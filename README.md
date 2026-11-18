# LISTO. — Create Your Visual Direction

A static, dependency-free visual exploration toolkit: color palettes, composition
structure, and curated visual references. No build step, no backend, no tracking —
everything runs and persists locally in the browser.

## Structure

```
index.html        Single shell + hash-routed views (#home, #colors, #studio, #references, #direction)
styles.css        Design system: tokens, glass surfaces, homepage, view framework
workspace.css     Color Explorer + Visual References layouts
studio.css        Composition Studio (single resizable artboard, infinite canvas, panels)
js/core.js        Shared foundation: storage, Web Audio SFX engine, router,
                  color math, IndexedDB helper, project history
js/home.js        Homepage: interactive hero wheel, reveals, palettes, moods, recents
js/explorer.js    Color Explorer: wheel, harmonies, dynamic glass environment,
                  mixer, gradient studio, contrast checker, exports
js/studio.js      Composition Studio: infinite pan/zoom canvas, single artboard,
                  realtime dimensions, composition library, guides, exports
js/references.js  Visual References: 54 original local studies across 15 categories, search, favorites,
                  local image import with palette extraction
js/direction.js   Guided workflow, shared project review, local PNG/JPG export, PDF print view
js/ux.js          First-run guide and contextual beginner help
ux.css            Quick Guide and contextual help styling
direction.css     Guided Direction and Export Studio styling
```

## Features

- **Color Explorer** — HSV wheel, HEX/RGB/HSL/native inputs, 7 harmonies, 8
  variations, 8 moods, 6 live previews, dynamic glass background reacting to the
  core color, mixer, gradient studio, WCAG contrast checker, locks, history,
  saved palettes, and JSON/CSS/PNG exports.
- **Composition Studio** — infinite pan/zoom canvas with one freely resizable artboard,
  realtime dimension editing (px/mm/cm/in, DPI, bleed, margin, safe area),
  49 composition guide presets across 9 categories, guide controls
  (visibility/color/opacity/thickness/params/rotation/lock/reorder),
  reference-image overlays, smart snap, minimap, focus mode, and
  workspace JSON / SVG / PNG exports.
- **Visual References** — 54 original, locally generated sample studies (no fabricated
  community content), search and category filters, favorites, detail drawer with
  copyable palettes, and local image import (IndexedDB) with palette extraction.
- **Sound** — synthesized Web Audio SFX with a global toggle + volume, persisted,
  anti-overlap capped, and fully failure-tolerant.

## Persistence (localStorage / IndexedDB)

`listo-theme`, `listo-sound`, `listo-volume`, `listo-hero-color`,
`listo-explorer`, `listo-palettes`, `listo-studio`, `listo-refs`,
`listo-refs-imports`, `listo-projects`, `listo-direction` (legacy blueprint),
plus reference image blobs in IndexedDB (`listo-files`).

## Deploy

Static hosting (e.g. Vercel): upload the folder as-is. No environment variables,
no build command, no server code.

## Accessibility & motion

Keyboard support on wheels, canvas, sliders and menus; visible focus states;
`prefers-reduced-motion` disables ambient animation and reveals.


## Beginner-friendly UX update

- A first-visit, five-step Quick Guide introduces the main LISTO workflow.
- The guide can be skipped and reopened from the floating **Quick guide** control.
- Short contextual help is available beside selected color, dimension, reference,
  and export controls.
- The existing Liquid Glass / Aurora styling is preserved; this update adds
  guidance without replacing the current visual system.
- Guide completion is stored locally using `listo-ux-guide-complete`.

## Source audit and repair

The supplied archive referenced `js/direction.js` but did not include it. This project now includes that module, with its workflow connected to the shared project state. Direct hash loading is also handled by the router so a view module can initialize even when its route is opened directly.

## Guided Direction module

The Guided Direction workflow is implemented in `js/direction.js` and styled by `direction.css`. Keep both files alongside the existing project structure. The workflow uses the shared local `Project` state from `js/core.js`.

PDF export opens a browser print view; choose **Save as PDF** in the print destination. PNG and JPG are downloaded directly by the browser. No project data is uploaded to a server.

## Composition Studio behavior

Composition Studio now starts with one freely resizable artboard. Existing multi-artboard local workspaces are migrated to the first artboard; the previous workspace is backed up in local storage under `listo-studio-legacy-backup`. The canvas remains pannable and zoomable, and composition guides remain editable.
