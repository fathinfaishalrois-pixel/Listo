(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const backdrop = $('#modalBackdrop'), body = $('#workspaceBody'), title = $('#workspaceTitle'), kicker = $('#workspaceKicker');
  let audioOn = false, audioCtx = null, currentPalette = ['#6D5CE8','#9277F2','#5AC8D8','#E28BC0','#F0B77A'];
  let activeGuide = 'thirds', artboardLandscape = false;

  function sound(freq=520, duration=.055, type='sine', volume=.025){
    if(!audioOn) return;
    try{
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      if(audioCtx.state === 'suspended') audioCtx.resume();
      const osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
      osc.type=type; osc.frequency.setValueAtTime(freq,audioCtx.currentTime);
      gain.gain.setValueAtTime(volume,audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+duration);
      osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration);
    }catch(e){}
  }
  function toast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2200)}
  function openModal(which){
    const configs={
      color:['COLOR / EXPLORATION','Color Explorer',colorMarkup()],
      composition:['COMPOSITION / PLAYGROUND','Composition Playground',compositionMarkup()],
      dimensions:['FORMAT / DIMENSIONS','Dimensions Explorer',dimensionsMarkup()],
      direction:['DIRECTION / BLUEPRINT','Direction Studio',directionMarkup()]
    };
    [kicker.textContent,title.textContent,body.innerHTML]=configs[which]||configs.color;
    backdrop.classList.add('open');backdrop.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';sound(620,.08,'sine');
    bindWorkspace(which);
  }
  function closeModal(){backdrop.classList.remove('open');backdrop.setAttribute('aria-hidden','true');document.body.style.overflow='';sound(390,.06)}
  $('#closeModal').addEventListener('click',closeModal);
  backdrop.addEventListener('click',e=>{if(e.target===backdrop)closeModal()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
  $$('[data-open]').forEach(b=>b.addEventListener('click',()=>openModal(b.dataset.open)));
  $('#soundToggle').addEventListener('click',()=>{audioOn=!audioOn;$('#soundIcon').textContent=audioOn?'♫':'♪';toast(audioOn?'Interaction sound enabled':'Sound muted');if(audioOn)sound(760,.09,'triangle')});
  $('#themeToggle').addEventListener('click',()=>{document.body.classList.toggle('light');sound(570,.05);toast(document.body.classList.contains('light')?'Light theme':'Dark theme')});
  $('#menuToggle').addEventListener('click',()=>$('#navLinks').classList.toggle('open'));
  $$('.nav-link').forEach(a=>a.addEventListener('click',()=>{$$('.nav-link').forEach(x=>x.classList.remove('active'));a.classList.add('active');$('#navLinks').classList.remove('open')}));
  window.addEventListener('scroll',()=>{$('.topbar').classList.toggle('scrolled',window.scrollY>45)},{passive:true});
  const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){const id=e.target.id;$$('.nav-link').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+id))}}),{rootMargin:'-30% 0px -60% 0px'});
  ['explore','colors','composition','dimensions','references'].forEach(id=>{const el=document.getElementById(id);if(el)observer.observe(el)});
  $$('.mood-card').forEach(card=>card.addEventListener('click',()=>{openModal('color');const mood=card.dataset.mood;$('#moodSelect').value=mood;generatePalette();toast(mood+' mood selected')}));
  function hexToRgb(hex){const n=parseInt(hex.replace('#',''),16);return [(n>>16)&255,(n>>8)&255,n&255]}
  function rgbToHex(r,g,b){return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('').toUpperCase()}
  function rgbToHsl(r,g,b){r/=255;g/=255;b/=255;let max=Math.max(r,g,b),min=Math.min(r,g,b),h,s,l=(max+min)/2;if(max===min)h=s=0;else{let d=max-min;s=l>.5?d/(2-max-min):d/(max+min);switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break}h*=60}return [h,s*100,l*100]}
  function hslToHex(h,s,l){s/=100;l/=100;const a=s*Math.min(l,1-l);const f=n=>{const k=(n+h/30)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1))};return rgbToHex(f(0)*255,f(8)*255,f(4)*255)}
  function makePalette(base,mode){const [h,s,l]=rgbToHsl(...hexToRgb(base));let hues=[];switch(mode){case'Analogous':hues=[h-35,h-18,h,h+18,h+35];break;case'Complementary':hues=[h-12,h,h+8,h+180,h+192];break;case'Triadic':hues=[h,h+120,h+240,h+12,h+132];break;case'Monochromatic':return [l-27,l-12,l,l+13,l+27].map((v)=>hslToHex(h,s,Math.max(12,Math.min(88,v))));default:hues=[h-28,h-12,h,h+12,h+28]}
    return hues.map((v,i)=>hslToHex((v+360)%360,Math.max(30,Math.min(88,s+(i%2?8:-5))),Math.max(22,Math.min(78,l+(i-2)*8))));
  }
  function paletteMarkup(){return `<div class="palette-output" id="paletteOutput">${currentPalette.map(c=>`<div class="palette-chip" style="background:${c}" data-copy="${c}">${c}</div>`).join('')}</div>`}
  function colorMarkup(){return `<div class="tool-layout"><div><div class="control-group"><label for="baseColor">Base color</label><input type="color" id="baseColor" value="#6D5CE8"></div><div class="control-group"><label for="hexColor">HEX value</label><input id="hexColor" value="#6D5CE8" maxlength="7" spellcheck="false"></div><div class="control-group"><label for="harmony">Color harmony</label><select id="harmony"><option>Analogous</option><option>Complementary</option><option>Triadic</option><option>Monochromatic</option><option>Balanced</option></select></div><div class="control-group"><label for="moodSelect">Mood direction</label><select id="moodSelect"><option value="Custom">Custom</option><option>Midnight</option><option>Earth</option><option>Electric</option></select></div><button class="button button-primary" id="generatePalette">Generate palette ↗</button></div><div><h3 class="subheading">Palette preview</h3><p class="help-copy">A considered starting point, not a universal color rule. Select a swatch to copy its HEX value.</p>${paletteMarkup()}<div class="result-box"><div class="subheading">Palette variation</div><button class="small-button" data-variation="lighter">Lighter</button><button class="small-button" data-variation="darker">Darker</button><button class="small-button" data-variation="muted">Muted</button><button class="small-button" data-variation="vibrant">Vibrant</button><button class="small-button" id="copyPalette">Copy CSS variables</button></div></div></div>`}
  function generatePalette(){const base=$('#baseColor').value;currentPalette=makePalette(base,$('#harmony').value);$('#hexColor').value=base.toUpperCase();$('#paletteOutput').outerHTML=paletteMarkup();bindPaletteClicks();sound(690,.1,'triangle')}
  function bindPaletteClicks(){$$('.palette-chip',body).forEach(el=>el.addEventListener('click',()=>{navigator.clipboard?.writeText(el.dataset.copy).then(()=>toast(el.dataset.copy+' copied')).catch(()=>toast(el.dataset.copy));sound(780,.045)}))}
  function bindWorkspace(which){
    if(which==='color'){
      $('#baseColor').addEventListener('input',e=>{$('#hexColor').value=e.target.value.toUpperCase();currentPalette=makePalette(e.target.value,$('#harmony').value);$('#paletteOutput').outerHTML=paletteMarkup();bindPaletteClicks()});
      $('#hexColor').addEventListener('change',e=>{let v=e.target.value.trim();if(/^#[0-9a-f]{6}$/i.test(v)){$('#baseColor').value=v;generatePalette()}else toast('Masukkan HEX enam digit, misalnya #6D5CE8')});
      $('#generatePalette').addEventListener('click',generatePalette);$('#harmony').addEventListener('change',generatePalette);
      $$('[data-variation]',body).forEach(b=>b.addEventListener('click',()=>{const mode=b.dataset.variation;currentPalette=currentPalette.map(c=>{let [h,s,l]=rgbToHsl(...hexToRgb(c));if(mode==='lighter')l=Math.min(88,l+12);if(mode==='darker')l=Math.max(12,l-12);if(mode==='muted')s=Math.max(12,s-25);if(mode==='vibrant')s=Math.min(100,s+22);return hslToHex(h,s,l)});$('#paletteOutput').outerHTML=paletteMarkup();bindPaletteClicks();sound(640,.08,'triangle')}));
      $('#copyPalette').addEventListener('click',()=>{const css=currentPalette.map((c,i)=>`--color-${i+1}: ${c};`).join('\n');navigator.clipboard?.writeText(':root {\\n'+css+'\\n}').then(()=>toast('CSS variables copied')).catch(()=>toast('Clipboard tidak tersedia'))});
      bindPaletteClicks();
    }
    if(which==='composition'){
      const art=$('#artboard');$('#guideSelect').addEventListener('change',e=>{activeGuide=e.target.value;renderGuide()});
      $('#orientation').addEventListener('change',e=>{artboardLandscape=e.target.value==='landscape';art.classList.toggle('landscape',artboardLandscape)});
      $('#guideOpacity').addEventListener('input',e=>{$$('.guide-third,.guide-golden,.guide-safe',art).forEach(el=>el.style.opacity=e.target.value/100)});
      $('#resetComposition').addEventListener('click',()=>{$('#guideSelect').value='thirds';$('#orientation').value='portrait';$('#guideOpacity').value=85;artboardLandscape=false;art.classList.remove('landscape');renderGuide();toast('Composition reset')});
      renderGuide();
    }
    if(which==='dimensions'){
      const update=()=>{const w=+$('#width').value||1,h=+$('#height').value||1;$('#ratioText').textContent=(w/h).toFixed(3)+ ' : 1';const scale=Math.min(300/w,140/h,1);$('#dimensionRect').style.width=Math.max(28,w*scale)+'px';$('#dimensionRect').style.height=Math.max(24,h*scale)+'px';$('#dimensionRect').textContent=w+' × '+h};
      $('#preset').addEventListener('change',()=>{const [w,h]=$('#preset').value.split('x');$('#width').value=w;$('#height').value=h;update()});$('#width').addEventListener('input',update);$('#height').addEventListener('input',update);update();
    }
    if(which==='direction'){
      $('#saveDirection').addEventListener('click',saveDirection);$('#exportDirection').addEventListener('click',exportDirection);loadDirection();
    }
  }
  function renderGuide(){const art=$('#artboard');art.innerHTML='';if(activeGuide==='thirds'||activeGuide==='all'){const e=document.createElement('div');e.className='guide-third';art.append(e)}if(activeGuide==='golden'||activeGuide==='all'){const e=document.createElement('div');e.className='guide-golden';art.append(e)}if(activeGuide==='safe'||activeGuide==='all'){const e=document.createElement('div');e.className='guide-safe';art.append(e)}}
  function compositionMarkup(){return `<div class="tool-layout"><div><div class="control-group"><label>Artboard format</label><select id="orientation"><option value="portrait">Portrait · 4:5</option><option value="landscape">Landscape · 16:9</option></select></div><div class="control-group"><label>Composition guide</label><select id="guideSelect"><option value="thirds">Rule of Thirds</option><option value="golden">Golden Ratio</option><option value="safe">Safe Area</option><option value="all">Layered · All guides</option><option value="none">No guide</option></select></div><div class="control-group"><label>Guide opacity</label><input type="range" id="guideOpacity" min="10" max="100" value="85"></div><button class="small-button" id="resetComposition">Reset setup</button><p class="help-copy">Preview-only artboard. Guides help compare structure; there are no drawing or image-editing tools.</p></div><div class="artboard-stage"><div class="artboard" id="artboard"></div></div></div>`}
  function dimensionsMarkup(){return `<div class="tool-layout"><div><div class="control-group"><label>Preset</label><select id="preset"><option value="1080x1350">Social portrait · 1080 × 1350</option><option value="1080x1920">Story / Reel · 1080 × 1920</option><option value="1920x1080">Landscape · 1920 × 1080</option><option value="1080x1080">Square · 1080 × 1080</option><option value="2480x3508">A4 · 300 DPI · 2480 × 3508</option><option value="custom">Custom (keep values)</option></select></div><div class="control-group"><label>Width (px)</label><input type="number" min="1" max="10000" id="width" value="1080"></div><div class="control-group"><label>Height (px)</label><input type="number" min="1" max="10000" id="height" value="1350"></div><div class="result-box"><div class="subheading">Aspect ratio</div><div id="ratioText">0.800 : 1</div><p class="help-copy">Print output depends on the actual printer's bleed and DPI requirements. Confirm those specs before production.</p></div></div><div><h3 class="subheading">Proportion preview</h3><div class="dimension-preview"><div class="dimension-rect" id="dimensionRect">1080 × 1350</div></div><p class="help-copy">Change width or height to see the format update. Presets are practical starting points, not permanent platform guarantees.</p></div></div>`}
  function directionMarkup(){return `<div class="tool-layout"><div><div class="control-group"><label>Project title</label><input id="projectName" placeholder="e.g. Midnight Signal"></div><div class="control-group"><label>Mood / visual direction</label><input id="projectMood" placeholder="e.g. Focused, atmospheric, bold"></div><div class="control-group"><label>Color palette (HEX, comma separated)</label><input id="projectColors" value="${currentPalette.join(', ')}"></div><div class="control-group"><label>Dimensions</label><input id="projectDimensions" value="1080 × 1350 px"></div><div class="control-group"><label>Composition notes</label><textarea id="projectNotes" rows="3" placeholder="Describe guides, hierarchy, references..."></textarea></div><button class="button button-primary" id="saveDirection">Save locally ↗</button></div><div><div class="result-box"><h3 class="subheading">Your visual blueprint</h3><p class="help-copy">Your choices, gathered into one portable direction. Saved only in this browser using localStorage.</p><div id="directionPreview" class="help-copy">Add a project title to begin building your direction.</div><button class="small-button" id="exportDirection">Export JSON</button></div></div></div>`}
  function getDirection(){return {product:'LISTO.',title:$('#projectName').value,mood:$('#projectMood').value,palette:$('#projectColors').value.split(',').map(x=>x.trim()).filter(Boolean),dimensions:$('#projectDimensions').value,compositionNotes:$('#projectNotes').value,updatedAt:new Date().toISOString()}}
  function saveDirection(){const data=getDirection();localStorage.setItem('listo-direction',JSON.stringify(data));$('#directionPreview').textContent=data.title||'Untitled direction';toast('Direction saved on this device');sound(820,.12,'sine')}
  function loadDirection(){try{const d=JSON.parse(localStorage.getItem('listo-direction')||'null');if(!d)return;$('#projectName').value=d.title||'';$('#projectMood').value=d.mood||'';$('#projectColors').value=(d.palette||currentPalette).join(', ');$('#projectDimensions').value=d.dimensions||'';$('#projectNotes').value=d.compositionNotes||'';$('#directionPreview').textContent=d.title||'Saved direction'}catch(e){}}
  function exportDirection(){const data=getDirection();download('listo-visual-direction.json',JSON.stringify(data,null,2),'application/json');toast('JSON blueprint exported')}
  function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
})();