#!/usr/bin/env node
// Generate the AIsleland SFX/ambience set with the ElevenLabs sound-generation
// API (docs/GAME_DESIGN.md §9). Files land in public/audio/ and automatically
// take priority over the built-in Web Audio synth.
//
//   ELEVENLABS_API_KEY=xi-... node scripts/generate-sfx.mjs
//   node scripts/generate-sfx.mjs --list      # show the set without generating

import { mkdir, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio')
const API = 'https://api.elevenlabs.io/v1/sound-generation'

/** name → { text, seconds, influence } (from the design doc SFX table) */
const SOUNDS = {
  quest_complete: { text: 'cheerful marimba and glockenspiel ascending three-note chime with soft sparkle tail, cozy game reward', seconds: 2 },
  levelup: { text: 'warm harp glissando swelling into bright bell arpeggio with airy choir pad, magical fanfare', seconds: 2.5 },
  pop_spawn: { text: 'soft cartoon pop with tiny sparkle, gentle magic bubble burst', seconds: 1 },
  xp_tick: { text: 'single very short bright kalimba pluck, clean', seconds: 0.6 },
  ui_tap: { text: 'tiny soft muted wooden tap for cozy game UI', seconds: 0.5 },
  boop_squish: { text: 'cute squishy jelly boop, playful', seconds: 0.7 },
  plant_flower: { text: 'gentle dirt rustle with small bloom whoosh and chime', seconds: 1.5 },
  tree_grow: { text: 'creaking wood stretch, leaves rustling upward, soft chime finish', seconds: 2 },
  build_house: { text: 'quick playful hammer taps on wood ending in satisfying thunk and chime', seconds: 2 },
  critter_cat: { text: 'tiny cute high-pitched cat chirp-meow, single', seconds: 1 },
  critter_rabbit: { text: 'soft adorable squeaky rabbit chirp, single', seconds: 0.8 },
  critter_dog: { text: 'small gentle puppy wuff, single', seconds: 0.8 },
  critter_hamster: { text: 'tiny cute hamster squeak-peep, single', seconds: 0.8 },
  streak_fire: { text: 'warm whoosh with crackling ember sparkle, positive', seconds: 1.5 },
  whoosh_camera: { text: 'soft airy wind pass', seconds: 1 },
  owl_delivery: { text: 'soft wing flaps with a gentle paper flutter and mailbox clink', seconds: 2 },
  calendar_bells: { text: 'three soft ascending hand bells, C major, gentle', seconds: 1.5 },
  ambient_day: { text: 'gentle morning birdsong with soft breeze, peaceful meadow, seamless loop', seconds: 12, influence: 0.5 },
  ambient_night: { text: 'quiet cricket chorus with occasional distant owl, calm night, seamless loop', seconds: 12, influence: 0.5 },
  ambient_water: { text: 'soft small waterfall with lapping water, gentle, seamless loop', seconds: 10, influence: 0.5 },
}

const args = process.argv.slice(2)
if (args.includes('--list')) {
  for (const [name, s] of Object.entries(SOUNDS)) {
    console.log(`${name.padEnd(16)} ${s.seconds}s  ${s.text}`)
  }
  process.exit(0)
}

const key = process.env.ELEVENLABS_API_KEY
if (!key) {
  console.log('No ELEVENLABS_API_KEY set — skipping generation.')
  console.log('The game will use its built-in Web Audio synth. To generate real')
  console.log('SFX: ELEVENLABS_API_KEY=xi-... node scripts/generate-sfx.mjs')
  process.exit(0)
}

await mkdir(OUT_DIR, { recursive: true })
let ok = 0, skipped = 0, failed = 0

for (const [name, spec] of Object.entries(SOUNDS)) {
  const file = path.join(OUT_DIR, `${name}.mp3`)
  try {
    await access(file)
    console.log(`skip   ${name} (exists)`)
    skipped++
    continue
  } catch { /* not there yet */ }

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: spec.text,
        duration_seconds: spec.seconds,
        prompt_influence: spec.influence ?? 0.3,
      }),
    })
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(file, buf)
    console.log(`done   ${name} (${(buf.length / 1024).toFixed(0)} KB)`)
    ok++
  } catch (e) {
    console.error(`FAIL   ${name}: ${e.message?.slice(0, 200)}`)
    failed++
  }
}

console.log(`\n${ok} generated, ${skipped} skipped, ${failed} failed → ${OUT_DIR}`)
