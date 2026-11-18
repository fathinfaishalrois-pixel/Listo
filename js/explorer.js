/* ==========================================================================
   LISTO. — explorer.js
   Color Explorer: wheel, harmonies, dynamic glass environment, mixer,
   gradient studio, contrast checker, moods, history, saved palettes, exports.
   ========================================================================== */
(() => {
  'use strict';
  const { $, $$, clamp, raf, store, Sound, toast, copyText, download, Color, Router, Projects, Project } = window.LISTO;
  const view = $('#view-colors');
  if (!view) return;

  /* ------------------------------------------------------------------ state */
  const DEFAULTS = { core: '#6D5CE8', harmony: 'Analogous', palette: null, locks: [false, false, false, false, false], preview: 'gradient', mood: 'Custom' };
  let state = Object.assign({}, DEFAULTS, store.getJSON('listo-explorer', {}));
  if (!Array.isArray(state.locks) || state.locks.length !== 5) state.locks = [false, false, false, false, false];
  if (!Array.isArray(state.palette) || state.palette.length !== 5) state.palette = null;
  if (!Color.hexToRgb(state.core)) state.core = DEFAULTS.core;

  let hist = [];                      // undo snapshots (newest last)
  let sel = 2;                        // selected swatch index
  let gradStops = [];                 // gradient studio session state
  let gradAngle = 135;
  let ct = { fg: '#FFFFFF', bg: '#6D5CE8' };

  let saveT;
  const persist = () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => store.setJSON('listo-explorer', state), 400);
    // Keep the shared project state in sync without waiting for the debounce.
    Project.update({
      color: {
        core: state.core,
        harmony: state.harmony,
        palette: [...(state.palette || [])],
        locks: [...state.locks],
        mood: state.mood || 'Custom'
      }
    }, 'explorer');
  };

  const coreHsv = () => Color.hexToHsv(state.core);

  /* --------------------------------------------------- dynamic environment */
  function syncEnvironment() {
    const [r, g, b] = Color.hexToRgb(state.core) || [109, 92, 232];
    const [h, s, v] = coreHsv();
    view.style.setProperty('--dyn-a', Color.hsvToHex(h, clamp(s + 6, 30, 100), 52));
    view.style.setProperty('--dyn-b', Color.hsvToHex(h + 70, clamp(s, 25, 90), 40));
    view.style.setProperty('--dyn-tint', `rgba(${r}, ${g}, ${b}, 0.07)`);
    view.style.setProperty('--dyn-glass-tint', `rgba(${r}, ${g}, ${b}, 0.24)`);
    view.style.setProperty('--dyn-edge', `rgba(${r}, ${g}, ${b}, 0.5)`);
  }

  /* ------------------------------------------------------------ wheel (HSV) */
  const wheel = $('#cxWheel');
  const knob = $('#cxKnob');
  let wSize = 0, wCx = 0, wR = 0;
  let wDirty = true;

  function drawWheel() {
    if (!wheel) return;
    const wrap = wheel.parentElement;
    const rect = wrap.getBoundingClientRect();
    if (!rect.width) return;
    const size = Math.round(rect.width);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (wheel.width !== Math.round(size * dpr)) {
      wheel.width = Math.round(size * dpr);
      wheel.height = Math.round(size * dpr);
    }
    const ctx = wheel.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wCx = size / 2;
    wR = size / 2 - 2;
    wSize = size;
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - wCx, dy = y - wCx;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const i = (y * size + x) * 4;
        if (dist > wR + 1) { d[i + 3] = 0; continue; }
        const ang = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
        const sat = Math.min(100, dist / wR * 100);
        const [r, g, b] = Color.hsvToRgb(ang, sat, 100);
        d[i] = r; d[i + 1] = g; d[i + 2] = b;
        d[i + 3] = dist > wR - 1 ? clamp((wR + 1 - dist) * 255, 0, 255) : 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.beginPath();
    ctx.arc(wCx, wCx, wR - 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    wDirty = false;
    renderKnob();
  }

  function renderKnob() {
    if (!knob || !wSize) return;
    const [h, s] = coreHsv();
    const a = h * Math.PI / 180;
    const r = s / 100 * wR;
    const px = wCx + Math.cos(a) * r;
    const py = wCx + Math.sin(a) * r;
    knob.style.transform = `translate(${(px - 11).toFixed(1)}px, ${(py - 11).toFixed(1)}px)`;
    knob.style.background = state.core;
    knob.setAttribute('aria-valuenow', String(Math.round(h)));
    knob.setAttribute('aria-valuetext', `hue ${Math.round(h)}, saturation ${Math.round(s)} percent`);
  }

  function wheelPick(e) {
    const rect = wheel.getBoundingClientRect();
    const dx = e.clientX - (rect.left + wCx);
    const dy = e.clientY - (rect.top + wCx);
    const h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    const s = clamp(Math.sqrt(dx * dx + dy * dy) / wR * 100, 0, 100);
    const [, , v] = coreHsv();
    setCore(Color.hsvToHex(h, s, v), { push: false, sound: false });
    raf(renderAll);
  }
  let wDrag = false;
  if (wheel) {
    wheel.addEventListener('pointerdown', e => { wDrag = true; wheel.setPointerCapture(e.pointerId); wheelPick(e); e.preventDefault(); });
    window.addEventListener('pointermove', e => { if (wDrag) wheelPick(e); }, { passive: true });
    window.addEventListener('pointerup', () => { if (wDrag) { wDrag = false; Sound.play('select'); } });
    window.addEventListener('pointercancel', () => { wDrag = false; });
  }
  if (knob) knob.addEventListener('keydown', e => {
    const [h, s, v] = coreHsv();
    const step = e.shiftKey ? 15 : 3;
    let next = null;
    if (e.key === 'ArrowLeft') next = [h - step, s, v];
    else if (e.key === 'ArrowRight') next = [h + step, s, v];
    else if (e.key === 'ArrowUp') next = [h, s + step, v];
    else if (e.key === 'ArrowDown') next = [h, s - step, v];
    if (next) {
      e.preventDefault();
      setCore(Color.hsvToHex(next[0], next[1], next[2]), { push: false });
      renderAll();
    }
  });

  /* --------------------------------------------------------- palette engine */
  function regen(push = true) {
    if (push) pushHistory();
    const base = coreHsv();
    const gen = Color.harmonyHexes(base, state.harmony);
    state.palette = gen.map((hex, i) => state.locks[i] && state.palette ? state.palette[i] : hex);
    persist();
  }

  function setCore(hex, opts = {}) {
    if (!Color.hexToRgb(hex)) return;
    if (opts.push !== false) pushHistory();
    state.core = hex.toUpperCase();
    regen(false);
    persist();
    if (opts.sound) Sound.play('generate');
  }

  function pushHistory() {
    hist.push({ core: state.core, harmony: state.harmony, palette: [...(state.palette || [])], locks: [...state.locks] });
    if (hist.length > 30) hist.shift();
    renderHistory();
  }

  /* --------------------------------------------------------------- UI: rail */
  function syncInputs() {
    const focus = document.activeElement;
    const skip = el => focus && el === focus;
    const [r, g, b] = Color.hexToRgb(state.core) || [0, 0, 0];
    const [hh, ss, ll] = Color.hexToHsl(state.core);
    const [, sv, vv] = coreHsv();
    const hex = $('#cxHex'), nat = $('#cxNative');
    if (hex && !skip(hex)) hex.value = state.core;
    if (nat && !skip(nat)) nat.value = state.core;
    const setNum = (id, val) => { const el = $(id); if (el && !skip(el)) el.value = Math.round(val); };
    setNum('#cxR', r); setNum('#cxG', g); setNum('#cxB', b);
    setNum('#cxH', hh); setNum('#cxS', ss); setNum('#cxL', ll);
    const val = $('#cxValue');
    if (val && !skip(val)) val.value = Math.round(vv);
  }

  function renderPaletteRow() {
    const row = $('#paletteRow');
    if (!row) return;
    row.innerHTML = (state.palette || []).map((hex, i) => `
      <div class="pal-item ${state.locks[i] ? 'locked' : ''}">
        <button type="button" class="pal-swatch ${i === sel ? 'selected' : ''}" style="background:${hex}" data-i="${i}" aria-label="Set ${hex} as core color">
          <span class="sw-hex">${hex}</span>
        </button>
        <button type="button" class="sw-lock" data-lock="${i}" aria-pressed="${state.locks[i]}" aria-label="${state.locks[i] ? 'Unlock' : 'Lock'} color ${i + 1}">${state.locks[i] ? '🔒' : '🔓'}</button>
        <button type="button" class="sw-edit" data-edit="${i}" aria-label="Edit color ${i + 1}" title="Edit this color">✎</button>
        <input class="sw-color-input" type="color" data-edit-color="${i}" value="${hex}" tabindex="-1" aria-label="Custom color ${i + 1}">
      </div>`).join('');

    row.querySelectorAll('[data-i]').forEach(el => el.addEventListener('click', () => {
      const i = Number(el.dataset.i);
      sel = i;
      setCore(state.palette[i], { push: false });
      renderAll();
    }));
    row.querySelectorAll('[data-lock]').forEach(el => el.addEventListener('click', e => {
      e.stopPropagation();
      const i = Number(el.dataset.lock);
      state.locks[i] = !state.locks[i];
      persist();
      Sound.play('lock');
      toast(state.locks[i] ? `Color ${i + 1} locked` : `Color ${i + 1} unlocked`);
      renderAll();
    }));
    row.querySelectorAll('[data-edit]').forEach(el => el.addEventListener('click', () => {
      const input = row.querySelector(`[data-edit-color="${el.dataset.edit}"]`);
      if (!input) return;
      try { if (typeof input.showPicker === 'function') input.showPicker(); else input.click(); }
      catch (_) { input.click(); }
    }));
    row.querySelectorAll('[data-edit-color]').forEach(input => input.addEventListener('change', () => {
      const i = Number(input.dataset.editColor), color = input.value.toUpperCase();
      if (!Number.isInteger(i) || i < 0 || i >= state.palette.length) return;
      state.palette[i] = color;
      state.locks[i] = true; // A manually edited swatch stays intact on regeneration.
      if (i === sel) state.core = color;
      persist();
      renderAll();
    }));
  }

  function renderReadout() {
    const [r, g, b] = Color.hexToRgb(state.core) || [0, 0, 0];
    const [h, s, l] = Color.hexToHsl(state.core);
    const [cy, cm, cyk, ck] = Color.rgbToCmyk(r, g, b);
    const ro = id => { const el = $(id); return el; };
    const elHex = ro('#roHex'), elRgb = ro('#roRgb'), elHsl = ro('#roHsl'), elTemp = ro('#roTemp'), elCw = ro('#roCw'), elCb = ro('#roCb');
    if (elHex) elHex.textContent = state.core;
    if (elRgb) elRgb.textContent = `${r} · ${g} · ${b}`;
    if (elHsl) elHsl.textContent = `${Math.round(h)}° ${Math.round(s)}% ${Math.round(l)}%`;
    if (elTemp) {
      elTemp.textContent = Color.temperature(h);
      elTemp.style.color = Color.temperature(h) === 'WARM' ? 'var(--coral)' : Color.temperature(h) === 'COOL' ? 'var(--cyan)' : 'var(--muted)';
    }
    if (elCw) elCw.textContent = Color.contrastRatio(state.core, '#FFFFFF').toFixed(1) + ':1';
    if (elCb) elCb.textContent = Color.contrastRatio(state.core, '#12142A').toFixed(1) + ':1';
  }

  /* ----------------------------------------------------------- previews */
  const PREVIEWS = {
    gradient() {
      const colors = (state.palette || []).slice();
      return `<div class="preview-content" style="background:linear-gradient(135deg, ${colors.join(', ')})"></div>`;
    },
    scene() {
      const p = state.palette;
      const [h] = coreHsv();
      const dark = Color.hslToHex(h, 45, 10);
      return `<div class="preview-content"><svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Landscape preview">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${p[3]}"/><stop offset=".55" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[2]}"/>
          </linearGradient>
          <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${p[2]}"/><stop offset="1" stop-color="${dark}"/>
          </linearGradient>
        </defs>
        <rect width="800" height="330" fill="url(#sky)"/>
        <circle cx="560" cy="180" r="64" fill="${p[4]}" opacity=".95"/>
        <circle cx="560" cy="180" r="96" fill="${p[4]}" opacity=".22"/>
        <path d="M0 330 L150 190 L260 300 L360 170 L470 320 L560 230 L680 330 Z" fill="${p[1]}" opacity=".9"/>
        <path d="M0 330 L120 250 L240 330 L400 210 L560 330 L700 260 L800 330 Z" fill="${p[0]}" opacity=".95"/>
        <rect y="330" width="800" height="170" fill="url(#sea)"/>
        <rect x="430" y="336" width="260" height="3" rx="1.5" fill="${p[4]}" opacity=".7"/>
        <rect x="470" y="348" width="180" height="2" rx="1" fill="${p[4]}" opacity=".45"/>
        <rect x="400" y="360" width="320" height="2" rx="1" fill="${p[4]}" opacity=".3"/>
        <rect x="440" y="376" width="220" height="2" rx="1" fill="${p[4]}" opacity=".2"/>
      </svg></div>`;
    },
    abstract() {
      const p = state.palette;
      const [h, s] = coreHsv();
      const bg = Color.hslToHex(h, clamp(s, 20, 60), 12);
      return `<div class="preview-content"><svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Abstract composition">
        <rect width="800" height="500" fill="${bg}"/>
        <circle cx="250" cy="200" r="170" fill="${p[0]}" opacity=".85"/>
        <circle cx="430" cy="290" r="130" fill="${p[2]}" opacity=".75"/>
        <circle cx="580" cy="160" r="90" fill="${p[4]}" opacity=".9"/>
        <rect x="90" y="330" width="620" height="34" rx="17" fill="${p[1]}" opacity=".85"/>
        <rect x="170" y="390" width="440" height="12" rx="6" fill="${p[3]}" opacity=".7"/>
        <path d="M0 500 L300 220 L520 500 Z" fill="${p[2]}" opacity=".28"/>
        <circle cx="640" cy="380" r="46" fill="none" stroke="${p[4]}" stroke-width="2" opacity=".8"/>
      </svg></div>`;
    },
    blocks() {
      const p = state.palette;
      const cells = [];
      const ramp = [];
      const [h, s] = coreHsv();
      for (let l = 88; l >= 16; l -= 9) ramp.push(Color.hslToHex(h, clamp(s, 18, 70), l));
      for (let i = 0; i < 60; i++) {
        const c = i % 7 === 0 ? p[i % 5] : ramp[i % ramp.length];
        const label = i < 5 ? p[i] : null;
        cells.push(`<i style="background:${c}${label ? '' : ''}">${label ? `<b>${label}</b>` : ''}</i>`);
      }
      return `<div class="preview-content"><div class="blocks-grid">${cells.join('')}</div></div>`;
    },
    glass() {
      const p = state.palette;
      const blobs = p.map((c, i) => {
        const pos = [[8, 12], [58, 4], [30, 52], [70, 58], [12, 74]][i];
        const size = [220, 180, 260, 160, 200][i];
        return `<i style="left:${pos[0]}%;top:${pos[1]}%;width:${size}px;height:${size}px;background:${c};opacity:.85"></i>`;
      }).join('');
      return `<div class="preview-content"><div class="glass-demo">
        <div class="glass-blobs" aria-hidden="true">${blobs}</div>
        <div class="glass-panel">
          <h5>Frosted material</h5>
          <p>The panel blurs the atmosphere behind it. Its tint follows your core color in real time.</p>
        </div>
      </div></div>`;
    },
    app() {
      const p = state.palette;
      const heroText = Color.readableOn(p[0]);
      const btnText = Color.readableOn(p[2]);
      const cardText = Color.readableOn(p[1]);
      return `<div class="preview-content" style="display:grid;place-items:center"><div class="app-frame" style="background:${p[0]}">
        <div class="app-nav" style="background:${p[0]}">
          <span class="app-dot" style="background:${p[2]}"></span>
          <span class="app-dot" style="background:${p[3]}"></span>
          <span class="app-dot" style="background:${p[4]}"></span>
          <span style="margin-left:auto;font:600 10px 'DM Sans';color:${heroText};opacity:.7">LISTO</span>
        </div>
        <div class="app-hero">
          <h4 style="color:${heroText}">Direction, applied.</h4>
          <p style="color:${heroText}">Every surface here is colored by your current palette — nothing is hard-coded.</p>
          <div class="app-btns">
            <span class="app-btn" style="background:${p[2]};color:${btnText}">Primary</span>
            <span class="app-btn" style="background:${p[3]};color:${cardText}">Secondary</span>
          </div>
        </div>
        <div class="app-cards">
          ${[p[1], p[3], p[4]].map((c, i) => `<div class="app-card" style="background:${c}">
            <i style="background:${p[2]}"></i><b style="color:${cardText}">Module ${i + 1}</b>
            <span style="color:${cardText}">Palette-driven</span></div>`).join('')}
        </div>
      </div></div>`;
    }
  };

  function renderPreview() {
    const stage = $('#previewStage');
    if (!stage) return;
    const fn = PREVIEWS[state.preview] || PREVIEWS.gradient;
    stage.innerHTML = fn();
  }

  /* ------------------------------------------------------------ gradient tab */
  function defaultStops() {
    return [state.palette[2] || state.core, state.palette[0] || '#01BAEF', state.palette[4] || '#F2A37C'];
  }
  function renderGradientTab() {
    const wrap = $('#gradStops');
    if (!wrap) return;
    wrap.innerHTML = gradStops.map((c, i) => `
      <div class="grad-stop">
        <input type="color" value="${c}" data-stop="${i}" aria-label="Gradient stop ${i + 1}">
        <code>${c}</code>
        <button class="mini-btn danger" data-stopdel="${i}" aria-label="Remove stop" ${gradStops.length <= 2 ? 'disabled' : ''}>×</button>
      </div>`).join('');
    const bar = $('#gradBar');
    const css = $('#gradCss');
    const g = Color.gradientCss(gradStops, gradAngle);
    if (bar) bar.style.background = g;
    if (css) css.textContent = 'background: ' + g + ';';
    $$('.grad-stop input[type="color"]', wrap).forEach(inp => inp.addEventListener('input', e => {
      gradStops[Number(inp.dataset.stop)] = e.target.value.toUpperCase();
      renderGradientTab();
    }));
    $$('.grad-stop [data-stopdel]', wrap).forEach(btn => btn.addEventListener('click', () => {
      if (gradStops.length <= 2) return;
      gradStops.splice(Number(btn.dataset.stopdel), 1);
      renderGradientTab();
      Sound.play('remove');
    }));
  }
  function addGradStop() {
    if (gradStops.length >= 4) { toast('Maximum four stops'); return; }
    gradStops.push(state.core);
    renderGradientTab();
    Sound.play('create');
  }

  /* ----------------------------------------------------------- contrast tab */
  function renderContrast() {
    const sample = $('#ctSample');
    if (sample) {
      sample.style.background = ct.bg;
      sample.style.color = ct.fg;
      sample.innerHTML = `<span>Sample text preview<small>${ct.fg} on ${ct.bg}</small></span>`;
    }
    const ratio = Color.contrastRatio(ct.fg, ct.bg);
    const el = $('#ctRatio');
    if (el) el.textContent = ratio.toFixed(2) + ' : 1';
    const badges = [
      ['AA · NORMAL', ratio >= 4.5], ['AA · LARGE', ratio >= 3],
      ['AAA · NORMAL', ratio >= 7], ['AAA · LARGE', ratio >= 4.5]
    ];
    const bWrap = $('#ctBadges');
    if (bWrap) bWrap.innerHTML = badges.map(([t, ok]) => `<span class="ct-badge ${ok ? 'pass' : 'fail'}">${t} ${ok ? 'PASS' : 'FAIL'}</span>`).join('');
    const q = $('#ctQuick');
    if (q) {
      q.innerHTML = (state.palette || []).map(c => `<button style="background:${c}" data-bg="${c}" aria-label="Use ${c} as background"></button>`).join('');
      $$('button', q).forEach(b => b.addEventListener('click', () => { ct.bg = b.dataset.bg; renderContrast(); Sound.play('select'); }));
    }
  }

  /* ------------------------------------------------------------- moods */
  function renderMoodChips() {
    const wrap = $('#moodChips');
    if (!wrap) return;
    wrap.innerHTML = Object.keys(Color.MOODS).map(mood => {
      const pal = Color.moodPalette(mood) || [];
      return `<button class="mood-chip" data-mood="${mood}"><i style="background:linear-gradient(135deg, ${pal[1]}, ${pal[3]})"></i>${mood}</button>`;
    }).join('');
    $$('.mood-chip', wrap).forEach(chip => chip.addEventListener('click', () => {
      const pal = Color.moodPalette(chip.dataset.mood);
      if (!pal) return;
      pushHistory();
      state.palette = pal.map((hex, i) => state.locks[i] ? state.palette[i] : hex);
      state.core = pal[2];
      state.mood = chip.dataset.mood;
      persist();
      Sound.play('generate');
      toast(chip.dataset.mood + ' mood applied', 'success');
      renderAll();
    }));
  }

  /* ---------------------------------------------------------- history strip */
  function renderHistory() {
    const strip = $('#histStrip');
    if (!strip) return;
    const cells = hist.slice(-12).reverse();
    strip.innerHTML = cells.map((snap, i) => `
      <button class="hist-cell" data-hist="${hist.length - 1 - i}" aria-label="Restore earlier palette">
        ${(snap.palette || []).map(c => `<i style="background:${c}"></i>`).join('')}
      </button>`).join('');
    $$('.hist-cell', strip).forEach(cell => cell.addEventListener('click', () => {
      const snap = hist[Number(cell.dataset.hist)];
      if (!snap) return;
      state.core = snap.core; state.harmony = snap.harmony;
      state.palette = [...snap.palette]; state.locks = [...snap.locks];
      hist = hist.slice(0, Number(cell.dataset.hist));
      persist();
      Sound.play('select');
      renderAll();
    }));
  }
  function undo() {
    const snap = hist.pop();
    if (!snap) { toast('Nothing to undo'); return; }
    state.core = snap.core; state.harmony = snap.harmony;
    state.palette = [...snap.palette]; state.locks = [...snap.locks];
    persist();
    Sound.play('toggleOff');
    renderAll();
  }

  /* ---------------------------------------------------------- saved palettes */
  function savedList() {
    const saved = store.getJSON('listo-palettes', null);
    if (saved === null) {
      const seed = [
        { name: 'Midnight Signal', core: '#6D5CE8', colors: ['#101532', '#28306B', '#6D5CE8', '#9277F2', '#CDC5FF'], origin: 'curated' },
        { name: 'Soft Terrain', core: '#A98F6F', colors: ['#2B2420', '#6B5844', '#A98F6F', '#D9C1A3', '#F0E4D4'], origin: 'curated' },
        { name: 'Tidal Glass', core: '#01BAEF', colors: ['#06222E', '#0B4F6C', '#01BAEF', '#8CE9F5', '#EAF7FA'], origin: 'curated' }
      ];
      store.setJSON('listo-palettes', seed);
      return seed;
    }
    return Array.isArray(saved) ? saved : [];
  }
  function renderSaved() {
    const list = $('#savedList');
    if (!list) return;
    const saved = savedList();
    if (!saved.length) { list.innerHTML = '<p class="saved-empty">Nothing saved yet — name a palette and press Save.</p>'; return; }
    list.innerHTML = saved.map((p, i) => `
      <div class="saved-item" data-load="${i}" role="button" tabindex="0" aria-label="Load ${p.name}">
        <span class="si-bars" aria-hidden="true">${p.colors.map(c => `<i style="background:${c}"></i>`).join('')}</span>
        <span class="si-name">${p.name}<em>${p.origin === 'curated' ? 'CURATED' : 'SAVED'}</em></span>
        <button class="mini-btn danger" data-del="${i}" aria-label="Delete ${p.name}">×</button>
      </div>`).join('');
    $$('.saved-item', list).forEach(item => {
      const load = () => {
        const p = saved[Number(item.dataset.load)];
        if (!p) return;
        pushHistory();
        state.palette = [...p.colors];
        state.core = p.core || p.colors[2] || p.colors[0];
        persist();
        Sound.play('select');
        toast(p.name + ' loaded', 'success');
        renderAll();
      };
      item.addEventListener('click', e => { if (!e.target.closest('[data-del]')) load(); });
      item.addEventListener('keydown', e => { if (e.key === 'Enter') load(); });
    });
    $$('[data-del]', list).forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      const i = Number(btn.dataset.del);
      const arr = savedList();
      arr.splice(i, 1);
      store.setJSON('listo-palettes', arr);
      Sound.play('remove');
      toast('Palette deleted');
      renderSaved();
      document.dispatchEvent(new CustomEvent('listo:palettes'));
    }));
  }
  function savePalette() {
    const nameInput = $('#palName');
    const name = (nameInput && nameInput.value.trim()) || 'Palette ' + (savedList().length + 1);
    const arr = savedList();
    arr.unshift({ name, core: state.core, colors: [...(state.palette || [])], origin: 'saved', ts: Date.now() });
    store.setJSON('listo-palettes', arr.slice(0, 24));
    if (nameInput) nameInput.value = '';
    Projects.add('palette', name, { colors: [...(state.palette || [])], core: state.core });
    Sound.play('success');
    toast('"' + name + '" saved on this device', 'success');
    renderSaved();
    document.dispatchEvent(new CustomEvent('listo:palettes'));
  }

  /* ---------------------------------------------------------------- exports */
  function exportJSON() {
    const data = {
      product: 'LISTO.', type: 'palette', core: state.core, harmony: state.harmony,
      palette: state.palette, locks: state.locks, exportedAt: new Date().toISOString()
    };
    download('listo-palette.json', JSON.stringify(data, null, 2), 'application/json');
    Sound.play('success');
    toast('Palette JSON exported', 'success');
  }
  function exportCSS() {
    const vars = (state.palette || []).map((c, i) => `  --color-${i + 1}: ${c};`).join('\n');
    const css = `:root {\n  --color-core: ${state.core};\n${vars}\n}`;
    copyText(css, 'CSS variables copied');
  }
  function exportPNG() {
    try {
      const W = 1200, H = 630;
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d');
      const [r, g, b] = Color.hexToRgb(state.core) || [109, 92, 232];
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, '#0A0D20');
      bgGrad.addColorStop(1, Color.rgbToHex(Math.round(r * .3), Math.round(g * .3), Math.round(b * .38)));
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.font = '600 26px Manrope, sans-serif';
      ctx.fillText('LISTO.', 70, 96);
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.font = '500 13px "DM Mono", monospace';
      ctx.fillText((state.harmony + ' — ' + state.core).toUpperCase(), 70, 124);
      const colors = state.palette || [];
      const n = Math.max(colors.length, 1);
      const gap = 10, total = W - 140;
      const w = (total - gap * (n - 1)) / n;
      colors.forEach((c, i) => {
        const x = 70 + i * (w + gap);
        const y = 190, h = 330;
        ctx.fillStyle = c;
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, 14);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, w, h);
        }
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.font = '500 12px "DM Mono", monospace';
        ctx.fillText(c, x + 8, y + h + 26);
      });
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      ctx.font = '500 11px "DM Mono", monospace';
      ctx.fillText('CREATE YOUR VISUAL DIRECTION — listo.app', 70, H - 46);
      cv.toBlob(blob => {
        if (blob && download('listo-palette.png', blob)) {
          Sound.play('success');
          toast('PNG card exported', 'success');
        }
      }, 'image/png');
    } catch (e) {
      toast('PNG export failed', 'error');
      Sound.play('error');
    }
  }

  /* ------------------------------------------------------------ master render */
  function renderAll() {
    syncEnvironment();
    syncInputs();
    if (wDirty) drawWheel(); else renderKnob();
    renderPaletteRow();
    renderReadout();
    renderPreview();
    renderGradientTab();
    renderContrast();
    const hd = $('#harmonyDesc');
    if (hd) {
      const descs = {
        'Analogous': 'Neighbors on the wheel — calm, cohesive, naturally balanced.',
        'Complementary': 'Opposite hues create maximum energy and clear focal contrast.',
        'Triadic': 'Three evenly spaced hues — lively while staying harmonious.',
        'Tetradic': 'Two complementary pairs. Rich, but give one hue the lead role.',
        'Split Complementary': 'A base hue plus its two neighbors-of-opposite — softer than complementary.',
        'Square': 'Four hues at 90°. Bold and even — mind the balance.',
        'Monochromatic': 'One hue, many values. The quietest, most editorial direction.'
      };
      hd.textContent = descs[state.harmony] || descs['Analogous'];
    }
  }

  /* -------------------------------------------------------------- bindings */
  function bind() {
    // rail tabs
    $$('.rail-tab', view).forEach(tab => tab.addEventListener('click', () => {
      $$('.rail-tab', view).forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      $$('.rail-panel', view).forEach(p => { p.hidden = p.id !== 'tab-' + tab.dataset.tab; });
      Sound.play('select');
    }));

    // input listeners
    const hexIn = $('#cxHex');
    if (hexIn) hexIn.addEventListener('input', () => {
      const v = hexIn.value.trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) { setCore(v, { push: false }); renderAll(); }
    });
    hexIn && hexIn.addEventListener('change', () => {
      const v = hexIn.value.trim();
      if (!/^#?[0-9a-f]{6}$/i.test(v)) {
        hexIn.value = state.core;
        toast('Enter a six-digit HEX like #6D5CE8', 'error');
        Sound.play('error');
      }
    });
    const native = $('#cxNative');
    native && native.addEventListener('input', e => { setCore(e.target.value, { push: false }); renderAll(); });

    const rgbBind = () => {
      const r = Number($('#cxR').value), g = Number($('#cxG').value), b = Number($('#cxB').value);
      if ([r, g, b].every(v => Number.isFinite(v))) {
        setCore(Color.rgbToHex(r, g, b), { push: false });
        renderAll();
      }
    };
    ['#cxR', '#cxG', '#cxB'].forEach(id => { const el = $(id); el && el.addEventListener('input', rgbBind); });
    const hslBind = () => {
      const h = Number($('#cxH').value), s = Number($('#cxS').value), l = Number($('#cxL').value);
      if ([h, s, l].every(v => Number.isFinite(v))) {
        setCore(Color.hslToHex(h, s, l), { push: false });
        renderAll();
      }
    };
    ['#cxH', '#cxS', '#cxL'].forEach(id => { const el = $(id); el && el.addEventListener('input', hslBind); });

    const valSlider = $('#cxValue');
    valSlider && valSlider.addEventListener('input', () => {
      const [h, s] = coreHsv();
      setCore(Color.hsvToHex(h, s, Number(valSlider.value)), { push: false });
      renderAll();
    });

    // harmony
    const hSel = $('#harmonySel');
    if (hSel) {
      hSel.value = state.harmony;
      hSel.addEventListener('change', () => {
        state.harmony = hSel.value;
        regen(true);
        Sound.play('select');
        renderAll();
      });
    }

    // regen
    const regenBtn = $('#regenBtn');
    regenBtn && regenBtn.addEventListener('click', () => {
      // rotate hue slightly for a genuinely new but deterministic-feeling variation
      pushHistory();
      const [h, s, v] = coreHsv();
      state.core = Color.hsvToHex(h + 47, s, v);
      regen(false);
      persist();
      Sound.play('generate');
      renderAll();
    });

    // variations
    $$('.vary-btn', view).forEach(btn => btn.addEventListener('click', () => {
      pushHistory();
      state.palette = state.palette.map((c, i) => state.locks[i] ? c : Color.varyHex(c, btn.dataset.vary));
      persist();
      Sound.play('generate');
      renderAll();
    }));

    // mixer
    const mixOut = () => {
      const t = Number($('#mixT').value) / 100;
      const mixed = Color.mixHex($('#mixA').value, $('#mixB').value, t);
      $('#mixOutSwatch').style.background = mixed;
      $('#mixOutHex').textContent = mixed;
      return mixed;
    };
    ['#mixA', '#mixB', '#mixT'].forEach(id => { const el = $(id); el && el.addEventListener('input', mixOut); });
    const mixAdd = $('#mixAdd');
    mixAdd && mixAdd.addEventListener('click', () => {
      const mixed = mixOut();
      pushHistory();
      let target = state.locks[sel] ? state.locks.findIndex(l => !l) : sel;
      if (target === -1) { toast('All colors are locked', 'error'); Sound.play('error'); return; }
      state.palette[target] = mixed;
      sel = target;
      persist();
      Sound.play('generate');
      toast('Mixed color added to slot ' + (target + 1), 'success');
      renderAll();
    });
    const mixSet = $('#mixSetCore');
    mixSet && mixSet.addEventListener('click', () => {
      setCore(mixOut(), { push: true, sound: true });
      renderAll();
    });

    // gradient
    const gradAngleIn = $('#gradAngle');
    gradAngleIn && gradAngleIn.addEventListener('input', () => {
      gradAngle = Number(gradAngleIn.value);
      const gv = $('#gradAngleVal');
      if (gv) gv.textContent = gradAngle + '°';
      renderGradientTab();
    });
    const gradAdd = document.createElement('button');
    gradAdd.className = 'small-button ghost';
    gradAdd.id = 'gradAddBtn';
    gradAdd.textContent = 'Add stop';
    gradAdd.dataset.sndOff = '';
    gradAdd.addEventListener('click', addGradStop);
    const gradPanel = $('#tab-gradient');
    gradPanel && gradPanel.insertBefore(gradAdd, $('#gradCss'));
    const gradCopy = $('#gradCopy');
    gradCopy && gradCopy.addEventListener('click', () => copyText('background: ' + Color.gradientCss(gradStops, gradAngle) + ';', 'Gradient CSS copied'));
    const gradApply = $('#gradApply');
    gradApply && gradApply.addEventListener('click', () => {
      state.palette = [...gradStops, ...state.palette.slice(gradStops.length)].slice(0, 5);
      persist();
      Sound.play('generate');
      toast('Gradient applied to palette', 'success');
      renderAll();
    });

    // contrast inputs
    const ctFg = $('#ctFgIn'), ctBg = $('#ctBgIn');
    ctFg && ctFg.addEventListener('input', () => { ct.fg = ctFg.value.toUpperCase(); renderContrast(); });
    ctBg && ctBg.addEventListener('input', () => { ct.bg = ctBg.value.toUpperCase(); renderContrast(); });

    // preview tabs
    $$('.preview-tab', view).forEach(tab => tab.addEventListener('click', () => {
      $$('.preview-tab', view).forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      state.preview = tab.dataset.preview;
      persist();
      Sound.play('select');
      renderPreview();
    }));

    // history / saved / exports
    const undoBtn = $('#undoBtn');
    undoBtn && undoBtn.addEventListener('click', undo);
    const saveBtn = $('#savePalBtn');
    saveBtn && saveBtn.addEventListener('click', savePalette);
    const ej = $('#expJson'); ej && ej.addEventListener('click', exportJSON);
    const ec = $('#expCss'); ec && ec.addEventListener('click', exportCSS);
    const ep = $('#expPng'); ep && ep.addEventListener('click', exportPNG);

    // keyboard shortcut: Ctrl/Cmd+Z undo
    view.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    });

    window.addEventListener('resize', () => { wDirty = true; if (Router.current === 'colors') drawWheel(); });
  }

  /* ------------------------------------------------------------ seed intake */
  function consumeSeed() {
    const seed = window.LISTO.seed;
    if (!seed) return;
    window.LISTO.seed = null;
    if (seed.mood) {
      const pal = Color.moodPalette(seed.mood);
      if (pal) { state.palette = [...pal]; state.core = pal[2]; state.harmony = 'Analogous'; }
      toast(seed.mood + ' mood loaded', 'success');
    } else if (Array.isArray(seed.palette) && seed.palette.length) {
      state.palette = seed.palette.slice(0, 5);
      state.core = seed.core || seed.palette[2] || seed.palette[0];
      toast('Palette loaded', 'success');
    } else if (seed.core) {
      state.core = seed.core;
      regen(false);
    }
    Sound.play('generate');
    persist();
  }

  /* ------------------------------------------------------------------- init */
  let inited = false;
  function init() {
    if (inited) return;
    inited = true;
    if (!state.palette) regen(false);
    if (!gradStops.length) gradStops = defaultStops();
    const fg = $('#ctFgIn'), bg = $('#ctBgIn');
    if (fg) fg.value = ct.fg = '#FFFFFF';
    if (bg) bg.value = ct.bg = state.core;
    bind();
    consumeSeed();
    renderAll();
    renderMoodChips();
    renderHistory();
    renderSaved();
    persist();
  }

  /* ------------------------------------------------- shared project bridge */
  document.addEventListener('listo:project', e => {
    const detail = e.detail || {};
    if (detail.source === 'explorer' || !detail.project || !detail.project.color) return;
    const c = detail.project.color;
    if (!Color.hexToRgb(c.core) || !Array.isArray(c.palette) || c.palette.length !== 5) return;
    state.core = c.core;
    state.harmony = c.harmony || state.harmony;
    state.palette = [...c.palette];
    state.locks = Array.isArray(c.locks) && c.locks.length === 5 ? [...c.locks] : state.locks;
    state.mood = c.mood || state.mood;
    store.setJSON('listo-explorer', state);
    if (inited) renderAll();
  });

  Router.register('colors', { init });
  document.addEventListener('listo:view', e => {
    if (e.detail === 'colors' && inited) { consumeSeed(); renderAll(); }
  });
  document.addEventListener('listo:palettes', () => { /* homepage strip refreshes itself */ });
})();
