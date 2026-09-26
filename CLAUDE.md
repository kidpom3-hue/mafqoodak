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
- `js/workflow.js` — **every item/claim status transition** (`approveClaim`, `rejectClaim`, `verifyHandover`, `releaseReservation`, `setItemStatus`, `disposeItems`, `deleteItem`). Each one is a single `writeBatch` + a `logs` entry; guard failures throw `FlowError` with an Arabic `msg` that `write()` toasts. Never change item/claim status anywhere else. Exception: creating a new item stays sequential (items first, then itemSecrets/photos) because those rules use `get()`, which does not see writes in the same batch.
- `js/migrate.js` — one-time move of legacy item fields into `itemSecrets` when the staff dashboard opens.
- `js/actions.js` — `ACT` click handlers (`data-act="name"`) and `submitForm` (forms use `data-form="kind"`).
- `js/constants.js` — categories (`CATS`), colors, office types, statuses, SVG icon paths.
- `js/utils.js` — dates, Arabic text normalisation/search, `matchScore` heuristic, SHA-256, image compression, `toast`. **Arabic counts:** always `plural(n, W.x)` (Intl.PluralRules('ar'); `W.item` nominative, `W.itemAcc` accusative, `W.itemGen` genitive…), never `${n} غرضاً`.
- `tools/` — developer-only checks (not loaded by the app): `tools/rules.test.mjs` runs the rules on the Firestore emulator (`cd tools && npm install && npm run test:rules`, needs Java).
- `docs/AUDIT.md` — audit findings and fixes.
- `firestore.rules` — server-side security. **Any data-model change must be reflected here** and the user must re-publish rules in the Firebase console. Any new field in `reports`, `claims`, `users` or `staffRequests` must be added to that collection's `keys().hasOnly([...])` list in the rules, otherwise the write is rejected.

## Data model (Firestore)
`config/app` {ownerUid} · `admins/{uid}` · `staff/{uid}` {offices[]} · `staffRequests/{uid}` · `users/{uid}` {name,email,photo} + `users/{uid}/private/codes` {codes: {claimId: code}} · `offices/{id}` · `reports/{id}` · `reportPhotos/{reportId}`.

Items are split so the public listing never reveals what proves ownership:
- `items/{id}` — **public**: officeId, ref, cat, sub, title, spot, foundDate, photo, status, createdBy, createdAt, updatedAt, sample (+ optional fromReport, reservedFor, returnedAt). `title` is generic (`publicTitle(cat, sub)` = sub or category name). `photo` is `'clear'` | `'blur'` | `'none'` (hidden publicly, original kept for staff) | `false`. Rules reject any of color/brand/desc/bldg/room/storage here. Legacy value `true` = old clear public photo, converted by `js/migrate.js`.
- `itemSecrets/{id}` — **staff only**: {officeId, title (detailed), color, brand, desc, bldg, room, storage}. Staff views use `full(item)` from `state.js` (public + secret, `S.secrets` is subscribed only for staff).
- `itemPhotosPrivate/{id}` — **staff only**: {officeId, data} = clear original (photo key `p_<id>`).
- `itemPhotos/{id}` — public {data}: the same image for `'clear'`, a real 24px downscale from `makeBlur()` for `'blur'`, no doc for `'none'`/`false`.
- `claims/{itemId}_{uid}` — fixed id = one claim per user per item; {itemId, officeId, uid, proof, color, brand, lostSpot, bldg, room, lostDate, reportId?, status, codeHash = sha256(claimId + ':' + code), createdAt, pickupBy (ms, set on approve = now + office.pickupDays), note}. Status: `pending` → `approved` → `done`, or `rejected` / `expired` (pickup missed or item made available again) / `cancelled` (item handed over directly, archived, disposed or deleted). Staff see a comparison against `itemSecrets`. A reserved item still accepts competing claims. Staff can never decide their own claim (UI + rules). Claims and reports need a verified email (`request.auth.token.email_verified`).
- Item status: `available`, `reserved` (only via approve, `reservedFor` = claim id), `returned`, `archived`, `disposed` (+ public `disposal`: donated|destroyed|authority|other, `disposedAt`; private `itemSecrets.disposalNote`). Direct handover stores `itemSecrets.handoverNote`. `offices/{id}.pickupDays` (default 7), `retentionDays` (default 90).
- `logs/{id}` — append-only chain of custody {officeId, itemId, claimId, reportId, action, by, at, note}, written by `workflow.js`.
- `foundReports/{id}` — rules exist for part C (finder notifications); not used by the app yet.
- **Subscriptions (read quota):** visitors get `items` with `status in [available, reserved]` only; returned count via `dbx.count` (getCountFromServer). `S.myReports`/`S.myClaims` = the user's own, by `uid`, across all offices. Staff: open reports, `pending`/`approved` claims live, a per-item `itemSecrets` listener for loaded items only; returned/archived/disposed items (`loadExtraItems`) and claim history (`loadClaimHistory`) on demand. Owner: no all-items subscription, `loadAdminCounts`. Items not loaded (other office, returned) come from `ensureItem(id)`. Queries use equality/`in` only, so no composite indexes.
- Write order: create `items` first, then `itemSecrets` / `itemPhotosPrivate` / `itemPhotos`; delete those three first, then `items`. Rules that check `resource.data` reject deleting a doc that does not exist, so delete only the parts that exist (or ignore that error).
Timestamps are client `Date.now()` numbers; dates are `YYYY-MM-DD` strings. Queries use only equality filters (no composite indexes needed); sort client-side.

## Conventions
- UI is Arabic, RTL. Use logical CSS properties (`inset-inline-start`, `padding-inline`). Colors only via CSS tokens in `:root` (light) and the two dark-mode blocks.
- Back button: `go()` and `openSheet()` call `history.pushState({mf: 1[, sheet: 1]})`; a `popstate` listener in `ui.js` closes an open sheet or steps back through `S.hist`. `back()` and `closeSheet()` go through `history.back()` so browser history and `S.hist` stay in sync. Never call `pushState` from inside the `popstate` listener.
- Images: only `data:image/...` values (item/report photos) and `https://*.googleusercontent.com/` avatars may be put into `img.src` (see `safeData`/`safeAvatar` in `ui.js`). Item photos load lazily via `IntersectionObserver` in `hydrate()`.
- Routes with `live: true` re-render on data changes; forms are `live: false` so typing is never lost. Views with inputs that must keep focus use an `update()` partial renderer (see `updateBrowse`, `updateStaff`).
- Write order matters for rules: create the parent doc (item/report) before its photo doc; delete the photo before the parent.
- Sensitive category (`ids`) never stores photos.
- Visitors never see match percentages: `maybeFor(r)` (same category, same type if given, found −1…+30 days from loss). Percentages (`candidatesFor(r, n, full)`) are for staff only.
- Renamed type names keep old stored values working via `LEGACY_SUBS` / `subName()` in `constants.js` (display, search, matching).
- Test locally with `python -m http.server 8000` → `http://localhost:8000`.
