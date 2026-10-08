import { getSession, checkDuplicate, saveWord } from './lib/supabase.js';
import { fetchWordData, fetchTranslation } from './lib/api.js';

// ── Service Worker Initialization ─────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  // Create Context Menu item
  chrome.contextMenus.create({
    id: "save-to-yokdilhunter",
    title: "📚 YOKDILHUNTER'a Kaydet",
    contexts: ["selection"]
  });
});

// ── Context Menu Click Handler ───────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "save-to-yokdilhunter") {
    const selectedText = info.selectionText;
    if (selectedText) {
      await processAndSaveWord(selectedText, tab.id, tab.url);
    }
  }
});

// ── Keyboard Command Handler ──────────────────────────────────────────────────
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === "save-word") {
    if (!tab?.id) return;

    // PDF / privileged pages block all script injection
    const isPdf = tab.url?.toLowerCase().endsWith('.pdf')
      || tab.url?.startsWith('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai')
      || tab.url?.startsWith('chrome://')
      || tab.url?.startsWith('edge://')
      || tab.url?.startsWith('about:');

    if (isPdf) {
      // Read clipboard via offscreen document (MV3 service workers can't access clipboard directly)
      const clipText = await readClipboardViaOffscreen();
      const word = validateClipboardWord(clipText);

      if (!word) {
        chrome.notifications.create('pdf-hint', {
          type: 'basic',
          iconUrl: '../icons/icon-192.png',
          title: 'YOKDILHUNTER',
          message: 'PDF\'de kelimeyi Ctrl+C ile kopyala, sonra Ctrl+Shift+S yap. ℹ️',
        });
        return;
      }

      // Save — no tabId (can't inject toast into PDF), use notification instead
      try {
        await processAndSaveWord(word, null, tab.url);
        chrome.notifications.create('pdf-saved', {
          type: 'basic',
          iconUrl: '../icons/icon-192.png',
          title: 'YOKDILHUNTER ✅',
          message: `"${word}" kaydedildi!`,
        });
      } catch (err) {
        chrome.notifications.create('pdf-error', {
          type: 'basic',
          iconUrl: '../icons/icon-192.png',
          title: 'YOKDILHUNTER ❌',
          message: err.message,
        });
      }
      return;
    }

    try {
      // Search ALL frames (iframes, shadow-dom hosts, etc.) for selected text
      const frames = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: () => window.getSelection()?.toString()?.trim() ?? ''
      });

      // Pick the first non-empty result across all frames
      const selectedText = frames.map(f => f.result).find(r => r && r.length > 0) ?? '';

      if (selectedText.length > 0) {
        await processAndSaveWord(selectedText, tab.id, tab.url);
      } else {
        notify(tab.id, "Önce kaydedilecek bir kelime seçmelisin! ❌");
      }
    } catch (err) {
      console.error("Failed to get selection:", err);
      notify(tab.id, "Seçim alınamadı — kelimeyi sağ tıkla ile kaydet. ❌");
    }
  }
});

// ── Clipboard via Offscreen Document (MV3) ────────────────────────────────────
async function readClipboardViaOffscreen() {
  try {
    const existing = await chrome.offscreen.hasDocument();
    if (!existing) {
      await chrome.offscreen.createDocument({
        url: chrome.runtime.getURL('offscreen.html'),
        reasons: ['CLIPBOARD'],
        justification: 'Read clipboard text to save selected word from PDF',
      });
    }
    return await chrome.runtime.sendMessage({ action: 'read-clipboard' })
      .then(r => r?.text ?? '');
  } catch (e) {
    console.error('Offscreen clipboard read failed:', e);
    return '';
  }
}

// ── Validate clipboard text as a saveable word ────────────────────────────────
// Accept 1-4 word phrases made of letters (no SQL, numbers, special chars)
function validateClipboardWord(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/);
  if (words.length < 1 || words.length > 4) return null;
  if (trimmed.length > 60) return null;
  // Must contain only letters, hyphens, apostrophes (no SQL, numbers, symbols)
  if (!/^[a-zA-ZğüşıöçĞÜŞİÖÇ\-'\s]+$/.test(trimmed)) return null;
  return trimmed;
}

// ── Message Listener (from popup or content) ──────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "manual_save") {
    processAndSaveWord(message.word, null, null)
      .then(result => sendResponse({ success: true, result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === "translate") {
    // Fast path: just fetch the Turkish translation (skips phonetics, English definitions, etc)
    fetchTranslation(message.word)
      .then(translation => sendResponse({ translation }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
});


// ── Core Save Logic ─────────────────────────────────────────────────────────
async function processAndSaveWord(text, tabId, url) {
  const word = text.trim().toLowerCase();
  
  if (word.split(' ').length > 4) {
    if (tabId) notify(tabId, "Lütfen en fazla 4 kelimelik bir öbek seç! ❌");
    throw new Error("Çok uzun kelime seçimi");
  }

  // Show loading notification
  if (tabId) notify(tabId, `"${word}" kaydediliyor... ⏳`);

  try {
    const session = await getSession();
    if (!session) {
      throw new Error("Lütfen eklentiye giriş yap! 🔒");
    }

    const isDuplicate = await checkDuplicate(word);
    if (isDuplicate) {
      throw new Error(`"${word}" zaten kütüphanende! 📚`);
    }

    // Fetch definitions and translations
    const data = await fetchWordData(word);

    // Save to Supabase
    await saveWord({
      english_word: data.english_word,
      turkish_translation: data.turkish_translation,
      synonyms: data.synonyms,
      definition: data.definition,
      example_sentence: data.example_sentence,
      phonetic: data.phonetic,
      source_url: url || null,
      difficulty: 'unrated',
      repetitions: 0,
      ease_factor: 2.5
    });

    if (tabId) notify(tabId, `"${data.english_word}" başarıyla kaydedildi! ✅`);
    return data;
  } catch (error) {
    if (tabId) notify(tabId, `${error.message}`);
    throw error;
  }
}

// ── Inject Notification via Content Script ────────────────────────────────────
async function notify(tabId, message) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (msg) => {
        // Simple vanilla JS toast notification injected into the page
        const toast = document.createElement('div');
        toast.textContent = msg;
        Object.assign(toast.style, {
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: '#1E293B', // Tailwind slate-800
          color: '#F8FAFC', // slate-50
          padding: '12px 20px',
          borderRadius: '8px',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          zIndex: '2147483647',
          transition: 'all 0.3s ease',
          opacity: '0',
          transform: 'translateY(10px)'
        });
        document.body.appendChild(toast);
        
        // Animate in
        requestAnimationFrame(() => {
          toast.style.opacity = '1';
          toast.style.transform = 'translateY(0)';
        });

        // Animate out after 3.5s
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(10px)';
          setTimeout(() => toast.remove(), 300);
        }, 3500);
      },
      args: [message]
    });
  } catch (err) {
    console.error("Failed to inject notification:", err);
  }
}
