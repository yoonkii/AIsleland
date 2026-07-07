# AIsleland 🏝️

**Your work grows an island.** A cozy 3D healing game where completing real Google
Workspace tasks — Gmail replies, Docs edits, Calendar events — grows a floating
island: flowers bloom, trees rise, windmills spin, and critters move in.

Built with React 19, Three.js (@react-three/fiber), zustand and Firebase.

## Quick start

```bash
npm install
npm run dev
```

Open the app and click **“Try the demo island”** — no login, no config needed.
Demo quests trickle in and everything persists to localStorage. A full day/night
cycle loops every 6 minutes in demo mode.

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
