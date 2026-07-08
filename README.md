# AIsleland 🏝️

**Your work grows an island.** A cozy 3D healing game where completing real Google
Workspace tasks — Gmail replies, Docs edits, Calendar events — grows a floating
island: flowers bloom, trees rise, windmills spin, and critters move in.

Built with React 19, Three.js (@react-three/fiber), zustand and Firebase.

## Run it on your machine

**Requirements:** Node.js **20.19+ or 22.12+** (Vite 8). Check with `node -v`.
If you use nvm: `nvm install && nvm use` (an `.nvmrc` pins Node 22).

```bash
# grab this branch
git fetch origin claude/workspace-game-3d-revamp-i7e3zz
git checkout claude/workspace-game-3d-revamp-i7e3zz

# install and run — no .env, no login needed to play
npm install
npm run dev
```

Vite prints a local URL (e.g. `http://localhost:5173`). Open it and click
**“Try the demo island.”** Demo quests trickle in, everything persists to
localStorage, and a full day/night cycle loops every 6 minutes. `npm run dev`
uses `--host`, so the printed **Network** URL also lets you open it from your
phone on the same Wi-Fi.

To view the optimized production build instead:

```bash
npm run build
npm run preview   # serves the built app on http://localhost:4173
```

> Sound works out of the box via a built-in Web Audio synth. Everything 3D is
> procedural — there are no model or texture files to download.

## The real thing (Google Workspace mode)

1. Create a Firebase project, enable Google auth + Firestore, and fill `.env`
   (see `.env.example`).
2. Deploy the Cloud Functions in `functions/` — they watch Gmail/Drive/Calendar
   and turn your actual tasks into quests.
3. Sign in with Google. Completing a quest calls the `completeQuest` function,
   which awards XP and plants a reward on your island.

## Sound (optional, ElevenLabs)

The game ships with a procedural Web Audio synth (marimba plucks, generative
pentatonic music, day/night ambience) so it always has sound. To generate the
full designed SFX set with ElevenLabs:

```bash
ELEVENLABS_API_KEY=xi-... node scripts/generate-sfx.mjs
```

Files land in `public/audio/` and automatically take priority over the synth.

## Design

The complete game design — palette, celebration timelines, camera language,
critter behaviors, sound table — lives in [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md).

### Architecture

```
src/
  state/      zustand game store + shared types (celebration queue lives here)
  data/       demoAdapter (localStorage) / firebaseAdapter (Firestore sync)
  design/     tokens.ts — every color/timing constant in the game
  three/
    world/    floating island, sky, sea, lighting, day/night, fireflies
    props/    procedural low-poly rewards (flowers, trees, houses, windmills…)
    critters/ wandering animals with tiny state machines
    fx/       Bloom Burst celebrations, confetti, post-processing
    camera/   orbit rig, idle drift, photo-mode orbits
  ui/         HUD, quest journal, celebration overlays, login hero
  audio/      SoundManager — ElevenLabs files with Web Audio synth fallback
functions/    Cloud Functions: quest generation from Gmail/Drive/Calendar
```

Everything 3D is procedural — zero model or texture files.
