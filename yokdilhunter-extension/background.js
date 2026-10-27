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
    const selectedText = info.selectionText?.trim();
    if (selectedText) {
      let contextSentence = null;
      if (tab?.id && !tab.url?.startsWith('chrome://') && !tab.url?.startsWith('edge://')) {
        try {
          const res = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (word) => {
              const sel = window.getSelection();
              if (!sel || sel.rangeCount === 0) return null;
              const range = sel.getRangeAt(0);
              let node = range.commonAncestorContainer;
              while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;
              let el = node;
              while (el && el !== document.body && !/^(P|DIV|LI|ARTICLE|SECTION|H[1-6]|BLOCKQUOTE|TD|TH)$/i.test(el.tagName)) {
                if (el.parentNode) el = el.parentNode; else break;
              }
              const fullText = (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
              const idx = fullText.toLowerCase().indexOf(word.toLowerCase());
              if (idx === -1) return null;
              let start = idx;
              while (start > 0 && !/[.!?\n]/.test(fullText[start - 1])) start--;
              let end = idx + word.length;
              while (end < fullText.length) {
                if (/[.!?\n]/.test(fullText[end])) { end++; break; }
                end++;
              }
              const s = fullText.slice(start, end).replace(/^[^\w"'“‘«]+/, '').trim();
              return (s.length >= 10 && s.length <= 350) ? s : null;
            },
            args: [selectedText]
          });
          contextSentence = res?.[0]?.result ?? null;
        } catch { /* ignore */ }
      }
      await processAndSaveWord(selectedText, tab.id, tab.url, contextSentence);
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
      // Search ALL frames (iframes, shadow-dom hosts, etc.) for selected text and surrounding sentence
      const frames = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: () => {
          const sel = window.getSelection();
          const word = sel?.toString()?.trim() ?? '';
          if (!word || sel.rangeCount === 0) return null;
          const range = sel.getRangeAt(0);
          let node = range.commonAncestorContainer;
          while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;
          let el = node;
          while (el && el !== document.body && !/^(P|DIV|LI|ARTICLE|SECTION|H[1-6]|BLOCKQUOTE|TD|TH)$/i.test(el.tagName)) {
            if (el.parentNode) el = el.parentNode; else break;
          }
          const fullText = (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
          let sentence = null;
          const idx = fullText.toLowerCase().indexOf(word.toLowerCase());
          if (idx !== -1) {
            let start = idx;
            while (start > 0 && !/[.!?\n]/.test(fullText[start - 1])) start--;
            let end = idx + word.length;
            while (end < fullText.length) {
              if (/[.!?\n]/.test(fullText[end])) { end++; break; }
              end++;
            }
            const s = fullText.slice(start, end).replace(/^[^\w"'“‘«]+/, '').trim();
            if (s.length >= 10 && s.length <= 350) sentence = s;
          }
          return { word, sentence };
        }
      });

      const match = frames.map(f => f.result).find(r => r && r.word && r.word.length > 0);

      if (match) {
        await processAndSaveWord(match.word, tab.id, tab.url, match.sentence);
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
    (async () => {
      // Content script manages its own direct toast feedback
      // Only notify active tab if request came from popup
      let notifyTabId = null;
      let tabUrl = sender.tab?.url ?? null;
      if (!sender.tab?.id) {
        try {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab?.id && !activeTab.url?.startsWith('chrome://') && !activeTab.url?.startsWith('edge://')) {
            notifyTabId = activeTab.id;
            tabUrl = activeTab.url;
          }
        } catch { }
      }
      try {
        const result = await processAndSaveWord(message.word, notifyTabId, tabUrl, message.context_sentence, message.mode);
        sendResponse({ success: true, result });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.action === "translate") {
    // Fast path: just fetch the Turkish translation (skips phonetics, English definitions, etc)
    fetchTranslation(message.word)
      .then(translation => sendResponse({ translation }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.action === "translate_sentence") {
    fetchSentenceTranslation(message.sentence)
      .then(translation => sendResponse({ translation }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
});

// ── Fast Multi-Provider Sentence Translation Engine ────────────────────────
async function fetchSentenceTranslation(sentence) {
  if (!sentence || typeof sentence !== 'string') return '';
  const trimmed = sentence.trim();
  if (!trimmed) return '';

  // 1. Google Translate (Official Chrome Extension Client)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=auto&tl=tr&dt=t&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.[0])) {
        const text = data[0].map(s => s?.[0]).filter(Boolean).join('');
        if (text && text.trim()) return text.trim();
      }
    }
  } catch (err) {
    console.warn("dict-chrome-ex translation failed, trying fallback:", err);
  }

  // 2. Google Translate (gtx client fallback)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=tr&dt=t&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.[0])) {
        const text = data[0].map(s => s?.[0]).filter(Boolean).join('');
        if (text && text.trim()) return text.trim();
      }
    }
  } catch (err) {
    console.warn("gtx translation failed, trying clients5 fallback:", err);
  }

  // 3. clients5 Google API fallback (ultra-fast compact payload)
  try {
    const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=tr&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.[0]) {
        const text = String(data[0][0]).trim();
        if (text) return text;
      }
    }
  } catch (err) {
    console.warn("clients5 translation failed, trying mymemory fallback:", err);
  }

  // 4. MyMemory API fallback
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=en|tr`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data?.responseData?.translatedText) {
        const text = data.responseData.translatedText.trim();
        if (text && !text.includes('QUERY LENGTH LIMIT EXCEEDED')) return text;
      }
    }
  } catch (err) {
    console.warn("All translation engines failed for sentence:", err);
  }

  return '';
}


// ── Core Save Logic ─────────────────────────────────────────────────────────
async function processAndSaveWord(text, tabId, url, contextSentence = null, mode = null) {
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

    const duplicate = await checkDuplicate(word);
    if (duplicate?.isDuplicate) {
      if (duplicate.isExact) {
        throw new Error(`"${duplicate.existingWord}" zaten kütüphanende kayıtlı! 📚`);
      } else {
        throw new Error(`Bu kelimenin kök / çekim hali ("${duplicate.existingWord}") zaten kütüphanende kayıtlı! 📚`);
      }
    }

    // Fetch definitions, translations and example sentences (with mode if available)
    const data = await fetchWordData(word, null, mode);

    // Always use the AI-generated example sentence
    const finalExampleSentence = data.example_sentence;

    // Save to Supabase
    await saveWord({
      english_word: data.english_word,
      turkish_translation: data.turkish_translation,
      synonyms: data.synonyms,
      definition: data.definition,
      example_sentence: finalExampleSentence,
      phonetic: data.phonetic,
      source_url: url || null,
      difficulty: 'unrated',
      repetitions: 0,
      ease_factor: 2.5
    });

    if (tabId) notify(tabId, `"${data.english_word}" başarıyla kaydedildi! ✅`);
    return { ...data, example_sentence: finalExampleSentence };
  } catch (error) {
    if (tabId) notify(tabId, `${error.message}`);
    throw error;
  }
}

// ── Inject Notification via Content Script ────────────────────────────────────
async function notify(tabId, message) {
  if (!tabId) return;
  try {
    // Try clean direct message to active content script first
    await chrome.tabs.sendMessage(tabId, { action: 'show_toast', text: message });
  } catch {
    // Fallback if content script was not ready
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (msg) => {
          const existing = document.getElementById('ydh-notification-toast');
          if (existing) existing.remove();

          const toast = document.createElement('div');
          toast.id = 'ydh-notification-toast';
          toast.textContent = msg;
          Object.assign(toast.style, {
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#0F172A',
            border: '1px solid rgba(99, 102, 241, 0.45)',
            color: '#F8FAFC',
            padding: '12px 20px',
            borderRadius: '10px',
            fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.5), 0 0 15px rgba(99, 102, 241, 0.2)',
            zIndex: '2147483647',
            pointerEvents: 'none'
          });
          const container = document.fullscreenElement || document.webkitFullscreenElement || document.body;
          container.appendChild(toast);
          setTimeout(() => toast.remove(), 3500);
        },
        args: [message]
      });
    } catch (err) {
      console.error("Failed to inject notification:", err);
    }
  }
}
