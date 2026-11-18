/* ==========================================================================
   LISTO. — studio.js
   Composition Studio: infinite canvas, multiple artboards, realtime
   dimensions, composition library, guide controls, reference overlays,
   minimap, focus/compare, persistence and exports.
   ========================================================================== */
(() => {
  'use strict';
  const { $, $$, clamp, uid, raf, store, Sound, toast, download, Color, Router, IDB, Projects } = window.LISTO;
  const view = $('#view-studio');
  if (!view) return;

  const vp = $('#canvasViewport');
  const world = $('#canvasWorld');
  const snapLayer = $('#snapLayer');
  const minimap = $('#minimap');
  const zoomLabel = $('#zoomLabel');

  const PHI = 1.6180339887;
  const MM = dpi => dpi / 25.4; // px per mm at given dpi

  /* ======================================================== GUIDE LIBRARY */
  // Every preset draws genuinely different geometry over an artboard of w×h.
  const ln = (x1, y1, x2, y2, o) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"${o ? ` stroke-opacity="${o}"` : ''}/>`;
  const rc = (x, y, w, h, o, fillOp) => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0, w).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}"${o ? ` stroke-opacity="${o}"` : ''}${fillOp ? ` fill-opacity="${fillOp}"` : ''}/>`;
  const ci = (cx, cy, r, o) => `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${Math.max(0, r).toFixed(1)}"${o ? ` stroke-opacity="${o}"` : ''}/>`;
  const pa = d => `<path d="${d}"/>`;
  const lcg = seed => { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };

  function spiralPath(w, h, turns) {
    const cx = w / 2, cy = h / 2;
    const b = Math.log(PHI) / (Math.PI / 2);
    const rMax = Math.min(w, h) * 0.48;
    const thMax = turns * Math.PI / 2;
    const r0 = rMax / Math.exp(b * thMax);
    const pts = [];
    for (let i = 0; i <= 150; i++) {
      const th = thMax * i / 150;
      const r = r0 * Math.exp(b * th);
      pts.push((cx + r * Math.cos(th)).toFixed(1) + ' ' + (cy + r * Math.sin(th)).toFixed(1));
    }
    return 'M' + pts.join(' L ');
  }
  function fibTiles(x, y, w, h, depth, out) {
    if (depth <= 0 || w < 6 || h < 6) return;
    if (w >= h) {
      const s = h;
      out.push(rc(x, y, s, s, .8), pa(`M ${x + s} ${y} A ${s} ${s} 0 0 1 ${x} ${y + s}`));
      fibTiles(x + s, y, w - s, h, depth - 1, out);
    } else {
      const s = w;
      out.push(rc(x, y, s, s, .8), pa(`M ${x} ${y + s} A ${s} ${s} 0 0 0 ${x + s} ${y}`));
      fibTiles(x, y + s, w, h - s, depth - 1, out);
    }
  }

  const GUIDE_DEFS = {
    /* ---- Fundamental ---- */
    thirds: { cat: 'fundamental', name: 'Rule of Thirds', desc: 'Two vertical and two horizontal lines split the frame into nine zones; place subjects on the intersections.', params: [],
      render: (w, h) => [1, 2].map(i => ln(w * i / 3, 0, w * i / 3, h, .9) + ln(0, h * i / 3, w, h * i / 3, .9)).join('') },
    centered: { cat: 'fundamental', name: 'Centered Composition', desc: 'Everything radiates from the exact center — still, formal, iconic.', params: [],
      render: (w, h) => ln(w / 2, 0, w / 2, h, .9) + ln(0, h / 2, w, h / 2, .9) + ci(w / 2, h / 2, Math.min(w, h) * .32, .8) + ci(w / 2, h / 2, Math.min(w, h) * .06, 1) },
    symmetry: { cat: 'fundamental', name: 'Symmetry', desc: 'A mirror axis with paired anchor ticks; left and right carry equal weight.', params: [],
      render: (w, h) => { let s = ln(w / 2, 0, w / 2, h) + ln(0, h / 2, w, h / 2, .35); for (let i = 1; i <= 4; i++) { const y = h * i / 5, dx = w * .18; s += ln(w / 2 - dx - 14, y, w / 2 - dx, y) + ln(w / 2 + dx, y, w / 2 + dx + 14, y); } return s; } },
    asymmetry: { cat: 'fundamental', name: 'Asymmetry', desc: 'A golden vertical divides unequal halves; a heavy mass balances a light counterweight.', params: [],
      render: (w, h) => ln(w / PHI, 0, w / PHI, h) + rc(w * .06, h * .45, w * .38, h * .42, .9) + rc(w * .72, h * .12, w * .14, h * .1, .9) + ln(w * .06, h * .87, w * .94, h * .22, .4) },
    diagonal: { cat: 'fundamental', name: 'Diagonal Composition', desc: 'Corner-to-corner diagonals inject motion and depth; elements stack along the slope.', params: [],
      render: (w, h) => ln(0, 0, w, h) + ln(w, 0, 0, h, .45) + ln(w * .33, 0, w, h * .67, .6) },
    'leading-lines': { cat: 'fundamental', name: 'Leading Lines', desc: 'Edges and sight-lines converge on one focal point.', params: [{ id: 'fx', label: 'Focal X %', min: 10, max: 90, step: 1, def: 62 }, { id: 'fy', label: 'Focal Y %', min: 10, max: 90, step: 1, def: 45 }],
      render: (w, h, P) => { const fx = w * P.fx / 100, fy = h * P.fy / 100; return ci(fx, fy, 8) + [[0, 0], [w, 0], [0, h], [w, h], [w / 2, 0], [w / 2, h], [0, h / 2], [w, h / 2]].map(p => ln(p[0], p[1], fx, fy, .55)).join(''); } },
    'frame-in-frame': { cat: 'fundamental', name: 'Frame Within Frame', desc: 'Nested boundaries create a stage inside the stage.', params: [{ id: 'inset', label: 'Inset %', min: 3, max: 22, step: 1, def: 9 }],
      render: (w, h, P) => { const a = Math.min(w, h) * P.inset / 100; return rc(a, a, w - 2 * a, h - 2 * a) + rc(a * 2.1, a * 2.1, w - 4.2 * a, h - 4.2 * a, .7); } },

    /* ---- Golden ---- */
    'golden-ratio': { cat: 'golden', name: 'Golden Ratio', desc: '1 : 1.618 splits on both axes — the classic proportion.', params: [],
      render: (w, h) => ln(w / PHI, 0, w / PHI, h) + ln(w - w / PHI, 0, w - w / PHI, h, .5) + ln(0, h / PHI, w, h / PHI) + ln(0, h - h / PHI, w, h - h / PHI, .5) },
    'golden-spiral': { cat: 'golden', name: 'Golden Spiral', desc: 'A logarithmic spiral that grows by φ every quarter turn.', params: [{ id: 'turns', label: 'Turns', min: 1, max: 5, step: 1, def: 3 }],
      render: (w, h, P) => ln(w / PHI, 0, w / PHI, h, .35) + ln(0, h / PHI, w, h / PHI, .35) + pa(spiralPath(w, h, P.turns || 3)) + ci(w / 2, h / 2, 5) },
    fibonacci: { cat: 'golden', name: 'Fibonacci Spiral', desc: 'Quarter-circle arcs inside nested golden rectangles.', params: [{ id: 'depth', label: 'Depth', min: 2, max: 7, step: 1, def: 5 }],
      render: (w, h, P) => { const out = []; fibTiles(0, 0, w, h, Math.round(P.depth || 5), out); return out.join(''); } },
    'golden-triangle': { cat: 'golden', name: 'Golden Triangle', desc: 'A diagonal with a perpendicular from the opposite corner — divides the frame in golden ratio triangles.', params: [],
      render: (w, h) => {
        const c2 = w * w + h * h;
        const fx = w * w * w / c2;          // foot of perpendicular from corner (w,0) onto the main diagonal
        const fy = w * w * h / c2;
        const gx = h * h * w / c2;          // foot from corner (0,h)
        const gy = h * h * h / c2;
        return ln(0, 0, w, h) + ln(w, 0, fx, fy, .9) + ln(0, h, gx, gy, .45) + ci(fx, fy, 6) + ci(gx, gy, 4, .7);
      } },
    'golden-section': { cat: 'golden', name: 'Golden Section', desc: 'φ-grid at 38.2% / 61.8% with harmonized circles.', params: [],
      render: (w, h) => ln(w * .382, 0, w * .382, h, .8) + ln(w * .618, 0, w * .618, h, .5) + ln(0, h * .382, w, h * .382, .8) + ln(0, h * .618, w, h * .618, .5) + ci(w * .618, h * .382, Math.min(w, h) * .191, .8) },

    /* ---- Grids ---- */
    modular: { cat: 'grid', name: 'Modular Grid', desc: 'Columns and rows with gutters — the workhorse of layout systems.', params: [{ id: 'cols', label: 'Columns', min: 2, max: 12, step: 1, def: 6 }, { id: 'rows', label: 'Rows', min: 2, max: 12, step: 1, def: 6 }, { id: 'gut', label: 'Gutter %', min: 0, max: 12, step: .5, def: 3 }],
      render: (w, h, P) => { const g = Math.min(w, h) * P.gut / 100, cw = (w - g * (P.cols - 1)) / P.cols, ch = (h - g * (P.rows - 1)) / P.rows; let s = rc(0, 0, w, h, .8); for (let i = 1; i < P.cols; i++) s += ln(i * (cw + g), 0, i * (cw + g) - g + g, h, .45); for (let i = 1; i < P.rows; i++) s += ln(0, i * (ch + g), w, i * (ch + g) - g + g, .45); return s; } },
    columns: { cat: 'grid', name: 'Column Grid', desc: 'Even vertical columns for text and modules.', params: [{ id: 'cols', label: 'Columns', min: 2, max: 16, step: 1, def: 6 }],
      render: (w, h, P) => { let s = rc(0, 0, w, h, .8); for (let i = 1; i < P.cols; i++) s += ln(w * i / P.cols, 0, w * i / P.cols, h, .5); return s; } },
    baseline: { cat: 'grid', name: 'Baseline Grid', desc: 'Even horizontal rhythm for typography.', params: [{ id: 'rows', label: 'Rows', min: 3, max: 28, step: 1, def: 12 }],
      render: (w, h, P) => { let s = ''; for (let i = 1; i < P.rows; i++) s += ln(0, h * i / P.rows, w, h * i / P.rows, i % 4 === 0 ? .8 : .4); return s + rc(0, 0, w, h, .6); } },
    swiss: { cat: 'grid', name: 'Swiss Grid', desc: 'International style: strict margins and a 12-column field.', params: [{ id: 'margin', label: 'Margin %', min: 4, max: 18, step: 1, def: 8 }],
      render: (w, h, P) => { const m = Math.min(w, h) * P.margin / 100, iw = w - 2 * m, ih = h - 2 * m; let s = rc(m, m, iw, ih, .9); for (let i = 1; i < 12; i++) s += ln(m + iw * i / 12, m, m + iw * i / 12, m + ih, .4); return s; } },
    '8pt': { cat: 'grid', name: '8pt Grid', desc: 'Interface spacing on consistent 8-pixel steps.', params: [{ id: 'step', label: 'Step px', min: 8, max: 64, step: 8, def: 16 }],
      render: (w, h, P) => { let s = '', n = 0; for (let x = P.step; x < w && n < 220; x += P.step, n++) s += ln(x, 0, x, h, .3); for (let y = P.step; y < h && n < 440; y += P.step, n++) s += ln(0, y, w, y, .3); return s; } },
    'custom-grid': { cat: 'grid', name: 'Custom Grid', desc: 'Freely tuned columns, rows and gutter with an outer margin.', params: [{ id: 'cols', label: 'Columns', min: 1, max: 16, step: 1, def: 4 }, { id: 'rows', label: 'Rows', min: 1, max: 16, step: 1, def: 4 }, { id: 'gut', label: 'Gutter %', min: 0, max: 15, step: .5, def: 4 }, { id: 'margin', label: 'Margin %', min: 0, max: 20, step: 1, def: 5 }],
      render: (w, h, P) => { const m = Math.min(w, h) * P.margin / 100, iw = w - 2 * m, ih = h - 2 * m, g = Math.min(w, h) * P.gut / 100, cw = (iw - g * (P.cols - 1)) / P.cols, ch = (ih - g * (P.rows - 1)) / P.rows; let s = rc(m, m, iw, ih, .9); for (let i = 1; i < P.cols; i++) s += ln(m + i * (cw + g), m, m + i * (cw + g), m + ih, .4); for (let i = 1; i < P.rows; i++) s += ln(m, m + i * (ch + g), m + iw, m + i * (ch + g), .4); return s; } },

    /* ---- Dynamic ---- */
    'z-pattern': { cat: 'dynamic', name: 'Z-Pattern', desc: 'The eye sweeps top-left → top-right → diagonal → bottom-left → bottom-right.', params: [],
      render: (w, h) => rc(0, h * .08, w, h * .07, .8) + ln(w * .92, h * .15, w * .08, h * .78) + rc(0, h * .85, w, h * .07, .8) + pa(`M ${w * .1} ${h * .89} L ${w * .04} ${h * .955} L ${w * .16} ${h * .955} Z`) + ci(w * .5, h * .5, 7) },
    'f-pattern': { cat: 'dynamic', name: 'F-Pattern', desc: 'Reading gravity: a full top bar, a middle scan, and a left rail.', params: [],
      render: (w, h) => rc(0, 0, w, h * .18, .8, .1) + rc(0, h * .3, w * .55, h * .14, .8, .08) + rc(0, 0, w * .14, h, .8) + ln(0, h * .3, w * .55, h * .3) + ln(w * .55, h * .3, w * .55, h * .44) },
    radial: { cat: 'dynamic', name: 'Radial Composition', desc: 'Concentric rings pulse out from an off-center focal point.', params: [{ id: 'rings', label: 'Rings', min: 2, max: 7, step: 1, def: 4 }, { id: 'fx', label: 'Focal X %', min: 15, max: 85, step: 1, def: 50 }, { id: 'fy', label: 'Focal Y %', min: 15, max: 85, step: 1, def: 42 }],
      render: (w, h, P) => { const fx = w * P.fx / 100, fy = h * P.fy / 100, rMax = Math.max(w, h); let s = ci(fx, fy, 6); for (let i = 1; i <= P.rings; i++) s += ci(fx, fy, rMax * i / P.rings, .55 - i * .06); return s; } },
    circular: { cat: 'dynamic', name: 'Circular Composition', desc: 'A central circle with inner rings and eight anchor spokes.', params: [],
      render: (w, h) => { const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .44; let s = ci(cx, cy, R) + ci(cx, cy, R * .62, .7) + ci(cx, cy, R * .3, .8); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; s += ln(cx + Math.cos(a) * R * .3, cy + Math.sin(a) * R * .3, cx + Math.cos(a) * R, cy + Math.sin(a) * R, .5); } return s; } },
    'diagonal-flow': { cat: 'dynamic', name: 'Diagonal Flow', desc: 'Parallel S-curves carry the eye down the frame.', params: [{ id: 'lines', label: 'Lines', min: 3, max: 8, step: 1, def: 5 }],
      render: (w, h, P) => { let s = ''; for (let i = 0; i < P.lines; i++) { const t = i / (P.lines - 1), y0 = h * (.12 + .76 * t); s += pa(`M ${-w * .1} ${y0} C ${w * .3} ${y0 - h * .18}, ${w * .6} ${y0 + h * .18}, ${w * 1.1} ${y0 - h * .06}`); } return s; } },
    'dynamic-balance': { cat: 'dynamic', name: 'Dynamic Balance', desc: 'A large pole is counterweighted by a small one across a tension axis.', params: [],
      render: (w, h) => ci(w * .3, h * .55, Math.min(w, h) * .2, .9) + ci(w * .74, h * .3, Math.min(w, h) * .07, .9) + ln(w * .3, h * .55, w * .74, h * .3, .6) + pa(`M ${w * .74} ${h * .3} q ${w * .12} ${-h * .1} ${w * .1} ${h * .18}`) },

    /* ---- Balance ---- */
    'negative-space': { cat: 'balance', name: 'Negative Space', desc: 'Shaded margins show how much room the emptiness owns.', params: [{ id: 'inset', label: 'Subject %', min: 25, max: 80, step: 1, def: 55 }],
      render: (w, h, P) => { const iw = w * P.inset / 100, ih = h * P.inset / 100, x = (w - iw) / 2, y = (h - ih) / 2; return pa(`M0 0 H${w} V${h} H0 Z M${x} ${y} h${iw} v${ih} h${-iw} Z`).replace('<path', '<path fill-rule="evenodd" fill-opacity=".12"') + rc(x, y, iw, ih, .8); } },
    'visual-weight': { cat: 'balance', name: 'Visual Weight', desc: 'Dot mass estimates where the eye lands first.', params: [],
      render: (w, h) => { const r = Math.min(w, h) * .09; return ci(w * .24, h * .3, r * 2, .9) + ci(w * .52, h * .42, r * 1.2, .8) + ci(w * .72, h * .52, r * .7, .7) + ci(w * .86, h * .62, r * .4, .6) + ln(0, h, w, 0, .3); } },
    hierarchy: { cat: 'balance', name: 'Visual Hierarchy', desc: 'Three emphasis bands — primary, secondary, tertiary.', params: [],
      render: (w, h) => rc(0, h * .06, w, h * .34, .9) + rc(w * .08, h * .5, w * .6, h * .18, .6) + rc(w * .08, h * .76, w * .3, h * .09, .4) },
    'focal-point': { cat: 'balance', name: 'Focal Point', desc: 'Crosshair with radiating intensity rings marks the star of the frame.', params: [{ id: 'fx', label: 'Focal X %', min: 10, max: 90, step: 1, def: 50 }, { id: 'fy', label: 'Focal Y %', min: 10, max: 90, step: 1, def: 50 }],
      render: (w, h, P) => { const fx = w * P.fx / 100, fy = h * P.fy / 100, r = Math.min(w, h) * .3; return ci(fx, fy, r, .3) + ci(fx, fy, r * .6, .5) + ci(fx, fy, r * .25, .9) + ln(fx - 26, fy, fx + 26, fy, .9) + ln(fx, fy - 26, fx, fy + 26, .9); } },
    'asym-balance': { cat: 'balance', name: 'Asymmetrical Balance', desc: 'A seesaw: unequal masses pivot around a fulcrum.', params: [],
      render: (w, h) => { const fx = w * .58, fy = h * .62; return pa(`M ${fx - 22} ${fy + 26} L ${fx} ${fy - 4} L ${fx + 22} ${fy + 26} Z`) + ln(fx - w * .4, fy - h * .16, fx + w * .34, fy - h * .3) + ci(fx - w * .4, fy - h * .16, Math.min(w, h) * .075, .9) + ci(fx + w * .34, fy - h * .3, Math.min(w, h) * .035, .9) + ln(fx, fy - 4, fx, fy + h * .3, .4); } },

    /* ---- Editorial ---- */
    magazine: { cat: 'editorial', name: 'Magazine Layout', desc: 'Masthead, hero image block, and a three-column text field.', params: [],
      render: (w, h) => rc(0, 0, w, h * .16, .9) + ln(w * .62, h * .2, w * .62, h * .58, .8) + rc(w * .62, h * .2, w * .38, h * .38, .9) + [1, 2].map(i => ln(w * i / 3 * .58, h * .66, w * i / 3 * .58, h * .94, .5)).join('') + ln(0, h * .66, w * .58, h * .66, .6) },
    'editorial-grid': { cat: 'editorial', name: 'Editorial Grid', desc: 'Six columns on a baseline field with a defined headline zone.', params: [{ id: 'rows', label: 'Rows', min: 4, max: 16, step: 1, def: 8 }],
      render: (w, h, P) => { let s = rc(0, 0, w, h * .2, .9); for (let i = 1; i < 6; i++) s += ln(w * i / 6, h * .2, w * i / 6, h, .4); for (let i = 1; i < P.rows; i++) s += ln(0, h * (.2 + .8 * i / P.rows), w, h * (.2 + .8 * i / P.rows), .25); return s; } },
    'broken-grid': { cat: 'editorial', name: 'Broken Grid', desc: 'Cells deliberately misalign — energy over order.', params: [],
      render: (w, h) => { const cw = w / 3, ch = h / 3, off = [[0, 0], [.12, .05], [.04, .1], [.08, .02], [.02, .08], [.14, .12], [.05, .04], [.1, .14], [.03, .09]]; return off.map((o, i) => rc((i % 3) * cw + o[0] * cw * .5, Math.floor(i / 3) * ch + o[1] * ch * .5, cw * .86, ch * .86, .7)).join(''); } },
    layered: { cat: 'editorial', name: 'Layered Composition', desc: 'Stacked, offset planes imply depth without perspective.', params: [],
      render: (w, h) => rc(w * .08, h * .1, w * .68, h * .5, .9) + rc(w * .18, h * .24, w * .68, h * .5, .7) + rc(w * .28, h * .38, w * .6, h * .48, .5) + ln(w * .08, h * .1, w * .88, h * .86, .3) },
    overlap: { cat: 'editorial', name: 'Overlapping Composition', desc: 'Two intersecting fields; the overlap is the message.', params: [],
      render: (w, h) => rc(w * .1, h * .14, w * .5, h * .62, .9, .06) + rc(w * .38, h * .3, w * .5, h * .56, .9, .06) },

    /* ---- Photography ---- */
    'center-framing': { cat: 'photo', name: 'Center Framing', desc: 'Subject dead-center with crop-mark corners.', params: [],
      render: (w, h) => { const cx = w / 2, cy = h / 2, r = Math.min(w, h) * .3; const m = Math.min(w, h) * .05, L = Math.min(w, h) * .1; let s = ci(cx, cy, r) + ci(cx, cy, r * .04, 1); [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]].forEach(([x, y, sx, sy]) => { s += ln(x, y, x + L * sx, y, .8) + ln(x, y, x, y + L * sy, .8); }); return s; } },
    'photo-symmetry': { cat: 'photo', name: 'Symmetry (Photo)', desc: 'Full mirror axes with faint thirds for horizon checks.', params: [],
      render: (w, h) => ln(w / 2, 0, w / 2, h) + ln(0, h / 2, w, h / 2) + [1, 2].map(i => ln(0, h * i / 3, w, h * i / 3, .25) + ln(w * i / 3, 0, w * i / 3, h, .25)).join('') },
    'photo-leading': { cat: 'photo', name: 'Leading Lines (Photo)', desc: 'A horizon plus converging sight-lines toward the vanishing point.', params: [{ id: 'hz', label: 'Horizon %', min: 20, max: 80, step: 1, def: 55 }, { id: 'vx', label: 'Vanish X %', min: 10, max: 90, step: 1, def: 50 }],
      render: (w, h, P) => { const hz = h * P.hz / 100, vx = w * P.vx / 100; return ln(0, hz, w, hz, .9) + ln(0, h, vx, hz, .5) + ln(w, h, vx, hz, .5) + ln(0, h * .78, vx, hz, .3) + ln(w, h * .78, vx, hz, .3) + ci(vx, hz, 5); } },
    depth: { cat: 'photo', name: 'Depth Composition', desc: 'Foreground, midground, background bands with scale cues.', params: [],
      render: (w, h) => rc(0, h * .68, w, h * .32, .9) + rc(w * .12, h * .44, w * .76, h * .24, .55) + rc(w * .26, h * .22, w * .48, h * .22, .3) + ci(w * .5, h * .33, Math.min(w, h) * .015, .9) },
    'photo-negative': { cat: 'photo', name: 'Negative Space (Photo)', desc: 'Rule of space: subject looks into the open field.', params: [],
      render: (w, h) => { const cx = w * .72, cy = h * .5, r = Math.min(w, h) * .11; return ci(cx, cy, r, .9) + pa(`M0 0 H${w * .5} V${h} H0 Z`).replace('<path', '<path fill-opacity=".08"') + ln(w * .5, 0, w * .5, h, .35) + pa(`M ${cx - r * 1.6} ${cy} L ${cx - r * 2.4} ${cy} M ${cx - r * 2} ${cy - r * .35} L ${cx - r * 2.4} ${cy} L ${cx - r * 2} ${cy + r * .35}`); } },
    'photo-thirds': { cat: 'photo', name: 'Thirds (Photo)', desc: 'Rule of thirds with photography crop ticks.', params: [],
      render: (w, h) => [1, 2].map(i => ln(w * i / 3, 0, w * i / 3, h, .8) + ln(0, h * i / 3, w, h * i / 3, .8)).join('') + [[0, 0], [w, 0], [0, h], [w, h]].map(([x, y]) => { const sx = x ? -1 : 1, sy = y ? -1 : 1, l = Math.min(w, h) * .04; return ln(x, y, x + l * sx, y, .9) + ln(x, y, x, y + l * sy, .9); }).join('') },

    /* ---- Geometric ---- */
    triangle: { cat: 'geometric', name: 'Triangular', desc: 'An inscribed triangle with medians meeting at the centroid.', params: [],
      render: (w, h) => { const A = [w * .5, h * .1], B = [w * .12, h * .9], C = [w * .88, h * .9]; const g = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3]; return pa(`M ${A} L ${B} L ${C} Z`) + ln(A[0], A[1], (B[0] + C[0]) / 2, (B[1] + C[1]) / 2, .4) + ln(B[0], B[1], (A[0] + C[0]) / 2, (A[1] + C[1]) / 2, .4) + ln(C[0], C[1], (A[0] + B[0]) / 2, (A[1] + B[1]) / 2, .4) + ci(g[0], g[1], 6); } },
    'circle-geo': { cat: 'geometric', name: 'Circular', desc: 'Inscribed circle with diameters for radial alignment.', params: [],
      render: (w, h) => { const r = Math.min(w, h) * .44; return ci(w / 2, h / 2, r) + ln(w / 2 - r, h / 2, w / 2 + r, h / 2, .5) + ln(w / 2, h / 2 - r, w / 2, h / 2 + r, .5) + ci(w / 2, h / 2, r * .5, .5); } },
    'radial-geo': { cat: 'geometric', name: 'Radial', desc: 'Spokes from center to edge for rotational layouts.', params: [{ id: 'spokes', label: 'Spokes', min: 4, max: 20, step: 1, def: 8 }],
      render: (w, h, P) => { const cx = w / 2, cy = h / 2, R = Math.hypot(w, h) / 2; let s = ci(cx, cy, Math.min(w, h) * .42, .8); for (let i = 0; i < P.spokes; i++) { const a = i * 2 * Math.PI / P.spokes; s += ln(cx, cy, cx + Math.cos(a) * R, cy + Math.sin(a) * R, .45); } return s; } },
    'diagonal-geo': { cat: 'geometric', name: 'Diagonal', desc: 'One dominant diagonal with echoing parallels.', params: [],
      render: (w, h) => ln(0, 0, w, h) + ln(0, h * .25, w * .75, h, .5) + ln(w * .25, 0, w, h * .75, .5) },
    'geo-balance': { cat: 'geometric', name: 'Geometric Balance', desc: 'Three equal masses at 120° rotational symmetry.', params: [],
      render: (w, h) => { const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .34, r = Math.min(w, h) * .1; let s = ci(cx, cy, R, .5); for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 3; s += ci(cx + Math.cos(a) * R, cy + Math.sin(a) * R, r, .9); } return s + pa(`M ${cx + Math.cos(-Math.PI / 2) * R} ${cy + Math.sin(-Math.PI / 2) * R} L ${cx + Math.cos(Math.PI / 6) * R} ${cy + Math.sin(Math.PI / 6) * R} L ${cx + Math.cos(Math.PI * 5 / 6) * R} ${cy + Math.sin(Math.PI * 5 / 6) * R} Z`).replace('<path', '<path stroke-opacity=".4"'); } },

    /* ---- Experimental ---- */
    fragmented: { cat: 'experimental', name: 'Fragmented Grid', desc: 'Seeded fragments scatter across the frame — chaotic but repeatable.', params: [{ id: 'seed', label: 'Seed', min: 1, max: 99, step: 1, def: 7 }, { id: 'count', label: 'Fragments', min: 4, max: 18, step: 1, def: 9 }],
      render: (w, h, P) => { const rnd = lcg(P.seed || 7); let s = ''; for (let i = 0; i < P.count; i++) { const x = rnd() * w * .8, y = rnd() * h * .8, ww = rnd() * w * .3 + w * .05, hh = rnd() * h * .3 + h * .05; s += rc(x, y, ww, hh, .7); } return s; } },
    organic: { cat: 'experimental', name: 'Organic Flow', desc: 'Hand-drawn feeling curves that avoid straight lines.', params: [{ id: 'waves', label: 'Curves', min: 2, max: 7, step: 1, def: 4 }],
      render: (w, h, P) => { let s = ''; for (let i = 0; i < P.waves; i++) { const t = i / Math.max(1, P.waves - 1); const y = h * (.15 + .7 * t); s += pa(`M ${w * .02} ${y} C ${w * .2} ${y - h * .12}, ${w * .35} ${y + h * .14}, ${w * .55} ${y - h * .04} S ${w * .85} ${y + h * .1}, ${w * .98} ${y - h * .08}`); } return s; } },
    'overlap-dyn': { cat: 'experimental', name: 'Dynamic Overlap', desc: 'Rotated translucent planes collide at offset centers.', params: [],
      render: (w, h) => rc(w * .16, h * .18, w * .5, h * .5, .9, .07).replace('<rect', `<rect transform="rotate(-7 ${w * .41} ${h * .43})"`) + rc(w * .3, h * .3, w * .5, h * .5, .9, .07).replace('<rect', `<rect transform="rotate(11 ${w * .55} ${h * .55})"`) + ci(w * .5, h * .5, Math.min(w, h) * .08, .9) },
    'asym-layers': { cat: 'experimental', name: 'Asymmetric Layers', desc: 'L-shaped bands stack against the corners.', params: [],
      render: (w, h) => pa(`M0 0 H${w * .55} V${h * .12} H${w * .12} V${h * .55} H0 Z`) + pa(`M${w} ${h} V${h * .45} H${w * .88} V${h * .88} H${w * .45} V${h} Z`).replace('<path', '<path stroke-opacity=".7"') + ln(w * .12, h * .12, w * .88, h * .88, .35) }
  };

  /* Presets whose geometry meaningfully rotates around the artboard center. */
  const ROTATABLE = new Set(['golden-spiral', 'fibonacci', 'radial', 'radial-geo', 'triangle', 'overlap-dyn', 'layered', 'asym-layers', 'organic', 'circular']);
  const isRotatable = (def, presetId) => !!(def && (def.rotable || ROTATABLE.has(presetId)));

  const CAT_NAMES = {
    fundamental: 'Fundamental Composition', golden: 'Golden Geometry', grid: 'Grid Systems',
    dynamic: 'Dynamic Composition', balance: 'Visual Balance', editorial: 'Editorial Composition',
    photo: 'Photography Composition', geometric: 'Geometric Composition', experimental: 'Experimental Composition'
  };

  function guideSvgInner(def, w, h, params) {
    try { return def.render(w, h, params || {}, null); }
    catch (e) { return ''; }
  }
  function guideSvgEl(ab, g, forExport) {
    const def = GUIDE_DEFS[g.preset];
    if (!def) return '';
    const rot = g.rot ? ` transform="rotate(${g.rot} ${ab.w / 2} ${ab.h / 2})"` : '';
    const inner = guideSvgInner(def, ab.w, ab.h, g.params);
    const size = forExport ? ` width="${ab.w}" height="${ab.h}"` : '';
    return `<svg viewBox="0 0 ${ab.w} ${ab.h}"${size} preserveAspectRatio="none" style="opacity:${g.opacity}" class="${g.visible ? '' : 'hidden'}" aria-hidden="true">` +
      `<g fill="none" stroke="${g.color}" stroke-width="${g.thick}" stroke-linecap="round"${rot}>${inner}</g></svg>`;
  }

  function makeGuide(presetId) {
    const def = GUIDE_DEFS[presetId];
    const params = {};
    (def.params || []).forEach(p => { params[p.id] = p.def; });
    return { id: uid(), preset: presetId, name: def.name, color: '#7CE6F2', opacity: .85, thick: 2, visible: true, locked: false, rot: 0, params };
  }

  /* ============================================================ ARTBOARDS */
  const PRESET_SIZES = {
    a4: { mm: [210, 297] }, a3: { mm: [297, 420] }, a5: { mm: [148, 210] },
    'poster-s': { mm: [279, 432] }, 'poster-l': { mm: [457, 610] }, 'poster-xl': { mm: [610, 914] }
  };
  function presetValueToSize(val, dpi) {
    if (PRESET_SIZES[val]) {
      const [mW, mH] = PRESET_SIZES[val].mm;
      return { w: Math.round(mW * MM(dpi)), h: Math.round(mH * MM(dpi)) };
    }
    const m = /^(\d+)x(\d+)/.exec(val);
    if (m) return { w: Number(m[1]), h: Number(m[2]) };
    return null;
  }

  function mkArtboard(o = {}) {
    return Object.assign({
      id: uid(), name: 'Artboard', x: 0, y: 0, w: 1080, h: 1350, unit: 'px',
      dpi: 300, bg: '#10162B', bleed: 0, margin: 0, safe: false, ratioLock: false,
      guides: [], ref: null
    }, o);
  }
  function seedState() {
    const t = makeGuide('thirds');
    const sp = makeGuide('golden-spiral');
    const mg = makeGuide('modular');
    return {
      camera: { x: -160, y: -160, zoom: .28 },
      snap: true, minimap: true,
      artboards: [
        mkArtboard({ name: 'Story 4:5', x: 0, y: 0, w: 1080, h: 1350, bg: '#10162B', guides: [t] }),
        mkArtboard({ name: 'Landscape 16:9', x: 1260, y: 0, w: 1920, h: 1080, bg: '#0E1A26', guides: [sp] }),
        mkArtboard({ name: 'A4 Print', x: 0, y: 1530, w: Math.round(210 * MM(300)), h: Math.round(297 * MM(300)), bg: '#F4F1EA', dpi: 300, unit: 'mm', bleed: 3, margin: 15, safe: true, guides: [mg] })
      ]
    };
  }

  let state = store.getJSON('listo-studio', null);
  if (!state || !Array.isArray(state.artboards) || !state.artboards.length) state = seedState();
  state.artboards = state.artboards.map(a => mkArtboard(a));
  if (!state.camera || !Number.isFinite(state.camera.zoom)) state.camera = { x: -160, y: -160, zoom: .28 };
  if (typeof state.snap !== 'boolean') state.snap = true;
  if (typeof state.minimap !== 'boolean') state.minimap = true;

  let selectedId = null;
  let lastSelIds = [];
  let undoStack = [];
  const refUrls = new Map();   // refId -> objectURL (session)

  let saveT;
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(() => store.setJSON('listo-studio', state), 500);
  }
  function saveNow(manual) {
    store.setJSON('listo-studio', state);
    if (manual) {
      const ab = selAb();
      Projects.add('studio', ab ? ab.name : 'Workspace', { state: snapshotForRecents() });
      Sound.play('success');
      toast('Workspace saved on this device', 'success');
    }
  }
  function snapshotForRecents() {
    return { artboards: state.artboards.map(a => ({ name: a.name, w: a.w, h: a.h })) };
  }
  function pushUndo() {
    undoStack.push(JSON.stringify({ camera: state.camera, artboards: state.artboards, snap: state.snap }));
    if (undoStack.length > 25) undoStack.shift();
  }
  function undo() {
    const snap = undoStack.pop();
    if (!snap) { toast('Nothing to undo'); return; }
    try {
      const s = JSON.parse(snap);
      state.artboards = s.artboards.map(a => mkArtboard(a));
      state.camera = s.camera; state.snap = s.snap;
      if (!state.artboards.find(a => a.id === selectedId)) selectedId = state.artboards[0] && state.artboards[0].id || null;
      Sound.play('toggleOff');
      renderWorld(); syncCamera(); syncInspector(); syncGuides(); persist();
    } catch (e) { toast('Undo failed', 'error'); }
  }

  const selAb = () => state.artboards.find(a => a.id === selectedId) || null;

  /* =============================================================== CAMERA */
  function applyTransform() {
    const { x, y, zoom } = state.camera;
    world.style.transform = `translate3d(${(-x * zoom).toFixed(2)}px, ${(-y * zoom).toFixed(2)}px, 0) scale(${zoom})`;
    if (zoomLabel) zoomLabel.textContent = Math.round(zoom * 100) + '%';
    scheduleMinimap();
  }
  function zoomAt(px, py, factor) {
    const cam = state.camera;
    const wx = cam.x + px / cam.zoom, wy = cam.y + py / cam.zoom;
    cam.zoom = clamp(cam.zoom * factor, 0.04, 5);
    cam.x = wx - px / cam.zoom;
    cam.y = wy - py / cam.zoom;
    applyTransform();
    persist();
  }
  function worldBBox() {
    const bs = state.artboards;
    if (!bs.length) return { x: 0, y: 0, w: 1000, h: 1000 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    bs.forEach(a => {
      x0 = Math.min(x0, a.x); y0 = Math.min(y0, a.y);
      x1 = Math.max(x1, a.x + a.w); y1 = Math.max(y1, a.y + a.h);
    });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  function fitBounds(bbox, pad = 120) {
    const vw = vp.clientWidth, vh = vp.clientHeight;
    if (!vw || !vh) return;
    const zoom = clamp(Math.min((vw - pad) / bbox.w, (vh - pad) / bbox.h), 0.04, 2.2);
    state.camera.zoom = zoom;
    state.camera.x = bbox.x - (vw / zoom - bbox.w) / 2;
    state.camera.y = bbox.y - (vh / zoom - bbox.h) / 2;
    applyTransform();
    persist();
  }
  function fitAll() { fitBounds(worldBBox()); }
  function fitSelected() {
    const ab = selAb();
    if (!ab) { toast('Select an artboard first'); return; }
    fitBounds({ x: ab.x, y: ab.y, w: ab.w, h: ab.h }, 200);
  }

  /* ============================================================ RENDERING */
  function renderWorld() {
    world.innerHTML = '';
    world.appendChild(snapLayer);
    snapLayer.innerHTML = '';
    state.artboards.forEach(ab => world.appendChild(buildAb(ab)));
    scheduleMinimap();
  }

  function buildAb(ab) {
    const el = document.createElement('div');
    el.className = 'ab' + (ab.id === selectedId ? ' sel' : '');
    el.dataset.id = ab.id;
    el.style.left = ab.x + 'px';
    el.style.top = ab.y + 'px';
    el.style.width = ab.w + 'px';
    el.style.height = ab.h + 'px';
    el.innerHTML = `
      <div class="ab-chip">
        <span class="ab-name" title="Double-click to rename">${escapeHtml(ab.name)}</span>
        <span class="ab-dims">${dimLabel(ab)}</span>
        <button class="chip-btn" data-act="rename" aria-label="Rename artboard" title="Rename">✎</button>
        <button class="chip-btn" data-act="dup" aria-label="Duplicate artboard" title="Duplicate">⧉</button>
        <button class="chip-btn" data-act="del" aria-label="Delete artboard" title="Delete">×</button>
      </div>
      <div class="ab-frame" style="background:${ab.bg}">
        ${overlays(ab)}
        <div class="ab-guides">${ab.guides.map(g => guideSvgEl(ab, g)).join('')}</div>
        ${refMarkup(ab)}
      </div>`;
    return el;
  }
  function dimLabel(ab) {
    const u = ab.unit;
    if (u === 'px') return `${Math.round(ab.w)}×${Math.round(ab.h)}`;
    // px per unit at the artboard's DPI: in → dpi px, mm → dpi/25.4, cm → dpi/2.54
    const per = u === 'in' ? ab.dpi : u === 'mm' ? ab.dpi / 25.4 : ab.dpi / 2.54;
    return `${(ab.w / per).toFixed(1)}×${(ab.h / per).toFixed(1)} ${u}`;
  }
  function overlays(ab) {
    let out = '';
    if (ab.bleed > 0) {
      const b = ab.bleed * MM(ab.dpi);
      out += `<div class="ab-bleed" style="inset:${-b}px" title="Bleed ${ab.bleed}mm"></div>`;
    }
    if (ab.margin > 0) {
      out += `<div class="ab-margin" style="inset:${ab.margin}px"></div>`;
    }
    if (ab.safe) {
      const m = ab.margin > 0 ? ab.margin : Math.min(ab.w, ab.h) * .06;
      out += `<div class="ab-safe" style="inset:${m}px"></div>`;
    }
    return out;
  }
  function refMarkup(ab) {
    const r = ab.ref;
    if (!r || !r.src) return '';
    const natW = r.naturalW || 800, natH = r.naturalH || 1000;
    const fitScale = Math.max(ab.w / natW, ab.h / natH);
    const base = r.fit ? fitScale : 1;
    const s = base * (r.scale || 100) / 100;
    return `<div class="ab-ref" style="opacity:${r.visible === false ? 0 : (r.opacity || 40) / 100}">
      <img src="${r.src}" alt="" draggable="false"
        style="width:${natW}px;height:${natH}px;left:50%;top:50%;
        transform:translate(-50%,-50%) translate(${r.x || 0}%, ${r.y || 0}%) scale(${s.toFixed(3)}) rotate(${r.rot || 0}deg)">
    </div>`;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function refreshAb(ab) {
    const el = world.querySelector(`.ab[data-id="${ab.id}"]`);
    if (!el) { renderWorld(); return; }
    el.className = 'ab' + (ab.id === selectedId ? ' sel' : '');
    el.style.left = ab.x + 'px';
    el.style.top = ab.y + 'px';
    el.style.width = ab.w + 'px';
    el.style.height = ab.h + 'px';
    el.querySelector('.ab-dims').textContent = dimLabel(ab);
    const nameEl = el.querySelector('.ab-name');
    if (nameEl && !nameEl.querySelector('input')) nameEl.textContent = ab.name;
    const frame = el.querySelector('.ab-frame');
    frame.style.background = ab.bg;
    // rebuild frame contents: print-space overlays + guides + reference
    frame.innerHTML = overlays(ab) + `<div class="ab-guides">${ab.guides.map(g => guideSvgEl(ab, g)).join('')}</div>` + refMarkup(ab);
    scheduleMinimap();
  }

  /* ============================================================ INTERACTION */
  const pointers = new Map();
  let mode = null; // 'pan' | 'move' | 'pinch'
  let moveStart = null;
  let pinchStart = null;

  function screenToWorldPoint(clientX, clientY) {
    const rect = vp.getBoundingClientRect();
    return {
      x: state.camera.x + (clientX - rect.left) / state.camera.zoom,
      y: state.camera.y + (clientY - rect.top) / state.camera.zoom
    };
  }

  vp.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    const chipBtn = e.target.closest('.chip-btn');
    const chipName = e.target.closest('.ab-name');
    if (chipBtn || (chipName && chipName.querySelector('input'))) return; // let clicks work
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, prev: { x: e.clientX, y: e.clientY } });
    if (pointers.size === 2) {
      mode = 'pinch';
      const [a, b] = [...pointers.values()];
      pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, cam: { ...state.camera } };
      vp.setPointerCapture(e.pointerId);
      return;
    }
    const abEl = e.target.closest('.ab');
    if (abEl) {
      const ab = state.artboards.find(a => a.id === abEl.dataset.id);
      if (!ab) return;
      if (selectedId !== ab.id) {
        selectedId = ab.id;
        noteSelection(ab.id);
        Sound.play('select');
        renderSelection();
        syncInspector(); syncGuides();
      }
      if (ab.ref && ab.ref.locked && e.target.closest('.ab-ref')) { mode = 'pan'; }
      else {
        mode = 'move';
        vp.classList.add('dragging-ab');
        const wpt = screenToWorldPoint(e.clientX, e.clientY);
        moveStart = { id: ab.id, ox: ab.x, oy: ab.y, wx: wpt.x, wy: wpt.y, px0: e.clientX, py0: e.clientY, snapshot: JSON.stringify(state.artboards) };
      }
    } else {
      mode = 'pan';
      vp.classList.add('panning');
    }
    vp.setPointerCapture(e.pointerId);
  });

  vp.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    p.prev.x = p.x; p.prev.y = p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (mode === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const cam = state.camera;
      const rect = vp.getBoundingClientRect();
      const factor = clamp(dist / Math.max(1, pinchStart.dist), .2, 5);
      const wx = pinchStart.cam.x + (cx - rect.left) / pinchStart.cam.zoom;
      const wy = pinchStart.cam.y + (cy - rect.top) / pinchStart.cam.zoom;
      cam.zoom = clamp(pinchStart.cam.zoom * factor, .04, 5);
      cam.x = wx - (cx - rect.left) / cam.zoom;
      cam.y = wy - (cy - rect.top) / cam.zoom;
      applyTransform();
      return;
    }
    if (mode === 'pan') {
      state.camera.x -= (p.x - p.prev.x) / state.camera.zoom;
      state.camera.y -= (p.y - p.prev.y) / state.camera.zoom;
      applyTransform();
      fadeHint();
      return;
    }
    if (mode === 'move' && moveStart) {
      const ab = state.artboards.find(a => a.id === moveStart.id);
      if (!ab) return;
      const totalDx = (e.clientX - moveStart.px0) / state.camera.zoom;
      const totalDy = (e.clientY - moveStart.py0) / state.camera.zoom;
      let nx = moveStart.ox + totalDx;
      let ny = moveStart.oy + totalDy;
      if (state.snap) {
        const res = computeSnap(ab, nx, ny);
        nx = res.x; ny = res.y;
        drawSnapLines(res.lines);
      } else drawSnapLines([]);
      ab.x = Math.round(nx); ab.y = Math.round(ny);
      const el = world.querySelector(`.ab[data-id="${ab.id}"]`);
      if (el) { el.style.left = ab.x + 'px'; el.style.top = ab.y + 'px'; }
      scheduleMinimap();
      fadeHint();
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (mode === 'move' && moveStart) {
      const ab = state.artboards.find(a => a.id === moveStart.id);
      if (ab && (ab.x !== undefined)) {
        // record undo using the snapshot taken at drag start
        if (moveStart.snapshot) undoStack.push(JSON.stringify({ camera: state.camera, artboards: JSON.parse(moveStart.snapshot), snap: state.snap }));
        if (undoStack.length > 25) undoStack.shift();
        persist();
      }
      moveStart = null;
      drawSnapLines([]);
      vp.classList.remove('dragging-ab');
      scheduleMinimap();
    }
    if (pointers.size === 0) { mode = null; vp.classList.remove('panning'); }
    else if (pointers.size === 1 && mode === 'pinch') mode = 'pan';
  }
  vp.addEventListener('pointerup', endPointer);
  vp.addEventListener('pointercancel', endPointer);

  vp.addEventListener('wheel', e => {
    e.preventDefault();
    fadeHint();
    const rect = vp.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    if (e.ctrlKey || e.metaKey) {
      zoomAt(px, py, Math.exp(-e.deltaY * 0.0016));
      Sound.play('zoom');
    } else {
      state.camera.x -= (e.shiftKey ? e.deltaY : e.deltaX) / state.camera.zoom;
      state.camera.y -= (e.shiftKey ? 0 : e.deltaY) / state.camera.zoom;
      applyTransform();
      persist();
    }
  }, { passive: false });

  vp.addEventListener('dblclick', e => {
    if (e.target.closest('.ab') || e.target.closest('.ab-chip')) return;
    const wpt = screenToWorldPoint(e.clientX, e.clientY);
    createArtboard({ x: Math.round(wpt.x - 540), y: Math.round(wpt.y - 675) });
  });

  // keyboard
  vp.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea, select')) return;
    const pan = 90 / state.camera.zoom;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft': state.camera.x -= pan; break;
      case 'ArrowRight': state.camera.x += pan; break;
      case 'ArrowUp': state.camera.y -= pan; break;
      case 'ArrowDown': state.camera.y += pan; break;
      case '+': case '=': zoomAt(vp.clientWidth / 2, vp.clientHeight / 2, 1.25); break;
      case '-': zoomAt(vp.clientWidth / 2, vp.clientHeight / 2, .8); break;
      case '0': fitAll(); break;
      case 'n': case 'N': createArtboard(); break;
      case 'f': case 'F': toggleFocus(); break;
      case 'c': case 'C': compareMode(); break;
      case 'Delete': case 'Backspace': deleteSelected(); break;
      default: handled = false;
    }
    if (handled) { e.preventDefault(); applyTransform(); persist(); }
  });

  function noteSelection(id) {
    lastSelIds = [id, ...lastSelIds.filter(x => x !== id)].slice(0, 2);
  }
  function renderSelection() {
    $$('.ab', world).forEach(el => el.classList.toggle('sel', el.dataset.id === selectedId));
  }

  /* ------------------------------------------------------------------ snap */
  function computeSnap(ab, nx, ny) {
    const tol = 10 / state.camera.zoom;
    const lines = [];
    let bestX = null, bestY = null;
    const moving = { l: nx, r: nx + ab.w, cx: nx + ab.w / 2 };
    const movingY = { t: ny, b: ny + ab.h, cy: ny + ab.h / 2 };
    const targetsX = [0];
    const targetsY = [0];
    state.artboards.forEach(o => {
      if (o.id === ab.id) return;
      targetsX.push(o.x, o.x + o.w, o.x + o.w / 2);
      targetsY.push(o.y, o.y + o.h, o.y + o.h / 2);
    });
    const keysX = ['l', 'r', 'cx'];
    const keysY = ['t', 'b', 'cy'];
    for (const mv of keysX) {
      for (const t of targetsX) {
        const d = t - moving[mv];
        if (Math.abs(d) <= tol && (bestX === null || Math.abs(d) < Math.abs(bestX.d))) bestX = { d, t };
      }
    }
    for (const mv of keysY) {
      for (const t of targetsY) {
        const d = t - movingY[mv];
        if (Math.abs(d) <= tol && (bestY === null || Math.abs(d) < Math.abs(bestY.d))) bestY = { d, t };
      }
    }
    let x = nx, y = ny;
    if (bestX) { x += bestX.d; lines.push({ v: bestX.t }); }
    if (bestY) { y += bestY.d; lines.push({ h: bestY.t }); }
    if (!bestX) x = Math.round(x / 8) * 8;
    if (!bestY) y = Math.round(y / 8) * 8;
    return { x, y, lines };
  }
  function drawSnapLines(lines) {
    snapLayer.innerHTML = lines.map(l => {
      if (l.v !== undefined) {
        const b = worldBBox();
        return `<div class="snap-line v" style="left:${l.v}px;top:${Math.min(0, b.y) - 200}px;height:${b.h + b.y + 400}px"></div>`;
      }
      const b = worldBBox();
      return `<div class="snap-line h" style="top:${l.h}px;left:${Math.min(0, b.x) - 200}px;width:${b.w + b.x + 400}px"></div>`;
    }).join('');
  }

  /* ================================================================ MINIMAP */
  let mmQueued = false;
  function scheduleMinimap() {
    if (mmQueued) return;
    mmQueued = true;
    raf(() => { mmQueued = false; drawMinimap(); });
  }
  function drawMinimap() {
    if (!minimap || state.minimap === false) return;
    const ctx = minimap.getContext('2d');
    const W = minimap.width, H = minimap.height;
    ctx.clearRect(0, 0, W, H);
    const b = worldBBox();
    const cam = state.camera;
    const vw = vp.clientWidth / cam.zoom, vh = vp.clientHeight / cam.zoom;
    const x0 = Math.min(b.x, cam.x) - 100, y0 = Math.min(b.y, cam.y) - 100;
    const x1 = Math.max(b.x + b.w, cam.x + vw) + 100, y1 = Math.max(b.y + b.h, cam.y + vh) + 100;
    const s = Math.min(W / (x1 - x0), H / (y1 - y0));
    const ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2;
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    state.artboards.forEach(a => {
      ctx.fillStyle = a.id === selectedId ? 'rgba(139,92,246,.9)' : 'rgba(160,170,255,.45)';
      ctx.fillRect(ox + (a.x - x0) * s, oy + (a.y - y0) * s, Math.max(2, a.w * s), Math.max(2, a.h * s));
    });
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(ox + (cam.x - x0) * s, oy + (cam.y - y0) * s, vw * s, vh * s);
    minimap._view = { x0, y0, s, ox, oy };
  }
  function minimapNav(e) {
    if (!minimap || !minimap._view) return;
    const rect = minimap.getBoundingClientRect();
    const v = minimap._view;
    const wx = v.x0 + (e.clientX - rect.left - v.ox) / v.s;
    const wy = v.y0 + (e.clientY - rect.top - v.oy) / v.s;
    state.camera.x = wx - vp.clientWidth / state.camera.zoom / 2;
    state.camera.y = wy - vp.clientHeight / state.camera.zoom / 2;
    applyTransform();
    persist();
  }
  if (minimap) {
    minimap.addEventListener('pointerdown', e => {
      minimap.setPointerCapture(e.pointerId);
      minimapNav(e);
      const mv = ev => minimapNav(ev);
      const up = () => { minimap.removeEventListener('pointermove', mv); minimap.removeEventListener('pointerup', up); };
      minimap.addEventListener('pointermove', mv);
      minimap.addEventListener('pointerup', up);
    });
  }

  /* ================================================================ ACTIONS */
  function createArtboard(pos) {
    pushUndo();
    const last = state.artboards[state.artboards.length - 1];
    const w = last ? last.w : 1080, h = last ? last.h : 1350;
    const i = state.artboards.length;
    const ab = mkArtboard({
      name: 'Artboard ' + (i + 1),
      x: pos ? pos.x : Math.round(i * 80), y: pos ? pos.y : Math.round(i * 80),
      w, h, bg: last ? last.bg : '#10162B', dpi: last ? last.dpi : 300
    });
    state.artboards.push(ab);
    selectedId = ab.id;
    noteSelection(ab.id);
    Sound.play('create');
    toast(ab.name + ' created', 'success');
    renderWorld(); syncInspector(); syncGuides(); fitSelected(); persist();
  }
  function duplicateSelected() {
    const ab = selAb();
    if (!ab) { toast('Select an artboard first'); return; }
    pushUndo();
    const copy = mkArtboard(Object.assign({}, ab, {
      id: uid(), name: ab.name + ' copy', x: ab.x + 60, y: ab.y + 60,
      guides: ab.guides.map(g => Object.assign({}, g, { id: uid(), locked: false }))
    }));
    state.artboards.push(copy);
    selectedId = copy.id;
    noteSelection(copy.id);
    Sound.play('create');
    toast(copy.name + ' created', 'success');
    renderWorld(); syncInspector(); syncGuides(); persist();
  }
  function deleteSelected() {
    const ab = selAb();
    if (!ab) { toast('Select an artboard first'); return; }
    if (state.artboards.length <= 1) { toast('Keep at least one artboard', 'error'); Sound.play('error'); return; }
    pushUndo();
    state.artboards = state.artboards.filter(a => a.id !== ab.id);
    selectedId = state.artboards[0].id;
    noteSelection(selectedId);
    Sound.play('remove');
    toast(ab.name + ' deleted');
    renderWorld(); syncInspector(); syncGuides(); persist();
  }
  function toggleFocus() {
    const ab = selAb();
    if (!ab) { toast('Select an artboard first'); return; }
    const on = vp.classList.toggle('focusing');
    $('#tbFocus').setAttribute('aria-pressed', String(on));
    if (on) { fitSelected(); Sound.play('toggleOn'); toast('Focus mode — press F to exit'); }
    else { Sound.play('toggleOff'); }
  }
  function compareMode() {
    const ids = lastSelIds.filter(id => state.artboards.find(a => a.id === id));
    if (ids.length < 2) { toast('Select two artboards first (click them one by one)', 'error'); Sound.play('error'); return; }
    const [a, b] = ids.map(id => state.artboards.find(x => x.id === id));
    const gap = 120;
    const total = a.w + gap + b.w;
    const maxH = Math.max(a.h, b.h);
    pushUndo();
    a.x = -total / 2; a.y = -maxH / 2;
    b.x = -total / 2 + a.w + gap; b.y = -maxH / 2;
    selectedId = a.id;
    renderWorld(); syncInspector(); syncGuides();
    fitBounds({ x: a.x, y: a.y, w: total, h: maxH }, 160);
    vp.classList.remove('focusing');
    Sound.play('nav');
    toast('Compare: ' + a.name + ' ↔ ' + b.name, 'success');
  }
  function autoArrange() {
    if (state.artboards.length < 2) { fitAll(); return; }
    pushUndo();
    const sorted = [...state.artboards].sort((p, q) => (q.w * q.h) - (p.w * p.h));
    const rowW = 4200;
    let x = 0, y = 0, rowH = 0;
    sorted.forEach(a => {
      if (x + a.w > rowW && x > 0) { x = 0; y += rowH + 140; rowH = 0; }
      a.x = x; a.y = y;
      x += a.w + 140;
      rowH = Math.max(rowH, a.h);
    });
    renderWorld();
    fitAll();
    Sound.play('generate');
    toast('Artboards arranged', 'success');
    persist();
  }

  /* ============================================================= INSPECTOR */
  const insp = {}; // element cache
  function cacheInspector() {
    ['abName', 'abUnit', 'abPreset', 'abW', 'abH', 'abSwap', 'abRatioLock', 'abRatio', 'abDpi', 'abBg',
     'abBleed', 'abMargin', 'abSafe', 'guideList', 'guideHint', 'refFile', 'refImport', 'refFit', 'refCtrls',
     'refOpacity', 'refOpacityVal', 'refScale', 'refScaleVal', 'refX', 'refY', 'refRot', 'refShow', 'refLock',
     'refRemove', 'bpTitle', 'bpMood', 'bpNotes', 'bpSave', 'bpExport', 'bpStatus'
    ].forEach(id => { insp[id] = $('#' + id); });
  }

  function toUnit(ab, px) {
    if (ab.unit === 'px') return Math.round(px);
    if (ab.unit === 'mm') return +(px / MM(ab.dpi)).toFixed(1);
    if (ab.unit === 'cm') return +(px / (MM(ab.dpi) * 10)).toFixed(2);
    return +(px / ab.dpi).toFixed(2);
  }
  function fromUnit(ab, val) {
    val = Number(val);
    if (!Number.isFinite(val) || val <= 0) return null;
    if (ab.unit === 'px') return Math.round(val);
    if (ab.unit === 'mm') return Math.round(val * MM(ab.dpi));
    if (ab.unit === 'cm') return Math.round(val * MM(ab.dpi) * 10);
    return Math.round(val * ab.dpi);
  }

  function syncInspector() {
    const ab = selAb();
    const has = !!ab;
    ['abName', 'abUnit', 'abPreset', 'abW', 'abH', 'abSwap', 'abRatioLock', 'abDpi', 'abBg', 'abBleed', 'abMargin', 'abSafe'].forEach(k => {
      if (insp[k]) insp[k].disabled = !has;
    });
    if (!ab) {
      if (insp.abRatio) insp.abRatio.textContent = '—';
      if (insp.refCtrls) insp.refCtrls.hidden = true;
      return;
    }
    if (insp.abName && document.activeElement !== insp.abName) insp.abName.value = ab.name;
    if (insp.abUnit) insp.abUnit.value = ab.unit;
    if (insp.abW && document.activeElement !== insp.abW) insp.abW.value = toUnit(ab, ab.w);
    if (insp.abH && document.activeElement !== insp.abH) insp.abH.value = toUnit(ab, ab.h);
    if (insp.abRatioLock) insp.abRatioLock.checked = !!ab.ratioLock;
    if (insp.abRatio) insp.abRatio.textContent = Color.ratioText(ab.w, ab.h);
    if (insp.abDpi && document.activeElement !== insp.abDpi) insp.abDpi.value = ab.dpi;
    if (insp.abBg) insp.abBg.value = ab.bg;
    if (insp.abBleed && document.activeElement !== insp.abBleed) insp.abBleed.value = ab.bleed;
    if (insp.abMargin && document.activeElement !== insp.abMargin) insp.abMargin.value = toUnit(ab, ab.margin || 0);
    if (insp.abSafe) insp.abSafe.checked = !!ab.safe;
    // reference controls
    if (insp.refCtrls) {
      const r = ab.ref;
      insp.refCtrls.hidden = !r;
      if (r) {
        if (insp.refOpacity && document.activeElement !== insp.refOpacity) insp.refOpacity.value = r.opacity;
        if (insp.refOpacityVal) insp.refOpacityVal.textContent = r.opacity + '%';
        if (insp.refScale && document.activeElement !== insp.refScale) insp.refScale.value = r.scale;
        if (insp.refScaleVal) insp.refScaleVal.textContent = r.scale + '%';
        if (insp.refX && document.activeElement !== insp.refX) insp.refX.value = r.x || 0;
        if (insp.refY && document.activeElement !== insp.refY) insp.refY.value = r.y || 0;
        if (insp.refRot && document.activeElement !== insp.refRot) insp.refRot.value = r.rot || 0;
        if (insp.refShow) insp.refShow.checked = r.visible !== false;
        if (insp.refLock) insp.refLock.checked = !!r.locked;
      }
    }
  }

  function bindInspector() {
    const withAb = fn => () => {
      const ab = selAb();
      if (!ab) return;
      fn(ab);
    };
    insp.abName && insp.abName.addEventListener('input', withAb(ab => {
      ab.name = insp.abName.value.slice(0, 48);
      const el = world.querySelector(`.ab[data-id="${ab.id}"] .ab-name`);
      if (el && !el.querySelector('input')) el.textContent = ab.name || 'Untitled';
      persist();
    }));
    insp.abUnit && insp.abUnit.addEventListener('change', withAb(ab => {
      ab.unit = insp.abUnit.value;
      Sound.play('select');
      syncInspector(); refreshAb(ab); persist();
    }));
    insp.abPreset && insp.abPreset.addEventListener('change', withAb(ab => {
      const size = presetValueToSize(insp.abPreset.value, ab.dpi);
      insp.abPreset.value = '';
      if (!size) return;
      pushUndo();
      ab.w = size.w; ab.h = size.h;
      Sound.play('generate');
      toast('Preset applied — ' + ab.w + ' × ' + ab.h + ' px', 'success');
      refreshAb(ab); syncInspector(); persist();
    }));
    function dimInput(kind) {
      return withAb(ab => {
        const val = fromUnit(ab, kind === 'w' ? insp.abW.value : insp.abH.value);
        if (val === null) return;
        const px = clamp(val, 16, 20000);
        if (ab.ratioLock) {
          const ratio = ab.w / ab.h;
          if (kind === 'w') { ab.w = px; ab.h = Math.round(px / ratio); }
          else { ab.h = px; ab.w = Math.round(px * ratio); }
        } else if (kind === 'w') ab.w = px; else ab.h = px;
        refreshAb(ab);
        if (insp.abRatio) insp.abRatio.textContent = Color.ratioText(ab.w, ab.h);
        if (kind === 'w' && insp.abH && document.activeElement !== insp.abH) insp.abH.value = toUnit(ab, ab.h);
        if (kind === 'h' && insp.abW && document.activeElement !== insp.abW) insp.abW.value = toUnit(ab, ab.w);
        persist();
      });
    }
    insp.abW && insp.abW.addEventListener('input', dimInput('w'));
    insp.abH && insp.abH.addEventListener('input', dimInput('h'));
    insp.abSwap && insp.abSwap.addEventListener('click', withAb(ab => {
      pushUndo();
      const t = ab.w; ab.w = ab.h; ab.h = t;
      Sound.play('adjust');
      refreshAb(ab); syncInspector(); persist();
    }));
    insp.abRatioLock && insp.abRatioLock.addEventListener('change', withAb(ab => {
      ab.ratioLock = insp.abRatioLock.checked;
      Sound.play('lock');
      persist();
    }));
    insp.abDpi && insp.abDpi.addEventListener('change', withAb(ab => {
      ab.dpi = clamp(Number(insp.abDpi.value) || 300, 24, 1200);
      syncInspector(); refreshAb(ab); persist();
    }));
    insp.abBg && insp.abBg.addEventListener('input', withAb(ab => {
      ab.bg = insp.abBg.value;
      const el = world.querySelector(`.ab[data-id="${ab.id}"] .ab-frame`);
      if (el) el.style.background = ab.bg;
      persist();
    }));
    insp.abBleed && insp.abBleed.addEventListener('input', withAb(ab => {
      ab.bleed = clamp(Number(insp.abBleed.value) || 0, 0, 20);
      refreshAb(ab); persist();
    }));
    insp.abMargin && insp.abMargin.addEventListener('input', withAb(ab => {
      const px = fromUnit(ab, insp.abMargin.value);
      ab.margin = clamp(px || 0, 0, 2000);
      refreshAb(ab); persist();
    }));
    insp.abSafe && insp.abSafe.addEventListener('change', withAb(ab => {
      ab.safe = insp.abSafe.checked;
      Sound.play('toggleOn');
      refreshAb(ab); persist();
    }));

    // reference overlay
    insp.refImport && insp.refImport.addEventListener('click', () => {
      const ab = selAb();
      if (!ab) { toast('Select an artboard first'); return; }
      insp.refFile.click();
    });
    insp.refFile && insp.refFile.addEventListener('change', async () => {
      const ab = selAb();
      const file = insp.refFile.files && insp.refFile.files[0];
      insp.refFile.value = '';
      if (!ab || !file) return;
      if (!file.type.startsWith('image/')) { toast('Choose an image file', 'error'); Sound.play('error'); return; }
      if (file.size > 10 * 1024 * 1024) { toast('Image too large (max 10 MB)', 'error'); Sound.play('error'); return; }
      const id = uid();
      const blob = file;
      await IDB.put({ id, blob, name: file.name, type: file.type, createdAt: Date.now() });
      const url = URL.createObjectURL(blob);
      refUrls.set(id, url);
      const img = new Image();
      img.onload = () => {
        ab.ref = {
          srcId: id, src: url, name: file.name, naturalW: img.naturalWidth, naturalH: img.naturalHeight,
          opacity: 40, scale: 100, x: 0, y: 0, rot: 0, visible: true, locked: false, fit: true
        };
        Sound.play('success');
        toast('Reference imported (reference only — never a design layer)', 'success');
        refreshAb(ab); syncInspector(); persist();
      };
      img.onerror = () => { toast('Could not read that image', 'error'); Sound.play('error'); };
      img.src = url;
    });
    const refField = (key, setter) => {
      insp[key] && insp[key].addEventListener('input', withAb(ab => {
        if (!ab.ref || ab.ref.locked) return;
        setter(ab.ref);
        refreshAb(ab); persist();
      }));
    };
    refField('refOpacity', r => { r.opacity = Number(insp.refOpacity.value); if (insp.refOpacityVal) insp.refOpacityVal.textContent = r.opacity + '%'; });
    refField('refScale', r => { r.scale = clamp(Number(insp.refScale.value) || 100, 10, 400); if (insp.refScaleVal) insp.refScaleVal.textContent = r.scale + '%'; });
    refField('refX', r => { r.x = clamp(Number(insp.refX.value) || 0, -100, 100); });
    refField('refY', r => { r.y = clamp(Number(insp.refY.value) || 0, -100, 100); });
    refField('refRot', r => { r.rot = clamp(Number(insp.refRot.value) || 0, -180, 180); });
    insp.refShow && insp.refShow.addEventListener('change', withAb(ab => {
      if (!ab.ref) return;
      ab.ref.visible = insp.refShow.checked;
      Sound.play('toggleOn');
      refreshAb(ab); persist();
    }));
    insp.refLock && insp.refLock.addEventListener('change', withAb(ab => {
      if (!ab.ref) return;
      ab.ref.locked = insp.refLock.checked;
      Sound.play('lock');
      persist();
    }));
    insp.refFit && insp.refFit.addEventListener('click', withAb(ab => {
      if (!ab.ref) { toast('Import a reference first'); return; }
      ab.ref.fit = true; ab.ref.scale = 100; ab.ref.x = 0; ab.ref.y = 0; ab.ref.rot = 0;
      Sound.play('adjust');
      refreshAb(ab); syncInspector(); persist();
    }));
    insp.refRemove && insp.refRemove.addEventListener('click', withAb(ab => {
      if (!ab.ref) return;
      ab.ref = null;
      Sound.play('remove');
      toast('Reference removed');
      refreshAb(ab); syncInspector(); persist();
    }));

    // blueprint (preserved Direction Studio)
    try {
      const bp = store.getJSON('listo-direction', null);
      if (bp) {
        if (insp.bpTitle) insp.bpTitle.value = bp.title || '';
        if (insp.bpMood) insp.bpMood.value = bp.mood || '';
        if (insp.bpNotes) insp.bpNotes.value = bp.compositionNotes || '';
        if (insp.bpStatus) insp.bpStatus.textContent = 'Loaded from this device.';
      }
    } catch (e) { /* corrupt data ignored */ }
    insp.bpSave && insp.bpSave.addEventListener('click', () => {
      const title = insp.bpTitle.value.trim();
      if (!title) { toast('Give the project a title first', 'error'); Sound.play('error'); insp.bpTitle.focus(); return; }
      const ab = selAb();
      const data = {
        product: 'LISTO.', title, mood: insp.bpMood.value.trim(),
        dimensions: ab ? `${ab.w} × ${ab.h} px` : '',
        compositionNotes: insp.bpNotes.value.trim(), updatedAt: new Date().toISOString()
      };
      if (store.setJSON('listo-direction', data)) {
        Projects.add('blueprint', title, data);
        if (insp.bpStatus) insp.bpStatus.textContent = 'Saved on this device · ' + new Date().toLocaleTimeString();
        Sound.play('success');
        toast('Blueprint saved on this device', 'success');
      } else {
        Sound.play('error');
        toast('Storage unavailable in this browser', 'error');
      }
    });
    insp.bpExport && insp.bpExport.addEventListener('click', () => {
      const title = insp.bpTitle.value.trim();
      if (!title) { toast('Give the project a title first', 'error'); Sound.play('error'); return; }
      const ab = selAb();
      const data = {
        product: 'LISTO.', type: 'visual-blueprint', title, mood: insp.bpMood.value.trim(),
        dimensions: ab ? `${ab.w} × ${ab.h} px` : '', compositionNotes: insp.bpNotes.value.trim(),
        artboard: ab ? { name: ab.name, w: ab.w, h: ab.h, unit: ab.unit, dpi: ab.dpi, bleed: ab.bleed } : null,
        exportedAt: new Date().toISOString()
      };
      download('listo-blueprint.json', JSON.stringify(data, null, 2), 'application/json');
      Sound.play('success');
      toast('Blueprint JSON exported', 'success');
    });
  }

  /* ============================================================ GUIDE LIST */
  function syncGuides() {
    const ab = selAb();
    const list = insp.guideList;
    if (!list) return;
    if (!ab) { list.innerHTML = '<p class="help-copy tiny">Select an artboard to manage guides.</p>'; return; }
    if (!ab.guides.length) {
      list.innerHTML = '<p class="help-copy tiny">No guides yet — apply one from the Composition Library.</p>';
      return;
    }
    list.innerHTML = ab.guides.map((g, i) => {
      const def = GUIDE_DEFS[g.preset];
      const rotCtl = `<div><label>Rotation °</label><input type="number" data-rot="${i}" value="${g.rot || 0}" min="-180" max="180" step="1"></div>`;
      const paramHtml = def && def.params && def.params.length
        ? `<div class="g-params g-ctrls">${def.params.map(p => `<div><label>${p.label}</label><input type="number" data-gp="${i}:${p.id}" value="${g.params[p.id] !== undefined ? g.params[p.id] : p.def}" min="${p.min}" max="${p.max}" step="${p.step}"></div>`).join('')}${isRotatable(def, g.preset) ? rotCtl : ''}</div>`
        : (isRotatable(def, g.preset) ? `<div class="g-params g-ctrls">${rotCtl}</div>` : '');
      return `<div class="guide-item ${g.visible ? '' : 'hidden-guide'}" data-gi="${i}">
        <div class="guide-item-top">
          <button class="mini-btn" data-eye="${i}" aria-pressed="${g.visible}" aria-label="Toggle visibility" title="Show / hide">${g.visible ? '👁' : '—'}</button>
          <span class="g-name" title="${def ? def.desc || '' : ''}">${g.name}</span>
          <input type="color" class="g-color" data-col="${i}" value="${g.color}" aria-label="Guide color">
          <button class="mini-btn" data-glock="${i}" aria-pressed="${g.locked}" aria-label="Lock guide" title="Lock">${g.locked ? '🔒' : '🔓'}</button>
        </div>
        <div class="g-ctrls">
          <div><label>OPACITY</label><input type="range" data-gop="${i}" min="10" max="100" value="${Math.round(g.opacity * 100)}"></div>
          <div><label>THICKNESS</label><input type="range" data-gth="${i}" min="1" max="8" value="${g.thick}"></div>
        </div>
        ${paramHtml}
        <div class="g-reorder" style="margin-top:8px">
          <button class="mini-btn" data-gup="${i}" aria-label="Move up" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="mini-btn" data-gdn="${i}" aria-label="Move down" title="Move down" ${i === ab.guides.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="mini-btn" data-gdup="${i}" aria-label="Duplicate guide" title="Duplicate">⧉</button>
          <button class="mini-btn danger" data-gdel="${i}" aria-label="Delete guide" title="Delete" ${g.locked ? 'disabled' : ''}>×</button>
        </div>
      </div>`;
    }).join('');

    $$('.guide-item', list).forEach(item => {
      const i = Number(item.dataset.gi);
      const g = ab.guides[i];
      item.querySelector('[data-eye]').addEventListener('click', () => {
        g.visible = !g.visible; Sound.play('toggleOn'); refreshAb(ab); syncGuides(); persist();
      });
      item.querySelector('[data-col]').addEventListener('input', e => {
        g.color = e.target.value; refreshAb(ab); persist();
      });
      item.querySelector('[data-glock]').addEventListener('click', () => {
        g.locked = !g.locked; Sound.play('lock'); syncGuides(); persist();
      });
      item.querySelector('[data-gop]').addEventListener('input', e => {
        g.opacity = Number(e.target.value) / 100; refreshAb(ab); persist();
      });
      item.querySelector('[data-gth]').addEventListener('input', e => {
        g.thick = Number(e.target.value); refreshAb(ab); persist();
      });
      $$('[data-gp]', item).forEach(inp => inp.addEventListener('input', () => {
        const [gi, key] = inp.dataset.gp.split(':');
        ab.guides[Number(gi)].params[key] = clamp(Number(inp.value) || 0, 0, 999);
        refreshAb(ab); persist();
      }));
      const rotInp = item.querySelector('[data-rot]');
      rotInp && rotInp.addEventListener('input', () => { g.rot = Number(rotInp.value) || 0; refreshAb(ab); persist(); });
      item.querySelector('[data-gup]').addEventListener('click', () => {
        if (i === 0) return;
        pushUndo();
        [ab.guides[i - 1], ab.guides[i]] = [ab.guides[i], ab.guides[i - 1]];
        Sound.play('tap'); refreshAb(ab); syncGuides(); persist();
      });
      item.querySelector('[data-gdn]').addEventListener('click', () => {
        if (i >= ab.guides.length - 1) return;
        pushUndo();
        [ab.guides[i + 1], ab.guides[i]] = [ab.guides[i], ab.guides[i + 1]];
        Sound.play('tap'); refreshAb(ab); syncGuides(); persist();
      });
      item.querySelector('[data-gdup]').addEventListener('click', () => {
        pushUndo();
        ab.guides.splice(i + 1, 0, Object.assign({}, g, { id: uid(), locked: false }));
        Sound.play('create'); refreshAb(ab); syncGuides(); persist();
      });
      item.querySelector('[data-gdel]').addEventListener('click', () => {
        if (g.locked) return;
        pushUndo();
        ab.guides.splice(i, 1);
        Sound.play('remove'); refreshAb(ab); syncGuides(); persist();
      });
    });
  }

  /* ============================================================== LIBRARY */
  function renderLibrary() {
    const wrap = $('#libList');
    if (!wrap) return;
    const cats = Object.keys(CAT_NAMES);
    wrap.innerHTML = cats.map(cat => {
      const defs = Object.entries(GUIDE_DEFS).filter(([, d]) => d.cat === cat);
      if (!defs.length) return '';
      return `<div class="lib-cat">${CAT_NAMES[cat]}</div>` + defs.map(([id, d]) => `
        <button class="lib-item" data-preset="${id}" title="${(d.desc || '').replace(/"/g, '&quot;')}">
          <span class="lib-thumb" aria-hidden="true"><svg viewBox="0 0 64 80"><g fill="none" stroke="#7CE6F2" stroke-width="1.6" stroke-linecap="round" opacity=".9">${guideSvgInner(d, 64, 80, defaultParams(d))}</g></svg></span>
          <span class="lib-item-name">${d.name}<small>${(d.desc || '').slice(0, 46)}…</small></span>
          <span class="lib-apply">APPLY</span>
        </button>`).join('');
    }).join('');
    $$('.lib-item', wrap).forEach(item => item.addEventListener('click', () => {
      const ab = selAb();
      if (!ab) { toast('Select an artboard first', 'error'); Sound.play('error'); return; }
      pushUndo();
      const g = makeGuide(item.dataset.preset);
      g.color = ['#7CE6F2', '#BDABFF', '#F2A37C'][ab.guides.length % 3];
      ab.guides.push(g);
      Sound.play('generate');
      toast(g.name + ' applied to ' + ab.name, 'success');
      refreshAb(ab); syncGuides(); persist();
    }));
  }
  function defaultParams(def) {
    const p = {};
    (def.params || []).forEach(x => { p[x.id] = x.def; });
    return p;
  }

  /* ============================================================== EXPORTS */
  function artboardExportSvg(ab) {
    const W = ab.w, H = ab.h;
    let inner = `<rect x="0" y="0" width="${W}" height="${H}" fill="${ab.bg}"/>`;
    if (ab.bleed > 0) {
      const b = ab.bleed * MM(ab.dpi);
      inner += `<rect x="${-b}" y="${-b}" width="${W + 2 * b}" height="${H + 2 * b}" fill="none" stroke="rgba(242,120,100,.6)" stroke-dasharray="10 7"/>`;
    }
    if (ab.margin > 0) inner += `<rect x="${ab.margin}" y="${ab.margin}" width="${W - 2 * ab.margin}" height="${H - 2 * ab.margin}" fill="none" stroke="rgba(255,255,255,.5)" stroke-dasharray="8 6"/>`;
    if (ab.safe) { const m = ab.margin > 0 ? ab.margin : Math.min(W, H) * .06; inner += `<rect x="${m}" y="${m}" width="${W - 2 * m}" height="${H - 2 * m}" fill="none" stroke="#7FE9C4" stroke-dasharray="6 5" opacity=".8"/>`; }
    inner += ab.guides.filter(g => g.visible).map(g => guideSvgEl(ab, g, true)).join('\n');
    inner += `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="rgba(255,255,255,.25)"/>`;
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${inner}</svg>`;
  }
  function exportSvg() {
    const ab = selAb();
    if (!ab) { toast('Select an artboard first', 'error'); Sound.play('error'); return; }
    const ok = download(`listo-guide-${slug(ab.name)}.svg`, artboardExportSvg(ab), 'image/svg+xml');
    if (ok) { Sound.play('success'); toast('SVG guide exported', 'success'); }
  }
  function exportPng() {
    const ab = selAb();
    if (!ab) { toast('Select an artboard first', 'error'); Sound.play('error'); return; }
    const svg = artboardExportSvg(ab);
    try {
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 3000 / Math.max(ab.w, ab.h));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(ab.w * scale));
        cv.height = Math.max(1, Math.round(ab.h * scale));
        const ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(b => {
          if (b && download(`listo-guide-${slug(ab.name)}.png`, b)) { Sound.play('success'); toast('PNG preview exported', 'success'); }
        }, 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(url); toast('PNG export failed', 'error'); Sound.play('error'); };
      img.src = url;
    } catch (e) { toast('PNG export failed', 'error'); Sound.play('error'); }
  }
  function exportWorkspace() {
    const data = {
      product: 'LISTO.', type: 'studio-workspace', version: 1,
      camera: state.camera, snap: state.snap, artboards: state.artboards.map(a => ({
        name: a.name, x: a.x, y: a.y, w: a.w, h: a.h, unit: a.unit, dpi: a.dpi, bg: a.bg,
        bleed: a.bleed, margin: a.margin, safe: a.safe, ratioLock: a.ratioLock,
        guides: a.guides.map(g => ({ preset: g.preset, name: g.name, color: g.color, opacity: g.opacity, thick: g.thick, rot: g.rot, params: g.params, visible: g.visible, locked: g.locked }))
      })),
      exportedAt: new Date().toISOString()
    };
    download('listo-workspace.json', JSON.stringify(data, null, 2), 'application/json');
    Sound.play('success');
    toast('Workspace JSON exported', 'success');
  }
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'artboard';

  /* =============================================================== TOOLBAR */
  function bindToolbar() {
    const on = (id, fn) => { const el = $('#' + id); el && el.addEventListener('click', fn); };
    on('tbNew', () => createArtboard());
    on('tbDup', duplicateSelected);
    on('tbDel', deleteSelected);
    on('tbUndo', undo);
    on('tbSnap', () => {
      state.snap = !state.snap;
      $('#tbSnap').setAttribute('aria-pressed', String(state.snap));
      Sound.play(state.snap ? 'toggleOn' : 'toggleOff');
      toast('Smart snap ' + (state.snap ? 'on' : 'off'));
      persist();
    });
    on('tbFitAll', () => { fitAll(); Sound.play('zoom'); });
    on('tbFocus', toggleFocus);
    on('tbCompare', compareMode);
    on('tbZoomOut', () => zoomAt(vp.clientWidth / 2, vp.clientHeight / 2, .8));
    on('tbZoomIn', () => zoomAt(vp.clientWidth / 2, vp.clientHeight / 2, 1.25));
    on('tbMini', () => {
      state.minimap = !state.minimap;
      $('#tbMini').setAttribute('aria-pressed', String(state.minimap));
      minimap.classList.toggle('hidden', !state.minimap);
      Sound.play(state.minimap ? 'toggleOn' : 'toggleOff');
      if (state.minimap) drawMinimap();
      persist();
    });
    on('tbLib', () => {
      const open = $('#libDrawer').classList.toggle('open');
      $('#tbLib').setAttribute('aria-pressed', String(open));
      if (open) $('#tbInsp').setAttribute('aria-pressed', 'false'), $('#inspector').classList.remove('open');
      Sound.play(open ? 'toggleOn' : 'toggleOff');
    });
    on('tbInsp', () => {
      const open = $('#inspector').classList.toggle('open');
      $('#tbInsp').setAttribute('aria-pressed', String(open));
      if (open) $('#tbLib').setAttribute('aria-pressed', 'false'), $('#libDrawer').classList.remove('open');
      Sound.play(open ? 'toggleOn' : 'toggleOff');
    });
    on('tbSave', () => saveNow(true));
    on('tbExport', () => {
      const menu = $('#exportMenu');
      const open = menu.hidden;
      menu.hidden = !open;
      $('#tbExport').setAttribute('aria-expanded', String(open));
      Sound.play(open ? 'toggleOn' : 'toggleOff');
    });
    on('expStudioJson', () => { $('#exportMenu').hidden = true; exportWorkspace(); });
    on('expGuideSvg', () => { $('#exportMenu').hidden = true; exportSvg(); });
    on('expGuidePng', () => { $('#exportMenu').hidden = true; exportPng(); });
    on('libClose', () => { $('#libDrawer').classList.remove('open'); $('#tbLib').setAttribute('aria-pressed', 'false'); });
    document.addEventListener('click', e => {
      const menu = $('#exportMenu');
      if (menu && !menu.hidden && !e.target.closest('#exportMenu') && !e.target.closest('#tbExport')) menu.hidden = true;
    });
    $('#tbSnap') && $('#tbSnap').setAttribute('aria-pressed', String(state.snap));
    $('#tbMini') && $('#tbMini').setAttribute('aria-pressed', String(state.minimap));
    minimap.classList.toggle('hidden', !state.minimap);
  }

  /* ============================================================ ARTBOARD UI */
  function bindArtboardEvents() {
    world.addEventListener('click', e => {
      const btn = e.target.closest('.chip-btn');
      if (!btn) return;
      const el = btn.closest('.ab');
      const ab = state.artboards.find(a => a.id === el.dataset.id);
      if (!ab) return;
      const act = btn.dataset.act;
      if (act === 'dup') { selectedId = ab.id; duplicateSelected(); }
      else if (act === 'del') { selectedId = ab.id; deleteSelected(); }
      else if (act === 'rename') startRename(ab);
    });
    world.addEventListener('dblclick', e => {
      const nameEl = e.target.closest('.ab-name');
      if (!nameEl) return;
      const el = nameEl.closest('.ab');
      const ab = state.artboards.find(a => a.id === el.dataset.id);
      if (ab) startRename(ab);
    });
  }
  function startRename(ab) {
    const nameEl = world.querySelector(`.ab[data-id="${ab.id}"] .ab-name`);
    if (!nameEl || nameEl.querySelector('input')) return;
    const input = document.createElement('input');
    input.value = ab.name;
    input.setAttribute('aria-label', 'Artboard name');
    input.maxLength = 48;
    nameEl.textContent = '';
    nameEl.appendChild(input);
    input.focus();
    input.select();
    const commit = () => {
      ab.name = input.value.trim() || ab.name;
      nameEl.textContent = ab.name;
      if (insp.abName && document.activeElement !== insp.abName) insp.abName.value = ab.name;
      Sound.play('success');
      persist();
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.removeEventListener('blur', commit); nameEl.textContent = ab.name; }
      e.stopPropagation();
    });
  }

  /* =================================================================== MISC */
  let hintFaded = false;
  function fadeHint() {
    if (hintFaded) return;
    hintFaded = true;
    const hint = $('#canvasHint');
    if (hint) setTimeout(() => hint.classList.add('faded'), 1400);
  }

  /* =================================================================== INIT */
  let inited = false;
  /* Blob object-URLs do not survive a reload. Re-resolve any saved reference
     from IndexedDB into a fresh URL; drop refs whose blob is gone. */
  async function restoreRefs() {
    const withRefs = state.artboards.filter(a => a.ref && a.ref.srcId);
    let changed = false;
    for (const ab of withRefs) {
      const rec = await IDB.get(ab.ref.srcId);
      if (rec && rec.blob) {
        if (!refUrls.has(ab.ref.srcId)) refUrls.set(ab.ref.srcId, URL.createObjectURL(rec.blob));
        ab.ref.src = refUrls.get(ab.ref.srcId);
        if (!ab.ref.naturalW || !ab.ref.naturalH) {
          // re-measure dimensions from the image itself
          await new Promise(resolve => {
            const img = new Image();
            img.onload = () => { ab.ref.naturalW = img.naturalWidth; ab.ref.naturalH = img.naturalHeight; resolve(); };
            img.onerror = resolve;
            img.src = ab.ref.src;
          });
        }
        changed = true;
        const el = world.querySelector(`.ab[data-id="${ab.id}"]`);
        if (el) {
          const frame = el.querySelector('.ab-frame');
          if (frame) frame.innerHTML = overlays(ab) + `<div class="ab-guides">${ab.guides.map(g => guideSvgEl(ab, g)).join('')}</div>` + refMarkup(ab);
        }
      } else {
        ab.ref = null;
        changed = true;
      }
    }
    if (changed) persist();
  }

  function init() {
    if (inited) return;
    inited = true;
    cacheInspector();
    bindToolbar();
    bindInspector();
    bindArtboardEvents();
    renderLibrary();
    // consume seed from homepage recents
    const seed = window.LISTO.studioSeed;
    if (seed && Array.isArray(seed.artboards)) {
      window.LISTO.studioSeed = null;
      state = { camera: { x: -160, y: -160, zoom: .3 }, snap: true, minimap: true, artboards: seed.artboards.map(a => mkArtboard(a)) };
    }
    if (!selectedId && state.artboards.length) { selectedId = state.artboards[0].id; noteSelection(selectedId); }
    renderWorld();
    applyTransform();
    requestAnimationFrame(() => { fitAll(); });
    syncInspector();
    syncGuides();
    restoreRefs();
    // default panels: inspector open on desktop, closed on small screens
    if (window.innerWidth > 980) {
      $('#inspector').classList.add('open');
      $('#tbInsp') && $('#tbInsp').setAttribute('aria-pressed', 'true');
    }
  }

  Router.register('studio', { init });
  window.addEventListener('resize', () => {
    if (!inited) return;
    applyTransform();
    scheduleMinimap();
  });
})();
