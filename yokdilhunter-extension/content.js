/**
 * YOKDILHUNTER Content Script
 * Shows a translation tooltip or directly saves when the user selects or Alt-clicks
 * an English word/phrase anywhere on the web (including YouTube, Prime Video, Netflix, etc.)
 */

let tooltip = null;
let currentWord = '';
let activeSaveMode = 'ai';

// Initialize translation mode from storage
if (typeof chrome !== 'undefined' && chrome.storage?.local) {
  chrome.storage.local.get(['translation_mode'], (data) => {
    if (data?.translation_mode) activeSaveMode = data.translation_mode;
  });
}

// ── Fullscreen & Container Helper ──────────────────────────────────────────
function getAppRoot() {
  return document.fullscreenElement ||
         document.webkitFullscreenElement ||
         document.mozFullScreenElement ||
         document.msFullscreenElement ||
         document.body;
}

// ── Subtitle Candidate Selectors ────────────────────────────────────────────
const SUBTITLE_SELECTORS = [
  // Amazon Prime Video
  '.timedTextBackground',
  '.timedTextOutput',
  '[class*="timedText"]',
  '[class*="timed-text"]',
  '.atvwebplayersdk-captions-overlay',
  '.atvwebplayersdk-captions-overlay *',
  '[class*="captions-overlay"]',
  // Netflix
  '.player-timedtext',
  '.player-timedtext-text-container',
  '[data-uia*="timed-text"]',
  // YouTube
  '.ytp-caption-segment',
  '.caption-window',
  '.ytp-caption-window-bottom',
  // Disney+, Hulu, HBO Max / Max, Apple TV
  '.dss-subtitle-renderer-line',
  '[class*="subtitle-renderer"]',
  '[class*="Subtitle"]',
  '[class*="subtitle"]',
  '[class*="Caption"]',
  '[class*="caption"]',
  // Video.js, HTML5 cues, media players
  '.vjs-text-track-display',
  '[aria-label*="subtitles" i]',
  '[aria-label*="captions" i]'
];

// ── Helper: Extract surrounding sentence around range or text ───────────────
function extractSentenceAroundRange(range, word) {
  if (!range) return null;
  try {
    let node = range.commonAncestorContainer;
    while (node && node.nodeType !== Node.ELEMENT_NODE) {
      node = node.parentNode;
    }
    let el = node;
    while (el && el !== document.body && !/^(P|DIV|LI|ARTICLE|SECTION|H[1-6]|BLOCKQUOTE|TD|TH)$/i.test(el.tagName)) {
      if (el.parentNode) el = el.parentNode;
      else break;
    }
    const fullText = (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
    if (!fullText) return null;
    return extractSentenceFromText(fullText, word);
  } catch {
    return null;
  }
}

function extractSentenceFromText(fullText, word) {
  if (!fullText || !word) return null;
  const idx = fullText.toLowerCase().indexOf(word.toLowerCase());
  if (idx === -1) return null;

  const honorifics = /^(mr|mrs|ms|dr|prof|vs|etc|eg|ie)\.?$/i;
  let start = idx;
  while (start > 0) {
    const prev = fullText[start - 1];
    if (/[.!?\n]/.test(prev)) {
      const beforeDot = fullText.slice(0, start - 1).trim().split(/\s+/).pop();
      if (!honorifics.test(beforeDot)) {
        break;
      }
    }
    start--;
  }

  let end = idx + word.length;
  while (end < fullText.length) {
    const char = fullText[end];
    if (/[.!?\n]/.test(char)) {
      const beforeDot = fullText.slice(idx, end).trim().split(/\s+/).pop();
      if (!honorifics.test(beforeDot)) {
        end++;
        break;
      }
    }
    end++;
  }

  let sentence = fullText.slice(start, end).trim();
  sentence = sentence.replace(/^[^\w"'“‘«]+/, '').trim();
  if (sentence.length >= 10 && sentence.length <= 350) {
    return sentence;
  }
  return null;
}

// ── Helper: Find word and its bounding rect in an element at point (x, y) ──
function findWordInElementAt(el, x, y) {
  if (!el) return null;

  const textNodes = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
  let n;
  while ((n = walker.nextNode())) {
    if (n.nodeValue && n.nodeValue.trim().length > 0) {
      textNodes.push(n);
    }
  }
  if (textNodes.length === 0) return null;

  const wordRegex = /[a-zA-Z0-9'-]+/g;
  const range = document.createRange();

  for (const textNode of textNodes) {
    const text = textNode.nodeValue;
    wordRegex.lastIndex = 0;
    let m;
    while ((m = wordRegex.exec(text)) !== null) {
      const rawWord = m[0];
      const cleanWord = rawWord.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '');
      if (cleanWord.length < 2 || cleanWord.length > 60 || !/^[a-zA-Z\s\-']+$/.test(cleanWord)) {
        continue;
      }

      try {
        range.setStart(textNode, m.index);
        range.setEnd(textNode, m.index + m[0].length);
        const rect = range.getBoundingClientRect();

        // 6px hit padding for easy and forgiving clicking on moving subtitles
        if (x >= rect.left - 6 && x <= rect.right + 6 && y >= rect.top - 6 && y <= rect.bottom + 6) {
          const container = el.closest?.(
            '.timedTextOutput, .timedTextBackground, [class*="timedText"], .atvwebplayersdk-captions-overlay, .player-timedtext, .ytp-caption-window-bottom, [class*="caption"], [class*="subtitle"]'
          ) || el;
          const fullText = (container.innerText || container.textContent || '').replace(/\s+/g, ' ').trim();
          const sentence = extractSentenceAroundRange(range, cleanWord) ||
                           extractSentenceFromText(fullText, cleanWord) ||
                           (fullText.length >= 5 && fullText.length <= 350 ? fullText : null);

          return {
            word: cleanWord,
            sentence,
            rect: {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height
            }
          };
        }
      } catch (err) {}
    }
  }
  return null;
}

// ── Video Helper: Find Active / Overlapping Video ───────────────────────────
function findAssociatedVideo(x, y) {
  const videos = document.querySelectorAll('video');
  for (const v of videos) {
    const r = v.getBoundingClientRect();
    if (x >= r.left - 20 && x <= r.right + 20 && y >= r.top - 20 && y <= r.bottom + 20) {
      return v;
    }
  }
  for (const v of videos) {
    if (!v.paused) return v;
  }
  return videos[0] || null;
}

function isElementOverVideo(el, video) {
  if (!video || !el) return false;
  const vRect = video.getBoundingClientRect();
  const eRect = el.getBoundingClientRect();
  return (
    eRect.left >= vRect.left - 30 &&
    eRect.right <= vRect.right + 30 &&
    eRect.top >= vRect.top - 30 &&
    eRect.bottom <= vRect.bottom + 30
  );
}

// ── Subtitle-Specific Word Extractor ────────────────────────────────────────
function extractSubtitleWordAtPoint(x, y) {
  const video = findAssociatedVideo(x, y);

  // Strategy 1: Check known subtitle/caption elements across streaming platforms
  const searchRoots = [document];
  try {
    const allCustom = document.querySelectorAll('*');
    for (let i = 0; i < allCustom.length; i++) {
      if (allCustom[i].shadowRoot) searchRoots.push(allCustom[i].shadowRoot);
    }
  } catch {}

  for (const root of searchRoots) {
    try {
      const candidates = root.querySelectorAll(SUBTITLE_SELECTORS.join(','));
      for (const el of candidates) {
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (x >= rect.left - 12 && x <= rect.right + 12 && y >= rect.top - 12 && y <= rect.bottom + 12) {
          const match = findWordInElementAt(el, x, y);
          if (match) return { ...match, isSubtitle: true, video };
        }
      }
    } catch {}
  }

  // Strategy 2: Penetrate transparent overlays using document.elementsFromPoint(x, y)
  if (document.elementsFromPoint) {
    const elements = document.elementsFromPoint(x, y);
    for (const el of elements) {
      if (!el || el.tagName === 'HTML' || el.tagName === 'BODY' || el.tagName === 'VIDEO') continue;
      if (el.id === 'ydh-tooltip' || el.closest?.('#ydh-tooltip') || el.id === 'ydh-notification-toast') continue;

      const isSubEl = el.matches?.(SUBTITLE_SELECTORS.join(',')) ||
                      el.closest?.(SUBTITLE_SELECTORS.join(',')) ||
                      (video && isElementOverVideo(el, video));
      if (isSubEl) {
        const match = findWordInElementAt(el, x, y);
        if (match) return { ...match, isSubtitle: true, video };
      }
    }
  }

  // Strategy 3: Elements overlapping any active <video>
  if (video) {
    const parent = video.parentElement;
    if (parent) {
      const textNodes = parent.querySelectorAll('span, div, p');
      for (const el of textNodes) {
        if (el.tagName === 'VIDEO' || el.id === 'ydh-tooltip' || el.closest?.('#ydh-tooltip')) continue;
        const rect = el.getBoundingClientRect();
        if (x >= rect.left - 6 && x <= rect.right + 6 && y >= rect.top - 6 && y <= rect.bottom + 6) {
          const match = findWordInElementAt(el, x, y);
          if (match) return { ...match, isSubtitle: true, video };
        }
      }
    }
  }

  return null;
}

// ── General Word Extractor At Point (x, y) ──────────────────────────────────
function extractWordAtPoint(x, y) {
  // Try subtitle extraction first
  const subMatch = extractSubtitleWordAtPoint(x, y);
  if (subMatch) return subMatch;

  // Next, elementsFromPoint for any text
  if (document.elementsFromPoint) {
    const elements = document.elementsFromPoint(x, y);
    for (const el of elements) {
      if (!el || el.tagName === 'HTML' || el.tagName === 'BODY' || el.tagName === 'VIDEO') continue;
      if (el.id === 'ydh-tooltip' || el.closest?.('#ydh-tooltip') || el.id === 'ydh-notification-toast') continue;
      const match = findWordInElementAt(el, x, y);
      if (match) return match;
    }
  }

  // Fallback: standard caretRangeFromPoint for normal web pages/articles
  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y);
    if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
      const text = range.startContainer.nodeValue;
      let start = range.startOffset;
      let end = start;

      while (start > 0 && /[a-zA-Z'-]/.test(text[start - 1])) start--;
      while (end < text.length && /[a-zA-Z'-]/.test(text[end])) end++;

      const extracted = text.slice(start, end).trim();
      const word = extracted.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '');

      if (word && word.length >= 2 && word.length <= 60 && /^[a-zA-Z\s\-']+$/.test(word)) {
        const sentence = extractSentenceAroundRange(range, word);
        let rect = null;
        try {
          const r = document.createRange();
          r.setStart(range.startContainer, start);
          r.setEnd(range.startContainer, end);
          const b = r.getBoundingClientRect();
          rect = { top: b.top, left: b.left, width: b.width, height: b.height };
        } catch {
          rect = { top: y - 15, left: x - 20, width: 40, height: 30 };
        }
        return { word, sentence, rect };
      }
    }
  }

  return null;
}

// ── Alt-Key Held Feedback (Cursor & Interactivity) ───────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.key === 'Alt' || e.altKey) {
    document.documentElement.classList.add('ydh-alt-held');
  }
}, true);

window.addEventListener('keyup', (e) => {
  if (e.key === 'Alt' || !e.altKey) {
    document.documentElement.classList.remove('ydh-alt-held');
  }
}, true);

window.addEventListener('blur', () => {
  document.documentElement.classList.remove('ydh-alt-held');
});

// Fullscreen changes
document.addEventListener('fullscreenchange', () => { hideTooltip(); });
document.addEventListener('webkitfullscreenchange', () => { hideTooltip(); });

// ── Click Handler: Direct Click on Subtitles or Alt+Click Everywhere ───────
window.addEventListener('click', (e) => {
  // If clicked inside our tooltip, let tooltip buttons handle it
  if (tooltip && tooltip.contains(e.target)) return;

  // 1. DIRECT LEFT CLICK ON SUBTITLES (No Alt key needed!)
  if (!e.altKey && !e.shiftKey && !e.ctrlKey) {
    const subData = extractSubtitleWordAtPoint(e.clientX, e.clientY);
    if (subData?.word) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      window.getSelection()?.removeAllRanges();

      // Automatically pause video so the subtitle stays visible while reading definition!
      if (subData.video && !subData.video.paused) {
        try { subData.video.pause(); } catch {}
      }

      const rect = subData.rect || { top: e.clientY - 15, left: e.clientX - 20, width: 40, height: 30 };
      showTooltip(subData.word, rect, subData.sentence);
      return;
    }
  }

  // 2. Alt + Left Click anywhere on the web (articles, documents, normal paragraphs)
  if (e.altKey && !e.shiftKey && !e.ctrlKey) {
    const data = extractWordAtPoint(e.clientX, e.clientY);
    if (data?.word) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      window.getSelection()?.removeAllRanges();

      if (data.video && !data.video.paused) {
        try { data.video.pause(); } catch {}
      }

      const rect = data.rect || { top: e.clientY - 15, left: e.clientX - 20, width: 40, height: 30 };
      showTooltip(data.word, rect, data.sentence);
      return;
    }
  }
}, true);

// ── Listen for Alt+RightClick (Direct Save) ──────────────────────────────────
window.addEventListener('contextmenu', (e) => {
  if (e.altKey && !e.shiftKey && !e.ctrlKey) {
    const data = extractWordAtPoint(e.clientX, e.clientY);
    if (data?.word) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      window.getSelection()?.removeAllRanges();

      // Instant feedback toast right on screen
      showToast(`"${data.word}" kaydediliyor... ⏳`);

      chrome.runtime.sendMessage({
        action: 'manual_save',
        word: data.word,
        context_sentence: data.sentence,
        mode: activeSaveMode
      }, (response) => {
        if (chrome.runtime.lastError) {
          showToast(`❌ Hata: ${chrome.runtime.lastError.message}`);
          return;
        }
        if (response?.success) {
          const savedWord = response.result?.english_word || data.word;
          showToast(`"${savedWord}" başarıyla kaydedildi! ✅`);
        } else {
          showToast(response?.error ? `${response.error}` : '❌ Kayıt başarısız oldu');
        }
      });
    }
  }
}, true);

// ── Listen for text selection (Mouseup) ─────────────────────────────────────
document.addEventListener('mouseup', (e) => {
  if (tooltip && tooltip.contains(e.target)) return;

  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection?.toString()?.trim();

    if (!text || text === currentWord) return;

    // Only 1–4 English words
    const words = text.split(/\s+/);
    if (words.length < 1 || words.length > 4) { hideTooltip(); return; }
    if (text.length > 60) { hideTooltip(); return; }
    if (!/^[a-zA-Z\s\-']+$/.test(text)) { hideTooltip(); return; }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const sentence = extractSentenceAroundRange(range, text);
    showTooltip(text, rect, sentence);
  }, 120);
});

// Hide when clicking outside tooltip
document.addEventListener('mousedown', (e) => {
  if (tooltip && !tooltip.contains(e.target)) hideTooltip();
});

// Hide on scroll
document.addEventListener('scroll', hideTooltip, { passive: true });

// ── Show tooltip ───────────────────────────────────────────────────────────
function showTooltip(word, rect, contextSentence = null) {
  hideTooltip();
  injectStyles();
  currentWord = word;

  const container = getAppRoot();

  tooltip = document.createElement('div');
  tooltip.id = 'ydh-tooltip';
  tooltip.innerHTML = `
    <div class="ydh-word">${escHtml(word)}</div>
    <div class="ydh-translation ydh-loading">çeviriliyor...</div>
    <div class="ydh-mode-container">
      <span class="ydh-mode-label">Kayıt:</span>
      <div class="ydh-mode-pills">
        <button type="button" class="ydh-pill ${activeSaveMode === 'ai' ? 'ydh-pill-active' : ''}" data-mode="ai">✨ AI (4 Anlam)</button>
        <button type="button" class="ydh-pill ${activeSaveMode === 'classic' ? 'ydh-pill-active' : ''}" data-mode="classic">⚡ Klasik</button>
      </div>
    </div>
    <button class="ydh-save-btn" disabled>💾 Kaydet</button>
  `;

  // Handle mode pill switching
  const pills = tooltip.querySelectorAll('.ydh-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const mode = pill.getAttribute('data-mode');
      activeSaveMode = mode;
      pills.forEach(p => p.classList.remove('ydh-pill-active'));
      pill.classList.add('ydh-pill-active');
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ translation_mode: mode });
      }
    });
  });

  // Calculate coordinates relative to container (handles fullscreen and standard body)
  let top, left;
  if (container === document.body) {
    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    top = rect.top + scrollY - 10;
    left = rect.left + scrollX + rect.width / 2;
  } else {
    const cRect = container.getBoundingClientRect();
    top = rect.top - cRect.top + container.scrollTop - 10;
    left = rect.left - cRect.left + container.scrollLeft + rect.width / 2;
  }

  // Prevent overflowing above screen
  const isNearTop = rect.top < 100;
  if (isNearTop) {
    const bottomTop = top + (rect.height || 20) + 20;
    Object.assign(tooltip.style, {
      position: 'absolute',
      top: `${bottomTop}px`,
      left: `${left}px`,
      transform: 'translate(-50%, 0)',
      zIndex: '2147483647',
    });
    tooltip.classList.add('ydh-tooltip-bottom');
  } else {
    Object.assign(tooltip.style, {
      position: 'absolute',
      top: `${top}px`,
      left: `${left}px`,
      transform: 'translate(-50%, -100%)',
      zIndex: '2147483647',
    });
    tooltip.classList.remove('ydh-tooltip-bottom');
  }

  container.appendChild(tooltip);

  // Animate in
  requestAnimationFrame(() => tooltip?.classList.add('ydh-visible'));

  // Fetch fast translation from background
  chrome.runtime.sendMessage({ action: 'translate', word }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Translation error:', chrome.runtime.lastError);
      if (!tooltip) return;
      const transEl = tooltip.querySelector('.ydh-translation');
      transEl.textContent = 'Hata: ' + chrome.runtime.lastError.message;
      transEl.classList.remove('ydh-loading');
      transEl.classList.add('ydh-error');
      return;
    }

    if (!tooltip) return;
    const transEl = tooltip.querySelector('.ydh-translation');
    const saveBtn = tooltip.querySelector('.ydh-save-btn');

    if (response?.translation) {
      transEl.textContent = response.translation;
      transEl.classList.remove('ydh-loading');
      saveBtn.disabled = false;
      saveBtn.addEventListener('click', () => saveWord(word, saveBtn, contextSentence, activeSaveMode));
    } else {
      transEl.textContent = response?.error || 'çeviri bulunamadı';
      transEl.classList.remove('ydh-loading');
      transEl.classList.add('ydh-error');
    }
  });
}

// ── Bottom-Right Toast Notification ─────────────────────────────────────────
let toastTimer = null;
function showToast(message) {
  const container = getAppRoot();
  let toast = container.querySelector('#ydh-notification-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'ydh-notification-toast';
    container.appendChild(toast);
  }

  const isSuccess = message.includes('✅');
  const isError = message.includes('❌') || message.includes('zaten') || message.includes('Lütfen') || message.includes('Hata');

  let borderColor = 'rgba(99, 102, 241, 0.5)';
  if (isSuccess) borderColor = 'rgba(74, 222, 128, 0.6)';
  if (isError) borderColor = 'rgba(248, 113, 113, 0.6)';

  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    backgroundColor: '#0F172A',
    border: `1px solid ${borderColor}`,
    color: '#F8FAFC',
    padding: '12px 20px',
    borderRadius: '10px',
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    fontSize: '14px',
    fontWeight: '500',
    boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.6), 0 0 15px rgba(99, 102, 241, 0.2)',
    zIndex: '2147483647',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    opacity: '0',
    transform: 'translateY(12px)',
    pointerEvents: 'none'
  });

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    setTimeout(() => {
      toast?.remove();
    }, 300);
  }, 3500);
}

// Listen for toast messages from background (Ctrl+Shift+S or context menu)
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'show_toast') {
    showToast(message.text);
  }
});

// ── Save word ──────────────────────────────────────────────────────────────
function saveWord(word, btn, contextSentence = null, mode = 'ai') {
  hideTooltip();
  showToast(`"${word}" kaydediliyor... ⏳`);

  chrome.runtime.sendMessage({
    action: 'manual_save',
    word,
    context_sentence: contextSentence,
    mode: mode
  }, (response) => {
    if (chrome.runtime.lastError) {
      showToast(`❌ Hata: ${chrome.runtime.lastError.message}`);
      return;
    }
    if (response?.success) {
      const savedWord = response.result?.english_word || word;
      showToast(`"${savedWord}" başarıyla kaydedildi! ✅`);
    } else {
      showToast(response?.error ? `${response.error}` : '❌ Kayıt başarısız oldu');
    }
  });
}

// ── Hide tooltip ───────────────────────────────────────────────────────────
function hideTooltip() {
  if (!tooltip) return;
  tooltip.classList.remove('ydh-visible');
  setTimeout(() => {
    tooltip?.remove();
    tooltip = null;
    currentWord = '';
  }, 180);
}

// ── Inject styles ──────────────────────────────────────────────────────────
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected && document.getElementById('ydh-injected-styles')) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.id = 'ydh-injected-styles';
  style.textContent = `
    #ydh-tooltip {
      background: #0f172a;
      border: 1px solid rgba(99, 102, 241, 0.4);
      border-radius: 12px;
      padding: 10px 14px;
      min-width: 160px;
      max-width: 280px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.1);
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #f8fafc;
      opacity: 0;
      transform: translate(-50%, -100%) translateY(-4px);
      transition: opacity 0.18s ease, transform 0.18s ease;
      pointer-events: auto;
      user-select: none;
    }
    #ydh-tooltip.ydh-visible {
      opacity: 1;
      transform: translate(-50%, -100%) translateY(-8px);
    }
    #ydh-tooltip.ydh-tooltip-bottom.ydh-visible {
      transform: translate(-50%, 0) translateY(8px);
    }
    #ydh-tooltip::after {
      content: '';
      position: absolute;
      bottom: -5px;
      left: 50%;
      transform: translateX(-50%) rotate(45deg);
      width: 10px;
      height: 10px;
      background: #0f172a;
      border-right: 1px solid rgba(99,102,241,0.4);
      border-bottom: 1px solid rgba(99,102,241,0.4);
    }
    #ydh-tooltip.ydh-tooltip-bottom::after {
      bottom: auto;
      top: -5px;
      border-right: none;
      border-bottom: none;
      border-left: 1px solid rgba(99,102,241,0.4);
      border-top: 1px solid rgba(99,102,241,0.4);
    }
    .ydh-word {
      font-size: 13px;
      font-weight: 700;
      color: #a5b4fc;
      margin-bottom: 4px;
      letter-spacing: 0.01em;
    }
    .ydh-translation {
      font-size: 13px;
      color: #f1f5f9;
      margin-bottom: 8px;
      line-height: 1.4;
    }
    .ydh-loading { color: #64748b; font-style: italic; }
    .ydh-error   { color: #f87171; }
    .ydh-mode-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
      padding-top: 4px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }
    .ydh-mode-label {
      font-size: 10px;
      color: #94a3b8;
      font-weight: 600;
    }
    .ydh-mode-pills {
      display: flex;
      gap: 3px;
    }
    .ydh-pill {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 5px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.05);
      color: #94a3b8;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s ease;
    }
    .ydh-pill:hover {
      color: #f1f5f9;
      background: rgba(255, 255, 255, 0.1);
    }
    .ydh-pill-active {
      background: rgba(99, 102, 241, 0.3) !important;
      border-color: rgba(99, 102, 241, 0.6) !important;
      color: #c7d2fe !important;
      font-weight: 600;
    }
    .ydh-save-btn {
      width: 100%;
      padding: 5px 10px;
      border-radius: 7px;
      border: 1px solid rgba(99,102,241,0.35);
      background: rgba(99,102,241,0.15);
      color: #a5b4fc;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .ydh-save-btn:hover:not(:disabled) {
      background: rgba(99,102,241,0.3);
      color: #c7d2fe;
    }
    .ydh-save-btn:disabled { opacity: 0.5; cursor: default; }

    /* Video subtitles are always interactive and show pointer cursor on hover */
    .timedTextBackground,
    .timedTextOutput,
    [class*="timedText"],
    [class*="timed-text"],
    .atvwebplayersdk-captions-overlay,
    .atvwebplayersdk-captions-overlay *,
    .player-timedtext,
    .player-timedtext *,
    .ytp-caption-segment,
    [class*="subtitle"],
    [class*="caption"] {
      cursor: pointer !important;
      user-select: text !important;
      -webkit-user-select: text !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
}

// ── Escape HTML ────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Initialize styles on load
injectStyles();
