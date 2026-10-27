/**
 * YOKDILHUNTER Content Script
 * Shows a translation tooltip or directly saves when the user selects or Alt-clicks
 * an English word/phrase anywhere on the web (including YouTube, Prime Video, Netflix, etc.)
 */

let tooltip = null;
let currentWord = '';
let activeSaveMode = 'ai';
let activeSubtitleMode = 'hover'; // 'hover' | 'dual' | 'off'

// Initialize translation & subtitle mode from storage
if (typeof chrome !== 'undefined' && chrome.storage?.local) {
  chrome.storage.local.get(['translation_mode', 'subtitle_mode'], (data) => {
    if (data?.translation_mode) activeSaveMode = data.translation_mode;
    activeSubtitleMode = data?.subtitle_mode || 'hover';
    handleSubtitleModeChange();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.translation_mode) activeSaveMode = changes.translation_mode.newValue || 'ai';
      if (changes.subtitle_mode) {
        activeSubtitleMode = changes.subtitle_mode.newValue || 'hover';
        handleSubtitleModeChange();
      }
    }
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

// ── Helper: Detect if an element is a Player Control, Menu, or Settings UI ────
function isPlayerControlOrUI(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;

  // Never match our own tooltip, toast, or subtitle bar
  if (el.id === 'ydh-tooltip' || el.closest?.('#ydh-tooltip') ||
      el.id === 'ydh-notification-toast' ||
      el.id === 'ydh-sub-translation-bar' ||
      el.closest?.('#ydh-sub-translation-bar')) {
    return false;
  }

  // Never match actual subtitles!
  if (el.closest?.(`
    .atvwebplayersdk-captions-overlay,
    .timedTextOutput,
    .timedTextBackground,
    [class*="timedText"],
    [class*="captions-overlay"],
    .player-timedtext,
    .player-timedtext-text-container,
    .ytp-caption-window-bottom,
    .caption-window,
    .ytp-caption-segment,
    .dss-subtitle-renderer-line,
    .vjs-text-track-cue,
    .vjs-text-track-display
  `)) {
    return false;
  }

  // Interactive HTML elements & ARIA widgets
  if (el.closest?.('button, a, input, select, textarea, [role="button"], [role="menu"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"], [role="tab"], [role="tablist"], [role="dialog"], [role="slider"], [role="toolbar"], [role="listbox"]')) {
    return true;
  }

  // Specific player controls, settings dropdowns, audio/subtitle pickers
  if (el.closest?.(`
    [class*="control"],
    [class*="settings"],
    [class*="setting"],
    [class*="menu"],
    [class*="panel"],
    [class*="picker"],
    [class*="dropdown"],
    [class*="popup"],
    [class*="flyout"],
    [class*="tray"],
    [class*="scrubber"],
    [class*="progressbar"],
    [class*="bottompanel"],
    .ytp-chrome-bottom,
    .ytp-chrome-top,
    .ytp-settings-menu,
    .ytp-panel,
    .ytp-popup,
    .ytp-menuitem,
    .atvwebplayersdk-controls-wrapper,
    .atvwebplayersdk-bottompanel-container,
    [data-uia*="control"],
    [data-uia*="menu"],
    [data-uia*="audio-subtitle"],
    [data-uia*="selector"]
  `)) {
    return true;
  }

  return false;
}

// ── Subtitle Candidate Selectors (Strict Subtitle Text Spans & Containers) ─────
const SUBTITLE_SELECTORS = [
  // Amazon Prime Video subtitle text containers & spans
  '.timedTextBackground span',
  '.timedTextOutput span',
  '.timedTextBackground',
  '.timedTextOutput',
  '.atvwebplayersdk-captions-overlay span',
  '.atvwebplayersdk-captions-overlay .timedTextOutput',
  // Netflix subtitle text containers
  '.player-timedtext-text-container span',
  '.player-timedtext-text-container',
  '.player-timedtext',
  // YouTube subtitle text segments
  '.ytp-caption-segment',
  // Disney+, Hulu, HBO Max
  '.dss-subtitle-renderer-line',
  // Video.js text track cues & generic
  '.vjs-text-track-display .vjs-text-track-cue',
  '.vjs-text-track-cue'
];

// Full subtitle cue containers for dual & hover subtitle sentence detection
const SUBTITLE_CONTAINER_SELECTORS = [
  // Amazon Prime Video (Target ONLY the actual cue text boxes, NOT the fullscreen wrapper)
  '.atvwebplayersdk-captions-overlay .timedTextOutput',
  '.atvwebplayersdk-captions-overlay .timedTextBackground',
  '.timedTextOutput',
  '.timedTextBackground',
  '[class*="timedTextOutput"]',
  '[class*="timedTextBackground"]',
  // YouTube
  '.ytp-caption-window-bottom',
  '.caption-window',
  '.ytp-caption-segment',
  // Netflix
  '.player-timedtext-text-container',
  // Disney+, Hulu, HBO Max
  '.dss-subtitle-renderer-line',
  // Generic HTML5 / Video.js
  '.vjs-text-track-display .vjs-text-track-cue',
  '.vjs-text-track-cue',
  '[class*="captions-text"]'
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
  // If pointer is over ANY player control or settings menu, ABORT immediately!
  if (document.elementsFromPoint) {
    const topElements = document.elementsFromPoint(x, y);
    for (const el of topElements) {
      if (isPlayerControlOrUI(el)) return null;
    }
  }

  const video = findAssociatedVideo(x, y);

  // Strategy 1: Check known subtitle/caption elements
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
        if (!el || isPlayerControlOrUI(el)) continue;
        const rect = el.getBoundingClientRect();
        if (x >= rect.left - 8 && x <= rect.right + 8 && y >= rect.top - 8 && y <= rect.bottom + 8) {
          const match = findWordInElementAt(el, x, y);
          if (match) return { ...match, isSubtitle: true, video };
        }
      }
    } catch {}
  }

  // Strategy 2: Penetrate transparent video overlay shields
  if (document.elementsFromPoint) {
    const elements = document.elementsFromPoint(x, y);
    for (const el of elements) {
      if (!el || el.tagName === 'HTML' || el.tagName === 'BODY' || el.tagName === 'VIDEO') continue;
      if (isPlayerControlOrUI(el)) return null;
      if (el.id === 'ydh-tooltip' || el.closest?.('#ydh-tooltip') || el.id === 'ydh-notification-toast' || el.id === 'ydh-sub-translation-bar') continue;

      const isSubEl = el.matches?.(SUBTITLE_SELECTORS.join(',')) || el.closest?.(SUBTITLE_SELECTORS.join(','));
      if (isSubEl) {
        const match = findWordInElementAt(el, x, y);
        if (match) return { ...match, isSubtitle: true, video };
      }
    }
  }

  return null;
}

// ── General Word Extractor At Point (x, y) ──────────────────────────────────
function extractWordAtPoint(x, y) {
  // If player control or settings menu, ignore
  if (document.elementsFromPoint) {
    const topElements = document.elementsFromPoint(x, y);
    for (const el of topElements) {
      if (isPlayerControlOrUI(el)) return null;
    }
  }

  // Try subtitle extraction first
  const subMatch = extractSubtitleWordAtPoint(x, y);
  if (subMatch) return subMatch;

  // Next, elementsFromPoint for any text
  if (document.elementsFromPoint) {
    const elements = document.elementsFromPoint(x, y);
    for (const el of elements) {
      if (!el || el.tagName === 'HTML' || el.tagName === 'BODY' || el.tagName === 'VIDEO') continue;
      if (isPlayerControlOrUI(el)) continue;
      if (el.id === 'ydh-tooltip' || el.closest?.('#ydh-tooltip') || el.id === 'ydh-notification-toast' || el.id === 'ydh-sub-translation-bar') continue;
      const match = findWordInElementAt(el, x, y);
      if (match) return match;
    }
  }

  // Fallback: standard caretRangeFromPoint for normal web pages/articles
  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y);
    if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
      if (isPlayerControlOrUI(range.startContainer.parentElement)) return null;
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

// ── Sentence Translation Cache & Fetcher ────────────────────────────────────
// ── Sentence Translation Cache & Fetcher ────────────────────────────────────
const sentenceCache = new Map();
const pendingTranslations = new Map();

function getSentenceTranslation(sentence) {
  if (!sentence) return Promise.resolve('');
  const trimmed = sentence.replace(/\s+/g, ' ').trim();
  if (sentenceCache.has(trimmed)) {
    return Promise.resolve(sentenceCache.get(trimmed));
  }
  if (pendingTranslations.has(trimmed)) {
    return pendingTranslations.get(trimmed);
  }

  const p = new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ action: 'translate_sentence', sentence: trimmed }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('translate_sentence runtime error:', chrome.runtime.lastError);
          resolve('');
          return;
        }
        const translation = (response?.translation || '').trim();
        if (translation) {
          if (sentenceCache.size > 500) {
            const firstKey = sentenceCache.keys().next().value;
            sentenceCache.delete(firstKey);
          }
          sentenceCache.set(trimmed, translation);
        }
        resolve(translation);
      });
    } catch (err) {
      console.warn('getSentenceTranslation exception:', err);
      resolve('');
    }
  }).finally(() => {
    pendingTranslations.delete(trimmed);
  });

  pendingTranslations.set(trimmed, p);
  return p;
}

// ── Subtitle Active Cue Detector (Prime Video, YouTube, Netflix, Disney+, HTML5) ──
function findActiveSubtitleCue() {
  const visibleCandidates = [];

  try {
    const elements = document.querySelectorAll(SUBTITLE_CONTAINER_SELECTORS.join(','));
    for (const el of elements) {
      if (!el || isPlayerControlOrUI(el)) continue;
      if (el.id === 'ydh-sub-translation-bar' || el.closest?.('#ydh-sub-translation-bar')) continue;
      if (el.id === 'ydh-tooltip' || el.closest?.('#ydh-tooltip')) continue;

      const rect = el.getBoundingClientRect();
      // Strict geometry sanity check: subtitle cues are never full-screen wrapper overlays!
      if (
        rect.width >= 15 &&
        rect.width <= window.innerWidth * 0.95 &&
        rect.height >= 8 &&
        rect.height <= 180 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight
      ) {
        const raw = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        // Must contain at least 2 chars, letters, and not be timecode like "01:23"
        if (raw.length >= 2 && /[a-zA-Z]/.test(raw) && !/^\d+:\d+/.test(raw)) {
          visibleCandidates.push({ el, text: raw, rect });
        }
      }
    }
  } catch {}

  // Fallback: check native HTML5 video text tracks
  if (visibleCandidates.length === 0) {
    try {
      const videos = document.querySelectorAll('video');
      for (const v of videos) {
        if (!v.paused && v.textTracks) {
          for (let i = 0; i < v.textTracks.length; i++) {
            const track = v.textTracks[i];
            if (track.mode === 'showing' && track.activeCues && track.activeCues.length > 0) {
              const cue = track.activeCues[0];
              const text = (cue.text || '').replace(/<[^>]+>/g, '').trim();
              if (text.length >= 2 && /[a-zA-Z]/.test(text)) {
                const vRect = v.getBoundingClientRect();
                return {
                  el: v,
                  text,
                  rect: {
                    top: vRect.bottom - 95,
                    bottom: vRect.bottom - 45,
                    left: vRect.left + vRect.width * 0.15,
                    right: vRect.left + vRect.width * 0.85,
                    width: vRect.width * 0.7,
                    height: 50
                  }
                };
              }
            }
          }
        }
      }
    } catch {}
    return null;
  }

  // Deduplicate nested elements and combine multi-line dialogue cues
  visibleCandidates.sort((a, b) => b.text.length - a.text.length);

  const uniqueLines = [];
  for (const item of visibleCandidates) {
    const isDup = uniqueLines.some(u => u.text.includes(item.text) || item.text.includes(u.text));
    if (!isDup) uniqueLines.push(item);
  }

  if (uniqueLines.length === 0) return null;

  // Sort top-to-bottom in reading order
  uniqueLines.sort((a, b) => a.rect.top - b.rect.top);

  const fullText = uniqueLines.map(u => u.text).join(' ');
  let minTop = uniqueLines[0].rect.top;
  let maxBottom = uniqueLines[0].rect.bottom;
  let minLeft = uniqueLines[0].rect.left;
  let maxRight = uniqueLines[0].rect.right;

  for (const u of uniqueLines) {
    minTop = Math.min(minTop, u.rect.top);
    maxBottom = Math.max(maxBottom, u.rect.bottom);
    minLeft = Math.min(minLeft, u.rect.left);
    maxRight = Math.max(maxRight, u.rect.right);
  }

  return {
    el: uniqueLines[0].el,
    text: fullText,
    rect: {
      top: minTop,
      bottom: maxBottom,
      left: minLeft,
      right: maxRight,
      width: maxRight - minLeft,
      height: maxBottom - minTop
    }
  };
}

// ── Subtitle Translation Bar Management ─────────────────────────────────────
let subBar = null;
let currentSubSentence = '';
let hoverHideTimeout = null;
let dualSubTimer = null;

function getSubBar() {
  const container = getAppRoot();
  let bar = document.getElementById('ydh-sub-translation-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'ydh-sub-translation-bar';
    bar.innerHTML = `<span class="ydh-sub-text"></span>`;
    container.appendChild(bar);
  } else if (bar.parentElement !== container) {
    container.appendChild(bar);
  }
  return bar;
}

function hideSubBar() {
  if (subBar) {
    subBar.classList.remove('ydh-sub-visible');
    currentSubSentence = '';
  }
}

function updateSubBarPosition(bar, anchorRect, container) {
  if (!bar || !anchorRect) return;

  const isBody = (container === document.body);
  const scrollX = isBody ? (window.scrollX || 0) : 0;
  const scrollY = isBody ? (window.scrollY || 0) : 0;
  const cRect = isBody ? { top: 0, left: 0 } : container.getBoundingClientRect();
  const cScrollTop = isBody ? 0 : container.scrollTop;
  const cScrollLeft = isBody ? 0 : container.scrollLeft;

  // Horizontally centered directly with the English subtitle line
  const left = anchorRect.left - cRect.left + scrollX + cScrollLeft + (anchorRect.width / 2);

  // Vertical placement: place below if room, flip directly above if near bottom edge
  const viewportHeight = window.innerHeight;
  const distFromBottom = viewportHeight - anchorRect.bottom;

  let top;
  let translateY = '0';
  if (distFromBottom < 75) {
    // Too close to viewport bottom: place cleanly above the English subtitle
    top = anchorRect.top - cRect.top + scrollY + cScrollTop - 10;
    translateY = '-100%';
  } else {
    // Standard: place directly below the English subtitle
    top = anchorRect.bottom - cRect.top + scrollY + cScrollTop + 8;
    translateY = '0';
  }

  // Safety clamp: top must NEVER push subtitle above the top of viewport!
  if (translateY === '-100%' && top < 45) {
    top = anchorRect.bottom - cRect.top + scrollY + cScrollTop + 8;
    translateY = '0';
  }

  Object.assign(bar.style, {
    position: 'absolute',
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    transform: `translate(-50%, ${translateY})`,
    zIndex: '2147483646',
  });
}

function showSubBar(sentence, anchorRect, isDual = false) {
  if (!sentence || activeSubtitleMode === 'off') {
    hideSubBar();
    return;
  }

  subBar = getSubBar();
  const textEl = subBar.querySelector('.ydh-sub-text');
  const container = getAppRoot();

  // If already displaying this exact sentence, just re-verify position
  if (currentSubSentence === sentence && subBar.classList.contains('ydh-sub-visible')) {
    updateSubBarPosition(subBar, anchorRect, container);
    return;
  }

  currentSubSentence = sentence;

  if (sentenceCache.has(sentence)) {
    textEl.textContent = sentenceCache.get(sentence);
    textEl.classList.remove('ydh-sub-loading');
    updateSubBarPosition(subBar, anchorRect, container);
    subBar.classList.add('ydh-sub-visible');
  } else {
    // Smooth transition: don't flash '...' box!
    // As soon as translation is ready, update text and position
    getSentenceTranslation(sentence).then((tr) => {
      if (currentSubSentence === sentence && subBar) {
        textEl.textContent = tr || sentence;
        textEl.classList.remove('ydh-sub-loading');
        updateSubBarPosition(subBar, anchorRect, container);
        subBar.classList.add('ydh-sub-visible');
      }
    });
  }
}

function handleSubtitleModeChange() {
  if (dualSubTimer) {
    clearInterval(dualSubTimer);
    dualSubTimer = null;
  }

  if (activeSubtitleMode === 'dual') {
    scanAndShowDualSubtitle();
    dualSubTimer = setInterval(scanAndShowDualSubtitle, 180);
  } else {
    hideSubBar();
  }
}

function scanAndShowDualSubtitle() {
  if (activeSubtitleMode !== 'dual') {
    if (dualSubTimer) {
      clearInterval(dualSubTimer);
      dualSubTimer = null;
    }
    return;
  }

  // Don't show if word translation tooltip is open
  if (tooltip && tooltip.classList.contains('ydh-visible')) {
    hideSubBar();
    return;
  }

  try {
    const sub = findActiveSubtitleCue();
    if (sub && sub.text) {
      showSubBar(sub.text, sub.rect, true);
    } else {
      hideSubBar();
    }
  } catch (err) {
    hideSubBar();
  }
}

// ── Hover Mode Mouse Listener ───────────────────────────────────────────────
window.addEventListener('mousemove', (e) => {
  if (activeSubtitleMode !== 'hover') return;

  // If hovering over player controls, settings menu, or our own tooltip, abort!
  if (isPlayerControlOrUI(e.target) || (tooltip && tooltip.classList.contains('ydh-visible'))) {
    hideSubBar();
    return;
  }

  // 1. Check if hovering over the active subtitle block
  const activeSub = findActiveSubtitleCue();
  if (activeSub) {
    const r = activeSub.rect;
    const isOverSub = (
      e.clientX >= r.left - 25 &&
      e.clientX <= r.right + 25 &&
      e.clientY >= r.top - 25 &&
      e.clientY <= r.bottom + 25
    );

    if (isOverSub) {
      if (hoverHideTimeout) {
        clearTimeout(hoverHideTimeout);
        hoverHideTimeout = null;
      }
      showSubBar(activeSub.text, activeSub.rect, false);
      return;
    }
  }

  // 2. Secondary fallback via point-based subtitle extraction
  const subData = extractSubtitleWordAtPoint(e.clientX, e.clientY);
  if (subData?.sentence) {
    if (hoverHideTimeout) {
      clearTimeout(hoverHideTimeout);
      hoverHideTimeout = null;
    }
    const anchorRect = subData.rect || {
      top: e.clientY - 15,
      bottom: e.clientY + 15,
      left: e.clientX - 20,
      right: e.clientX + 20,
      width: 40,
      height: 30
    };
    showSubBar(subData.sentence, anchorRect, false);
    return;
  }

  // If moved outside subtitle zone, gracefully hide after 350ms
  if (!hoverHideTimeout && subBar && subBar.classList.contains('ydh-sub-visible')) {
    hoverHideTimeout = setTimeout(() => {
      hideSubBar();
      hoverHideTimeout = null;
    }, 350);
  }
}, { passive: true });

// Fullscreen changes
document.addEventListener('fullscreenchange', () => {
  hideTooltip();
  hideSubBar();
  handleSubtitleModeChange();
});
document.addEventListener('webkitfullscreenchange', () => {
  hideTooltip();
  hideSubBar();
  handleSubtitleModeChange();
});

// ── Word Card Trigger Helper (Pauses Video & Opens Save Popup) ───────────────
function triggerWordCard(clientX, clientY) {
  const data = extractWordAtPoint(clientX, clientY);
  if (!data?.word) return false;

  window.getSelection()?.removeAllRanges();

  // Durdursun: pause video if playing
  const video = data.video || findAssociatedVideo(clientX, clientY);
  if (video && !video.paused) {
    try { video.pause(); } catch {}
  }

  const rect = data.rect || { top: clientY - 15, left: clientX - 20, width: 40, height: 30 };
  showTooltip(data.word, rect, data.sentence);
  return true;
}

// ── Scroll Wheel / Middle Click (Button 1): Pause & Open Save Card ──────────
// 1. Prevent browser autoscroll mode on mousedown
window.addEventListener('mousedown', (e) => {
  if (e.button === 1) { // Middle click / Scroll wheel click
    if (isPlayerControlOrUI(e.target)) return;
    const data = extractWordAtPoint(e.clientX, e.clientY);
    if (data?.word) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
}, true);

// 2. Open card on auxclick / mouseup with debounce
let lastMiddleClickTime = 0;
function handleMiddleClick(e) {
  if (e.button !== 1) return;
  if (tooltip && tooltip.contains(e.target)) return;
  if (isPlayerControlOrUI(e.target)) return;

  const now = Date.now();
  if (now - lastMiddleClickTime < 350) return;

  const handled = triggerWordCard(e.clientX, e.clientY);
  if (handled) {
    lastMiddleClickTime = now;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();
  }
}

window.addEventListener('auxclick', handleMiddleClick, true);
window.addEventListener('mouseup', (e) => {
  if (e.button === 1) handleMiddleClick(e);
}, true);

// ── Alt + Left Click (Button 0): Alternative for Trackpads / Laptops ─────────
window.addEventListener('click', (e) => {
  // If clicked inside our tooltip, let tooltip buttons handle it
  if (tooltip && tooltip.contains(e.target)) return;
  if (isPlayerControlOrUI(e.target)) return;

  if (e.altKey && !e.shiftKey && !e.ctrlKey && e.button === 0) {
    const handled = triggerWordCard(e.clientX, e.clientY);
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
    }
  }
}, true);

// ── Listen for Alt+RightClick (Direct Save) ──────────────────────────────────
window.addEventListener('contextmenu', (e) => {
  if (isPlayerControlOrUI(e.target)) return;
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
  hideSubBar();
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

    /* Only actual subtitle text spans are interactive with pointer cursor */
    .timedTextBackground span,
    .timedTextOutput span,
    .player-timedtext-text-container span,
    .ytp-caption-segment,
    .dss-subtitle-renderer-line {
      cursor: pointer !important;
      user-select: text !important;
      -webkit-user-select: text !important;
    }

    /* Subtitle Sentence Translation Bar (True Cinema Subtitle Style) */
    #ydh-sub-translation-bar {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      position: absolute;
      max-width: 90vw;
      text-align: center;
      opacity: 0;
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
      transition: opacity 0.15s ease-out;
      z-index: 2147483646;
    }
    #ydh-sub-translation-bar.ydh-sub-visible {
      opacity: 1;
    }
    .ydh-sub-text {
      display: inline-block;
      background: rgba(0, 0, 0, 0.82);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      color: #ffeb3b; /* Cinema Subtitle Yellow */
      font-family: 'YouTube Noto', Roboto, 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
      font-size: clamp(20px, 2.4vw, 30px);
      font-weight: 700;
      line-height: 1.35;
      padding: 5px 18px;
      border-radius: 6px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
      text-shadow:
        0 0 3px #000,
        0 0 6px #000,
        -1.5px -1.5px 0 #000,
         1.5px -1.5px 0 #000,
        -1.5px  1.5px 0 #000,
         1.5px  1.5px 0 #000;
      letter-spacing: 0.015em;
      text-align: center;
      max-width: 86vw;
      word-wrap: break-word;
    }
    .ydh-sub-text.ydh-sub-loading {
      color: #fde047;
      opacity: 0.85;
      font-style: italic;
      font-size: clamp(16px, 1.8vw, 22px);
      padding: 3px 14px;
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
