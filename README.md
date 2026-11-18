# LISTO. — Create Your Visual Direction

A static, dependency-free visual exploration toolkit: color palettes, composition
structure, and curated visual references. No build step, no backend, no tracking —
everything runs and persists locally in the browser.

## Structure

```
index.html        Single shell + hash-routed views (#home, #colors, #studio, #references)
styles.css        Design system: tokens, glass surfaces, homepage, view framework
workspace.css     Color Explorer + Visual References layouts
studio.css        Composition Studio (infinite canvas, artboards, panels)
js/core.js        Shared foundation: storage, Web Audio SFX engine, router,
                  color math, IndexedDB helper, project history
js/home.js        Homepage: interactive hero wheel, reveals, palettes, moods, recents
js/explorer.js    Color Explorer: wheel, harmonies, dynamic glass environment,
                  mixer, gradient studio, contrast checker, exports
js/studio.js      Composition Studio: infinite pan/zoom canvas, artboards,
                  realtime dimensions, composition library, guides, exports
js/references.js  Visual References: curated local studies, search, favorites,
                  local image import with palette extraction
```

## Features

- **Color Explorer** — HSV wheel, HEX/RGB/HSL/native inputs, 7 harmonies, 8
  variations, 8 moods, 6 live previews, dynamic glass background reacting to the
  core color, mixer, gradient studio, WCAG contrast checker, locks, history,
  saved palettes, and JSON/CSS/PNG exports.
- **Composition Studio** — infinite pan/zoom canvas with multiple artboards,
  realtime dimension editing (px/mm/cm/in, DPI, bleed, margin, safe area),
  49 composition guide presets across 9 categories, guide controls
  (visibility/color/opacity/thickness/params/rotation/lock/reorder),
  reference-image overlays, snap, minimap, focus/compare, and
  workspace JSON / SVG / PNG exports.
- **Visual References** — curated, locally drawn sample studies (no fabricated
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
