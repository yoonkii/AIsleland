# AIsleland — Handoff Document

_Last updated: 2026-07-09 · Branch: `claude/workspace-game-3d-revamp-i7e3zz`_

AIsleland is a cozy 3D healing game: completing real Google Workspace tasks
(Gmail, Docs, Sheets, Slides, Calendar) grows a floating voxel island. This
document is everything a new developer (or agent) needs to take over.

---

## 1. Current state — what works today

- **Full 3D revamp shipped.** The legacy PixiJS 2D view is gone. The game is a
  React 19 + @react-three/fiber v9 scene: a MagicaVoxel-style terraced island
  with a creek that spills over two waterfalls, plush Pokémon-cozy trees,
  procedural buildings, wandering critters, real-time day/night, celebration
  choreography, photo mode with postcard export, and a full Web Audio
  soundscape. **Zero external assets** — every mesh, texture and sound is
  procedural (ElevenLabs files optionally override the synth).
- **Two play modes:**
  - **Demo** (default, no config): mock quests trickle in, everything persists
    to `localStorage` (`aisleland-demo-v2`), a full day/night cycle loops every
    6 minutes. This is the instant-play viral entry point.
  - **Firebase**: Google sign-in → Cloud Functions watch Gmail/Drive/Calendar
    and write quests to Firestore; completing a quest calls the `completeQuest`
    callable which awards XP and plants a reward.
- **Verified**: `tsc` clean, `eslint` clean, `vite build` clean, demo flow
  smoke-tested end-to-end in headless Chromium, visuals screenshot-reviewed at
  morning/golden/night across ~8 polish iterations, plus an adversarial
  multi-agent code review whose confirmed findings were all fixed.

## 2. Run / build / deploy

```bash
# Node 20.19+ or 22.12+ (.nvmrc pins 22)
npm install
npm run dev        # http://localhost:5173 → "Try the demo island"
npm run build      # tsc -b && vite build
npm run preview    # serve the production build on :4173
npm run lint
npm run sfx        # generate ElevenLabs SFX into public/audio/ (needs ELEVENLABS_API_KEY)
```

- **Env** (`.env`, see `.env.example`): `VITE_FIREBASE_*` for real mode;
  everything runs without it (demo only). `ELEVENLABS_API_KEY` is only read by
  `scripts/generate-sfx.mjs` at build-tool time, never shipped to the client.
- **Firebase mode setup**: create a Firebase project (Google auth + Firestore),
  fill `.env`, deploy `firestore.rules` + `firestore.indexes.json`, then deploy
  `functions/` (Gmail watch needs a GCP Pub/Sub topic — see
  `functions/src/setup-gmail-watch.ts`).
- There is **no hosting/CI config** in the repo yet. `vite build` outputs
  `dist/`; any static host works (Firebase Hosting is the natural choice).

## 3. Architecture

```
src/
  main.tsx, App.tsx        session bootstrap: login → adapter → game shell
  state/
    gameStore.ts           zustand store — THE hub (session, island, quests,
                           celebration queue, UI flags, camera focus requests)
    types.ts               shared types + LEVEL_THRESHOLDS/LEVEL_UNLOCKS tables
  data/
    demoAdapter.ts         localStorage-backed fake backend (quests, XP, rewards)
    firebaseAdapter.ts     Firestore subscriptions → store; completeQuest callable
  firebase/                auth (Google OAuth + GWS scopes), config, firestore IO
  design/tokens.ts         every color/timing/camera constant (single source)
  three/
    IslandScene.tsx        <Canvas> composition + ClockSync + postcard snapshot
    coords.ts              ★ world contract: 8×7 grid, VOXEL size, terrainHeight,
                           island boundary, waterfall channels
    materials.ts           ★ "meringue" toon material factory (3-band ramp +
                           fresnel rim + curved-world bend) + global uniforms
    islandMotion.ts        deterministic island bob/roll (shared, uncoupled)
    world/                 voxelIsland (terrain mesher), Sky, SkySea, Waterfalls,
                           Clouds, Lights (keyframed rig), Fireflies, GrassTufts,
                           RuneRing (diegetic XP), skyColors (OKLab tracks)
    props/                 recipes.ts (all 20 prop types as merged vertex-colored
                           geometry), Props/Prop (pop-in, hover, arrange mode)
    critters/Critters.tsx  7 species, per-critter FSM (idle/wander/sit/groom/
                           sleep/jump), heart emotes
    fx/                    CelebrationDirector (Bloom Burst + level-up quake,
                           pooled particles) + AmbientFX, PostFX (composer)
    camera/CameraRig.tsx   OrbitControls + idle drift + focus flights + photo orbits
  ui/                      DOM overlay: HUD, QuestJournal, CelebrationOverlay,
                           PhotoModeBar, LoginScreen, ToastHost + ui.css
  audio/SoundManager.ts    dual-source SFX (files → synth fallback), ambience,
                           generative pentatonic music, celebration ducking
functions/src/             Cloud Functions (pre-existing): quest generation from
                           Gmail/Drive/Calendar webhooks, completeQuest callable,
                           island-manager (XP/level/asset placement)
scripts/generate-sfx.mjs   ElevenLabs sound-generation batch script
docs/GAME_DESIGN.md        full design doc (§13 = v1 scope cuts)
docs/VISUAL_PLAYBOOK.md    researched visual techniques + global grade settings
```

### Data flow

```
Cloud Functions ──writes──▶ Firestore ──onSnapshot──▶ firebaseAdapter ─┐
                                                                        ├──▶ gameStore ──▶ three/* + ui/*
localStorage ◀──persist── demoAdapter ◀──completeQuest()── QuestJournal ┘
                                │
                                └──enqueueCelebration()──▶ CelebrationDirector
                                                           (camera + FX + SFX,
                                                            then endCelebration)
```

- **Celebrations** are a queue on the store. Adapters enqueue; the
  `CelebrationDirector` (r3f) pops one at a time, runs the timeline
  (~3.2 s quest / ~4.5 s level-up), fires `requestFocus` for the camera and
  `aisleland-sfx` events for audio, then calls `endCelebration()`.
- **Audio/visual decoupling**: anything can play a sound by dispatching
  `window.dispatchEvent(new CustomEvent('aisleland-sfx', {detail:{name}}))`.
  Canonical names live in `src/audio/SoundManager.ts` (`SFX_NAMES`).

## 4. Critical invariants — do not break these

1. **Legacy asset-type ids are the save format.** The Cloud Function writes
   `islands/{uid}/assets` docs with types like `flower-1`, `tree-3`,
   `small-house`, `windmill-2` on an **8×7 grid** (`gridX`, `gridY`).
   `src/three/coords.ts` (`gridToWorld`, `isInClearing`) and
   `functions/src/island-manager.ts` (`isInClearing`) must stay consistent.
   Every type in `LEVEL_UNLOCKS` must have a recipe in
   `src/three/props/recipes.ts` (unknown types render a gift box).
2. **`terrainHeight` is voxel-quantized and shared.** The voxel mesher
   (`world/voxelIsland.ts`), prop placement, critters, grass scatter and
   celebration FX all call `coords.terrainHeight`. If you change the terrain
   shape, change it **only** there (smoothHeight/boundaryRadius/isWaterChannel)
   — the mesh and all standing objects will follow automatically.
3. **The stream is carved terrain.** `WATERFALL_AZIMUTHS` + `isWaterChannel`
   in coords.ts drive: the carved channel in the voxel mesh, the recessed
   stream bed (−1 voxel), the waterfall sheet anchors, and placement
   exclusions (demo adapter + grass tufts). Keep them in lockstep.
4. **One material family.** All solid meshes use `makeMeringue()` from
   `three/materials.ts` (multi-hue via vertex colors, ideally merged into few
   draw calls). It bakes in the toon ramp, rim light and the curved-world
   vertex bend. Custom ShaderMaterials (sky, sea, waterfall) are the exception
   and must include tonemapping/colorspace chunks.
5. **Island bob is deterministic.** Everything that "rides" the island applies
   `islandBob(clock.elapsedTime)` from `three/islandMotion.ts` independently —
   never couple modules by importing runtime values across them.
6. **`timeOfDay ∈ [0,1)`** (0 = midnight, 0.5 = noon) drives *everything*
   (sky, lights, lamps, fireflies, ambience). Read via
   `effectiveTimeOfDay(state)` so the photo-mode override works. Demo mode
   loops a day in 6 min (`ClockSync` in IslandScene).
7. **Adapters own session lifecycle.** Only `App.tsx`'s `onAuthChange`
   listener creates the firebase adapter (guarded by a `connecting` ref);
   `startSession` disposes any adapter it replaces; `dispose()` must clean up
   every subscription **and timer**. This was the worst bug class found in
   review — keep it tight.
8. **No allocations in `useFrame`.** Use module-level scratch
   Vector3/Color/Euler/Matrix4. Pooled FX (confetti, dust, motes) are reused,
   never recreated.

## 5. Verification workflow (how this was QA'd)

- **Static**: `npx tsc --noEmit -p tsconfig.app.json && npx eslint src scripts && npm run build`.
- **Visual**: run the dev server, then drive headless Chromium with Playwright
  (software GL flags: `--use-gl=angle --use-angle=swiftshader
  --enable-unsafe-swiftshader --no-sandbox`) — screenshot the login, demo
  island, journal, a quest completion mid-celebration, and photo-mode at
  t=0.5 / 0.72 / 0.9. Inject a maxed demo save into localStorage
  (`aisleland-demo-v2`, level 10 + all prop types + critters) to review every
  asset at once. Judge the screenshots against `docs/VISUAL_PLAYBOOK.md`.
- **Flow**: click "Try the demo island" → complete a quest → assert
  localStorage XP/streak/quests changed and the HUD updated.
- Playwright launches a fresh browser profile each run, so localStorage does
  **not** persist across script runs — don't mistake that for a save bug.

## 6. Known issues & sharp edges

| # | Issue | Notes |
|---|---|---|
| 1 | **Server placement ignores the stream.** `functions/src/island-manager.ts` scans the grid row-major and can place a reward on water-channel cells (near grid (7,0)/(0,6)). | Mirror `isWaterChannel` in the function, or reorder its scan. Demo mode already excludes the stream. |
| 2 | Level-up celebration can play **before** its quest celebration in firebase mode (island snapshot enqueues immediately; the quest celebration waits 1.8 s for the asset write). | Cosmetic. Fix: delay level-up enqueue or sequence by quest id. |
| 3 | Postcard export is canvas-resolution PNG, not the 1080×1350 framed postcard from the design doc (§11). CSS film filters *are* re-applied via `ctx.filter`. | Design doc §13 lists this as deferred. |
| 4 | Toasts ("New quest") still render in photo mode and can photobomb. | Gate `ToastHost` on `!photoMode`. |
| 5 | Critter hover sets `document.body.style.cursor` without unmount cleanup (low; from review). | One-line `useEffect` cleanup if it ever bites. |
| 6 | Console deprecation warnings from three r18x: `THREE.Clock` (r3f internal) and `PCFSoftShadowMap`. Harmless; shadows silently fall back to PCF. | Revisit when bumping three/r3f. |
| 7 | Ambient audio quality is synth-only until `npm run sfx` is run with an ElevenLabs key; generated files land in `public/audio/` and take priority automatically. | Loops aren't gapless-verified — check `ambient_*` seams after generating. |
| 8 | `functions/` were **not touched** in this revamp (except being read). They compile under their own tsconfig; treat them as legacy-stable. | Rate limit: 1 completion per source per 5 min (`complete-quest.ts`). |
| 9 | The grass-tuft cones read slightly non-voxel against the new terrain. | Candidate: swap `tuftGeometry` for tiny voxel crosses. |

## 7. Where the vision lives / roadmap

- `docs/GAME_DESIGN.md` — the north star. Since the initial v1 scope cut
  (§13), the following have SHIPPED: owl mail delivery + mailbox (flag up
  while quests wait, click opens the journal), morning-rain streak ritual
  (rain + pastel rainbow on the first completion of each day, both modes),
  ambient micro-events (day hot-air balloon, night shooting star with a
  click-to-wish burst), creek pond + arched bridge + animated stream surface,
  island naming (HUD click-to-edit, persisted), framed 1080×1350 postcard
  export with film filter + level stamp + caption, and an opening camera
  reveal. Still open, roughly in value order:
  1. **Critter friendship/affinity** (cat→gmail etc., heart levels — needs a
     small server schema addition; "do my email" becomes "feed my cat")
  2. **Pocket + seed-toss placement** (player-controlled planting)
  3. **Sunday Postcard Retro** (weekly auto-tour + shareable stat card)
  4. Share prompt auto-fired after level-ups; wish → +XP through the adapter
- `docs/VISUAL_PLAYBOOK.md` — remaining un-applied polish items: height-fog
  shader patch, god-ray cones at golden hour, paper-grain finishing effect,
  pitch-adaptive world curve, per-instance hue jitter on props.
- Visual upgrade candidates from the latest voxel pass: animated stream
  surface (scrolling foam), voxel-styled buildings, a pond at the stream
  source, a small bridge prop over the creek.

## 8. Git & process notes

- Work happens on `claude/workspace-game-3d-revamp-i7e3zz`; `main` still holds
  the pre-revamp 2D app. No PR has been opened yet.
- History is structured in reviewable slices: foundation → world/props →
  critters/fx/ui/audio → visual polish → review fixes → local-dev setup →
  voxel restyle. `git log --oneline` is the change narrative.
- The multi-agent build contracts (module boundaries, exports) used during
  development are baked into this doc's §3–4; the design/playbook docs are the
  only other institutional memory that matters.
