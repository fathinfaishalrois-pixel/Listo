/* ==========================================================================
   LISTO. — home.js
   Homepage: interactive hero wheel, scroll choreography, featured palettes,
   mood tiles, recent projects.
   ========================================================================== */
(() => {
  'use strict';
  const { $, $$, clamp, raf, store, Sound, toast, Color, Router, Projects,
          reduceMotion, finePointer } = window.LISTO;
  const root = document.documentElement;

  /* ----------------------------------------------------------------- seed data */
  const SEED_PALETTES = [
    { name: 'Midnight Signal', core: '#6D5CE8', colors: ['#101532', '#28306B', '#6D5CE8', '#9277F2', '#CDC5FF'], origin: 'Curated' },
    { name: 'Soft Terrain',    core: '#A98F6F', colors: ['#2B2420', '#6B5844', '#A98F6F', '#D9C1A3', '#F0E4D4'], origin: 'Curated' },
    { name: 'Electric Bloom',  core: '#C026D3', colors: ['#170A33', '#5B21B6', '#C026D3', '#F472B6', '#FDE68A'], origin: 'Curated' },
    { name: 'Tidal Glass',     core: '#01BAEF', colors: ['#06222E', '#0B4F6C', '#01BAEF', '#8CE9F5', '#EAF7FA'], origin: 'Curated' },
    { name: 'Violet Dusk',     core: '#7C5CF5', colors: ['#171233', '#3B2E7E', '#7C5CF5', '#BDABFF', '#F2E9FF'], origin: 'Curated' }
  ];

  function savedPalettes() {
    const saved = store.getJSON('listo-palettes', []);
    return Array.isArray(saved) ? saved : [];
  }

  /* ------------------------------------------------------- interactive hero wheel */
  const hero = (() => {
    const canvas = $('#heroWheel');
    const knob = $('#heroKnob');
    const halo = $('#heroHalo');
    const swatch = $('#heroSwatch');
    const hexOut = $('#heroHex');
    if (!canvas || !knob) return;

    const hsv = Color.hexToHsv(store.get('listo-hero-color', '#6D5CE8'));
    let size = 300, cx = 150, cy = 150, radius = 150;

    function measure() {
      const rect = canvas.parentElement.getBoundingClientRect();
      size = Math.max(200, Math.min(rect.width || 300, 340));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = size / 2; cy = size / 2; radius = size / 2 - 2;
      drawWheel(ctx);
      render(false);
    }

    function drawWheel(ctx) {
      const img = ctx.createImageData(size, size);
      const d = img.data;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - cx, dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const i = (y * size + x) * 4;
          if (dist > radius + 1) { d[i + 3] = 0; continue; }
          const ang = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
          const sat = Math.min(100, dist / radius * 100);
          const [r, g, b] = Color.hsvToRgb(ang, sat, 100);
          const alpha = dist > radius - 1 ? clamp((radius + 1 - dist) * 255, 0, 255) : 255;
          d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = alpha;
        }
      }
      ctx.putImageData(img, 0, 0);
      // rim
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    function apply(h, s) {
      hsv[0] = ((h % 360) + 360) % 360;
      hsv[1] = clamp(s, 0, 100);
      render(true);
    }

    function render(sound) {
      const hex = Color.hsvToHex(hsv[0], hsv[1], hsv[2]);
      const a = hsv[0] * Math.PI / 180;
      const r = hsv[1] / 100 * radius;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      knob.style.transform = `translate(${(px - 12).toFixed(1)}px, ${(py - 12).toFixed(1)}px)`;
      knob.style.background = hex;
      knob.setAttribute('aria-valuenow', String(Math.round(hsv[0])));
      knob.setAttribute('aria-valuetext', `hue ${Math.round(hsv[0])}, saturation ${Math.round(hsv[1])} percent`);
      if (swatch) swatch.style.background = hex;
      if (hexOut) hexOut.textContent = hex;
      if (halo) {
        halo.style.background =
          `radial-gradient(circle, ${Color.hsvToHex(hsv[0], Math.min(95, hsv[1] + 18), 62)}55, ` +
          `${Color.hsvToHex(hsv[0] + 40, 70, 55)}22 45%, transparent 70%)`;
      }
      root.style.setProperty('--hero-h', String(Math.round(hsv[0])));
      store.set('listo-hero-color', hex);
      if (sound) Sound.play('select');
    }

    function pos(e) {
      const rect = canvas.getBoundingClientRect();
      const dx = e.clientX - (rect.left + cx);
      const dy = e.clientY - (rect.top + cy);
      return [Math.atan2(dy, dx) * 180 / Math.PI, Math.min(100, Math.sqrt(dx * dx + dy * dy) / radius * 100)];
    }

    let dragging = false;
    const wrap = canvas.parentElement;
    const start = e => { dragging = true; wrap.setPointerCapture && wrap.setPointerCapture(e.pointerId); move(e); };
    const move = e => {
      if (!dragging && e.type === 'pointermove') return;
      if (e.type === 'pointerdown') dragging = true;
      const [h, s] = pos(e);
      apply(h, s);
    };
    const end = () => { dragging = false; };

    wrap.addEventListener('pointerdown', e => { start(e); e.preventDefault(); });
    window.addEventListener('pointermove', e => { if (dragging) move(e); }, { passive: true });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);

    knob.addEventListener('keydown', e => {
      const step = e.shiftKey ? 15 : 3;
      let handled = true;
      if (e.key === 'ArrowLeft') apply(hsv[0] - step, hsv[1]);
      else if (e.key === 'ArrowRight') apply(hsv[0] + step, hsv[1]);
      else if (e.key === 'ArrowUp') apply(hsv[0], hsv[1] + step);
      else if (e.key === 'ArrowDown') apply(hsv[0], hsv[1] - step);
      else handled = false;
      if (handled) e.preventDefault();
    });

    const useBtn = $('#heroUse');
    if (useBtn) useBtn.addEventListener('click', () => {
      window.LISTO.seed = { core: Color.hsvToHex(hsv[0], hsv[1], hsv[2]), from: 'hero' };
      Router.go('colors');
    });

    measure();
    let resizeT;
    window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(measure, 160); });
    return { get hex() { return Color.hsvToHex(hsv[0], hsv[1], hsv[2]); } };
  })();

  /* ----------------------------------------------------------- scroll effects */
  let sweepReveals = () => {};
  let scrollQueued = false;
  function onScroll() {
    if (Router.current !== 'home') { scrollQueued = false; return; }
    const y = window.scrollY || 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    root.style.setProperty('--p', max > 0 ? clamp(y / max, 0, 1).toFixed(4) : 0);
    const topbar = $('.topbar');
    if (topbar) topbar.classList.toggle('scrolled', y > 45);
    if (!reduceMotion) {
      root.style.setProperty('--px-a', clamp(y * 0.07, 0, 90) + 'px');
      root.style.setProperty('--px-b', clamp(y * -0.04, -60, 0) + 'px');
    }
    sweepReveals();
    scrollQueued = false;
  }
  window.addEventListener('scroll', () => {
    if (!scrollQueued) { raf(onScroll); scrollQueued = true; }
  }, { passive: true });

  /* ----------------------------------------------------------- pointer light */
  if (!reduceMotion && finePointer) {
    const light = $('#pointerLight');
    let pointerQueued = false;
    let mx = 0, my = 0;
    const applyPointer = () => {
      root.style.setProperty('--mx', mx + 'px');
      root.style.setProperty('--my', my + 'px');
      pointerQueued = false;
    };
    window.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY;
      if (light) light.classList.add('active');
      if (!pointerQueued) { raf(applyPointer); pointerQueued = true; }
    }, { passive: true });
    document.addEventListener('mouseleave', () => { if (light) light.classList.remove('active'); });
    window.addEventListener('blur', () => { if (light) light.classList.remove('active'); });
  }

  /* --------------------------------------------------------- scroll reveals */
  const revealed = new WeakSet();
  function initReveals() {
    const selectors = [
      '.intro-section .section-kicker', '.intro-grid > *',
      '.tools-section .section-heading > *', '.tool-card',
      '.palettes-section .section-heading > *', '.pal-card',
      '.moods-section .section-heading > *', '.mood-tile',
      '.recents-section .section-heading > *', '.recent-item',
      '.feature-visual', '.feature-copy > *',
      '.closing-section > *:not(.closing-glow)', '.footer > *'
    ];
    const items = [];
    selectors.forEach(sel => $$(sel).forEach(el => {
      if (!items.includes(el) && !revealed.has(el)) items.push(el);
    }));
    if (!items.length) return;
    items.forEach(el => {
      const siblings = [...el.parentElement.children].filter(n => items.includes(n) || revealed.has(n));
      el.style.setProperty('--d', Math.min(siblings.indexOf(el), 6) * 70 + 'ms');
      el.classList.add('reveal');
    });
    const pending = new Set(items);
    const settle = el => {
      if (!pending.has(el)) return;
      pending.delete(el);
      revealed.add(el);
      el.classList.add('in');
      const done = () => {
        el.classList.remove('reveal', 'in');
        el.style.removeProperty('--d');
        el.removeEventListener('transitionend', done);
      };
      el.addEventListener('transitionend', done);
      setTimeout(done, 1400);
    };
    sweepReveals = () => {
      if (!pending.size) return;
      const threshold = window.innerHeight * 0.95;
      [...pending].forEach(el => {
        if (el.getBoundingClientRect().top < threshold) settle(el);
      });
    };
    if (!('IntersectionObserver' in window) || reduceMotion) {
      items.forEach(settle);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        settle(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    items.forEach(el => observer.observe(el));
    sweepReveals();
  }

  /* -------------------------------------------------------- magnetic buttons */
  if (!reduceMotion && finePointer) {
    $$('.magnetic, .nav-cta').forEach(el => {
      el.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        el.style.transform = `translate3d(${(dx * 8).toFixed(1)}px, ${(dy * 6).toFixed(1)}px, 0)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* -------------------------------------------------------- featured palettes */
  function renderPalettes() {
    const strip = $('#paletteStrip');
    if (!strip) return;
    const saved = savedPalettes().slice(0, 4).map(p => ({
      name: p.name || 'Saved palette', core: p.colors ? p.colors[2] || p.colors[0] : '#6D5CE8',
      colors: p.colors || [], origin: 'Saved on this device'
    }));
    const all = [...saved, ...SEED_PALETTES].slice(0, 8);
    strip.innerHTML = all.map((p, i) => `
      <button class="pal-card glass glass-crystal reveal" style="--d:${(i % 8) * 60}ms"
              data-palette="${p.colors.map(c => c.replace('#', '')).join(',')}"
              data-core="${(p.core || p.colors[0]).replace('#', '')}"
              aria-label="Open ${p.name} in Color Explorer">
        <span class="pal-bars" aria-hidden="true">${p.colors.map(c => `<i style="background:${c}"></i>`).join('')}</span>
        <span class="pal-name">${p.name}</span>
        <span class="pal-meta">${p.origin} · ${p.colors.length} colors</span>
        <span class="pal-go" aria-hidden="true">↗</span>
      </button>`).join('');
    $$('.pal-card', strip).forEach(card => card.addEventListener('click', () => {
      const colors = (card.dataset.palette || '').split(',').filter(Boolean).map(c => '#' + c.toUpperCase());
      const core = '#' + (card.dataset.core || colors[0]).replace('#', '').toUpperCase();
      window.LISTO.seed = { palette: colors, core, from: 'home' };
      Router.go('colors');
    }));
    initReveals();
  }

  /* ------------------------------------------------------------- mood tiles */
  function renderMoods() {
    const wrap = $('#moodTiles');
    if (!wrap) return;
    const grads = {
      Warm: ['#3a1d0e', '#e2823c', '#f4c163'],
      Cool: ['#0a2338', '#1d7fa8', '#8ce9f5'],
      Pastel: ['#f6e7ef', '#c9e4f4', '#f5d9c8'],
      Muted: ['#413f4a', '#8b8794', '#c2bfb6'],
      Vibrant: ['#1b0b3a', '#c026d3', '#01baef'],
      Dark: ['#05060f', '#171233', '#3b2e7e'],
      Earthy: ['#241a12', '#6b5844', '#c9a37a'],
      'High Contrast': ['#0b0d18', '#ffffff', '#e23c3c']
    };
    wrap.innerHTML = Object.keys(Color.MOODS).map((mood, i) => {
      const g = grads[mood] || ['#222', '#555', '#999'];
      const words = Color.MOODS[mood].words;
      return `
      <button class="mood-tile" data-mood="${mood}" style="--d:${i * 55}ms" aria-label="Open ${mood} mood in Color Explorer">
        <span class="mt-swatch" style="background:linear-gradient(135deg, ${g[0]}, ${g[1]} 55%, ${g[2]})" aria-hidden="true"></span>
        <span class="mt-name">${mood}</span>
        <span class="mt-words">${words}</span>
        <span class="mt-go" aria-hidden="true">↗</span>
      </button>`;
    }).join('');
    $$('.mood-tile', wrap).forEach(tile => tile.addEventListener('click', () => {
      window.LISTO.seed = { mood: tile.dataset.mood, from: 'home' };
      Router.go('colors');
    }));
  }

  /* --------------------------------------------------------- recent projects */
  const typeLabels = { palette: 'PALETTE', studio: 'WORKSPACE', blueprint: 'BLUEPRINT' };
  function renderRecents() {
    const list = $('#recentsList');
    if (!list) return;
    const items = Projects.list().slice(0, 6);
    if (!items.length) {
      list.innerHTML = `
        <div class="recents-empty">
          <span>No projects yet.</span>
          <p>Palettes you save and workspaces you keep will appear here — stored only on this device.</p>
          <a class="text-link" href="#colors">Start with a color <span aria-hidden="true">↗</span></a>
        </div>`;
      return;
    }
    list.innerHTML = items.map(p => {
      const d = new Date(p.ts);
      const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      const route = p.type === 'palette' ? 'colors' : p.type === 'references' ? 'references' : 'studio';
      const chips = Array.isArray(p.meta && p.meta.colors)
        ? `<span class="recent-chips" aria-hidden="true">${p.meta.colors.slice(0, 5).map(c => `<i style="background:${c}"></i>`).join('')}</span>`
        : '';
      return `
      <button class="recent-item" data-route="${route}" data-id="${p.id}">
        <span class="recent-type">${typeLabels[p.type] || 'PROJECT'}</span>
        <span class="recent-name">${p.title}</span>
        ${chips}
        <span class="recent-date">${date} · ${time}</span>
        <span class="recent-go" aria-hidden="true">↗</span>
      </button>`;
    }).join('');
    $$('.recent-item', list).forEach(el => el.addEventListener('click', () => {
      const item = Projects.list().find(x => x.id === el.dataset.id);
      if (item && item.meta) {
        if (item.type === 'palette' && Array.isArray(item.meta.colors)) {
          window.LISTO.seed = { palette: item.meta.colors, core: item.meta.core || item.meta.colors[0], from: 'recents' };
        } else if (item.type === 'studio' && item.meta.state) {
          window.LISTO.studioSeed = item.meta.state;
        }
      }
      Router.go(el.dataset.route);
    }));
  }

  document.addEventListener('listo:projects', renderRecents);
  document.addEventListener('listo:palettes', renderPalettes);
  document.addEventListener('listo:ready', () => {
    initReveals();
    renderPalettes();
    renderMoods();
    renderRecents();
    onScroll();
  });
})();
