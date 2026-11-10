# LISTO. — Static HTML Edition

LISTO is a visual exploration toolkit, not a design editor.

## Run locally
Open `index.html` in a modern browser. For a local server, use VS Code Live Server or:
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000`.

## Deploy to Vercel
1. Upload this folder to a GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Framework Preset: **Other**.
4. Build Command: leave empty.
5. Output Directory: `.` (or leave the static default if Vercel detects it).
6. Deploy.

No database, backend, login, or build step is required. `index.html` is the entry point.

## Included
- Aurora-inspired cinematic landing page and Abstract Flow mark
- Persistent floating pill navigation
- Crystal Liquid Glass surfaces and fluid responsive layout
- Dynamic ambient motion with reduced-motion support
- Optional interaction sound effects (starts muted; browser audio starts only after user interaction)
- Dark/light theme toggle
- Color Explorer: HEX/color input, deterministic harmony palettes, palette variations, CSS copy
- Composition Playground: portrait/landscape artboard and layered guides
- Dimensions Explorer: common presets, custom dimensions and ratio preview
- Direction Studio: local save using browser localStorage and JSON export

## Notes
- Google Fonts are loaded remotely. System fallbacks remain available if offline.
- Local saves stay in the current browser/device. There is no cloud sync or community service in this static edition.
- The current UI is a functional first prototype. Some advanced brainstormed capabilities (multi-artboard free positioning, reference image overlay, full PDF/PNG/SVG exports, community, creator profiles, comments, cloud sync) are not implemented in this no-database version.
