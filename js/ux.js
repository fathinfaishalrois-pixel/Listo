/* LISTO. — Beginner-friendly UX layer
   Adds optional onboarding and concise contextual help without replacing the
   existing Liquid Glass / Aurora interface or changing tool behavior. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const store = window.LISTO && window.LISTO.store;
  if (!store) return;

  const steps = [
    {
      eyebrow: '01 / START WITH A FEELING',
      title: 'Choose your color direction',
      body: 'Start with one color or choose a mood. LISTO suggests a palette, and you can still edit every color yourself.',
      action: 'Open Color Explorer',
      route: 'colors'
    },
    {
      eyebrow: '02 / SET THE FORMAT',
      title: 'Atur ukuran dan komposisi',
      body: 'Set the width and height of your artboard, then choose a guide such as Rule of Thirds or Golden Ratio. The preview adjusts as you resize it.',
      action: 'Open Composition Studio',
      route: 'studio'
    },
    {
      eyebrow: '03 / FIND INSPIRATION',
      title: 'Jelajahi referensi visual',
      body: 'Browse by category, search for ideas, save favorites, or import your own images for inspiration.',
      action: 'Browse References',
      route: 'references'
    },
    {
      eyebrow: '04 / BRING IT TOGETHER',
      title: 'Tinjau visual direction',
      body: 'Your colors, mood, dimensions, and composition come together in one visual direction. You can return to an earlier step at any time.',
      action: 'Review Direction',
      route: 'direction'
    },
    {
      eyebrow: '05 / TAKE IT WITH YOU',
      title: 'Ekspor hasil eksplorasi',
      body: 'Choose PDF for a complete blueprint, PNG for a high-quality image, or JPG for a lighter preview. Files are generated directly in your browser.',
      action: 'Open Export Studio',
      route: 'direction'
    }
  ];

  const tips = {
    cxWheel: 'Drag the selector on the wheel to choose a color. Colors become more saturated toward the outer edge and softer toward the center.',
    cxValue: 'Adjust how light or dark your selected color appears.',
    cxHex: 'Enter a color code such as #7357E8. The preview and other color values update with it.',
    harmonySel: 'Choose how colors relate to each other. You can still edit each suggested color manually.',
    abW: 'Set the artboard width in the selected unit. You can also resize the artboard directly.',
    abH: 'Set the artboard height. Composition guides adjust to the new size.',
    abRatioLock: 'Keep the same width-to-height proportion when resizing.',
    abDpi: 'Print resolution. For screen designs, pixel dimensions usually matter more.',
    abBleed: 'Extra space beyond the design edge to allow for trimming when printed.',
    abMargin: 'Keep important content away from the edge of the artboard.',
    refSearch: 'Search references by title, category, or keyword.',
    refImportBtn: 'Add an image from your device. It stays on your device and is processed in your browser.',
    dpW: 'Set the blueprint width. The dimension preview updates with this value.',
    dpHeight: 'Set the blueprint height. The dimension preview updates with this value.',
    dpDpi: 'Print resolution. Choose a value that suits your intended output.',
    dxPaper: 'Choose the page size for your PDF.',
    dxOrientation: 'Choose portrait or landscape page orientation for your PDF.',
    dxResolution: 'Higher resolution creates a larger export file.',
    dxQuality: 'Higher JPG quality usually creates a larger file.'
  };

  let index = 0;
  let dialog;
  let lastFocus = null;

  function buildDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('div');
    dialog.className = 'ux-guide-backdrop';
    dialog.id = 'uxGuideDialog';
    dialog.hidden = true;
    dialog.innerHTML = `
      <section class="ux-guide-card glass glass-liquid" role="dialog" aria-modal="true" aria-labelledby="uxGuideTitle" aria-describedby="uxGuideBody">
        <div class="ux-guide-top">
          <span class="ux-guide-brand"><span class="ux-guide-mark">L.</span> LISTO. QUICK GUIDE</span>
          <button class="ux-guide-close" type="button" data-ux-close aria-label="Close guide">×</button>
        </div>
        <div class="ux-guide-progress" aria-label="Guide progress"><i id="uxGuideProgress"></i></div>
        <div class="ux-guide-content">
          <span class="ux-guide-eyebrow" id="uxGuideEyebrow"></span>
          <h2 id="uxGuideTitle"></h2>
          <p id="uxGuideBody"></p>
          <div class="ux-guide-stepdots" id="uxGuideDots" aria-hidden="true"></div>
        </div>
        <div class="ux-guide-footer">
          <button class="ux-guide-textbtn" type="button" data-ux-skip>Skip guide</button>
          <div class="ux-guide-actions">
            <button class="ux-guide-back" type="button" data-ux-prev>Back</button>
            <button class="ux-guide-next" type="button" data-ux-next>Next <span aria-hidden="true">→</span></button>
          </div>
        </div>
      </section>`;
    document.body.append(dialog);
    dialog.addEventListener('click', e => {
      if (e.target === dialog || e.target.closest('[data-ux-close]') || e.target.closest('[data-ux-skip]')) closeGuide(true);
      if (e.target.closest('[data-ux-prev]')) renderStep(index - 1);
      if (e.target.closest('[data-ux-next]')) {
        if (index === steps.length - 1) {
          const route = steps[index].route;
          closeGuide(true);
          window.LISTO.Router.go(route);
        } else renderStep(index + 1);
      }
    });
    document.addEventListener('keydown', e => {
      if (dialog.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); closeGuide(false); }
      if (e.key === 'ArrowRight') renderStep(index + 1);
      if (e.key === 'ArrowLeft') renderStep(index - 1);
      if (e.key === 'Tab') {
        const focusables = [...dialog.querySelectorAll('button:not([disabled])')];
        if (!focusables.length) return;
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    return dialog;
  }

  function renderStep(next) {
    index = Math.max(0, Math.min(steps.length - 1, next));
    const step = steps[index];
    $('#uxGuideEyebrow', dialog).textContent = step.eyebrow;
    $('#uxGuideTitle', dialog).textContent = step.title;
    $('#uxGuideBody', dialog).textContent = step.body;
    $('#uxGuideProgress', dialog).style.width = `${((index + 1) / steps.length) * 100}%`;
    $('#uxGuideDots', dialog).innerHTML = steps.map((_, i) => `<i class="${i === index ? 'active' : ''}"></i>`).join('');
    $('[data-ux-prev]', dialog).disabled = index === 0;
    $('[data-ux-next]', dialog).innerHTML = index === steps.length - 1 ? `${step.action} <span aria-hidden="true">↗</span>` : 'Next <span aria-hidden="true">→</span>';
    $('[data-ux-skip]', dialog).textContent = index === steps.length - 1 ? 'Close guide' : 'Skip guide';
  }

  function openGuide() {
    buildDialog();
    lastFocus = document.activeElement;
    renderStep(0);
    dialog.hidden = false;
    document.body.classList.add('ux-guide-open');
    $('[data-ux-close]', dialog).focus();
  }

  function closeGuide(completed) {
    if (!dialog || dialog.hidden) return;
    dialog.hidden = true;
    document.body.classList.remove('ux-guide-open');
    if (completed) store.set('listo-ux-guide-complete', '1');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function addContextTips() {
    Object.entries(tips).forEach(([id, message]) => {
      const control = document.getElementById(id);
      if (!control || control.dataset.uxTipAdded) return;
      const label = document.querySelector(`label[for="${id}"]`);
      if (!label) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ux-info';
      button.textContent = '?';
      button.setAttribute('aria-label', `Help: ${label.textContent.trim()}`);
      button.setAttribute('aria-expanded', 'false');
      button.title = message;
      const tip = document.createElement('span');
      tip.className = 'ux-info-pop';
      tip.textContent = message;
      tip.hidden = true;
      button.addEventListener('click', () => {
        const willOpen = tip.hidden;
        document.querySelectorAll('.ux-info-pop').forEach(el => { el.hidden = true; });
        document.querySelectorAll('.ux-info[aria-expanded="true"]').forEach(el => el.setAttribute('aria-expanded', 'false'));
        tip.hidden = !willOpen;
        button.setAttribute('aria-expanded', String(willOpen));
      });
      label.append(button, tip);
      control.dataset.uxTipAdded = '1';
    });
  }

  function bind() {
    const trigger = $('#uxGuideTrigger');
    trigger && trigger.addEventListener('click', openGuide);
    document.addEventListener('listo:view', () => setTimeout(addContextTips, 80));
    // This script is loaded after the core boot event, so initialize directly.
    addContextTips();
    if (store.get('listo-ux-guide-complete', '0') !== '1') {
      window.setTimeout(openGuide, 900);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();