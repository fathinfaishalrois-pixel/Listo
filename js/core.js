/* ==========================================================================
   LISTO. — core.js
   Shared foundation: storage, sound engine, router, color math, IndexedDB.
   Vanilla JS. No dependencies.
   ========================================================================== */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const raf = fn => requestAnimationFrame(fn);

  /* ---------------------------------------------------------------- storage
     Every read/write is guarded — missing or corrupted data never breaks UI. */
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : v;
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, String(value)); return true; }
      catch (e) { return false; }
    },
    getJSON(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        if (v === null) return fallback;
        const parsed = JSON.parse(v);
        return parsed === null || typeof parsed !== 'object' ? fallback : parsed;
      } catch (e) { return fallback; }
    },
    setJSON(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (e) { /* noop */ }
    }
  };

  /* ------------------------------------------------------------ sound engine
     Every sound is a short synthesized voice (Web Audio API). Nothing is
     created until a user gesture. Failures are swallowed so audio never
     breaks the application. Anti-overlap windows cap simultaneous voices. */
  const Sound = (() => {
    let ctx = null;
    let master = null;
    let enabled = store.get('listo-sound', 'on') !== 'off';
    let volume = clamp(parseFloat(store.get('listo-volume', '0.35')) || 0, 0, 1);
    let lastAt = 0;
    let voices = 0;

    const MIN_GAP = 24;          // global anti-overlap window
    const MAX_VOICES = 8;        // hard cap on simultaneous oscillators
    const MASTER_SCALE = 0.9;    // audible, but capped well below full scale
    const gaps = {
      tap: 45, nav: 55, select: 50, adjust: 70, copy: 60, error: 140,
      success: 180, modalOpen: 200, modalClose: 200, toggleOn: 160,
      toggleOff: 160, generate: 120, create: 120, remove: 160, lock: 90,
      zoom: 150, open: 200, close: 200
    };
    const lastBy = Object.create(null);

    function ensureContext() {
      if (ctx) return ctx;
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      try { ctx = new AudioCtor(); } catch (e) { return null; }
      master = ctx.createGain();
      master.gain.value = volume * MASTER_SCALE;
      master.connect(ctx.destination);
      return ctx;
    }

    function note(c, o) {
      const f = Math.max(24, o.f || 440);
      const to = Math.max(24, o.to || f);
      const d = o.d || 0.08;
      const at = c.currentTime + (o.at || 0);
      const osc = c.createOscillator();
      const gain = c.createGain();

      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(f, at);
      if (to !== f) osc.frequency.exponentialRampToValueAtTime(to, at + d);

      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, o.g || 0.12), at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + d);

      osc.connect(gain);
      gain.connect(master);
      osc.start(at);
      osc.stop(at + d + 0.03);
      voices += 1;
      osc.onended = () => {
        voices = Math.max(0, voices - 1);
        try { osc.disconnect(); gain.disconnect(); } catch (e) { /* noop */ }
      };
    }

    const recipes = {
      tap: c => note(c, { f: 540, to: 430, d: 0.06, g: 0.13 }),
      nav: c => { note(c, { f: 620, d: 0.05, g: 0.09 }); note(c, { f: 830, d: 0.07, g: 0.07, at: 0.05 }); },
      toggleOn: c => { note(c, { f: 440, to: 880, d: 0.16, g: 0.13 }); note(c, { f: 660, to: 1320, d: 0.1, type: 'triangle', g: 0.045, at: 0.02 }); },
      toggleOff: c => note(c, { f: 680, to: 300, d: 0.15, g: 0.11 }),
      select: c => note(c, { f: 720, to: 830, d: 0.06, type: 'triangle', g: 0.1 }),
      adjust: c => note(c, { f: 470, d: 0.04, g: 0.055 }),
      open: c => [523, 659, 784].forEach((f, i) => note(c, { f, d: 0.26, g: 0.075, at: i * 0.045 })),
      close: c => note(c, { f: 760, to: 350, d: 0.18, g: 0.09 }),
      success: c => [523, 659, 784, 1046].forEach((f, i) => note(c, { f, d: 0.18, g: 0.085, at: i * 0.07 })),
      error: c => { note(c, { f: 220, to: 165, d: 0.17, type: 'triangle', g: 0.11 }); note(c, { f: 150, to: 120, d: 0.2, g: 0.07, at: 0.03 }); },
      copy: c => note(c, { f: 900, to: 1200, d: 0.07, g: 0.09 }),
      generate: c => note(c, { f: 380, to: 920, d: 0.2, type: 'triangle', g: 0.1 }),
      create: c => { note(c, { f: 494, d: 0.08, g: 0.1 }); note(c, { f: 740, d: 0.12, type: 'triangle', g: 0.08, at: 0.06 }); },
      remove: c => { note(c, { f: 300, to: 140, d: 0.16, type: 'triangle', g: 0.1 }); note(c, { f: 150, to: 100, d: 0.12, g: 0.05, at: 0.05 }); },
      lock: c => note(c, { f: 1250, d: 0.035, type: 'square', g: 0.05 }),
      zoom: c => note(c, { f: 660, d: 0.03, g: 0.035 })
    };

    function play(name) {
      if (!enabled || volume <= 0) return;
      const now = performance.now();
      if (now - lastAt < MIN_GAP) return;
      if (voices >= MAX_VOICES) return;
      const gap = gaps[name];
      if (gap && now - (lastBy[name] || 0) < gap) return;
      try {
        const c = ensureContext();
        if (!c) return;
        if (c.state === 'suspended') c.resume().catch(() => {});
        (recipes[name] || recipes.tap)(c);
        lastAt = now;
        lastBy[name] = now;
      } catch (e) { /* audio must never break the application */ }
    }

    function setEnabled(value) {
      enabled = !!value;
      store.set('listo-sound', enabled ? 'on' : 'off');
    }
    function setVolume(value) {
      volume = clamp(value, 0, 1);
      store.set('listo-volume', volume.toFixed(2));
      try {
        if (master && ctx) master.gain.setTargetAtTime(volume * MASTER_SCALE, ctx.currentTime, 0.02);
      } catch (e) { /* noop */ }
    }

    return {
      play, setEnabled, setVolume,
      get enabled() { return enabled; },
      get volume() { return volume; }
    };
  })();

  /* ------------------------------------------------------------------- toast */
  let toastTimer;
  function toast(message, type = 'info') {
    const toastEl = $('#toast');
    const toastText = $('#toastText');
    if (!toastEl || !toastText) return;
    toastText.textContent = message;
    toastEl.className = 'toast show ' + (type === 'success' || type === 'error' ? type : 'info');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }

  function copyText(text, okMessage, failMessage) {
    const success = () => { toast(okMessage || 'Copied', 'success'); Sound.play('copy'); };
    const failure = () => { toast(failMessage || 'Clipboard is not available', 'error'); Sound.play('error'); };
    const legacy = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? success() : failure();
      } catch (e) { failure(); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(success).catch(legacy);
    } else {
      legacy();
    }
  }

  function download(name, content, type) {
    try {
      const blob = content instanceof Blob ? content : new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1200);
      return true;
    } catch (e) {
      toast('Export failed — download is not available', 'error');
      Sound.play('error');
      return false;
    }
  }

  /* ---------------------------------------------------------------- projects
     Lightweight local project history, shown on the homepage. */
  const Projects = {
    list() {
      const items = store.getJSON('listo-projects', []);
      return Array.isArray(items) ? items : [];
    },
    add(type, title, meta = {}) {
      try {
        const items = Projects.list();
        items.unshift({ id: uid(), type, title: String(title || 'Untitled').slice(0, 60), meta, ts: Date.now() });
        store.setJSON('listo-projects', items.slice(0, 12));
        document.dispatchEvent(new CustomEvent('listo:projects'));
      } catch (e) { /* storage may be blocked */ }
    },
    remove(id) {
      store.setJSON('listo-projects', Projects.list().filter(p => p.id !== id));
      document.dispatchEvent(new CustomEvent('listo:projects'));
    }
  };

  /* -------------------------------------------------------------- IDB helper
     Small IndexedDB wrapper for reference images (blobs). Falls back to an
     in-memory map when IndexedDB is unavailable; the app keeps working. */
  const IDB = (() => {
    const DB = 'listo-files';
    const STORE = 'images';
    let dbPromise = null;
    const memory = new Map();

    function open() {
      if (dbPromise) return dbPromise;
      if (!('indexedDB' in window)) { dbPromise = Promise.resolve(null); return dbPromise; }
      dbPromise = new Promise(resolve => {
        let req;
        try { req = indexedDB.open(DB, 1); }
        catch (e) { resolve(null); return; }
        req.onupgradeneeded = () => {
          try { req.result.createObjectStore(STORE, { keyPath: 'id' }); } catch (e) { /* noop */ }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      });
      return dbPromise;
    }

    function tx(mode, fn) {
      return open().then(db => new Promise((resolve, reject) => {
        if (!db) { reject(new Error('no-idb')); return; }
        try {
          const t = db.transaction(STORE, mode);
          const s = t.objectStore(STORE);
          const out = fn(s);
          t.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
          t.onerror = () => reject(t.error || new Error('idb-error'));
          t.onabort = () => reject(t.error || new Error('idb-abort'));
        } catch (e) { reject(e); }
      }));
    }

    return {
      async put(record) {
        try { await tx('readwrite', s => s.put(record)); memory.delete(record.id); return true; }
        catch (e) { memory.set(record.id, record); return false; }
      },
      async get(id) {
        try { return await tx('readonly', s => s.get(id)); }
        catch (e) { return memory.get(id) || null; }
      },
      async getMany(ids) {
        const out = [];
        for (const id of ids) { const r = await IDB.get(id); if (r) out.push(r); }
        return out;
      },
      async remove(id) {
        memory.delete(id);
        try { await tx('readwrite', s => s.delete(id)); return true; }
        catch (e) { return false; }
      }
    };
  })();

  /* --------------------------------------------------------------- color math
     Deterministic conversions and generation. No random recommendations. */
  const Color = (() => {
    const c255 = v => clamp(Math.round(v), 0, 255);
    const hexToRgb = hex => {
      const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
      if (!m) return null;
      const n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const rgbToHex = (r, g, b) => '#' + [r, g, b].map(c255).map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();

    function rgbToHsv(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      let h = 0;
      if (d) {
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
      }
      return [h, max ? d / max * 100 : 0, max * 100];
    }
    function hsvToRgb(h, s, v) {
      h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; v = clamp(v, 0, 100) / 100;
      const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
      let rgb;
      if (h < 60) rgb = [c, x, 0]; else if (h < 120) rgb = [x, c, 0];
      else if (h < 180) rgb = [0, c, x]; else if (h < 240) rgb = [0, x, c];
      else if (h < 300) rgb = [x, 0, c]; else rgb = [c, 0, x];
      return [(rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255];
    }
    function rgbToHsl(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
      }
      return [h, s * 100, l * 100];
    }
    function hslToRgb(h, s, l) {
      h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
      const a = s * Math.min(l, 1 - l);
      const f = n => {
        const k = (n + h / 30) % 12;
        return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      };
      return [f(0) * 255, f(8) * 255, f(4) * 255];
    }
    const hsvToHex = (h, s, v) => { const [r, g, b] = hsvToRgb(h, s, v); return rgbToHex(r, g, b); };
    const hexToHsv = hex => { const rgb = hexToRgb(hex); return rgb ? rgbToHsv(...rgb) : [0, 0, 0]; };
    const hexToHsl = hex => { const rgb = hexToRgb(hex); return rgb ? rgbToHsl(...rgb) : [0, 0, 0]; };
    const hslToHex = (h, s, l) => { const [r, g, b] = hslToRgb(h, s, l); return rgbToHex(r, g, b); };

    function rgbToCmyk(r, g, b) {
      const R = r / 255, G = g / 255, B = b / 255;
      const k = 1 - Math.max(R, G, B);
      if (k === 1) return [0, 0, 0, 100];
      return [(1 - R - k) / (1 - k), (1 - G - k) / (1 - k), (1 - B - k) / (1 - k), k].map(v => Math.round(v * 100));
    }

    function relLuminance(hex) {
      const rgb = hexToRgb(hex);
      if (!rgb) return 0;
      const lin = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    }
    const contrastRatio = (a, b) => {
      const l1 = relLuminance(a), l2 = relLuminance(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const readableOn = hex => contrastRatio(hex, '#FFFFFF') >= contrastRatio(hex, '#12142A') ? '#FFFFFF' : '#12142A';

    function temperature(hue) {
      if (hue < 70 || hue >= 330) return 'WARM';
      if (hue >= 170 && hue < 280) return 'COOL';
      return 'NEUTRAL';
    }

    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    function ratioText(w, h) {
      if (!w || !h) return '—';
      const g = gcd(Math.round(w), Math.round(h)) || 1;
      let a = Math.round(w) / g, b = Math.round(h) / g;
      if (a > 40 || b > 40) return (w / h).toFixed(3) + ' : 1';
      return a + ':' + b;
    }

    /* Harmony: returns N core-relative hues in HSL space (deterministic). */
    function harmony(hsv, mode) {
      const [h, s, v] = hsv;
      const H = (x, ds = 0, dv = 0) => [((x % 360) + 360) % 360, clamp(s + ds, 12, 100), clamp(v + dv, 14, 96)];
      switch (mode) {
        case 'Complementary':
          return [H(h), H(h + 180), H(h - 14), H(h + 194), H(h + 166)];
        case 'Triadic':
          return [H(h), H(h + 120), H(h + 240), H(h + 12), H(h + 132)];
        case 'Tetradic':
          return [H(h), H(h + 60), H(h + 180), H(h + 240), H(h + 30)];
        case 'Split Complementary':
          return [H(h), H(h + 150), H(h + 210), H(h - 12), H(h + 162)];
        case 'Square':
          return [H(h), H(h + 90), H(h + 180), H(h + 270), H(h + 45)];
        case 'Monochromatic': {
          const [, ss] = hsv;
          return [
            hsvToHex(h, clamp(ss, 20, 90), clamp(v - 26, 12, 90)),
            hsvToHex(h, clamp(ss - 8, 20, 90), clamp(v - 12, 14, 92)),
            hsvToHex(h, ss, v),
            hsvToHex(h, clamp(ss + 6, 20, 96), clamp(v + 12, 20, 94)),
            hsvToHex(h, clamp(ss + 2, 20, 92), clamp(v + 24, 24, 96))
          ].map(hex => hexToHsv(hex));
        }
        default: // Analogous
          return [H(h - 32), H(h - 16), H(h), H(h + 16), H(h + 32)];
      }
    }
    function harmonyHexes(hsv, mode) {
      return harmony(hsv, mode).map(x => hsvToHex(...x));
    }

    /* Variations transform the whole palette (locked slots are kept). */
    function varyHex(hex, kind) {
      const [h, s, v] = hexToHsv(hex);
      const [hh, ss, ll] = hexToHsl(hex);
      switch (kind) {
        case 'lighter': return hslToHex(hh, ss, clamp(ll + 12, 6, 94));
        case 'darker': return hslToHex(hh, ss, clamp(ll - 12, 6, 94));
        case 'warmer': {
          const nh = h < 180 ? h - 12 : 300;
          return hsvToHex(h < 180 ? nh : nh, clamp(s + 4, 10, 100), clamp(v + 3, 14, 96));
        }
        case 'cooler': {
          const nh = h < 180 ? h + 18 : 220;
          return hsvToHex(nh, clamp(s - 2, 10, 100), clamp(v - 2, 14, 96));
        }
        case 'muted': return hsvToHex(h, clamp(s - 24, 6, 100), clamp(v + 4, 16, 92));
        case 'vibrant': return hsvToHex(h, clamp(s + 22, 20, 100), clamp(v + 2, 20, 96));
        case 'contrast': {
          const target = ll < 50 ? Math.max(10, ll - 18) : Math.min(94, ll + 18);
          return hslToHex(hh, clamp(ss + 6, 10, 100), target);
        }
        case 'balanced': {
          const tL = clamp(ll, 32, 72), tS = clamp(ss, 38, 78);
          return hslToHex(hh, tS, (tL + 54) / 2);
        }
        default: return hex;
      }
    }

    /* Mood seeds — each mood reshapes the base hue deterministically. */
    const MOODS = {
      Warm:         { words: 'Sunlit · Spiced · Open',     hues: [28, 14, 42, 36, 8],  s: [82, 74, 68, 60, 52], l: [56, 64, 60, 72, 78] },
      Cool:         { words: 'Glacial · Calm · Deep',      hues: [198, 212, 190, 226, 204], s: [78, 66, 54, 72, 40], l: [52, 60, 66, 58, 82] },
      Pastel:       { words: 'Soft · Powdery · Airy',      hues: [340, 28, 190, 260, 150], s: [58, 52, 46, 50, 40], l: [84, 86, 84, 82, 88] },
      Muted:        { words: 'Faded · Quiet · Matte',      hues: [222, 26, 160, 250, 40], s: [26, 22, 20, 28, 16], l: [56, 62, 58, 48, 74] },
      Vibrant:      { words: 'Loud · Electric · Alive',    hues: [328, 260, 188, 42, 120], s: [92, 96, 94, 98, 88], l: [56, 60, 56, 62, 58] },
      Dark:         { words: 'Nocturne · Ink · Deep',      hues: [248, 262, 222, 288, 210], s: [52, 58, 44, 62, 34], l: [22, 16, 26, 20, 32] },
      Earthy:       { words: 'Grounded · Organic · Clay',  hues: [30, 18, 88, 12, 45], s: [42, 34, 30, 48, 26], l: [48, 60, 52, 34, 74] },
      'High Contrast': { words: 'Graphic · Bold · Sharp', hues: [226, 0, 226, 44, 200], s: [76, 0, 12, 92, 68], l: [16, 98, 62, 56, 88] }
    };
    function moodPalette(mood) {
      const m = MOODS[mood];
      if (!m) return null;
      return m.hues.map((h, i) => hslToHex(h, m.s[i], m.l[i]));
    }

    const mixHex = (a, b, t) => {
      const A = hexToRgb(a) || [0, 0, 0], B = hexToRgb(b) || [0, 0, 0];
      return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
    };

    const gradientCss = (colors, angle) =>
      'linear-gradient(' + angle + 'deg, ' + colors.join(', ') + ')';

    return {
      hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, rgbToHsl, hslToRgb,
      hsvToHex, hexToHsv, hexToHsl, hslToHex, rgbToCmyk,
      relLuminance, contrastRatio, readableOn, temperature, ratioText,
      harmonyHexes, varyHex, moodPalette, MOODS, mixHex, gradientCss
    };
  })();

  /* ---------------------------------------------------------- project state
     One shared source of truth for the guided direction workflow, Color
     Explorer, Composition Studio, review and exports. Everything is local. */
  const Project = (() => {
    const KEY = 'listo-project';
    const SAVED = 'listo-project-saves';
    const PALETTE_FALLBACK = ['#101532', '#28306B', '#6D5CE8', '#9277F2', '#CDC5FF'];
    const hex = v => Color.hexToRgb(v) ? String(v).toUpperCase() : null;
    const deep = o => JSON.parse(JSON.stringify(o));
    const now = () => Date.now();

    function bootstrap() {
      const ex = store.getJSON('listo-explorer', {}) || {};
      const studio = store.getJSON('listo-studio', {}) || {};
      const bp = store.getJSON('listo-direction', {}) || {};
      const ab = Array.isArray(studio.artboards) && studio.artboards[0] ? studio.artboards[0] : null;
      const core = hex(ex.core) || '#6D5CE8';
      const harmony = typeof ex.harmony === 'string' ? ex.harmony : 'Analogous';
      return {
        version: 1, id: uid(), title: bp.title || 'Untitled Direction',
        mood: bp.mood || '', notes: bp.compositionNotes || '',
        color: {
          core, harmony,
          palette: Array.isArray(ex.palette) ? ex.palette : Color.harmonyHexes(Color.hexToHsv(core), harmony),
          locks: Array.isArray(ex.locks) ? ex.locks : [false, false, false, false, false],
          mood: 'Analogous'
        },
        composition: ab ? {
          artboardId: ab.id || null, name: ab.name || 'Direction Artboard',
          width: ab.w || 1080, height: ab.h || 1350, unit: ab.unit || 'px',
          dpi: ab.dpi || 300, ratioLock: !!ab.ratioLock, background: ab.bg || '#10162B',
          margin: ab.margin || 0, bleed: ab.bleed || 0, safe: !!ab.safe, grid: false,
          guides: Array.isArray(ab.guides) ? ab.guides.map(g => g.preset).filter(Boolean) : ['thirds']
        } : {
          artboardId: null, name: 'Direction Artboard', width: 1080, height: 1350,
          unit: 'px', dpi: 300, ratioLock: true, background: '#10162B',
          margin: 0, bleed: 0, safe: true, grid: false, guides: ['thirds']
        }
      };
    }

    function normalize(raw) {
      const base = raw && typeof raw === 'object' ? raw : bootstrap();
      const c = base.color && typeof base.color === 'object' ? base.color : {};
      const comp = base.composition && typeof base.composition === 'object' ? base.composition : {};
      const core = hex(c.core) || '#6D5CE8';
      const harmony = typeof c.harmony === 'string' ? c.harmony : 'Analogous';
      let palette = Array.isArray(c.palette) ? c.palette.map(hex).filter(Boolean) : null;
      if (!palette || palette.length !== 5) {
        palette = Color.harmonyHexes(Color.hexToHsv(core), harmony);
        if (!palette || palette.length !== 5) palette = PALETTE_FALLBACK.slice();
      }
      const locks = Array.isArray(c.locks) && c.locks.length === 5 ? c.locks.map(Boolean) : [false, false, false, false, false];
      const width = clamp(Number(comp.width) || 1080, 16, 20000);
      const height = clamp(Number(comp.height) || 1350, 16, 20000);
      const guides = Array.isArray(comp.guides) ? comp.guides.filter(g => typeof g === 'string').slice(0, 12) : ['thirds'];
      return {
        version: 1,
        id: typeof base.id === 'string' ? base.id : uid(),
        title: String(base.title || 'Untitled Direction').slice(0, 80),
        mood: String(base.mood || '').slice(0, 60),
        notes: String(base.notes || '').slice(0, 1200),
        color: {
          core, harmony, palette, locks,
          mood: String(c.mood || 'Custom').slice(0, 40)
        },
        composition: {
          artboardId: comp.artboardId || null,
          name: String(comp.name || 'Direction Artboard').slice(0, 48),
          width: Math.round(width), height: Math.round(height),
          unit: ['px', 'mm', 'cm', 'in'].includes(comp.unit) ? comp.unit : 'px',
          dpi: clamp(Number(comp.dpi) || 300, 24, 1200),
          ratioLock: comp.ratioLock !== false,
          background: hex(comp.background) || '#10162B',
          margin: clamp(Number(comp.margin) || 0, 0, 2000),
          bleed: clamp(Number(comp.bleed) || 0, 0, 20),
          safe: comp.safe !== false,
          grid: !!comp.grid,
          guides
        },
        updatedAt: Number(base.updatedAt) || now()
      };
    }

    let current = normalize(store.getJSON(KEY, null));
    let saveT;
    function queueSave() {
      clearTimeout(saveT);
      saveT = setTimeout(() => store.setJSON(KEY, current), 220);
    }
    queueSave();

    function emit(source, patch) {
      document.dispatchEvent(new CustomEvent('listo:project', {
        detail: { project: current, source: source || 'app', patch: patch || null }
      }));
    }

    function get() { return current; }

    function update(patch, source) {
      if (!patch || typeof patch !== 'object') return current;
      const next = Object.assign({}, current);
      if (patch.color) next.color = Object.assign({}, current.color, patch.color);
      if (patch.composition) next.composition = Object.assign({}, current.composition, patch.composition);
      Object.keys(patch).forEach(k => { if (k !== 'color' && k !== 'composition') next[k] = patch[k]; });
      current = normalize(next);
      current.updatedAt = now();
      queueSave();
      emit(source, patch);
      return current;
    }

    function replace(state, source) {
      current = normalize(Object.assign({}, state, { updatedAt: now() }));
      queueSave();
      emit(source || 'replace', null);
      return current;
    }

    function reset() {
      const next = bootstrap();
      next.id = uid();
      next.title = 'Untitled Direction';
      next.mood = '';
      next.notes = '';
      current = normalize(next);
      current.updatedAt = now();
      queueSave();
      emit('reset', null);
      return current;
    }

    function savedList() {
      const arr = store.getJSON(SAVED, []);
      return Array.isArray(arr) ? arr.filter(x => x && x.project) : [];
    }
    function save(name) {
      const arr = savedList();
      const label = String(name || current.title || 'Untitled Direction').slice(0, 60);
      const snap = { id: uid(), name: label, ts: now(), project: deep(current) };
      arr.unshift(snap);
      store.setJSON(SAVED, arr.slice(0, 24));
      return snap;
    }
    function open(id) {
      const found = savedList().find(x => x.id === id);
      if (!found) return null;
      current = normalize(Object.assign({}, found.project, { id: uid(), updatedAt: now() }));
      queueSave();
      emit('open', null);
      return current;
    }
    function removeSaved(id) {
      store.setJSON(SAVED, savedList().filter(x => x.id !== id));
      return true;
    }
    function flush() { clearTimeout(saveT); store.setJSON(KEY, current); }
    function ratioText() { return Color.ratioText(current.composition.width, current.composition.height); }

    return { get, update, replace, reset, save, open, listSaved: savedList, removeSaved, flush, ratioText, normalize, bootstrap };
  })();

  /* ------------------------------------------------------------------ router
     Hash routes: #home (default), #colors, #studio, #references, #direction.
     Views are full-screen fixed layers; home scroll position is preserved. */
  const Router = (() => {
    const ROUTES = ['colors', 'studio', 'references', 'direction'];
    const hooks = {};           // route -> { init }
    const inited = new Set();
    let current = 'home';
    let savedScroll = 0;
    let internalHash = false;
    let opener = null;

    function viewEl(route) { return $('#view-' + route); }

    function activate(route) {
      current = route;
      const body = document.body;
      $$('.view').forEach(v => v.classList.remove('open'));
      if (route === 'home') {
        body.classList.remove('view-open', 'view-colors', 'view-studio', 'view-references', 'view-direction');
        ROUTES.forEach(r => { const el = viewEl(r); if (el) { el.hidden = true; el.setAttribute('aria-hidden', 'true'); } });
        savedScroll = clamp(savedScroll, 0, 1e7);
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, savedScroll);
        requestAnimationFrame(() => { document.documentElement.style.scrollBehavior = ''; });
        if (opener && typeof opener.focus === 'function') { try { opener.focus({ preventScroll: true }); } catch (e) { /* noop */ } opener = null; }
      } else {
        savedScroll = window.scrollY;
        body.classList.add('view-open', 'view-' + route);
        ROUTES.forEach(r => {
          const el = viewEl(r);
          if (!el) return;
          if (r === route) {
            el.hidden = false;
            el.setAttribute('aria-hidden', 'false');
            if (!inited.has(r) && hooks[r] && typeof hooks[r].init === 'function') {
              inited.add(r);
              try { hooks[r].init(); } catch (e) { console.error('[LISTO] init failed for ' + r, e); }
            }
            raf(() => el.classList.add('open'));
          } else {
            el.hidden = true;
          }
        });
        const crumb = $('#viewCrumb');
        if (crumb) {
          const names = { colors: 'COLOR EXPLORER', studio: 'COMPOSITION STUDIO', references: 'VISUAL REFERENCES', direction: 'GUIDED DIRECTION' };
          crumb.textContent = names[route] || '';
        }
      }
      syncNav();
      document.dispatchEvent(new CustomEvent('listo:view', { detail: route }));
    }

    function syncNav() {
      $$('.nav-link').forEach(a => {
        const active = a.dataset.route === current;
        a.classList.toggle('active', active);
        if (active) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
      const crumb = $('#viewCrumb');
      const back = $('#crumbBack');
      if (crumb) crumb.hidden = current === 'home';
      if (back) back.hidden = current === 'home';
    }

    function go(route, fromHash = false) {
      if (!ROUTES.includes(route)) route = 'home';
      if (route === current && route !== 'home') return;
      if (route === 'home' && current === 'home' && !fromHash) return;
      if (!fromHash) {
        internalHash = true;
        try { location.hash = route === 'home' ? '#home' : '#' + route; } catch (e) { /* noop */ }
      }
      opener = current !== 'home' ? null : (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      if (route !== 'home') Sound.play('open'); else Sound.play('close');
      activate(route);
    }

    function onHashChange() {
      if (internalHash) { internalHash = false; return; }
      const route = (location.hash || '#home').replace(/^#/, '');
      go(ROUTES.includes(route) ? route : 'home', true);
    }

    function init() {
      window.addEventListener('hashchange', onHashChange);
      // delegated routing for data-route elements (nav links, cards, buttons)
      document.addEventListener('click', e => {
        const el = e.target.closest('[data-route]');
        if (!el) return;
        e.preventDefault();
        go(el.dataset.route);
      });
      const back = $('#crumbBack');
      if (back) back.addEventListener('click', () => go('home'));
      const boot = (location.hash || '').replace(/^#/, '');
      if (ROUTES.includes(boot)) go(boot, true); else activate('home');
    }

    return {
      init, go,
      register(route, hook) {
        hooks[route] = hook || {};
        // A direct hash load can activate a view before its module script registers.
        if (current === route && !inited.has(route) && typeof hooks[route].init === 'function') {
          inited.add(route);
          try { hooks[route].init(); } catch (e) { console.error('[LISTO] init failed for ' + route, e); }
        }
      },
      get current() { return current; }
    };
  })();

  /* -------------------------------------------------------- shared nav chrome */
  function initChrome() {
    // Sound UI
    const soundBtn = $('#soundToggle');
    const soundIcon = $('#soundIcon');
    const volumeSlider = $('#volumeSlider');
    const syncSoundUI = () => {
      const on = Sound.enabled;
      if (soundIcon) soundIcon.textContent = on ? '♫' : '♪';
      if (soundBtn) {
        soundBtn.setAttribute('aria-pressed', String(on));
        soundBtn.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
      }
      if (volumeSlider) volumeSlider.value = Math.round(Sound.volume * 100);
    };
    syncSoundUI();
    if (soundBtn) soundBtn.addEventListener('click', () => {
      if (Sound.enabled) {
        Sound.play('toggleOff');
        Sound.setEnabled(false);
        syncSoundUI();
        toast('Interaction sounds off');
      } else {
        Sound.setEnabled(true);
        syncSoundUI();
        Sound.play('toggleOn');
        toast('Interaction sounds on', 'success');
      }
    });
    if (volumeSlider) {
      volumeSlider.addEventListener('input', e => Sound.setVolume(Number(e.target.value) / 100));
      volumeSlider.addEventListener('change', () => Sound.play('adjust'));
    }

    // Theme
    const savedTheme = store.get('listo-theme', 'dark');
    if (savedTheme === 'light') document.body.classList.add('light');
    const themeToggle = $('#themeToggle');
    if (themeToggle) themeToggle.addEventListener('click', () => {
      const light = document.body.classList.toggle('light');
      store.set('listo-theme', light ? 'light' : 'dark');
      Sound.play(light ? 'toggleOn' : 'toggleOff');
      toast(light ? 'Light theme' : 'Dark theme');
    });

    // Mobile menu
    const navLinks = $('#navLinks');
    const menuToggle = $('#menuToggle');
    const closeMenu = () => {
      if (!navLinks) return;
      navLinks.classList.remove('open');
      if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
    };
    if (menuToggle && navLinks) {
      menuToggle.addEventListener('click', () => {
        const open = navLinks.classList.toggle('open');
        menuToggle.setAttribute('aria-expanded', String(open));
        Sound.play(open ? 'toggleOn' : 'toggleOff');
      });
      document.addEventListener('click', e => {
        if (navLinks.classList.contains('open') && !e.target.closest('.topbar')) closeMenu();
      });
    }

    // Escape closes view or menu
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (Router.current !== 'home') { Router.go('home'); return; }
      if (navLinks && navLinks.classList.contains('open')) closeMenu();
    });

    // Generic interaction sounds (data-snd opt-in, data-snd-off opt-out)
    document.addEventListener('click', e => {
      const target = e.target.closest('[data-snd]');
      if (target) { Sound.play(target.dataset.snd || 'tap'); return; }
      if (e.target.closest('[data-snd-off]')) return;
      const btn = e.target.closest('button, a');
      if (btn) Sound.play(btn.matches('.nav-link, .brand') ? 'nav' : 'tap');
    });
    // Range/number/color inputs give subtle adjust ticks on commit
    document.addEventListener('change', e => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.matches('input[type="range"], input[type="number"], input[type="color"]') && !t.closest('[data-snd-off]')) {
        Sound.play('adjust');
      }
    });
  }

  /* ---------------------------------------------------------------- exports */
  const LISTO = {
    reduceMotion, finePointer, $, $$, clamp, uid, raf,
    store, Sound, toast, copyText, download, Projects, Project, IDB, Color, Router
  };
  window.LISTO = LISTO;

  function boot() {
    requestAnimationFrame(() => document.body.classList.add('loaded'));
    initChrome();
    Router.init();
    document.dispatchEvent(new CustomEvent('listo:ready'));
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
