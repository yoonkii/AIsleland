# AIsleland — Handoff Document

_Last updated: 2026-07-09 (rev 2, post living-island pass) · Branch: `claude/workspace-game-3d-revamp-i7e3zz` · HEAD: `7cf5f5c`_

AIsleland is a cozy 3D healing game: completing real Google Workspace tasks
(Gmail, Docs, Sheets, Slides, Calendar) grows a floating voxel island. This
document is everything a new developer (or agent) needs to take over.

---

## 1. Current state — what works today

- **Full 3D revamp shipped.** The legacy PixiJS 2D view is gone. The game is a
  React 19 + @react-three/fiber v9 scene: a MagicaVoxel-style terraced island
  with a creek (spring pond → arched bridge → twin waterfalls), plush
  Pokémon-cozy trees, procedural buildings, real-time day/night, celebration
  choreography, photo mode, and a full Web Audio soundscape.
  **Zero external assets** — every mesh, texture and sound is procedural
  (ElevenLabs files optionally override the synth).
- **The island is alive** (no unlocks needed): ducks paddle the creek,
  songbirds fly in and peck around, gulls circle offshore, fish jump from the
  sea, bees work the flowers, a hot-air balloon crosses by day and a
  clickable wish-star streaks by at night. Every new quest is delivered by an
  **owl** to a mailbox whose flag stays up while quests wait. The **first
  completion of each day** triggers a morning-rain ritual with a pastel
  rainbow (streak reward). 11 collectible companion species wander with tiny
  FSMs (idle/wander/sit/groom/sleep/jump), emote spontaneously, and react to
  clicks. Demo players start with a cat.
- **Two play modes:**
  - **Demo** (default, zero config): mock quests trickle in, persistence in
    `localStorage` (`aisleland-demo-v2`), a day/night cycle every 6 minutes,
    bonus companions (duck/sheep/bird/fox) from level 4.
  - **Firebase**: Google sign-in → Cloud Functions watch Gmail/Drive/Calendar
    and write quests to Firestore; completing calls the `completeQuest`
    callable which awards XP and plants a reward.
- **Player-facing extras**: island naming (click the HUD name), framed
  1080×1350 postcard export (film filter, level stamp, "Day N on {isle}"
  caption), opening camera reveal, photo mode with three curated orbits and a
  time-of-day slider.
- **Verified**: `tsc` clean, `eslint` clean, `vite build` clean, demo flow
  smoke-tested in headless Chromium, every feature screenshot-verified
  (including a precise celebration-timeline measurement), plus an earlier
  adversarial multi-agent review whose confirmed findings were all fixed.

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
  everything runs without it (demo only). `ELEVENLABS_API_KEY` is used only by
  `scripts/generate-sfx.mjs`, never shipped to the client.
- **Firebase mode setup**: Firebase project (Google auth + Firestore), fill
  `.env`, deploy `firestore.rules` + indexes, deploy `functions/` (Gmail
  watch needs a GCP Pub/Sub topic — see `functions/src/setup-gmail-watch.ts`).
- **No hosting/CI config yet.** `vite build` → `dist/`; any static host works.

## 3. Architecture

```
src/
  main.tsx, App.tsx        session bootstrap: login → adapter → game shell
  state/
    gameStore.ts           zustand store — THE hub (session, island, quests,
                           celebration queue, islandName, UI flags, camera focus)
    types.ts               shared types, CelebrationEvent (quest|levelup|rain),
                           LEVEL_THRESHOLDS/LEVEL_UNLOCKS, CRITTER_SPECIES
  data/
    demoAdapter.ts         localStorage backend: quests, XP, rewards, streak day
                           tracking (rain ritual), demo-only bonus companions
    firebaseAdapter.ts     Firestore subs → store; completeQuest callable;
                           rain ritual derived from lastQuestCompletedAt day flip
  firebase/                auth (Google OAuth + GWS scopes), config, firestore IO
  design/tokens.ts         every color/timing/camera constant (single source)
  three/
    IslandScene.tsx        <Canvas> composition, ClockSync, framed-postcard export
    coords.ts              ★ world contract: 8×7 grid, VOXEL size, terraced
                           terrainHeight, boundaryRadius, waterfall channels +
                           spring pond (isWaterChannel), WATERFALL_AZIMUTHS
    materials.ts           ★ meringue toon factory (3-band ramp + rim + curved
                           world) + global uniforms
    islandMotion.ts        deterministic island bob/roll shared by all modules
    world/                 voxelIsland (terrain mesher), StreamFlow (animated
                           water ribbon), Bridge, Mailbox (+ owl delivery),
                           Sky, SkySea, Waterfalls, Clouds, Lights, Fireflies,
                           GrassTufts, RuneRing, skyColors (OKLab tracks)
    props/                 recipes.ts (20 prop types: plush trees, voxel pine,
                           fenced pumpkin patch…), Props/Prop (pop-in, hover,
                           arrange mode)
    critters/
      Critters.tsx         11 companion species (specs: ears/bill/head/bushy
                           tail), FSM + blink + spontaneous & click emotes
      Wildlife.tsx         ambient life: ducks, songbirds, gulls, fish, bees
    fx/                    CelebrationDirector (Bloom Burst, level-up quake,
                           rain+rainbow ritual, balloon, wish-star, pollen,
                           butterflies) + PostFX (composer)
    camera/CameraRig.tsx   OrbitControls + intro reveal + idle drift + focus
                           flights + photo orbits
  ui/                      HUD (editable island name), QuestJournal,
                           CelebrationOverlay (incl. rain chip), PhotoModeBar,
                           LoginScreen, ToastHost (photo-mode aware) + ui.css
  audio/SoundManager.ts    dual-source SFX (files → synth), ambience by time of
                           day, generative music, celebration ducking
functions/src/             Cloud Functions (legacy-stable): quest generation,
                           completeQuest callable, island-manager placement
scripts/generate-sfx.mjs   ElevenLabs sound-generation batch script
docs/GAME_DESIGN.md        design north star (§13 = original v1 scope cuts)
docs/VISUAL_PLAYBOOK.md    researched visual techniques + grade settings
```

### Data flow

```
Cloud Functions ──writes──▶ Firestore ──onSnapshot──▶ firebaseAdapter ─┐
                                                                        ├──▶ gameStore ──▶ three/* + ui/*
localStorage ◀──persist── demoAdapter ◀──completeQuest()── QuestJournal ┘
                                │
                                └──enqueueCelebration(rain?, quest, levelup?)──▶ CelebrationDirector
```

- **Celebrations** are a FIFO queue on the store. Adapters enqueue (the rain
  ritual, when due, is enqueued *before* its quest event); the
  `CelebrationDirector` pops one at a time, runs the timeline (3.2 s quest /
  4.5 s level-up / 4.2 s rain), drives camera focus + SFX, then
  `endCelebration()`.
- **Audio decoupling**: anything plays a sound via
  `window.dispatchEvent(new CustomEvent('aisleland-sfx', {detail:{name}}))`;
  canonical names in `src/audio/SoundManager.ts`.
- **Quest arrival is physical**: `world/Mailbox.tsx` subscribes to the quest
  list; a fresh quest id triggers the owl flight + `owl_delivery` SFX, and
  the mailbox flag eases up while `quests.length > 0`. `ToastHost` still
  shows the textual toast (suppressed in photo mode).

## 4. Critical invariants — do not break these

1. **Legacy asset-type ids are the save format.** The Cloud Function writes
   `islands/{uid}/assets` with types like `flower-1`, `small-house` on an
   **8×7 grid**. `coords.ts` and `functions/src/island-manager.ts` share the
   clearing math. Every type in `LEVEL_UNLOCKS` must have a recipe in
   `props/recipes.ts` (unknown → gift box).
2. **`terrainHeight` is voxel-quantized and shared.** The voxel mesher, prop
   placement, critters, wildlife perch points, grass scatter and celebration
   FX all read `coords.terrainHeight`. Change terrain shape ONLY via
   `smoothHeight`/`boundaryRadius`/`isWaterChannel` in coords.ts — mesh and
   everything standing on it follow automatically.
3. **The creek is carved terrain.** `WATERFALL_AZIMUTHS` + `isWaterChannel`
   (which includes the spring-pond widening on channel 0) drive: the carved
   voxel channel, the recessed bed (−1 voxel), waterfall sheet anchors, the
   StreamFlow ribbon path, duck swim paths, and placement exclusions (demo
   adapter + grass tufts). One source of truth; keep it that way.
4. **One material family.** All solid meshes use `makeMeringue()` (hues via
   vertex colors; share instances). Custom ShaderMaterials (sky, sea,
   waterfall, stream) must include tonemapping/colorspace chunks.
5. **Island bob is deterministic.** Everything riding the island applies
   `islandBob(clock.elapsedTime)` independently — never share runtime refs
   across modules.
6. **`timeOfDay ∈ [0,1)`** drives everything (sky, lights, lamps, fireflies,
   ambience, wildlife visibility, balloon/star schedules). Read via
   `effectiveTimeOfDay(state)` so photo-mode override works.
7. **Adapters own session lifecycle.** Only App.tsx's `onAuthChange` listener
   creates the firebase adapter (guarded by `connecting` ref); `startSession`
   disposes any adapter it replaces; `dispose()` must clear every
   subscription **and timer**. Worst historical bug class — keep it tight.
8. **No allocations in `useFrame`.** Module-level scratch vectors; pooled FX
   only. New celebration kinds must hide their meshes in `hideAll()`.
9. **Species additions**: extend `CritterSpecies` + `CRITTER_SPECIES`
   (types.ts), `SPECIES` spec (Critters.tsx), `CRITTER_NAMES` (+ demo bonus
   table if demo-grantable) in demoAdapter. Do NOT add client-only species to
   `LEVEL_UNLOCKS` — the firebase level-up banner diffs that table and the
   server will never grant them.
10. **Timeline code uses one clock.** r3f `clock.elapsedTime` and
    `performance.now()` are different bases — never mix them in one timeline
    (the wish-star click stamps via a pending flag consumed in useFrame; the
    critter jump queue does the same).

## 5. Verification workflow (how this is QA'd)

- **Static**: `npx tsc --noEmit -p tsconfig.app.json && npx eslint src scripts && npm run build`.
- **Visual**: dev server + Playwright headless Chromium (flags:
  `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader
  --no-sandbox`). Inject a maxed save into localStorage
  (`aisleland-demo-v2`: level 10, all prop types, all species) to review
  everything at once; screenshot day/golden/night via the photo-mode slider.
- **Event timing**: headless rendering is slow and skews fixed sleeps — for
  timeline features (celebrations, owl), poll the DOM (overlay classes, the
  journal badge) and screenshot on state change instead of sleeping.
  Playwright uses a fresh profile per launch, so localStorage never persists
  across runs — that is not a save bug.
- **Downloads** (postcard): `page.waitForEvent('download')` → `saveAs` →
  inspect the PNG.

## 6. Known issues & sharp edges

| # | Issue | Notes |
|---|---|---|
| 1 | **Server placement ignores the creek.** `functions/src/island-manager.ts` scans row-major and can drop a reward on water cells (near grid (7,0)/(0,6)). | Mirror `isWaterChannel` in the function. Demo mode already excludes water. |
| 2 | Rain ritual + level-up + quest can queue back-to-back on a big day — order is rain → quest → levelup (level-up may still slip first in firebase mode since it comes from the island snapshot while the quest waits 1.8 s for the asset write). | Cosmetic; sequence by quest id if it bothers. |
| 3 | Wish-star grants no XP (visual + sound only) — the adapters expose no client-side XP hook. | Add `adapter.grantBonusXp?(n)` if wanted (demo trivial; firebase needs a callable). |
| 4 | Critter hover sets `document.body.style.cursor` without unmount cleanup (low). | One-line `useEffect` cleanup if it bites. |
| 5 | three r18x deprecation warnings (`THREE.Clock`, `PCFSoftShadowMap`) — harmless; shadows fall back to PCF. | Revisit on the next three/r3f bump. |
| 6 | Synth-only audio until `npm run sfx` runs with an ElevenLabs key; generated `ambient_*` loop seams unverified. | Files in `public/audio/` auto-take priority. |
| 7 | `functions/` untouched by the revamp; treat as legacy-stable. Rate limit: 1 completion per source per 5 min. | |
| 8 | Owl/mailbox sit at a fixed meadow spot (−4.2, 8.6). If terrain near there changes, re-check `terrainHeight` puts them on land. | |
| 9 | Wildlife counts are fixed (2 ducks / 3 birds / 2 gulls / 2 bees) with no quality-tier gating — fine on current budgets (~10 extra draw calls). | Gate on `store.quality` if mobile perf ever hurts. |

## 7. Roadmap (in value order)

Shipped since the original design-doc scope cut (§13): owl mail + mailbox,
morning-rain streak ritual, ambient micro-events (balloon, wish-star),
creek pond + bridge + animated stream, ambient wildlife (ducks, songbirds,
gulls, fish, bees), 4 new companion species + starter buddy + spontaneous
emotes, island naming, framed postcard export, opening camera reveal.

Still open:
1. **Critter friendship/affinity** (cat→gmail etc., heart levels; "do my
   email" becomes "feed my cat") — needs a small server schema addition.
2. **Pocket + seed-toss placement** (player-controlled planting).
3. **Sunday Postcard Retro** (weekly auto-tour + shareable stat card).
4. Share prompt auto-fired after level-ups; wish-star → real +XP.
5. Remaining VISUAL_PLAYBOOK items: height-fog patch, golden-hour god rays,
   paper-grain finishing effect, per-instance prop hue jitter.
6. Critter nameplates on hover (names exist in data, unseen in game).

## 8. Git & process notes

- Work lives on `claude/workspace-game-3d-revamp-i7e3zz`; `main` still holds
  the pre-revamp 2D app. No PR opened yet.
- History is reviewable slices — `git log --oneline` reads as the project
  narrative (foundation → modules → polish → review fixes → voxel restyle →
  living-world → living-island).
- Institutional memory: this file + `docs/GAME_DESIGN.md` +
  `docs/VISUAL_PLAYBOOK.md`.
