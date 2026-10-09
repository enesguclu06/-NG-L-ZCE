/**
 * YOKDILHUNTER Content Script
 * Shows a translation tooltip when the user selects an English word/phrase.
 */

let tooltip = null;
let currentWord = '';

// ── Listen for text selection ──────────────────────────────────────────────
document.addEventListener('mouseup', (e) => {
  // Don't trigger inside our own tooltip
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
    showTooltip(text, rect);
  }, 120);
});

// Hide when clicking outside tooltip
document.addEventListener('mousedown', (e) => {
  if (tooltip && !tooltip.contains(e.target)) hideTooltip();
});

// Hide on scroll
document.addEventListener('scroll', hideTooltip, { passive: true });

// ── Show tooltip ───────────────────────────────────────────────────────────
function showTooltip(word, rect) {
  hideTooltip();
  currentWord = word;

  tooltip = document.createElement('div');
  tooltip.id = 'ydh-tooltip';
  tooltip.innerHTML = `
    <div class="ydh-word">${escHtml(word)}</div>
    <div class="ydh-translation ydh-loading">çeviriliyor...</div>
    <button class="ydh-save-btn" disabled>💾 Kaydet</button>
  `;

  // Position above the selection
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const top = rect.top + scrollY - 8; // above the selection
  const left = rect.left + scrollX + rect.width / 2;

  Object.assign(tooltip.style, {
    position: 'absolute',
    top: `${top}px`,
    left: `${left}px`,
    transform: 'translate(-50%, -100%)',
    zIndex: '2147483647',
  });

  document.body.appendChild(tooltip);
  injectStyles();

  // Animate in
  requestAnimationFrame(() => tooltip.classList.add('ydh-visible'));

  // Fetch translation from background
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
      saveBtn.addEventListener('click', () => saveWord(word, saveBtn));
    } else {
      transEl.textContent = response?.error || 'çeviri bulunamadı';
      transEl.classList.remove('ydh-loading');
      transEl.classList.add('ydh-error');
    }
  });
}

// ── Save word ──────────────────────────────────────────────────────────────
function saveWord(word, btn) {
  btn.disabled = true;
  btn.textContent = '⏳ Kaydediliyor...';

  chrome.runtime.sendMessage({ action: 'manual_save', word }, (response) => {
    if (!tooltip) return;
    if (response?.success) {
      btn.textContent = '✅ Kaydedildi!';
      btn.style.background = 'rgba(74, 222, 128, 0.2)';
      btn.style.color = '#4ade80';
      setTimeout(hideTooltip, 1200);
    } else {
      btn.textContent = '❌ ' + (response?.error || 'Hata');
      btn.style.color = '#f87171';
      btn.disabled = false;
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

// ── Inject styles (only once) ──────────────────────────────────────────────
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
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
  `;
  document.head.appendChild(style);
}

// ── Escape HTML ────────────────────────────────────────────────────────────
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
