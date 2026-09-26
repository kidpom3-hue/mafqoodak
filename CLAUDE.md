# CLAUDE.md — مفقودك (Mafqoodak)

Lost-and-found PWA. First deployment: Technical College Al-Ahsa (office id `tc-ahsa`, ref code `TCA`). The owner is a beginner developer who reads Arabic; keep explanations in Arabic and changes small and well-commented.

## Stack
- Plain HTML/CSS/ES modules, **no build step**. Firebase JS SDK loaded from gstatic CDN, version pinned to `12.19.0` in `js/firebase.js` and `js/ai.js` (change all together).
- Firebase Auth (Google + Email/Password), Cloud Firestore, optional Firebase AI Logic (Gemini) behind `SETTINGS.enableAI`.
- Hosted on GitHub Pages (relative paths only — the app lives under `/mafqoodak/`). `firebase.json` also allows Firebase Hosting.
- Must stay on the free Spark plan: no Cloud Storage (photos are compressed JPEG data URLs in Firestore docs, < 350 KB), no Cloud Functions, no phone SMS auth.

## Layout
- `js/config.js` — Firebase config + app settings (the only file a new deployer edits).
- `js/firebase.js` — init + `dbx` helper (string paths: `dbx.set('items/abc', data)`, `dbx.watch(col, [[field, op, value]], cb)`).
- `js/state.js` — global state `S`, auth listener, Firestore subscriptions, role helpers (`isStaffHere`, `modes`), photo/name caches, `write()` wrapper with Arabic error toasts.
- `js/ui.js` — router (`ROUTES`, `go`, `back`), header/nav/sheet rendering, `hydrate()` (lazy photos `img[data-photo]` and names `[data-uname]`).
- `js/views/*.js` — pure functions returning HTML strings (`home.js` = landing page for the chosen office + «وجدت غرضاً» guide; visitor default route is `home`; `privacy.js` = privacy policy & terms, route `privacy`). Item share links use `#item/<officeId>/<itemId>` (parsed in `state.js`). **Always escape user data with `esc()`.**
- `js/actions.js` — `ACT` click handlers (`data-act="name"`) and `submitForm` (forms use `data-form="kind"`).
- `js/constants.js` — categories (`CATS`), colors, office types, statuses, SVG icon paths.
- `js/utils.js` — dates, Arabic text normalisation/search, `matchScore` heuristic, SHA-256, image compression, `toast`.
- `firestore.rules` — server-side security. **Any data-model change must be reflected here** and the user must re-publish rules in the Firebase console. Any new field in `reports`, `claims`, `users` or `staffRequests` must be added to that collection's `keys().hasOnly([...])` list in the rules, otherwise the write is rejected.

## Data model (Firestore)
`config/app` {ownerUid} · `admins/{uid}` · `staff/{uid}` {offices[]} · `staffRequests/{uid}` · `users/{uid}` {name,email,photo} + `users/{uid}/private/codes` {codes: {claimId: code}} · `offices/{id}` · `items/{id}` · `itemPhotos/{itemId}` {data} · `reports/{id}` · `reportPhotos/{reportId}` · `claims/{id}` {codeHash = sha256(claimId + ':' + code)}.
Timestamps are client `Date.now()` numbers; dates are `YYYY-MM-DD` strings. Queries use only equality filters (no composite indexes needed); sort client-side.

## Conventions
- UI is Arabic, RTL. Use logical CSS properties (`inset-inline-start`, `padding-inline`). Colors only via CSS tokens in `:root` (light) and the two dark-mode blocks.
- Back button: `go()` and `openSheet()` call `history.pushState({mf: 1[, sheet: 1]})`; a `popstate` listener in `ui.js` closes an open sheet or steps back through `S.hist`. `back()` and `closeSheet()` go through `history.back()` so browser history and `S.hist` stay in sync. Never call `pushState` from inside the `popstate` listener.
- Images: only `data:image/...` values (item/report photos) and `https://*.googleusercontent.com/` avatars may be put into `img.src` (see `safeData`/`safeAvatar` in `ui.js`). Item photos load lazily via `IntersectionObserver` in `hydrate()`.
- Routes with `live: true` re-render on data changes; forms are `live: false` so typing is never lost. Views with inputs that must keep focus use an `update()` partial renderer (see `updateBrowse`, `updateStaff`).
- Write order matters for rules: create the parent doc (item/report) before its photo doc; delete the photo before the parent.
- Sensitive category (`ids`) never stores photos.
- Test locally with `python -m http.server 8000` → `http://localhost:8000`.
