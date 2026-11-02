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
    if (str.endsWith('ms')) {
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num / 1000;
    }
    if (str.endsWith('s')) {
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    }
    if (str.endsWith('m')) {
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num * 60;
    }
    if (str.endsWith('h')) {
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num * 3600;
    }
    if (str.endsWith('t')) {
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num / 10000000;
    }

    // Format: HH:MM:SS:FF or HH:MM:SS;FF or HH:MM:SS.mmm or MM:SS.mmm
    const parts = str.replace(',', '.').replace(';', ':').split(':');
    if (parts.length === 4) {
      const h = parseFloat(parts[0]) || 0;
      const m = parseFloat(parts[1]) || 0;
      const s = parseFloat(parts[2]) || 0;
      const f = parseFloat(parts[3]) || 0;
      return h * 3600 + m * 60 + s + (f / 25);
    } else if (parts.length === 3) {
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
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseWebVTT(text) {
    const cues = [];
    if (!text || typeof text !== 'string') return cues;
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

    // Match <p ...>Text</p> or <tt:p ...>Text</tt:p>
    const pRegex = /<(?:[a-zA-Z0-9]+:)?p\b([^>]*)>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?p>/gi;
    let match;
    while ((match = pRegex.exec(text)) !== null) {
      const attrs = match[1];
      const rawText = match[2];

      const beginMatch = attrs.match(/\bbegin=["']([^"']+)["']/i);
      if (!beginMatch) continue;

      const endMatch = attrs.match(/\bend=["']([^"']+)["']/i);
      const durMatch = attrs.match(/\bdur=["']([^"']+)["']/i);

      const start = parseTimeSeconds(beginMatch[1]);
      let end = endMatch ? parseTimeSeconds(endMatch[1]) : (durMatch ? start + parseTimeSeconds(durMatch[1]) : start + 3.5);
      const cueText = cleanSubtitleText(rawText);
      if (cueText && cueText.length >= 2) {
        cues.push({ start, end, text: cueText });
      }
    }

    // Some TTML files embed timed spans inside paragraphs
    if (cues.length === 0) {
      const spanRegex = /<(?:[a-zA-Z0-9]+:)?span\b([^>]*)>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?span>/gi;
      while ((match = spanRegex.exec(text)) !== null) {
        const attrs = match[1];
        const rawText = match[2];

        const beginMatch = attrs.match(/\bbegin=["']([^"']+)["']/i);
        if (!beginMatch) continue;

        const endMatch = attrs.match(/\bend=["']([^"']+)["']/i);
        const durMatch = attrs.match(/\bdur=["']([^"']+)["']/i);

        const start = parseTimeSeconds(beginMatch[1]);
        let end = endMatch ? parseTimeSeconds(endMatch[1]) : (durMatch ? start + parseTimeSeconds(durMatch[1]) : start + 3.5);
        const cueText = cleanSubtitleText(rawText);
        if (cueText && cueText.length >= 2) {
          cues.push({ start, end, text: cueText });
        }
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
    // Strict URL-based Turkish detection (must be explicit language parameter or specific filename)
    if (
      urlLower.includes('lang=tr') ||
      urlLower.includes('language=tr') ||
      urlLower.includes('language=turkish') ||
      urlLower.includes('srclang=tr') ||
      urlLower.includes('.tur.vtt') ||
      urlLower.includes('_tur.vtt') ||
      urlLower.includes('-tur.vtt') ||
      urlLower.includes('_tr.vtt') ||
      urlLower.includes('-tr.vtt')
    ) {
      return 'tr';
    }
    // Content-based language detection (TTML/VTT root header only)
    if (text && typeof text === 'string') {
      const head = text.slice(0, 1000).toLowerCase();
      if (
        head.includes('xml:lang="tr') ||
        head.includes("xml:lang='tr") ||
        head.includes('lang="tr') ||
        head.includes("lang='tr") ||
        head.includes('language: tr')
      ) {
        return 'tr';
      }
    }
    // Default to source English track so cues are always available for pre-warming and A/D navigation
    return 'en';
  }

  function processSubtitlePayload(url, rawContent, hintLang = null) {
    if (!rawContent) return;
    try {
      let cues = [];
      const isString = typeof rawContent === 'string';

      if (isString && rawContent.includes('WEBVTT')) {
        cues = parseWebVTT(rawContent);
      } else if (isString && (rawContent.includes('<tt') || rawContent.includes('<p begin=') || rawContent.includes(':p begin=') || rawContent.includes('<p ') || rawContent.includes('<span begin='))) {
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
        const lang = hintLang || detectLanguage(url, isString ? rawContent : '');
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

  let lastFetchedTrSubtitleUrl = '';

  function inspectManifestJson(obj) {
    if (!obj || typeof obj !== 'object') return;
    const candidates = [];

    function walk(o, depth) {
      if (!o || depth > 6) return;
      if (Array.isArray(o)) {
        for (const item of o) {
          if (item && typeof item === 'object') {
            const u = item.url || item.subtitleUrl || item.timedTextUrl || item.href || item.src;
            const l = item.languageCode || item.lang || item.displayName || item.language || item.label || item.trackId;
            if (u && typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/'))) {
              candidates.push({ url: u, lang: String(l || '') });
            }
          }
          walk(item, depth + 1);
        }
      } else if (typeof o === 'object') {
        for (const k of Object.keys(o)) {
          walk(o[k], depth + 1);
        }
      }
    }

    try { walk(obj, 0); } catch {}

    for (const c of candidates) {
      const l = c.lang.toLowerCase();
      const isTr = l.includes('tr') || l.includes('turk') || l.includes('türk');
      if (isTr) {
        let fullUrl = c.url;
        if (fullUrl.startsWith('/')) {
          try { fullUrl = new URL(fullUrl, window.location.origin).href; } catch {}
        }
        if (fullUrl === lastFetchedTrSubtitleUrl) continue;
        lastFetchedTrSubtitleUrl = fullUrl;

        fetch(fullUrl)
          .then(r => r.text())
          .then(text => {
            if (text && text.length > 50) {
              processSubtitlePayload(fullUrl, text, 'tr');
            }
          })
          .catch(() => {});
        break; // Found the primary Turkish subtitle track
      }
    }
  }

  function isManifestUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const u = url.toLowerCase();
    return (
      u.includes('getplaybackresources') ||
      u.includes('playbackresources') ||
      u.includes('/playback/manifest') ||
      u.includes('licenseandplaybackmetadata') ||
      (u.includes('primevideo.com') && (u.includes('playback') || u.includes('metadata'))) ||
      (u.includes('amazon.com') && (u.includes('playback') || u.includes('metadata')))
    );
  }

  function isSubtitleUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const u = url.toLowerCase();

    // Exclude video/audio media chunks (unless clearly subtitle/timedtext related)
    if (
      (u.includes('.mp4') || u.includes('.ts') || u.includes('.m4a') || u.includes('.m4v') || u.includes('.webm')) &&
      !u.includes('sub') && !u.includes('caption') && !u.includes('text')
    ) {
      return false;
    }

    return (
      u.includes('.vtt') ||
      u.includes('.ttml') ||
      u.includes('.dfxp') ||
      u.includes('.srt') ||
      u.includes('timedtext') ||
      u.includes('/subtitles') ||
      u.includes('/captions') ||
      u.includes('/subtitle') ||
      u.includes('/caption') ||
      u.includes('tracktype=subtitles') ||
      u.includes('format=ttml') ||
      u.includes('format=vtt') ||
      u.includes('format=dfxp') ||
      u.includes('pv-cdn.net') ||
      u.includes('aiv-cdn.net') ||
      u.includes('atv-ext') ||
      (u.includes('amazon.com') && (u.includes('subtitle') || u.includes('caption') || u.includes('timedtext') || u.includes('dfxp') || u.includes('text') || u.includes('subs'))) ||
      (u.includes('nflxvideo.net') && (u.includes('?o=') || u.includes('xml') || u.includes('vtt'))) ||
      u.includes('youtube.com/api/timedtext') ||
      (u.includes('googlevideo.com') && u.includes('subtitle')) ||
      (u.includes('dplus') && u.includes('subtitle')) ||
      (u.includes('disneyplus') && u.includes('subtitle')) ||
      (u.includes('hbomax') && u.includes('subtitle')) ||
      (u.includes('max.com') && u.includes('subtitle'))
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
          clone.text().then(text => {
            if (text) processSubtitlePayload(url, text);
          }).catch(() => {});
        } else if (isManifestUrl(url)) {
          const clone = res.clone();
          clone.json().then(obj => {
            if (obj) inspectManifestJson(obj);
          }).catch(() => {});
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
          if (this._ydhUrl) {
            if (isSubtitleUrl(this._ydhUrl)) {
              const rType = this.responseType;
              if (!rType || rType === 'text') {
                if (typeof this.responseText === 'string' && this.responseText) {
                  processSubtitlePayload(this._ydhUrl, this.responseText);
                }
              } else if (rType === 'arraybuffer' && this.response) {
                const text = new TextDecoder('utf-8').decode(this.response);
                if (text) processSubtitlePayload(this._ydhUrl, text);
              } else if (rType === 'blob' && this.response instanceof Blob) {
                this.response.text().then(text => {
                  if (text) processSubtitlePayload(this._ydhUrl, text);
                }).catch(() => {});
              } else if (typeof this.response === 'string' && this.response) {
                processSubtitlePayload(this._ydhUrl, this.response);
              }
            } else if (isManifestUrl(this._ydhUrl)) {
              try {
                const text = typeof this.responseText === 'string' ? this.responseText : (typeof this.response === 'string' ? this.response : '');
                if (text) {
                  const obj = JSON.parse(text);
                  inspectManifestJson(obj);
                }
              } catch {}
            }
          }
        } catch {}
      });
      return origSend.apply(this, arguments);
    };
  }

  // Listen for direct cue load requests from content.js
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data.from === 'ydh_content' && e.data.action === 'parse_direct') {
      if (e.data.url && e.data.content) {
        processSubtitlePayload(e.data.url, e.data.content);
      }
    }
  });

  // 3. Block Prime Video's default 'A' (Audio & Subtitles tray) shortcut in MAIN world
  function isInputActive(target) {
    const activeEl = document.activeElement;
    const t = target || activeEl;
    if (!t) return false;
    const tag = (t.tagName || '').toUpperCase();
    const activeTag = (activeEl?.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return true;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeEl?.isContentEditable) return true;
    if (t.closest?.('input, textarea, [contenteditable="true"], [role="textbox"], [role="searchbox"], #ydh-tooltip')) return true;
    if (activeEl?.closest?.('input, textarea, [contenteditable="true"], [role="textbox"], [role="searchbox"], #ydh-tooltip')) return true;
    return false;
  }

  let lastInterceptionPostTime = 0;

  function handleNavKeyInMainWorld(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (isInputActive(e.target || document.activeElement)) return;

    let key = (e.key || '').toLowerCase();
    if (!key) {
      if (e.code === 'KeyA') key = 'a';
      else if (e.code === 'KeyD') key = 'd';
      else if (e.code === 'KeyS') key = 's';
    }

    if (key === 'a' || key === 'd' || key === 's') {
      const hasVideo = document.querySelector('video') || document.getElementById('movie_player')?.querySelector('video');
      if (hasVideo) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Forward to content.js on keydown so it executes the jump!
        if (e.type === 'keydown') {
          const now = Date.now();
          if (now - lastInterceptionPostTime > 80) {
            lastInterceptionPostTime = now;
            window.postMessage({ from: 'ydh_interceptor', action: 'nav_key', key }, '*');
          }
        }
      }
    }
  }

  window.addEventListener('keydown', handleNavKeyInMainWorld, true);
  window.addEventListener('keypress', handleNavKeyInMainWorld, true);
  window.addEventListener('keyup', handleNavKeyInMainWorld, true);
})();
