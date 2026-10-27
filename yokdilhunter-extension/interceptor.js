/**
 * YOKDILHUNTER Subtitle & Caption Interceptor (Runs in page MAIN world)
 * Intercepts network requests (fetch / XHR) for subtitle files (WebVTT, TTML/DFXP, YouTube timedtext)
 * so that all dialogue cues can be pre-warmed & translated ahead of time (0ms latency).
 */
(function() {
  if (window.__ydh_interceptor_loaded) return;
  window.__ydh_interceptor_loaded = true;

  function parseTimeSeconds(timeStr) {
    if (!timeStr) return 0;
    const str = String(timeStr).trim();
    if (str.endsWith('s')) {
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    }
    // Format: HH:MM:SS.mmm or MM:SS.mmm or HH:MM:SS:FF
    const parts = str.replace(',', '.').split(':');
    if (parts.length === 3) {
      const h = parseFloat(parts[0]) || 0;
      const m = parseFloat(parts[1]) || 0;
      const s = parseFloat(parts[2]) || 0;
      return h * 3600 + m * 60 + s;
    } else if (parts.length === 2) {
      const m = parseFloat(parts[0]) || 0;
      const s = parseFloat(parts[1]) || 0;
      return m * 60 + s;
    }
    const direct = parseFloat(str);
    return isNaN(direct) ? 0 : direct;
  }

  function cleanSubtitleText(raw) {
    if (!raw) return '';
    return raw
      .replace(/<br\s*[\/]?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseWebVTT(text) {
    const cues = [];
    if (!text || typeof text !== 'string') return cues;
    // Split by double newline
    const blocks = text.split(/\r?\n\r?\n/);
    const timeRegex = /((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})/;

    for (const block of blocks) {
      const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(timeRegex);
        if (match) {
          const start = parseTimeSeconds(match[1]);
          const end = parseTimeSeconds(match[2]);
          const cueText = cleanSubtitleText(lines.slice(i + 1).join(' '));
          if (cueText && cueText.length >= 2 && !/^\d+$/.test(cueText)) {
            cues.push({ start, end, text: cueText });
          }
          break;
        }
      }
    }
    return cues;
  }

  function parseTTML(text) {
    const cues = [];
    if (!text || typeof text !== 'string') return cues;
    // Match <p ... begin="..." end="...">Text</p>
    const pRegex = /<p\b[^>]*?\bbegin=["']([^"']+)["'][^>]*?(?:\bend=["']([^"']+)["']|\bdur=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/p>/gi;
    let match;
    while ((match = pRegex.exec(text)) !== null) {
      const beginStr = match[1];
      const endStr = match[2];
      const durStr = match[3];
      const rawText = match[4];

      const start = parseTimeSeconds(beginStr);
      let end = endStr ? parseTimeSeconds(endStr) : (durStr ? start + parseTimeSeconds(durStr) : start + 4);
      const cueText = cleanSubtitleText(rawText);
      if (cueText && cueText.length >= 2) {
        cues.push({ start, end, text: cueText });
      }
    }
    return cues;
  }

  function parseYouTubeJson(data) {
    const cues = [];
    if (!data || !Array.isArray(data.events)) return cues;
    for (const ev of data.events) {
      if (!ev.segs || ev.segs.length === 0) continue;
      const start = (ev.tStartMs || 0) / 1000;
      const end = start + ((ev.dDurationMs || 3000) / 1000);
      const raw = ev.segs.map(s => s.utf8 || '').join('');
      const cueText = cleanSubtitleText(raw);
      if (cueText && cueText.length >= 2 && cueText !== '\n') {
        cues.push({ start, end, text: cueText });
      }
    }
    return cues;
  }

  function parseYouTubeXml(text) {
    const cues = [];
    if (!text || typeof text !== 'string') return cues;
    const textRegex = /<text\b[^>]*?\bstart=["']([^"']+)["'][^>]*?(?:\bdur=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/text>/gi;
    let match;
    while ((match = textRegex.exec(text)) !== null) {
      const start = parseFloat(match[1]) || 0;
      const dur = parseFloat(match[2]) || 3;
      const cueText = cleanSubtitleText(match[3]);
      if (cueText && cueText.length >= 2) {
        cues.push({ start, end: start + dur, text: cueText });
      }
    }
    return cues;
  }

  function detectLanguage(url, text) {
    const urlLower = (url || '').toLowerCase();
    if (urlLower.includes('lang=tr') || urlLower.includes('language=tr') || urlLower.includes('/tr/') || urlLower.includes('turkish') || urlLower.includes('tur.vtt') || urlLower.includes('tr-tr')) {
      return 'tr';
    }
    if (text && typeof text === 'string') {
      const head = text.slice(0, 500).toLowerCase();
      if (head.includes('xml:lang="tr"') || head.includes('lang="tr"')) return 'tr';
      if (head.includes('xml:lang="en"') || head.includes('lang="en"')) return 'en';
    }
    if (urlLower.includes('lang=en') || urlLower.includes('language=en') || urlLower.includes('/en/') || urlLower.includes('english') || urlLower.includes('eng.vtt') || urlLower.includes('en-us') || urlLower.includes('en-gb')) {
      return 'en';
    }
    return 'unknown';
  }

  function processSubtitlePayload(url, rawContent) {
    if (!rawContent) return;
    try {
      let cues = [];
      const isString = typeof rawContent === 'string';

      if (isString && rawContent.includes('WEBVTT')) {
        cues = parseWebVTT(rawContent);
      } else if (isString && (rawContent.includes('<tt') || rawContent.includes('<p begin='))) {
        cues = parseTTML(rawContent);
      } else if (isString && rawContent.includes('<transcript>')) {
        cues = parseYouTubeXml(rawContent);
      } else if (isString && rawContent.startsWith('{') && rawContent.includes('"events"')) {
        try {
          const parsed = JSON.parse(rawContent);
          cues = parseYouTubeJson(parsed);
        } catch {}
      } else if (typeof rawContent === 'object' && Array.isArray(rawContent.events)) {
        cues = parseYouTubeJson(rawContent);
      }

      if (cues && cues.length > 0) {
        const lang = detectLanguage(url, isString ? rawContent : '');
        // Sort cues chronologically
        cues.sort((a, b) => a.start - b.start);

        window.postMessage({
          from: 'ydh_interceptor',
          action: 'cues_loaded',
          lang: lang,
          url: url,
          cues: cues
        }, '*');
      }
    } catch (e) {
      // Non-fatal
    }
  }

  function isSubtitleUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const u = url.toLowerCase();
    return (
      u.includes('.vtt') ||
      u.includes('.ttml') ||
      u.includes('.dfxp') ||
      u.includes('timedtext') ||
      u.includes('/subtitles') ||
      u.includes('/captions') ||
      u.includes('atv-ext') ||
      u.includes('pv-cdn') ||
      u.includes('nflxvideo.net') && (u.includes('?o=') || u.includes('xml')) ||
      u.includes('youtube.com/api/timedtext')
    );
  }

  // 1. Hook window.fetch
  if (typeof window.fetch === 'function') {
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
      const res = await origFetch.apply(this, args);
      try {
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        if (isSubtitleUrl(url)) {
          const clone = res.clone();
          clone.text().then(text => processSubtitlePayload(url, text)).catch(() => {});
        }
      } catch {}
      return res;
    };
  }

  // 2. Hook XMLHttpRequest
  if (typeof window.XMLHttpRequest === 'function') {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
      this._ydhUrl = url;
      return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function() {
      this.addEventListener('load', function() {
        try {
          if (this._ydhUrl && isSubtitleUrl(this._ydhUrl) && typeof this.responseText === 'string') {
            processSubtitlePayload(this._ydhUrl, this.responseText);
          }
        } catch {}
      });
      return origSend.apply(this, arguments);
    };
  }

  // 3. Block Prime Video's default 'A' (Audio & Subtitles tray) shortcut in MAIN world
  function isInputActive(target) {
    if (!target) return false;
    const tag = (target.tagName || '').toUpperCase();
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      target.isContentEditable ||
      target.closest?.('input, textarea, [contenteditable="true"], [role="textbox"], [role="searchbox"]')
    );
  }

  function handleNavKeyInMainWorld(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (isInputActive(e.target || document.activeElement)) return;

    const key = (e.key || '').toLowerCase();
    if (key === 'a' || key === 'd' || key === 's') {
      const hasVideo = document.querySelector('video');
      if (hasVideo) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }
  }

  window.addEventListener('keydown', handleNavKeyInMainWorld, true);
  window.addEventListener('keypress', handleNavKeyInMainWorld, true);
  window.addEventListener('keyup', handleNavKeyInMainWorld, true);
  document.addEventListener('keydown', handleNavKeyInMainWorld, true);
  document.addEventListener('keypress', handleNavKeyInMainWorld, true);
  document.addEventListener('keyup', handleNavKeyInMainWorld, true);
})();
