import { getSession, checkDuplicate, saveWord } from './lib/supabase.js';
import { fetchWordData } from './lib/api.js';

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
    try {
      // Inject script to get selection text if not triggered via context menu
      const [{ result: selectedText }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection().toString()
      });

      if (selectedText && selectedText.trim().length > 0) {
        await processAndSaveWord(selectedText, tab.id, tab.url);
      } else {
        notify(tab.id, "Önce kaydedilecek bir kelime seçmelisin! ❌");
      }
    } catch (err) {
      console.error("Failed to get selection:", err);
    }
  }
});

// ── Message Listener (from popup or content) ──────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "manual_save") {
    // Fire and forget, or handle async response
    processAndSaveWord(message.word, null, null)
      .then(result => sendResponse({ success: true, result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
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
      phonetic: data.phonetic,
      source_url: url || null,
      difficulty: 'unrated'
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
