/* ==========================================================================
   LISTO. — references.js
   Visual References: 54 original sample studies across 15 categories (locally generated),
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

  // Additional original SVG studies expand the library to 50+ distinct entries.
  // They are generated locally from different compositions, not duplicated cards.
  const EXTRA_STUDIES = [
    ['Prism Drift','Color Study','gradient',['#10152C','#3347A5','#7B72E8','#E2A4D7','#F7D8C6'],'A cool-to-warm transition with overlapping translucent fields.'],
    ['Citrus Spectrum','Color Study','gradient',['#18352F','#7DAE58','#E9C84A','#F18B4C','#F5E7B8'],'A fresh palette study balancing botanical greens and citrus warmth.'],
    ['Quiet Monochrome','Color Study','minimal',['#17191F','#50545D','#9298A1','#D8D9D6','#F4F2EC'],'A restrained value scale built from one neutral family.'],
    ['Violet Frequency','Color Study','texture',['#17102D','#482A83','#8757C8','#C29BEA','#F1DDFB'],'Repeated fine lines create a sense of rhythm and color vibration.'],
    ['Type Specimen / Axis','Typography','type',['#101827','#D8E2F0','#4EA1A8','#E5A45B','#F5F0E7'],'A typographic specimen pairing oversized display type with precise metadata.'],
    ['Serif & Signal','Typography','editorial',['#201B25','#F3E9DA','#B65E4C','#687A71','#D7B98E'],'Editorial contrast between expressive serif forms and quiet labels.'],
    ['Mono Rhythm','Typography','type',['#11151B','#E7E9E7','#8BA4A0','#D3A46F','#5C6670'],'Monospaced type arranged as a modular information system.'],
    ['Letterform Study','Typography','geometry',['#F0EBDD','#1A2431','#E15D48','#E5B94C','#4A7790'],'Letterform-inspired geometry explores counters, stems and weight.'],
    ['Editorial Columns','Editorial','editorial',['#EAE4D9','#20232B','#A84D3F','#7C8D80','#C6A66B'],'A three-column editorial spread with a strong title and image block.'],
    ['Sunday Journal','Editorial','layout',['#F3EBDD','#25252A','#B66A52','#8D9B83','#D6B88C'],'A calm magazine page balancing a headline, caption and image field.'],
    ['Index / 07','Editorial','type',['#111827','#E8E6E0','#B4A4E8','#65A6A2','#D58A6A'],'A numbered editorial index with oversized numerals and thin rules.'],
    ['Modular Balance','Layout','grid',['#17202C','#E9E7DF','#E36D50','#5A8F9B','#E6C66A'],'A modular grid with deliberate asymmetry and varied block sizes.'],
    ['Offset Blocks','Layout','layout',['#F0EDE5','#20263A','#4E79A7','#E7A65B','#A9B5A5'],'Offset rectangles create a clear reading path across the frame.'],
    ['Quiet Interface','UI Design','ui',['#111827','#F2F4F7','#6C63D9','#5AA8A0','#E3A36B'],'A compact interface study with layered panels and restrained accents.'],
    ['Dashboard / Orbit','UI Design','ui',['#0C1222','#202B46','#6D72D9','#54B9B1','#F1C77B'],'A dashboard composition organized around one central data card.'],
    ['Glass Controls','UI Design','ui',['#101525','#28314C','#8A7CE8','#69C7D0','#E6D7FF'],'A control panel study focused on spacing, hierarchy and translucent surfaces.'],
    ['Radial Grammar','Geometry','geometry',['#111827','#E7EAF0','#7D70D6','#D77B69','#6BA89B'],'Concentric geometry establishes a clear center and orbiting accents.'],
    ['Polygon Field','Geometry','geometry',['#16182A','#4E4A91','#A5A0D6','#E2A36F','#E9DCC8'],'Layered polygons explore overlap, scale and visual weight.'],
    ['Soft Geometry','Geometry','minimal',['#F1EDE5','#29364B','#C76C56','#D5B95F','#719A91'],'Simple circles and arcs create a balanced geometric arrangement.'],
    ['Coastal Haze','Photography','photo',['#17344A','#5F91A5','#D8BFA3','#E8D9C6','#B96F59'],'A locally illustrated coastal scene with atmospheric depth.'],
    ['Desert Noon','Photography','photo',['#3B2730','#A65F4D','#E5A66C','#F1D5A5','#6C6A55'],'A warm desert horizon with strong light and layered silhouettes.'],
    ['Blue Hour','Photography','photo',['#101A35','#304B76','#7896B0','#D5B8A4','#E9D8C8'],'A quiet blue-hour landscape study with a low horizon.'],
    ['Grain Archive','Texture','texture',['#202027','#68616A','#B7A9A0','#E0D4C8','#A36B57'],'Fine grain and scattered marks create a tactile archival surface.'],
    ['Woven Lines','Texture','texture',['#142A32','#356B70','#8EB4A6','#D8C9A7','#E9E0D0'],'Interlaced linework creates a woven rhythm and subtle depth.'],
    ['Ink / Scatter','Texture','texture',['#F1EEE7','#26252A','#A34D3C','#596F80','#C5A86A'],'An ink-like field of varied marks against warm paper.'],
    ['Monogram / Aster','Branding','brand',['#17172B','#F0E9DD','#9A76D8','#5DA6A0','#D99A70'],'A compact monogram system with a distinctive geometric signature.'],
    ['Northline Identity','Branding','brand',['#12242A','#DDE6D9','#477C79','#D6A35F','#A95E4B'],'A directional identity built from a wordmark, line and symbol.'],
    ['Field Notes Brand','Branding','editorial',['#E9E1D2','#2B3431','#7B8C6D','#C27A58','#D1B67B'],'An earthy identity system for a field journal or nature publication.'],
    ['Contour Illustration','Illustration','nature',['#142B32','#4E8A79','#A8C8A5','#E9C98A','#D57C62'],'Organic contour forms suggest a landscape without literal detail.'],
    ['Playful Forms','Illustration','illustration',['#18213A','#F1C75B','#E8785B','#76B6AD','#E8D8C4'],'Playful cut-paper forms balance bold shapes and open space.'],
    ['Botanical Gesture','Illustration','nature',['#172E2A','#527A59','#A7B98A','#E6C9A2','#C7795B'],'A botanical arrangement of curved stems and leaf silhouettes.'],
    ['Quiet Object','Minimalism','minimal',['#F1EFE8','#252A32','#8A9A91','#C9A47A','#D9D3C7'],'One restrained object, one shadow and deliberate negative space.'],
    ['Pure Interval','Minimalism','minimal',['#151923','#EAE8E0','#9CA6B5','#B5A1D8','#6D8C84'],'A minimal study in spacing, proportion and a single accent.'],
    ['Unstable System','Experimental Design','experimental',['#17152B','#7A50B5','#E36B58','#D9C16C','#63A7A0'],'An intentionally disrupted geometry system with layered visual tension.'],
    ['Signal Fragments','Abstract','abstract',['#101B2D','#3C72A2','#D46E5B','#E5B66E','#E7E2D6'],'Abstract fragments collide across a loose but intentional field.' ],
    ['Courtyard Study','Architecture','architecture',['#252B31','#B8A58C','#E3D8C6','#72847C','#A86F54'],'A courtyard elevation study using repeated openings and strong massing.'],
    ['Concrete Rhythm','Architecture','architecture',['#20252A','#737B7D','#C5C5BB','#A77D63','#D9B88F'],'A brutalist facade study focused on proportion and shadow.'],
    ['Arcade / Light','Architecture','geometry',['#1B2432','#597A86','#D5B88F','#B96D57','#E9E2D5'],'Arches and repeated bays create a calm architectural rhythm.'],
    ['Canopy Layers','Nature','nature',['#142C25','#3D6B4E','#8EAA70','#D5C28D','#E7DCC1'],'Layered canopy silhouettes explore organic depth and green temperature.'],
    ['Tidal Forms','Nature','gradient',['#102C3A','#267A83','#64B4AC','#D5C9A7','#E7E1D2'],'Flowing tidal bands create a quiet natural gradient.']
  ];

  function generatedArt(w, h, type, palette, seed) {
    const rand = rng(seed), c = palette, out = [`<rect width="${w}" height="${h}" fill="${c[0]}"/>`];
    if (type === 'gradient') {
      out.push(`<defs><linearGradient id="g${seed}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${c[1]}"/><stop offset=".55" stop-color="${c[2]}"/><stop offset="1" stop-color="${c[4]}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g${seed})"/>`);
      for(let i=0;i<5;i++){const x=rand()*w,y=rand()*h,r=Math.min(w,h)*(.12+rand()*.25);out.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${c[(i+2)%5]}" opacity=".32"/>`);}
    } else if (type === 'type' || type === 'editorial') {
      const words=['FORM','FIELD','STUDY','OBJECT','NORTH','SIGNAL','INDEX','SLOW'];
      out.push(`<text x="${w*.07}" y="${h*.34}" fill="${c[2]}" font-family="Manrope,sans-serif" font-size="${h*.22}" font-weight="800">${words[seed%words.length]}</text>`);
      out.push(`<text x="${w*.08}" y="${h*.48}" fill="${c[3]}" font-family="monospace" font-size="${h*.045}" letter-spacing="4">VISUAL SYSTEM / 0${seed%9+1}</text>`);
      for(let i=0;i<5;i++)out.push(`<rect x="${w*.08}" y="${h*(.62+i*.055)}" width="${w*(.3+rand()*.48)}" height="${Math.max(2,h*.009)}" rx="2" fill="${c[(i+1)%5]}" opacity="${.35+rand()*.5}"/>`);
      out.push(`<rect x="${w*.78}" y="${h*.12}" width="${w*.12}" height="${h*.72}" fill="${c[1]}" opacity=".8"/>`);
    } else if (type === 'grid' || type === 'layout' || type === 'ui') {
      const cols=type==='ui'?3:4, rows=3, gap=w*.018, cw=(w-gap*(cols+1))/cols, ch=(h-gap*(rows+1))/rows;
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const xx=gap+x*(cw+gap),yy=gap+y*(ch+gap),tone=c[(x+y*2+1)%5];out.push(`<rect x="${xx}" y="${yy}" width="${cw}" height="${ch}" rx="${type==='ui'?12:3}" fill="${tone}" opacity="${.55+rand()*.4}"/>`);if(type==='ui'&&x===0&&y===0){for(let k=0;k<3;k++)out.push(`<rect x="${xx+cw*.12}" y="${yy+ch*(.25+k*.2)}" width="${cw*.68}" height="${Math.max(3,ch*.045)}" rx="3" fill="${c[4]}" opacity=".8"/>`);}}
    } else if (type === 'photo' || type === 'architecture' || type === 'nature') {
      out.push(`<rect width="${w}" height="${h*.58}" fill="${c[1]}"/><circle cx="${w*(.2+rand()*.6)}" cy="${h*.3}" r="${h*.1}" fill="${c[4]}" opacity=".9"/>`);
      if(type==='architecture'){for(let i=0;i<7;i++){const x=i*w/7;out.push(`<rect x="${x}" y="${h*.38}" width="${w/8}" height="${h*.62}" fill="${c[(i%3)+1]}" opacity=".9"/><rect x="${x+w*.025}" y="${h*.46}" width="${w*.045}" height="${h*.1}" fill="${c[4]}" opacity=".7"/>`);}}
      else if(type==='nature'){for(let i=0;i<9;i++){const x=rand()*w,y=h*(.55+rand()*.35);out.push(`<path d="M${x} ${h} Q${x-w*.08} ${y} ${x+w*.04} ${y-h*.18} Q${x+w*.16} ${y} ${x} ${h}Z" fill="${c[(i%3)+1]}" opacity=".85"/>`);}}
      else {out.push(`<path d="M0 ${h*.68} Q${w*.25} ${h*.48} ${w*.5} ${h*.68} T${w} ${h*.64} L${w} ${h} L0 ${h}Z" fill="${c[2]}"/><path d="M0 ${h*.82} Q${w*.3} ${h*.65} ${w*.58} ${h*.84} T${w} ${h*.78} L${w} ${h} L0 ${h}Z" fill="${c[3]}"/>`);}
    } else if (type === 'minimal') {
      out.push(`<circle cx="${w*.5}" cy="${h*.46}" r="${Math.min(w,h)*.17}" fill="${c[2]}"/><ellipse cx="${w*.5}" cy="${h*.69}" rx="${w*.2}" ry="${h*.035}" fill="${c[1]}" opacity=".28"/><rect x="${w*.08}" y="${h*.86}" width="${w*.84}" height="2" fill="${c[3]}" opacity=".55"/>`);
    } else if (type === 'brand') {
      out.push(`<circle cx="${w*.5}" cy="${h*.42}" r="${Math.min(w,h)*.22}" fill="none" stroke="${c[2]}" stroke-width="${h*.025}"/><path d="M${w*.36} ${h*.56} L${w*.5} ${h*.24} L${w*.64} ${h*.56}" fill="none" stroke="${c[4]}" stroke-width="${h*.035}"/><text x="${w*.5}" y="${h*.82}" text-anchor="middle" fill="${c[3]}" font-family="Manrope,sans-serif" font-size="${h*.075}" letter-spacing="5">NORTH / FORM</text>`);
    } else if (type === 'geometry' || type === 'illustration') {
      for(let i=0;i<11;i++){const x=rand()*w,y=rand()*h,r=Math.min(w,h)*(.035+rand()*.17),color=c[(i%4)+1];if(i%3===0)out.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity=".82"/>`);else if(i%3===1)out.push(`<polygon points="${x},${y-r} ${x+r},${y+r} ${x-r},${y+r}" fill="${color}" opacity=".82"/>`);else out.push(`<rect x="${x-r}" y="${y-r}" width="${r*2}" height="${r*2}" transform="rotate(${rand()*80-40} ${x} ${y})" fill="${color}" opacity=".78"/>`);}
    } else {
      for(let i=0;i<140;i++){const x=rand()*w,y=rand()*h,r=.4+rand()*2.4;out.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${c[(i%4)+1]}" opacity="${.15+rand()*.55}"/>`);}
      for(let i=0;i<18;i++){const x=rand()*w,y=rand()*h;out.push(`<path d="M${x} ${y} l${w*(.04+rand()*.16)} ${h*(rand()-.5)*.08}" stroke="${c[(i%4)+1]}" stroke-width="${1+rand()*3}" opacity=".6"/>`);}
    }
    return out.join('');
  }
  EXTRA_STUDIES.forEach((item, i) => {
    const [title, cat, type, palette, desc] = item;
    REFS.push({ id: `cur-extra-${String(i+1).padStart(2,'0')}`, cat, title, desc, tags: [type, cat.toLowerCase(), 'study'], palette,
      art: (w,h) => generatedArt(w,h,type,palette,i+41), w: 640, h: 440 });
  });

  const CATS = ['Color Study', 'Typography', 'Layout', 'Geometry', 'Photography', 'Texture', 'Abstract', 'Branding', 'UI Design', 'Editorial', 'Illustration', 'Architecture', 'Nature', 'Minimalism', 'Experimental Design'];

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
