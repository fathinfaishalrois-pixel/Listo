/* ==========================================================================\n   LISTO. — direction.js\n   Guided Direction workflow. Uses the shared Project state from core.js.\n   Browser-only: no database, backend, or runtime dependency.\n   ========================================================================== */
(() => {
  'use strict';
  const L = window.LISTO;
  if (!L) return;
  const { $, $$, clamp, store, Sound, toast, download, Color, Project, Router } = L;
  const view = $('#view-direction');
  if (!view) return;

  const $id = id => document.getElementById(id);
  const panels = ['color', 'composition', 'review', 'export'];
  const labels = ['Color direction', 'Composition & dimensions', 'Visual review', 'Export'];
  const moods = Object.keys(Color.MOODS || {});
  const guideOptions = [
    ['thirds', 'Rule of Thirds'], ['golden-ratio', 'Golden Ratio'], ['golden-spiral', 'Golden Spiral'],
    ['golden-triangle', 'Golden Triangle'], ['fibonacci', 'Fibonacci Spiral'], ['symmetry', 'Symmetry'],
    ['diagonal', 'Diagonal'], ['modular', 'Modular Grid'], ['columns', 'Column Grid'], ['baseline', 'Baseline Grid'],
    ['z-pattern', 'Z-Pattern'], ['f-pattern', 'F-Pattern'], ['radial', 'Radial Composition'], ['negative-space', 'Negative Space']
  ];
  let stage = 0, initialized = false, wheelDrag = false, resizeDrag = null, exportFormat = 'pdf', exportTarget = 'blueprint';
  let state = Project.get();
  let saveTimer = 0, wheelDrawnSize = 0, wheelDrawnDpr = 0;

  const hexValid = v => !!Color.hexToRgb(v);
  const ratio = (w, h) => Color.ratioText(w, h);
  const safeText = v => String(v == null ? '' : v);
  const setStatus = (text, good = false) => {
    const el = $id('dpSavedState');
    if (el) { el.textContent = text; el.classList.toggle('flash', good); }
  };
  const update = (patch, source = 'direction') => { state = Project.update(patch, source); render(); queueSave(); };
  function queueSave() {
    clearTimeout(saveTimer);
    setStatus('Saving locally…');
    saveTimer = setTimeout(() => { Project.flush(); setStatus('Saved on this device', true); }, 260);
  }
  function setStage(targetStage) {
    stage = clamp(targetStage, 0, 3);
    $$('.dir-stage', view).forEach(p => { p.hidden = p.dataset.panel !== panels[stage]; });
    $$('.dir-step', view).forEach((b, i) => {
      b.classList.toggle('active', i === stage);
      b.classList.toggle('done', i < stage);
      if (i === stage) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    const back = $id('dpBack'), next = $id('dpNext'), label = $id('dpStepLabel'), scroll = $id('dpScroll');
    if (back) back.disabled = stage === 0;
    if (next) next.innerHTML = stage === 2 ? 'Export <span aria-hidden="true">→</span>' : stage === 3 ? 'Finish <span aria-hidden="true">✓</span>' : `${['Composition', 'Review', 'Export'][stage]} <span aria-hidden="true">→</span>`;
    if (label) label.textContent = `Step ${stage + 1} of 4 · ${labels[stage]}`;
    if (scroll) scroll.scrollTop = 0;
    render();
  }

  function drawWheel() {
    const canvas = $id('dpWheel'), wrap = canvas && canvas.parentElement, knob = $id('dpKnob');
    if (!canvas || !wrap) return;
    const size = Math.max(120, Math.floor(wrap.clientWidth || 246));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = '100%'; canvas.style.height = '100%';
    if (wheelDrawnSize !== size || wheelDrawnDpr !== dpr) {
      canvas.width = Math.round(size * dpr); canvas.height = Math.round(size * dpr);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      const image = ctx.createImageData(canvas.width, canvas.height);
      const cx = canvas.width / 2, cy = canvas.height / 2, radius = Math.min(cx, cy) * .97;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const dx = x - cx, dy = y - cy, dist = Math.sqrt(dx * dx + dy * dy), i = (y * canvas.width + x) * 4;
        if (dist <= radius) {
          const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
          const sat = clamp(dist / radius, 0, 1);
          const rgb = Color.hsvToRgb(hue, sat * 100, 100);
          image.data[i] = rgb[0]; image.data[i + 1] = rgb[1]; image.data[i + 2] = rgb[2]; image.data[i + 3] = 255;
        } else image.data[i + 3] = 0;
      }
      ctx.putImageData(image, 0, 0); wheelDrawnSize = size; wheelDrawnDpr = dpr;
    }
    const hsv = Color.hexToHsv(state.color.core), angle = hsv[0] * Math.PI / 180, r = hsv[1] / 100 * 48.5;
    if (knob) {
      knob.style.left = `${50 + Math.cos(angle) * r}%`;
      knob.style.top = `${50 + Math.sin(angle) * r}%`;
      knob.setAttribute('aria-valuenow', String(Math.round(hsv[0])));
      knob.setAttribute('aria-valuetext', `Hue ${Math.round(hsv[0])}, saturation ${Math.round(hsv[1])} percent`);
    }
  }
  function pickWheel(e) {
    const canvas = $id('dpWheel'); if (!canvas) return;
    const rect = canvas.getBoundingClientRect(), cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx, dy = e.clientY - cy, rad = Math.min(rect.width, rect.height) / 2;
    const dist = Math.min(Math.hypot(dx, dy), rad * .97);
    const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    const sat = clamp(dist / (rad * .97) * 100, 0, 100);
    const hsv = Color.hexToHsv(state.color.core);
    const core = Color.hsvToHex(hue, sat, hsv[2]);
    update({ color: { core, palette: Color.harmonyHexes([hue, sat, hsv[2]], state.color.harmony) } });
  }

  function renderPalette() {
    const host = $id('dpPalette'); if (!host) return;
    host.innerHTML = state.color.palette.map((c, i) => `<button type="button" class="pal-swatch ${c.toUpperCase() === state.color.core.toUpperCase() ? 'selected' : ''}" data-dp-color="${c}" title="Use ${c} as core color" aria-label="Use ${c} as core color" style="background:${c}"><span class="sw-hex">${c}</span></button>`).join('');
  }
  function renderMoods() {
    const host = $id('dpMoods'); if (!host) return;
    host.innerHTML = moods.map(m => `<button type="button" class="mood-chip ${state.color.mood === m ? 'active' : ''}" data-dp-mood="${m}">${m}</button>`).join('');
  }
  function guideSvg(w, h) {
    const lines = (x1,y1,x2,y2,op=.65) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${state.color.core}" stroke-opacity="${op}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
    const rect = (x,y,ww,hh,op=.7) => `<rect x="${x}" y="${y}" width="${ww}" height="${hh}" fill="none" stroke="${state.color.core}" stroke-opacity="${op}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
    let s = '';
    state.composition.guides.forEach(g => {
      if (g === 'thirds') s += lines(w/3,0,w/3,h)+lines(2*w/3,0,2*w/3,h)+lines(0,h/3,w,h/3)+lines(0,2*h/3,w,2*h/3);
      else if (g === 'golden-ratio') s += lines(w*.382,0,w*.382,h)+lines(w*.618,0,w*.618,h)+lines(0,h*.382,w,h*.382)+lines(0,h*.618,w,h*.618);
      else if (g === 'golden-triangle' || g === 'diagonal') s += lines(0,0,w,h)+lines(w,0,0,h,.35);
      else if (g === 'symmetry') s += lines(w/2,0,w/2,h)+lines(0,h/2,w,h/2);
      else if (g === 'columns' || g === 'modular') { for(let i=1;i<4;i++) s += lines(w*i/4,0,w*i/4,h,.45); if(g==='modular') for(let i=1;i<4;i++) s += lines(0,h*i/4,w,h*i/4,.45); }
      else if (g === 'baseline') { for(let i=1;i<10;i++) s += lines(0,h*i/10,w,h*i/10,.35); }
      else if (g === 'z-pattern') s += lines(0,0,w,h)+lines(0,h*.5,w,h*.5,.35);
      else if (g === 'f-pattern') s += lines(0,h*.22,w,h*.22)+lines(0,h*.48,w*.72,h*.48,.55)+lines(w*.2,0,w*.2,h,.45);
      else if (g === 'radial') { s += `<circle cx="${w/2}" cy="${h/2}" r="${Math.min(w,h)*.32}" fill="none" stroke="${state.color.core}" stroke-opacity=".65"/>`; s += lines(w/2,0,w/2,h)+lines(0,h/2,w,h/2); }
      else if (g === 'negative-space') s += rect(w*.18,h*.18,w*.64,h*.64,.45)+rect(w*.3,h*.3,w*.4,h*.4,.7);
      else if (g === 'golden-spiral' || g === 'fibonacci') { s += rect(w*.0,h*.0,w*.618,h,.55)+rect(w*.382,h*.0,w*.618,h*.618,.45); }
    });
    if (state.composition.safe) s += rect(w*.06,h*.06,w*.88,h*.88,.35);
    if (state.composition.grid) { for(let i=1;i<8;i++) s += lines(w*i/8,0,w*i/8,h,.15)+lines(0,h*i/8,w,h*i/8,.15); }
    if (state.composition.margin > 0) { const m = clamp(state.composition.margin / Math.max(w,h), 0, .4); s += rect(w*m,h*m,w*(1-2*m),h*(1-2*m),.85); }
    return s;
  }
  function renderArtboard() {
    const c = state.composition, frame = $id('dpArtFrame'), svg = $id('dpArtSvg'), viewport = $id('dpArtViewport');
    if (!frame || !svg || !viewport) return;
    const w = c.width, h = c.height, maxW = Math.max(80, viewport.clientWidth - 44), maxH = Math.max(80, viewport.clientHeight - 44);
    const scale = Math.min(maxW / w, maxH / h, 1);
    frame.style.width = `${Math.max(1, w * scale)}px`; frame.style.height = `${Math.max(1, h * scale)}px`; frame.style.background = c.background;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.innerHTML = guideSvg(w,h);
    const txt = `${w} × ${h} ${c.unit}`; ['dpDimReadout'].forEach(id => { if($id(id)) $id(id).textContent = txt; });
    ['dpArtRatio','dpRatioReadout'].forEach(id => { if($id(id)) $id(id).textContent = ratio(w,h); });
    if ($id('dpArtName')) $id('dpArtName').textContent = c.name;
    if ($id('dpSafeState')) $id('dpSafeState').textContent = c.safe ? 'ON' : 'OFF';
    if ($id('dpGridState')) $id('dpGridState').textContent = c.grid ? 'ON' : 'OFF';
    if ($id('dpLockState')) $id('dpLockState').textContent = c.ratioLock ? 'ON' : 'OFF';
  }
  function renderGuides() {
    const host = $id('dpGuides'); if (!host) return;
    host.innerHTML = guideOptions.map(([id,name]) => `<label class="dp-guide ${state.composition.guides.includes(id) ? 'active' : ''}"><input type="checkbox" data-dp-guide="${id}" ${state.composition.guides.includes(id) ? 'checked' : ''}><i aria-hidden="true"></i><span>${name}</span></label>`).join('');
  }
  function renderReview() {
    const c = state.color, d = state.composition, rgb = Color.hexToRgb(c.core), hsl = Color.hexToHsl(c.core);
    const put = (id, value) => { if ($id(id)) $id(id).textContent = safeText(value); };
    put('dpRevTitle', state.title || 'Untitled Direction'); put('dpRevMood', state.mood || c.mood || 'No mood selected');
    put('dpRevCore', c.core); put('dpRevHarmony', c.harmony); put('dpRevDims', `${d.width} × ${d.height} ${d.unit}`); put('dpRevRatio', ratio(d.width,d.height));
    put('dpRevGuides', d.guides.map(g => guideOptions.find(x=>x[0]===g)?.[1] || g).join(', ') || 'None'); put('dpRevDpi', d.dpi);
    put('dpRevName', d.name); put('dpRevArtRatio', `${d.width} × ${d.height}`);
    if ($id('dpRevSwatch')) $id('dpRevSwatch').style.background = c.core;
    if ($id('dpRevPalette')) $id('dpRevPalette').innerHTML = c.palette.map(x=>`<span style="background:${x}" title="${x}"></span>`).join('');
    if ($id('dpRevAtmosphere')) { $id('dpRevAtmosphere').style.setProperty('--direction-color', c.core); $id('dpRevAtmosphere').style.setProperty('--dp-a', c.core); $id('dpRevAtmosphere').style.setProperty('--dp-b', Color.varyHex(c.core,'darker')); ['.atmo-a','.atmo-b','.atmo-c'].forEach((sel,i)=>{const el=$id('dpRevAtmosphere').querySelector(sel);if(el)el.style.background=[c.core,Color.varyHex(c.core,'cooler'),Color.varyHex(c.core,'lighter')][i];}); }
    if ($id('dpRevArt')) { $id('dpRevArt').style.background = d.background; $id('dpRevArt').style.aspectRatio = `${d.width}/${d.height}`; $id('dpRevArt').innerHTML = `<svg viewBox="0 0 ${d.width} ${d.height}" preserveAspectRatio="none">${guideSvg(d.width,d.height)}</svg>`; }
    if ($id('dpRevNotes') && document.activeElement !== $id('dpRevNotes')) $id('dpRevNotes').value = state.notes || '';
    if (rgb && hsl) { put('dpCoreHex',c.core); put('dpCoreRgb',rgb.join(' · ')); put('dpCoreHsl',`${Math.round(hsl[0])}° ${Math.round(hsl[1])}% ${Math.round(hsl[2])}%`); }
  }
  function renderExportPreview() {
    const canvas = $id('dxPreview'); if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    canvas.width = 900; canvas.height = 650;
    const c = state.color, d = state.composition;
    ctx.fillStyle = '#0b1020'; ctx.fillRect(0,0,900,650);
    ctx.fillStyle = '#ffffff'; ctx.font = '700 34px Manrope, sans-serif'; ctx.fillText(state.title || 'Untitled Direction', 48, 62);
    ctx.fillStyle = '#a9a5bd'; ctx.font = '15px sans-serif'; ctx.fillText(`${state.mood || c.mood || 'Visual direction'}  ·  ${d.width} × ${d.height} ${d.unit}  ·  ${c.harmony}`,48,94);
    if (exportTarget === 'palette' || exportTarget === 'blueprint') {
      c.palette.forEach((color,i)=>{ctx.fillStyle=color;ctx.fillRect(48+i*160,130,145,110);ctx.fillStyle='#fff';ctx.font='13px monospace';ctx.fillText(color,48+i*160,260);});
    }
    if (exportTarget === 'composition' || exportTarget === 'artboard' || exportTarget === 'blueprint') {
      const maxW=exportTarget==='blueprint'?430:760, maxH=exportTarget==='blueprint'?300:470, scale=Math.min(maxW/d.width,maxH/d.height);
      const aw=d.width*scale, ah=d.height*scale, x=(900-aw)/2, y=exportTarget==='blueprint'?310:(650-ah)/2+25;
      ctx.fillStyle=d.background;ctx.fillRect(x,y,aw,ah);
      if(exportTarget!=='artboard') { ctx.strokeStyle=c.core;ctx.lineWidth=1.4;ctx.globalAlpha=.75; if(d.guides.includes('thirds')){for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(x+aw*i/3,y);ctx.lineTo(x+aw*i/3,y+ah);ctx.moveTo(x,y+ah*i/3);ctx.lineTo(x+aw,y+ah*i/3);ctx.stroke();}} if(d.safe){ctx.strokeRect(x+aw*.06,y+ah*.06,aw*.88,ah*.88);} ctx.globalAlpha=1; }
    }
    const title=$id('dxPreviewTitle'), meta=$id('dxPreviewMeta'), label=$id('dxExportLabel');
    if(title) title.textContent=`${exportTarget} · ${exportFormat.toUpperCase()}`;
    if(meta) meta.textContent=`${$id('dxPaper')?.value || 'A4'} · ${$id('dxOrientation')?.value || 'Portrait'}`;
    if(label) label.textContent=`Export ${exportFormat.toUpperCase()}`;
    if($id('dxQualityVal') && $id('dxQuality')) $id('dxQualityVal').textContent=`${$id('dxQuality').value}%`;
  }
  function render() {
    state = Project.get();
    const c=state.color,d=state.composition;
    const set=(id,v)=>{const el=$id(id);if(!el || document.activeElement===el)return;if(el.type==='checkbox')el.checked=!!v;else el.value=String(v);};
    set('dpTitle',state.title); set('dpHex',c.core); set('dpNative',c.core); set('dpHarmony',c.harmony); set('dpValue',Math.round(Color.hexToHsv(c.core)[2]));
    const rgb=Color.hexToRgb(c.core),hsl=Color.hexToHsl(c.core),hsv=Color.hexToHsv(c.core);
    if(rgb){set('dpR',rgb[0]);set('dpG',rgb[1]);set('dpB',rgb[2]);}
    if(hsl){set('dpH',Math.round(hsl[0]));set('dpS',Math.round(hsl[1]));set('dpL',Math.round(hsl[2]));}
    if($id('dpMoodReadout')) $id('dpMoodReadout').textContent=c.mood || 'Custom';
    if($id('dpAtmosphere')) { $id('dpAtmosphere').style.setProperty('--direction-color',c.core); $id('dpAtmosphere').style.setProperty('--dp-a',c.core); $id('dpAtmosphere').style.setProperty('--dp-b',Color.varyHex(c.core,'darker')); }
    if($id('dpAtmoA')) $id('dpAtmoA').style.background=c.core;
    if($id('dpAtmoB')) $id('dpAtmoB').style.background=Color.varyHex(c.core,'cooler');
    if($id('dpAtmoC')) $id('dpAtmoC').style.background=Color.varyHex(c.core,'lighter');
    if($id('dpCoreHex')) $id('dpCoreHex').textContent=c.core;
    if($id('dpCoreRgb')) $id('dpCoreRgb').textContent=rgb.join(' · ');
    if($id('dpCoreHsl')) $id('dpCoreHsl').textContent=`${Math.round(hsl[0])}° ${Math.round(hsl[1])}% ${Math.round(hsl[2])}%`;
    if($id('dpHarmonyNote')) $id('dpHarmonyNote').textContent=`${c.harmony} · generated colors are editable; choose any swatch as your new core.`;
    set('dpUnit',d.unit);set('dpDpi',d.dpi);set('dpW',d.width);set('dpHeight',d.height);set('dpRatioLock',d.ratioLock);set('dpBg',d.background);set('dpMargin',d.margin);set('dpSafe',d.safe);set('dpGrid',d.grid);
    renderPalette();renderMoods();renderGuides();renderArtboard();renderReview();renderExportPreview();drawWheel();
  }

  function setCore(hex, keepPalette=false) {
    if(!hexValid(hex)) return;
    const hsv=Color.hexToHsv(hex), palette=keepPalette?state.color.palette:Color.harmonyHexes(hsv,state.color.harmony);
    update({color:{core:hex.toUpperCase(),palette}});
  }
  function bindColor() {
    const wheel=$id('dpWheel'),knob=$id('dpKnob');
    if(wheel){wheel.addEventListener('pointerdown',e=>{wheelDrag=true;wheel.setPointerCapture?.(e.pointerId);pickWheel(e);});wheel.addEventListener('pointermove',e=>{if(wheelDrag)pickWheel(e);});wheel.addEventListener('pointerup',()=>wheelDrag=false);wheel.addEventListener('pointercancel',()=>wheelDrag=false);}
    if(knob){knob.addEventListener('pointerdown',e=>{e.preventDefault();wheelDrag=true;});window.addEventListener('pointermove',e=>{if(wheelDrag)pickWheel(e);});window.addEventListener('pointerup',()=>wheelDrag=false);}
    const hex=$id('dpHex'), native=$id('dpNative');
    hex?.addEventListener('change',()=>{let v=hex.value.trim();if(!v.startsWith('#'))v='#'+v;if(hexValid(v))setCore(v);else{hex.value=state.color.core;toast('Enter a valid HEX color, for example #7357E8','error');}});
    native?.addEventListener('input',()=>setCore(native.value));
    $id('dpValue')?.addEventListener('input',e=>{const hsv=Color.hexToHsv(state.color.core);setCore(Color.hsvToHex(hsv[0],hsv[1],Number(e.target.value)/100));});
    ['dpR','dpG','dpB'].forEach(id=>$id(id)?.addEventListener('change',()=>{const vals=['dpR','dpG','dpB'].map(k=>clamp(Number($id(k).value)||0,0,255));setCore(Color.rgbToHex(...vals));}));
    ['dpH','dpS','dpL'].forEach(id=>$id(id)?.addEventListener('change',()=>{const vals=['dpH','dpS','dpL'].map((k,i)=>clamp(Number($id(k).value)||0,[0,0,0][i],[360,100,100][i]));setCore(Color.hslToHex(...vals));}));
    $id('dpHarmony')?.addEventListener('change',e=>update({color:{harmony:e.target.value,palette:Color.harmonyHexes(Color.hexToHsv(state.color.core),e.target.value)}}));
    $id('dpMoods')?.addEventListener('click',e=>{const b=e.target.closest('[data-dp-mood]');if(!b)return;const mood=b.dataset.dpMood,pal=Color.moodPalette(mood);if(pal)update({mood,color:{core:pal[2],palette:pal,mood}});});
    $id('dpClearMood')?.addEventListener('click',()=>update({mood:'',color:{mood:'Custom'}}));
    $id('dpRegen')?.addEventListener('click',()=>update({color:{palette:Color.harmonyHexes(Color.hexToHsv(state.color.core),state.color.harmony)}}));
    $id('dpPalette')?.addEventListener('click',e=>{const b=e.target.closest('[data-dp-color]');if(b)setCore(b.dataset.dpColor);});
    $id('dpHarmony')?.addEventListener('change',()=>Sound.play('select'));
    $$('.dir-vary [data-dp-vary]').forEach(b=>b.addEventListener('click',()=>setCore(Color.varyHex(state.color.core,b.dataset.dpVary))));
  }
  function bindComposition() {
    const num=(id,fn)=>$id(id)?.addEventListener('change',e=>fn(Number(e.target.value)));
    const liveDimension=(id,kind)=>$id(id)?.addEventListener('input',e=>{
      if(e.target.value.trim()==='')return;
      const value=Number(e.target.value);if(!Number.isFinite(value)||value<16)return;
      const d=state.composition;
      if(kind==='w'){const w=clamp(Math.round(value),16,20000);const h=d.ratioLock?Math.round(w*d.height/d.width):d.height;update({composition:{width:w,height:clamp(h,16,20000)}});}
      else {const h=clamp(Math.round(value),16,20000);const w=d.ratioLock?Math.round(h*d.width/d.height):d.width;update({composition:{width:clamp(w,16,20000),height:h}});}
    });
    liveDimension('dpW','w'); liveDimension('dpHeight','h');
    num('dpDpi',v=>update({composition:{dpi:clamp(Math.round(v)||300,24,1200)}}));
    num('dpMargin',v=>update({composition:{margin:clamp(Math.round(v)||0,0,2000)}}));
    $id('dpUnit')?.addEventListener('change',e=>update({composition:{unit:e.target.value}}));
    $id('dpBg')?.addEventListener('input',e=>update({composition:{background:e.target.value}}));
    $id('dpRatioLock')?.addEventListener('change',e=>update({composition:{ratioLock:e.target.checked}}));
    $id('dpSafe')?.addEventListener('change',e=>update({composition:{safe:e.target.checked}}));
    $id('dpGrid')?.addEventListener('change',e=>update({composition:{grid:e.target.checked}}));
    $id('dpSwap')?.addEventListener('click',()=>update({composition:{width:state.composition.height,height:state.composition.width}}));
    $id('dpRatios')?.addEventListener('click',e=>{const b=e.target.closest('[data-ratio]');if(!b)return;const [a,bv]=b.dataset.ratio.split(':').map(Number);const d=state.composition;let w=d.width,h=Math.round(w*bv/a);if(h>20000){h=20000;w=Math.round(h*a/bv);}update({composition:{width:Math.max(16,w),height:Math.max(16,h)}});});
    $id('dpGuides')?.addEventListener('change',e=>{const cb=e.target.closest('[data-dp-guide]');if(!cb)return;const guides=new Set(state.composition.guides);cb.checked?guides.add(cb.dataset.dpGuide):guides.delete(cb.dataset.dpGuide);update({composition:{guides:[...guides]}});});
    $id('dpTitle')?.addEventListener('input',e=>{Project.update({title:e.target.value},'direction-title');state=Project.get();queueSave();renderReview();});
    $id('dpRevNotes')?.addEventListener('input',e=>{Project.update({notes:e.target.value},'direction-notes');state=Project.get();queueSave();});
    const frame=$id('dpArtFrame');
    frame?.addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-handle]');if(!handle)return;e.preventDefault();const rect=frame.getBoundingClientRect();resizeDrag={handle:handle.dataset.handle,x:e.clientX,y:e.clientY,w:state.composition.width,h:state.composition.height,rectW:rect.width,rectH:rect.height};frame.classList.add('dragging');frame.setPointerCapture?.(e.pointerId);});
    frame?.addEventListener('pointermove',e=>{if(!resizeDrag)return;const r=resizeDrag,dx=(e.clientX-r.x)*(r.w/r.rectW),dy=(e.clientY-r.y)*(r.h/r.rectH),g=r.handle;let w=r.w,h=r.h;if(g.includes('e'))w+=dx;if(g.includes('w'))w-=dx;if(g.includes('s'))h+=dy;if(g.includes('n'))h-=dy;w=clamp(Math.round(w),16,20000);h=clamp(Math.round(h),16,20000);if(state.composition.ratioLock){const ratio0=r.w/r.h;if(Math.abs(dx)>=Math.abs(dy))h=Math.round(w/ratio0);else w=Math.round(h*ratio0);}update({composition:{width:w,height:h}});});
    const end=()=>{resizeDrag=null;frame?.classList.remove('dragging');};
    frame?.addEventListener('pointerup',end);frame?.addEventListener('pointercancel',end);
  }
  function openSaved() {
    const modal=$id('dpSavedModal'),list=$id('dpSavedList');if(!modal||!list)return;
    const saved=Project.listSaved();
    list.innerHTML=saved.length?saved.map(x=>`<div class="dir-saved-item"><button type="button" class="si-main" data-open-project="${x.id}"><b>${escapeHtml(x.name)}</b><span>${new Date(x.ts).toLocaleString()}</span></button><button type="button" class="mini-btn" data-delete-project="${x.id}" aria-label="Delete ${escapeHtml(x.name)}">×</button></div>`).join(''):'<p class="help-copy">No saved directions yet. Save this project to find it here.</p>';
    modal.hidden=false;
  }
  function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function bindProjects() {
    $id('dpSave')?.addEventListener('click',()=>{state=Project.update({title:$id('dpTitle')?.value||state.title},'save');Project.save(state.title);Project.flush();setStatus('Project saved',true);toast('Direction saved on this device','success');});
    $id('dpOpen')?.addEventListener('click',openSaved);
    $id('dpNew')?.addEventListener('click',()=>{if(confirm('Start a new direction? Your current project is saved locally only if you have saved it.')){Project.reset();setStage(0);toast('New direction started');}});
    $id('dpModalClose')?.addEventListener('click',()=>{$id('dpSavedModal').hidden=true;});
    $id('dpSavedModal')?.addEventListener('click',e=>{if(e.target===$id('dpSavedModal'))$id('dpSavedModal').hidden=true;const open=e.target.closest('[data-open-project]');if(open){Project.open(open.dataset.openProject);$id('dpSavedModal').hidden=true;setStage(0);}const del=e.target.closest('[data-delete-project]');if(del){Project.removeSaved(del.dataset.deleteProject);openSaved();}});
    $id('dpModalSave')?.addEventListener('click',()=>{$id('dpSave')?.click();openSaved();});
    $id('dpModalNew')?.addEventListener('click',()=>{$id('dpSavedModal').hidden=true;$id('dpNew')?.click();});
  }
  function exportCanvas(target, scale=1, transparent=false) {
    const d=state.composition,c=state.color, canvas=document.createElement('canvas'), max=3200;
    const ratioScale=Math.min(1,2000/Math.max(d.width,d.height));
    const baseW=target==='palette'?1200:target==='blueprint'?1600:Math.max(1,Math.round(d.width*ratioScale));
    const baseH=target==='palette'?700:target==='blueprint'?1200:Math.max(1,Math.round(d.height*ratioScale));
    const factor=Math.min(scale,max/Math.max(baseW,baseH),2);canvas.width=Math.max(1,Math.round(baseW*factor));canvas.height=Math.max(1,Math.round(baseH*factor));
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas is unavailable');
    if(!transparent || target==='palette' || target==='blueprint'){ctx.fillStyle=target==='palette'||target==='blueprint'?'#0b1020':d.background;ctx.fillRect(0,0,canvas.width,canvas.height);}
    if(target==='palette'||target==='blueprint'){
      ctx.fillStyle='#fff';ctx.font=`bold ${Math.max(24,canvas.width*.035)}px sans-serif`;ctx.fillText(state.title||'LISTO Direction',canvas.width*.05,canvas.height*.13);
      const gap=canvas.width*.018, sw=(canvas.width*.9-gap*4)/5, y=canvas.height*.25, sh=canvas.height*.34;
      c.palette.forEach((color,i)=>{const x=canvas.width*.05+i*(sw+gap);ctx.fillStyle=color;ctx.fillRect(x,y,sw,sh);ctx.fillStyle='#fff';ctx.font=`${Math.max(12,canvas.width*.012)}px monospace`;ctx.fillText(color,x,y+sh+28);});
    }
    if(target==='blueprint'){
      ctx.strokeStyle=c.core;ctx.lineWidth=Math.max(1,canvas.width*.0012);ctx.globalAlpha=.55;
      if(d.guides.includes('thirds'))for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(canvas.width*i/3,0);ctx.lineTo(canvas.width*i/3,canvas.height);ctx.moveTo(0,canvas.height*i/3);ctx.lineTo(canvas.width,canvas.height*i/3);ctx.stroke();}
      ctx.globalAlpha=1;
    }
    return canvas;
  }
  function drawGuideOverlay(canvas) {
    return new Promise(resolve => {
      const d=state.composition;
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${d.width} ${d.height}">${guideSvg(d.width,d.height)}</svg>`;
      const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
      const img=new Image();
      img.onload=()=>{try{canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);}finally{URL.revokeObjectURL(url);resolve();}};
      img.onerror=()=>{URL.revokeObjectURL(url);resolve();};
      img.src=url;
    });
  }
  function exportImage(format,target) {
    const transparent=format==='png' && !!$id('dxTransparent')?.checked;
    const canvas=exportCanvas(target,Number($id('dxResolution')?.value||2400)/1600,transparent),mime=format==='jpg'?'image/jpeg':'image/png';
    const finish=()=>canvas.toBlob(blob=>{if(!blob){toast('Could not create image. Try a lower resolution.','error');return;}download(`listo-${target}.${format}`,blob,mime);toast(`${format.toUpperCase()} exported`,'success');},mime,Number($id('dxQuality')?.value||92)/100);
    if(target==='composition') drawGuideOverlay(canvas).then(finish); else finish();
  }
  function exportJson() { const data={...state,exportedAt:new Date().toISOString(),app:'LISTO.'};download('listo-visual-direction.json',JSON.stringify(data,null,2),'application/json');toast('JSON blueprint exported','success'); }
  function exportPdf() {
    const target=exportTarget, c=state.color,d=state.composition;
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(state.title||'LISTO Blueprint')}</title><style>@page{size:${$id('dxPaper')?.value==='letter'?'letter':'A4'} ${$id('dxOrientation')?.value==='landscape'?'landscape':'portrait'};margin:16mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#172033}h1{font-size:28px;margin:0 0 8px}p{color:#586174}.swatches{display:flex;gap:8px;margin:20px 0}.swatch{flex:1;height:95px;border-radius:8px;padding:8px;color:#fff;font:11px monospace;display:flex;align-items:end}.art{margin:20px auto;background:${d.background};width:min(70%,400px);aspect-ratio:${d.width}/${d.height};border:1px solid #ddd;position:relative}.art svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.facts{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px}.facts div{padding:12px;background:#f3f4f8;border-radius:8px}.note{white-space:pre-wrap}</style></head><body><h1>${escapeHtml(state.title||'Untitled Direction')}</h1><p>${escapeHtml(state.mood||c.mood||'Visual direction')} · ${escapeHtml(c.harmony)}</p>${target!=='composition'&&target!=='artboard'?`<div class="swatches">${c.palette.map(x=>`<div class="swatch" style="background:${x}">${x}</div>`).join('')}</div>`:''}${target!=='palette'?`<div class="art"><svg viewBox="0 0 ${d.width} ${d.height}" preserveAspectRatio="none">${target==='artboard'?'':guideSvg(d.width,d.height)}</svg></div>`:''}<div class="facts"><div><b>Core color</b><br>${c.core}</div><div><b>Dimensions</b><br>${d.width} × ${d.height} ${d.unit}</div><div><b>Aspect ratio</b><br>${ratio(d.width,d.height)}</div><div><b>Guides</b><br>${escapeHtml(d.guides.join(', ')||'None')}</div><div><b>Resolution</b><br>${d.dpi} DPI</div><div><b>Background</b><br>${d.background}</div></div><h3>Notes</h3><p class="note">${escapeHtml(state.notes||'No notes added.')}</p><script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script></body></html>`;
    const win=window.open('', '_blank');if(!win){toast('Allow pop-ups to create the PDF print view.','error');return;}win.document.open();win.document.write(html);win.document.close();
    toast('Print dialog opened. Choose “Save as PDF”.','success');
  }
  function bindExport() {
    $id('dxFormats')?.addEventListener('click',e=>{const b=e.target.closest('[data-format]');if(!b)return;exportFormat=b.dataset.format;$$('[data-format]').forEach(x=>x.classList.toggle('active',x===b));renderExportPreview();});
    $id('dxTargets')?.addEventListener('click',e=>{const b=e.target.closest('[data-target]');if(!b)return;exportTarget=b.dataset.target;$$('[data-target]').forEach(x=>x.classList.toggle('active',x===b));renderExportPreview();});
    $$('[data-quick]').forEach(b=>b.addEventListener('click',()=>{exportTarget=b.dataset.quick;$$('[data-target]').forEach(x=>x.classList.toggle('active',x.dataset.target===exportTarget));renderExportPreview();}));
    ['dxPaper','dxOrientation','dxResolution','dxQuality'].forEach(id=>$id(id)?.addEventListener('input',renderExportPreview));
    $id('dxExport')?.addEventListener('click',()=>{try{if(exportFormat==='pdf')exportPdf();else exportImage(exportFormat,exportTarget);}catch(err){console.error('[LISTO] export failed',err);toast('Export failed. Try another format or lower resolution.','error');}});
    $id('dxAll')?.addEventListener('click',()=>{try{exportJson();exportImage('png','blueprint');exportImage('jpg','artboard');toast('JSON, PNG, and JPG export started. PDF can be saved from the PDF option.');}catch(err){console.error(err);toast('Some exports could not be created.','error');}});
    $id('dpNext')?.addEventListener('click',()=>{if(stage===3){toast('Your direction is saved locally.','success');return;}setStage(stage+1);});
    $id('dpBack')?.addEventListener('click',()=>setStage(stage-1));
    $id('dpSteps')?.addEventListener('click',e=>{const b=e.target.closest('[data-stage]');if(b)setStage(panels.indexOf(b.dataset.stage));});
  }
  function init() {
    if(initialized)return;initialized=true;
    bindColor();bindComposition();bindProjects();bindExport();
    document.addEventListener('listo:project',e=>{if(String(e.detail?.source || '').startsWith('direction'))return;state=Project.get();render();});
    window.addEventListener('resize',()=>{if(Router.current==='direction')renderArtboard();});
    render();setStage(0);
  }
  Router.register('direction',{init});
  if(Router.current==='direction')init();
})();
