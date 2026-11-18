/* ==========================================================================
   LISTO. — references.js
   Visual References: curated sample studies (clearly labeled, locally drawn),
   search / category filters, favorites, detail drawer with extractable
   palettes, and local image import (IndexedDB) with palette extraction.
   ========================================================================== */
(() => {
  'use strict';
  const { $, $$, clamp, uid, raf, store, Sound, toast, copyText, Color, Router, IDB } = window.LISTO;
  const view = $('#view-references');
  if (!view) return;

  /* ============================================================ CURATED SET */
  // Every visual is generated here — nothing is scraped or fabricated as
  // "community content". Source note on each card says so plainly.
  const rng = seed => { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };

  const REFS = [
    {
      id: 'cur-aurora-field', cat: 'Color Study', title: 'Aurora Field',
      desc: 'Soft ribbons of color drifting across a deep field — a study in how hue temperature reads as atmosphere.',
      tags: ['aurora', 'gradient', 'calm', 'flow'],
      palette: ['#101532', '#28306B', '#6D5CE8', '#9277F2', '#CDC5FF'],
      art: (w, h) => {
        let s = `<rect width="${w}" height="${h}" fill="#101532"/>`;
        const bands = [[0, '#28306B'], [1, '#6D5CE8'], [2, '#9277F2'], [3, '#CDC5FF']];
        bands.forEach(([i, c], n) => {
          const y = h * (.18 + n * .16);
          s += `<path d="M0 ${y} C ${w * .25} ${y - h * .12}, ${w * .55} ${y + h * .12}, ${w} ${y - h * .05} L ${w} ${y + h * .1} C ${w * .55} ${y + h * .22}, ${w * .25} ${y + h * .02}, 0 ${y + h * .14} Z" fill="${c}" opacity="${.55 + n * .1}"/>`;
        });
        return s;
      }, w: 640, h: 420
    },
    {
      id: 'cur-signal-poster', cat: 'Typography', title: 'Signal Poster',
      desc: 'A typographic poster skeleton: one loud headline, a mono kicker, and generous negative space at the base.',
      tags: ['poster', 'type', 'hierarchy'],
      palette: ['#0B0D18', '#171233', '#F2E9FF', '#BDABFF', '#F2A37C'],
      art: (w, h) => `
        <rect width="${w}" height="${h}" fill="#0B0D18"/>
        <rect x="0" y="0" width="${w}" height="8" fill="#F2A37C"/>
        <text x="40" y="86" font-family="'DM Mono', monospace" font-size="20" letter-spacing="6" fill="#BDABFF">SIGNAL / 01</text>
        <text x="34" y="240" font-family="Manrope, sans-serif" font-weight="800" font-size="132" fill="#F2E9FF">STAY</text>
        <text x="34" y="366" font-family="Manrope, sans-serif" font-weight="800" font-size="132" fill="#BDABFF">READY</text>
        <rect x="34" y="404" width="${w - 68}" height="2" fill="rgba(242,233,255,.25)"/>
        <text x="34" y="446" font-family="'DM Sans', sans-serif" font-size="17" fill="rgba(242,233,255,.6)">Small caption line for balance and rhythm.</text>`,
      w: 640, h: 500
    },
    {
      id: 'cur-orbital', cat: 'Geometry', title: 'Orbital Study',
      desc: 'Concentric rings with satellites — rotational balance and a single strong focal center.',
      tags: ['rings', 'balance', 'space'],
      palette: ['#05060F', '#0E1A3C', '#7CE6F2', '#BDABFF', '#F2A37C'],
      art: (w, h) => {
        const cx = w / 2, cy = h / 2;
        let s = `<rect width="${w}" height="${h}" fill="#05060F"/>`;
        [0.94, 0.76, 0.58, 0.4].forEach((f, i) => {
          s += `<circle cx="${cx}" cy="${cy}" r="${Math.min(w, h) * f / 2}" fill="none" stroke="${i % 2 ? '#7CE6F2' : '#BDABFF'}" stroke-width="1.4" opacity="${.8 - i * .15}"/>`;
        });
        [[0.94, 3], [0.76, 5], [0.58, 7]].forEach(([f, n], ring) => {
          for (let i = 0; i < n; i++) {
            const a = i * 2 * Math.PI / n + ring * .6;
            s += `<circle cx="${cx + Math.cos(a) * Math.min(w, h) * f / 2}" cy="${cy + Math.sin(a) * Math.min(w, h) * f / 2}" r="${5 - ring}" fill="${['#F2A37C', '#7CE6F2', '#BDABFF'][ring]}"/>`;
          }
        });
        s += `<circle cx="${cx}" cy="${cy}" r="10" fill="#F2E9FF"/><circle cx="${cx}" cy="${cy}" r="20" fill="none" stroke="#F2E9FF" opacity=".5"/>`;
        return s;
      }, w: 600, h: 600
    },
    {
      id: 'cur-bauhaus', cat: 'Layout', title: 'Bauhaus Blocks',
      desc: 'Primary shapes on a strict grid — weight, counterform and the grid doing all the talking.',
      tags: ['grid', 'shapes', 'primary'],
      palette: ['#F4F1EA', '#E23C3C', '#2B6CB8', '#F2C230', '#17182D'],
      art: (w, h) => {
        const cw = w / 4, ch = h / 3;
        const cells = [
          ['circle', '#E23C3C', 0, 0], ['rect', '#2B6CB8', 1, 0], ['tri', '#F2C230', 2, 0], ['dot', '#17182D', 3, 0],
          ['tri', '#2B6CB8', 0, 1], ['dot', '#E23C3C', 1, 1], ['circle', '#17182D', 2, 1], ['rect', '#F2C230', 3, 1],
          ['rect', '#17182D', 0, 2], ['tri', '#E23C3C', 1, 2], ['circle', '#F2C230', 2, 2], ['dot', '#2B6CB8', 3, 2]
        ];
        return `<rect width="${w}" height="${h}" fill="#F4F1EA"/>` + cells.map(([t, c, gx, gy]) => {
          const x = gx * cw, y = gy * ch, cx = x + cw / 2, cy = y + ch / 2, r = Math.min(cw, ch) * .36;
          if (t === 'circle') return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/>`;
          if (t === 'rect') return `<rect x="${x + cw * .18}" y="${y + ch * .2}" width="${cw * .64}" height="${ch * .6}" fill="${c}"/>`;
          if (t === 'tri') return `<path d="M ${cx} ${cy - r} L ${cx + r} ${cy + r * .8} L ${cx - r} ${cy + r * .8} Z" fill="${c}"/>`;
          return `<circle cx="${cx}" cy="${cy}" r="${r * .28}" fill="${c}"/>`;
        }).join('');
      }, w: 640, h: 480
    },
    {
      id: 'cur-tonal-wave', cat: 'Color Study', title: 'Tonal Wave',
      desc: 'One hue stepped through value. A lesson in monochrome depth without touching saturation.',
      tags: ['tonal', 'monochrome', 'layers'],
      palette: ['#06222E', '#0B4F6C', '#1583A8', '#4CC3DE', '#B8EDF7'],
      art: (w, h) => {
        let s = `<rect width="${w}" height="${h}" fill="#06222E"/>`;
        for (let i = 0; i < 5; i++) {
          const y = h * (.3 + i * .13), amp = h * (.05 + i * .015), c = ['#0B4F6C', '#1583A8', '#4CC3DE', '#8ADAEA', '#B8EDF7'][i];
          s += `<path d="M0 ${y} Q ${w * .25} ${y - amp}, ${w * .5} ${y} T ${w} ${y - amp * .4} L ${w} ${h} L 0 ${h} Z" fill="${c}" opacity="${.9 - i * .08}"/>`;
        }
        return s;
      }, w: 640, h: 420
    },
    {
      id: 'cur-shards', cat: 'Texture', title: 'Shard Field',
      desc: 'Angular translucent shards stacked with multiply-like overlap — a reusable texture recipe.',
      tags: ['shards', 'translucent', 'texture'],
      palette: ['#1A0B2E', '#5B21B6', '#C026D3', '#F472B6', '#FDE68A'],
      art: (w, h) => {
        const r = rng(11);
        let s = `<rect width="${w}" height="${h}" fill="#1A0B2E"/>`;
        for (let i = 0; i < 14; i++) {
          const x = r() * w, y = r() * h, len = w * (.2 + r() * .3), a = r() * Math.PI;
          const c = ['#5B21B6', '#C026D3', '#F472B6', '#FDE68A'][i % 4];
          const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
          const px = -Math.sin(a) * len * .18, py = Math.cos(a) * len * .18;
          s += `<path d="M ${x} ${y} L ${x2} ${y2} L ${x2 + px} ${y2 + py} L ${x + px} ${y + py} Z" fill="${c}" opacity=".55"/>`;
        }
        return s;
      }, w: 640, h: 440
    },
    {
      id: 'cur-grid-tones', cat: 'Layout', title: 'Grid Tones',
      desc: 'A modular grid carrying tone blocks of descending lightness — hierarchy you can measure.',
      tags: ['modular', 'tones', 'hierarchy'],
      palette: ['#12142B', '#1E2A5A', '#3C55A8', '#7E9BE8', '#DDE6FF'],
      art: (w, h) => {
        const cols = 6, rows = 4, cw = w / cols, ch = h / rows;
        let s = `<rect width="${w}" height="${h}" fill="#12142B"/>`;
        const tones = ['#1E2A5A', '#3C55A8', '#7E9BE8', '#DDE6FF'];
        for (let gy = 0; gy < rows; gy++) {
          for (let gx = 0; gx < cols; gx++) {
            const span = (gx + gy * 2) % 7 === 0 ? 2 : 1;
            const c = tones[(gx * 2 + gy) % 4];
            const ww = Math.min(span, cols - gx) * cw;
            s += `<rect x="${gx * cw + 3}" y="${gy * ch + 3}" width="${ww - 6}" height="${ch - 6}" fill="${c}" opacity="${.55 + ((gx + gy) % 3) * .15}" rx="6"/>`;
            if (span === 2) gx++;
          }
        }
        return s;
      }, w: 640, h: 420
    },
    {
      id: 'cur-horizon', cat: 'Photography', title: 'Horizon Test',
      desc: 'A composition study frame: horizon placement, focal sun, and reflection — before a single photo exists.',
      tags: ['horizon', 'composition', 'study'],
      palette: ['#2A1030', '#7A2E5C', '#E2688A', '#F6C29A', '#FBE8D3'],
      art: (w, h) => {
        const hz = h * .58;
        return `<rect width="${w}" height="${h}" fill="#2A1030"/>
        <rect width="${w}" height="${hz}" fill="url(#hzsky)"/>
        <defs><linearGradient id="hzsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A1030"/><stop offset=".7" stop-color="#7A2E5C"/><stop offset="1" stop-color="#E2688A"/></linearGradient></defs>
        <circle cx="${w * .68}" cy="${hz - h * .12}" r="${h * .1}" fill="#FBE8D3"/>
        <circle cx="${w * .68}" cy="${hz - h * .12}" r="${h * .16}" fill="#F6C29A" opacity=".3"/>
        <rect y="${hz}" width="${w}" height="${h - hz}" fill="#1B0A20"/>
        <rect x="${w * .6}" y="${hz}" width="${w * .16}" height="3" fill="#FBE8D3" opacity=".8"/>
        <rect x="${w * .63}" y="${hz + 10}" width="${w * .1}" height="2" fill="#FBE8D3" opacity=".5"/>
        <rect x="${w * .66}" y="${hz + 20}" width="${w * .05}" height="2" fill="#FBE8D3" opacity=".3"/>`;
      }, w: 640, h: 420
    },
    {
      id: 'cur-ink-speckle', cat: 'Texture', title: 'Ink Speckle',
      desc: 'Deterministic speckle noise over paper tones — grain without a single bitmap.',
      tags: ['noise', 'paper', 'grain'],
      palette: ['#EFEAE0', '#D8CFBE', '#8A7B63', '#4A4034', '#221D16'],
      art: (w, h) => {
        const r = rng(42);
        let s = `<rect width="${w}" height="${h}" fill="#EFEAE0"/>`;
        const inks = ['#8A7B63', '#4A4034', '#221D16'];
        for (let i = 0; i < 260; i++) {
          const x = r() * w, y = r() * h, rad = r() * r() * 5 + .6;
          s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="${inks[i % 3]}" opacity="${(.15 + r() * .5).toFixed(2)}"/>`;
        }
        return s;
      }, w: 600, h: 450
    },
    {
      id: 'cur-type-scale', cat: 'Typography', title: 'Type Scale',
      desc: 'A modular type scale specimen — ratios you can feel before committing to a stylesheet.',
      tags: ['scale', 'specimen', 'ratio'],
      palette: ['#17182D', '#3A3A55', '#B9BCD6', '#7CE6F2', '#F4F4FB'],
      art: (w, h) => `
        <rect width="${w}" height="${h}" fill="#17182D"/>
        <text x="36" y="96" font-family="Manrope, sans-serif" font-weight="800" font-size="64" fill="#F4F4FB">Aa 48</text>
        <text x="36" y="156" font-family="Manrope, sans-serif" font-weight="600" font-size="34" fill="#B9BCD6">Aa 24 · 1.5 ratio</text>
        <text x="36" y="196" font-family="Manrope, sans-serif" font-weight="500" font-size="22" fill="#7CE6F2">Aa 16 — body</text>
        <text x="36" y="224" font-family="'DM Mono', monospace" font-size="14" fill="#3A3A55">Aa 12 mono caption</text>
        <rect x="36" y="252" width="${w - 72}" height="1" fill="rgba(255,255,255,.15)"/>
        <text x="36" y="300" font-family="'DM Mono', monospace" font-size="13" fill="#B9BCD6">48 / 32 / 24 / 16 / 12</text>`,
      w: 560, h: 340
    },
    {
      id: 'cur-radial-balance', cat: 'Geometry', title: 'Radial Balance',
      desc: 'Petal rotation at equal angles — rotational symmetry as a layout engine.',
      tags: ['radial', 'symmetry', 'rotation'],
      palette: ['#0E0E1A', '#245B4F', '#7FE9C4', '#F2E9A0', '#F2A37C'],
      art: (w, h) => {
        const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .4;
        let s = `<rect width="${w}" height="${h}" fill="#0E0E1A"/><circle cx="${cx}" cy="${cy}" r="${R * 1.12}" fill="none" stroke="rgba(127,233,196,.35)"/>`;
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          s += `<ellipse cx="${cx + Math.cos(a) * R * .58}" cy="${cy + Math.sin(a) * R * .58}" rx="${R * .3}" ry="${R * .16}" fill="${i % 2 ? '#7FE9C4' : '#245B4F'}" transform="rotate(${i * 22.5} ${cx + Math.cos(a) * R * .58} ${cy + Math.sin(a) * R * .58})" opacity=".9"/>`;
        }
        s += `<circle cx="${cx}" cy="${cy}" r="${R * .12}" fill="#F2E9A0"/><circle cx="${cx}" cy="${cy}" r="${R * .05}" fill="#F2A37C"/>`;
        return s;
      }, w: 600, h: 600
    },
    {
      id: 'cur-deep-space', cat: 'Color Study', title: 'Deep Space',
      desc: 'Glowing orbs on near-black — how little saturation a palette needs to still sing.',
      tags: ['dark', 'glow', 'contrast'],
      palette: ['#030410', '#141B4D', '#5A4FF0', '#9C8BFF', '#E4DEFF'],
      art: (w, h) => {
        const r = rng(7);
        let s = `<rect width="${w}" height="${h}" fill="#030410"/>`;
        for (let i = 0; i < 46; i++) {
          s += `<circle cx="${(r() * w).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${(r() * 1.6 + .3).toFixed(1)}" fill="#E4DEFF" opacity="${(.2 + r() * .6).toFixed(2)}"/>`;
        }
        s += `<circle cx="${w * .3}" cy="${h * .42}" r="${h * .17}" fill="#5A4FF0"/><circle cx="${w * .3}" cy="${h * .42}" r="${h * .23}" fill="#5A4FF0" opacity=".22"/><circle cx="${w * .3}" cy="${h * .42}" r="${h * .3}" fill="#5A4FF0" opacity=".08"/>`;
        s += `<circle cx="${w * .66}" cy="${h * .6}" r="${h * .1}" fill="#9C8BFF"/><circle cx="${w * .66}" cy="${h * .6}" r="${h * .16}" fill="#9C8BFF" opacity=".18"/>`;
        return s;
      }, w: 640, h: 440
    },
    {
      id: 'cur-paper-fold', cat: 'Texture', title: 'Paper Fold',
      desc: 'Faceted planes shading a single hue — cheap depth from geometry alone.',
      tags: ['facets', 'depth', 'paper'],
      palette: ['#1C1408', '#6B4E1E', '#C9A15C', '#EBD9AE', '#FBF4E2'],
      art: (w, h) => {
        const r = rng(23);
        let s = `<rect width="${w}" height="${h}" fill="#1C1408"/>`;
        const tones = ['#6B4E1E', '#C9A15C', '#EBD9AE', '#FBF4E2'];
        for (let i = 0; i < 10; i++) {
          const x = r() * w, y = r() * h;
          const pts = `${x},${y} ${x + w * (.2 + r() * .35)},${y + (r() - .5) * h * .5} ${x + (r() - .5) * w * .4},${y + h * (.2 + r() * .35)}`;
          s += `<polygon points="${pts}" fill="${tones[i % 4]}" opacity="${(.5 + r() * .4).toFixed(2)}"/>`;
        }
        return s;
      }, w: 620, h: 440
    },
    {
      id: 'cur-mood-board', cat: 'Layout', title: 'Mood Board Frame',
      desc: 'A collage skeleton — swatch tiles, text bars and one hero block, ready to be filled with direction.',
      tags: ['collage', 'board', 'template'],
      palette: ['#14121F', '#2A2440', '#6D5CE8', '#01BAEF', '#F2A37C'],
      art: (w, h) => {
        const cw = w / 3, ch = h / 3;
        const tiles = [
          ['#2A2440', 0, 0, 2], ['#01BAEF', 2, 0, 1], ['#6D5CE8', 0, 1, 1], ['#14121F', 1, 1, 1], ['#F2A37C', 2, 1, 1], ['#2A2440', 0, 2, 1], ['#01BAEF', 1, 2, 2]
        ];
        let s = `<rect width="${w}" height="${h}" fill="#14121F"/>`;
        tiles.forEach(([c, gx, gy, span]) => {
          const x = gx * cw + 5, y = gy * ch + 5, ww = span * cw - 10, hh = ch - 10;
          s += `<rect x="${x}" y="${y}" width="${ww}" height="${hh}" fill="${c}" rx="8"/>`;
          if (c === '#14121F') {
            s += `<rect x="${x + 12}" y="${y + 14}" width="${ww * .7}" height="8" rx="4" fill="rgba(255,255,255,.4)"/><rect x="${x + 12}" y="${y + 30}" width="${ww * .5}" height="8" rx="4" fill="rgba(255,255,255,.2)"/><rect x="${x + 12}" y="${y + 46}" width="${ww * .6}" height="8" rx="4" fill="rgba(255,255,255,.2)"/>`;
          }
        });
        return s;
      }, w: 640, h: 480
    }
  ];

  const CATS = ['Color Study', 'Typography', 'Layout', 'Geometry', 'Photography', 'Texture'];

  /* ------------------------------------------------------------------ state */
  let favs = store.getJSON('listo-refs', null);
  if (favs === null || typeof favs !== 'object' || Array.isArray(favs)) favs = {};
  let imports = store.getJSON('listo-refs-imports', null);
  if (!Array.isArray(imports)) imports = [];   // [{id, name, ts}]
  let filterCat = 'All';
  let query = '';
  const refUrls = new Map();

  function saveMeta() {
    store.setJSON('listo-refs', favs);
    store.setJSON('listo-refs-imports', imports);
  }

  function svgDoc(item) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${item.w} ${item.h}" role="img" aria-label="${item.title}">${item.art(item.w, item.h)}</svg>`;
  }

  /* ------------------------------------------------------------- rendering */
  function allItems() {
    return [...imports.map(im => ({
      id: im.id, cat: 'Imported', title: im.name, desc: 'Imported from this device.',
      tags: ['import', 'yours'], imported: true, w: 4, h: 3
    })), ...REFS];
  }

  function filtered() {
    return allItems().filter(it => {
      if (filterCat === 'Favorites' && !favs[it.id]) return false;
      if (filterCat !== 'All' && filterCat !== 'Favorites' && it.cat !== filterCat) return false;
      if (query) {
        const hay = (it.title + ' ' + it.cat + ' ' + it.tags.join(' ') + ' ' + it.desc).toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }

  function renderChips() {
    const wrap = $('#refChips');
    if (!wrap) return;
    const cats = ['All', ...CATS, ...(imports.length ? ['Imported'] : []), 'Favorites'];
    wrap.innerHTML = cats.map(c => `
      <button class="ref-chip ${c === filterCat ? 'active' : ''}" data-cat="${c}">${c === 'Favorites' ? '★ ' : ''}${c}</button>`).join('');
    $$('.ref-chip', wrap).forEach(chip => chip.addEventListener('click', () => {
      filterCat = chip.dataset.cat;
      Sound.play('select');
      renderChips();
      renderGrid();
    }));
  }

  function renderGrid() {
    const grid = $('#refsGrid');
    const empty = $('#refsEmpty');
    const count = $('#refsCount');
    if (!grid) return;
    const items = filtered();
    const total = allItems().length;
    if (count) count.textContent = `${items.length} / ${total} ${total === 1 ? 'item' : 'items'}`;
    if (!items.length) {
      grid.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    grid.innerHTML = items.map((it, i) => {
      const pal = paletteOf(it);
      const artHtml = it.imported
        ? `<img src="${it.src || ''}" alt="${it.title}" loading="lazy">`
        : svgDoc(it);
      return `
      <button class="ref-card" data-id="${it.id}" style="transition-delay:${Math.min(i, 10) * 35}ms" aria-label="Open ${it.title} details">
        <span class="ref-art" aria-hidden="true">${artHtml}</span>
        <span class="ref-info">
          <span class="ref-title">${it.title}</span>
          <span class="ref-meta">
            <span class="ref-cat">${it.cat}</span>
            <span class="ref-fav ${favs[it.id] ? 'active' : ''}" data-fav="${it.id}" role="button" tabindex="-1" aria-label="${favs[it.id] ? 'Remove from' : 'Add to'} favorites">${favs[it.id] ? '★' : '☆'}</span>
          </span>
          <span class="ref-dots" aria-hidden="true">${pal.slice(0, 5).map(c => `<i style="background:${c}"></i>`).join('')}</span>
        </span>
      </button>`;
    }).join('');
    raf(() => $$('.ref-card', grid).forEach(el => el.classList.add('in')));
    $$('.ref-card', grid).forEach(card => card.addEventListener('click', e => {
      if (e.target.closest('[data-fav]')) {
        toggleFav(e.target.closest('[data-fav]').dataset.fav);
        e.stopPropagation();
        return;
      }
      openDetail(card.dataset.id);
    }));
  }

  function paletteOf(it) {
    if (it.imported) return it.palette || [];
    return it.palette;
  }

  function toggleFav(id) {
    favs[id] = !favs[id];
    if (!favs[id]) delete favs[id];
    saveMeta();
    Sound.play(favs[id] ? 'toggleOn' : 'toggleOff');
    toast(favs[id] ? 'Added to favorites' : 'Removed from favorites');
    renderGrid();
    renderChips();
    if (detailId === id) syncDetailFav();
  }

  /* ---------------------------------------------------------------- detail */
  let detailId = null;
  function findItem(id) {
    return allItems().find(it => it.id === id) || null;
  }
  function openDetail(id) {
    const it = findItem(id);
    if (!it) return;
    detailId = id;
    const body = $('#refDetailBody');
    const drawer = $('#refDetail');
    if (!body || !drawer) return;
    const pal = paletteOf(it);
    const artHtml = it.imported
      ? `<img src="${it.src || ''}" alt="${it.title}">`
      : svgDoc(it);
    body.innerHTML = `
      <div class="rd-art">${artHtml}</div>
      <div class="rd-cat">${it.cat}${it.imported ? ' · IMPORTED' : ' · CURATED SAMPLE'}</div>
      <h4 class="rd-title">${it.title}</h4>
      <p class="rd-desc">${it.desc}</p>
      <div class="rd-tags">${it.tags.map(t => `<i>${t}</i>`).join('')}</div>
      ${pal && pal.length ? `
      <div class="rd-palette">
        <h5>PALETTE — CLICK TO COPY</h5>
        <div class="rd-swatches">${pal.map(c => `<button data-copy="${c}"><i style="background:${c}"></i>${c}</button>`).join('')}</div>
      </div>` : ''}
      <p class="rd-source">${it.imported ? 'Stored on this device · ' + new Date(it.ts || Date.now()).toLocaleDateString() : 'Sample study drawn locally by LISTO — not sourced from any community.'}</p>
      <div class="rd-actions">
        ${pal && pal.length >= 2 ? '<button class="small-button" id="rdUse">Use palette in Explorer</button>' : ''}
        ${it.imported && pal && pal.length ? '<button class="small-button" id="rdReextract">Re-extract palette</button>' : ''}
        <button class="small-button ghost" id="rdFav">${favs[it.id] ? '★ Favorited' : '☆ Favorite'}</button>
        ${it.imported ? '<button class="small-button ghost" id="rdDelete">Delete import</button>' : ''}
      </div>`;
    $$('[data-copy]', body).forEach(btn => btn.addEventListener('click', () => copyText(btn.dataset.copy, btn.dataset.copy + ' copied')));
    const use = $('#rdUse', body);
    use && use.addEventListener('click', () => {
      window.LISTO.seed = { palette: pal, core: pal[2] || pal[0], from: 'references' };
      Router.go('colors');
    });
    const reex = $('#rdReextract', body);
    reex && reex.addEventListener('click', () => extractForImport(it, true));
    const favBtn = $('#rdFav', body);
    favBtn && favBtn.addEventListener('click', () => toggleFav(it.id));
    const del = $('#rdDelete', body);
    del && del.addEventListener('click', () => deleteImport(it.id));
    drawer.hidden = false;
    raf(() => drawer.classList.add('open'));
    Sound.play('open');
  }
  function syncDetailFav() {
    const favBtn = $('#rdFav', $('#refDetailBody'));
    if (favBtn && detailId) favBtn.textContent = favs[detailId] ? '★ Favorited' : '☆ Favorite';
  }
  function closeDetail() {
    const drawer = $('#refDetail');
    if (!drawer || drawer.hidden) return;
    drawer.classList.remove('open');
    detailId = null;
    setTimeout(() => { if (!detailId) drawer.hidden = true; }, 380);
    Sound.play('close');
  }

  /* ------------------------------------------------------------- importing */
  async function importFiles(files) {
    const list = [...files].filter(f => f.type.startsWith('image/'));
    if (!list.length) { toast('Choose image files', 'error'); Sound.play('error'); return; }
    for (const file of list) {
      if (file.size > 12 * 1024 * 1024) { toast(file.name + ' is too large (max 12 MB)', 'error'); continue; }
      const id = 'imp-' + uid();
      try {
        await IDB.put({ id, blob: file, name: file.name, type: file.type, createdAt: Date.now() });
        const url = URL.createObjectURL(file);
        refUrls.set(id, url);
        const palette = await extractPalette(file);
        imports.unshift({ id, name: file.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 40) || 'Imported image', ts: Date.now(), palette, blobType: file.type, blobSize: file.size });
        Sound.play('create');
      } catch (e) {
        toast('Could not store ' + file.name, 'error');
        Sound.play('error');
      }
    }
    saveMeta();
    filterCat = 'Imported';
    renderChips();
    renderGrid();
    toast(list.length + ' image' + (list.length > 1 ? 's' : '') + ' imported — stored on this device', 'success');
  }

  /* Quantize an image to a 4-bit-per-channel histogram; return top colors. */
  function extractPalette(file) {
    return new Promise(resolve => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 120;
          const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
          const cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(img.naturalWidth * scale));
          cv.height = Math.max(1, Math.round(img.naturalHeight * scale));
          const ctx = cv.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, cv.width, cv.height);
          const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
          const bins = new Map();
          for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            if (a < 128) continue;
            const r = data[i] & 0xF0, g = data[i + 1] & 0xF0, b = data[i + 2] & 0xF0;
            const key = (r << 16) | (g << 8) | b;
            const cur = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 };
            cur.n++; cur.r += data[i]; cur.g += data[i + 1]; cur.b += data[i + 2];
            bins.set(key, cur);
          }
          const sorted = [...bins.values()]
            .map(v => ({ n: v.n, hex: Color.rgbToHex(v.r / v.n, v.g / v.n, v.b / v.n) }))
            .sort((a, b) => b.n - a.n);
          // keep the top colors but diversify: skip near-duplicates of picked ones
          const out = [];
          for (const c of sorted) {
            if (out.some(p => Color.contrastRatio(p, c.hex) < 1.25)) continue;
            out.push(c.hex);
            if (out.length >= 6) break;
          }
          URL.revokeObjectURL(url);
          resolve(out.length ? out : ['#888888']);
        } catch (e) {
          URL.revokeObjectURL(url);
          resolve([]);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve([]); };
      img.src = url;
    });
  }

  async function extractForImport(it, notify) {
    const rec = await IDB.get(it.id);
    if (!rec || !rec.blob) { toast('Original file is missing', 'error'); Sound.play('error'); return; }
    const pal = await extractPalette(rec.blob);
    if (!pal.length) { toast('Palette extraction failed', 'error'); Sound.play('error'); return; }
    it.palette = pal;
    const meta = imports.find(m => m.id === it.id);
    if (meta) meta.palette = pal;
    saveMeta();
    if (notify) { Sound.play('success'); toast('Palette re-extracted', 'success'); }
    openDetail(it.id);
    renderGrid();
  }

  async function deleteImport(id) {
    imports = imports.filter(m => m.id !== id);
    await IDB.remove(id);
    if (refUrls.has(id)) { URL.revokeObjectURL(refUrls.get(id)); refUrls.delete(id); }
    delete favs[id];
    saveMeta();
    closeDetail();
    renderChips();
    renderGrid();
    Sound.play('remove');
    toast('Import deleted');
  }

  /* --------------------------------------------------------- restore imports */
  async function restoreImports() {
    if (!imports.length) { renderGrid(); return; }
    let dropped = false;
    for (const im of imports) {
      const rec = await IDB.get(im.id);
      if (rec && rec.blob) {
        if (!refUrls.has(im.id)) refUrls.set(im.id, URL.createObjectURL(rec.blob));
        im.src = refUrls.get(im.id);
        im.palette = im.palette || [];
      } else {
        dropped = true;
      }
    }
    if (dropped) {
      const before = imports.length;
      imports = imports.filter(im => im.src);
      if (imports.length !== before) toast('Some imports were missing and removed');
    }
    saveMeta();
    renderChips();
    renderGrid();
  }

  /* ------------------------------------------------------------------ init */
  let inited = false;
  function init() {
    if (inited) return;
    inited = true;
    const search = $('#refSearch');
    search && search.addEventListener('input', () => {
      query = search.value.trim().toLowerCase();
      renderGrid();
    });
    const fileInput = $('#refFileInput');
    $('#refImportBtn') && $('#refImportBtn').addEventListener('click', () => fileInput && fileInput.click());
    $('#refImportBtn2') && $('#refImportBtn2').addEventListener('click', () => fileInput && fileInput.click());
    fileInput && fileInput.addEventListener('change', () => {
      const files = fileInput.files;
      fileInput.value = '';
      if (files && files.length) importFiles([...files]);
    });
    const closeBtn = $('#refDetailClose');
    closeBtn && closeBtn.addEventListener('click', closeDetail);
    // Escape closes the drawer first; only a second Escape leaves the view.
    window.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const drawer = $('#refDetail');
      if (drawer && !drawer.hidden) {
        e.stopPropagation();
        closeDetail();
      }
    }, true);
    renderChips();
    restoreImports();
  }

  Router.register('references', { init });
})();
