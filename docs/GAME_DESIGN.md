# AIsleland 3D — Game Design Document (v1.0, implementation-ready)

## 1. Vision & Signature Look

A meringue-soft floating island in a sea of sky. Every real Google Workspace task completed detonates a choreographed 3-second celebration — a source-flavored delivery, squash-and-stretch bloom, confetti, and a marimba chime landing on the same beat — on an island that visibly grows, misses you gently (never punishes), and hands you a shareable postcard at your proudest moment.

Five signature elements, non-negotiable:
1. **Meringue toon material** — one shared 3-band MeshToonMaterial + warm cream fresnel rim on every edge (§2).
2. **Gumdrop silhouette** — lip-overhang lathe island with dangling roots and twin waterfalls falling into an infinite sparkle sea (§3).
3. **Curved world** — Pocket-Camp planet bend, `uCurve = 0.0065` (§3.5).
4. **Bloom Burst** — the one repeated celebration timeline, source-flavored on entry, identical on landing (§6).
5. **Postcard photo mode** — 1080×1350 export with tilt-shift and torn-paper frame, offered automatically at every level-up (§11).

Decisions made: freeform placement (old 8×7 grid is dead). Diegetic XP (rune ring, not a HUD bar). No real DoF (fake tilt-shift, photo mode only). Levels readable as island height AND footprint.

---

## 2. Palette & Materials

Ship as `src/theme3d.ts` exporting typed `Color` constants. **Every system samples only from this file.**

| Token | Hex | Use |
|---|---|---|
| `dirtUnder` | `#A9744F` → `#7A4E33` | island underside gradient |
| `clay` | `#C98A5E` | mid cliff band |
| `cliff` | `#E3B08A` | upper cliff |
| `soilLip` | `#D9A066` | grass-to-cliff lip |
| `grass` | `#A8D8A0` | grass base |
| `grassHi` | `#C8EBB8` | grass toon top band |
| `pathSand` | `#F2E3C2` / `#D8C7A8` | paths / pebble border |
| `seaDeep` / `seaShallow` | `#4FA8C7` / `#8FD8DE` | sky-sea |
| `foam` | `#FFFFFF` @ 85% | pond foam, waterfall stripes `#CFF0F5` |
| `skyDay` | `#7EC8E8` / `#A8DCEF` / `#FDEBD2` | dome top/mid/horizon |
| `skyDusk` | `#5C6B9E` / `#E8917C` / `#FFD9A0` | dusk (the money hour) |
| `skyNight` | `#101A38` / `#22335E` / `#3A5178` | night + stars |
| `canopySpring` | `#B7E4A8` + blossom `#F7C8D8` | seasonal foliage |
| `canopySummer` | `#7FC97F` / inner `#5FAF6F` | |
| `canopyAutumn` | random of `#E8A94F` `#E07B54` `#D9C36A` | per-tree |
| `canopyWinter` | `#EAF4F7` + snow `#FFFFFF` | trunk always `#8A6248` |
| `wallCream` | `#FFF4E0` | houses, windmill blades |
| `roofCoral` / `roofBlue` | `#E07A6E` / `#7EAED4` | roofs (match existing HUD tokens) |
| `accentGreen` | `#6BAF8D` | lily pads, UI |
| `lampGlow` | `#FFD98A` | emissives |
| `sparkle` | `#FFF3E0` | universal pop-in particles |
| `celebration set` | `#FF9EAA` `#A8E6CF` `#FFD3B6` `#B5D8FF` `#FFF6A5` | confetti (only these five) |
| `rimDay` / `rimNight` | `#FFF3E0` / `#B8C7F0` | fresnel rim uniform |
| `rain` / `rainGold` | `#BFE3F2` / `#FFE9B8` | streak shower (§6.4) |
| `overcast` | `#C9D4DC` | missed-day cloud tint |

**Meringue material factory** — one `makeMeringue(vertexColors = true)`:
- `MeshToonMaterial` + shared 4px `DataTexture` gradient map, **exactly 3 bands** (0.55 / 0.78 / 1.0, `NearestFilter`). Three bands = soft, two = cel. 
- All hue via vertex colors painted at geometry build time; merge static island geometry with `BufferGeometryUtils.mergeGeometries` → target **≤5 draw calls** for terrain+static props.
- One `onBeforeCompile` injects: (a) fresnel rim `pow(1.0 - saturate(dot(N, V)), 3.0) * 0.35 * uRimColor` (uRimColor lerps `rimDay`→`rimNight` with time-of-day); (b) underside dye `mix(1.0, 0.92, smoothstep(0.0, -1.5, worldPos.y))`; (c) the world curve (§3.5); (d) per-plant wind uniform (§8 hover).
- AO is painted: crevice/canopy-bottom vertices 12% darker at build time. Zero texture fetches beyond the 4px ramp.

---

## 3. World Composition

### 3.1 Island geometry recipe
Three stacked layers, one parent group (everything rides the bob):
1. **Top plate**: LatheGeometry, 9-point profile — r=10 at y=0, out to **r=10.6 at y=−0.4** (lip overhang, mandatory), in to r=7.5 at y=−2. Displace radius with 2 octaves value noise (amp 0.45, freq 0.35); top disc stays flat for gameplay. `toNonIndexed` on the cliff band only for chunky facets.
2. **Underside**: inverted ConeGeometry r=7.5 h=6, **9 radial segments** (low on purpose), vertex noise ±0.6, gradient `dirtUnder`. Plus 5 dangling root cones (r=0.35 h=1.8) and 3 icosahedron-d0 rock chunks (scale 0.8/0.5/0.7) orbiting below: `sin(t*0.3)` bob, 20 s orbit.
3. **Twin waterfalls** at 10 o'clock and 4 o'clock: PlaneGeometry(1.2, 7, 1, 24) bent to quarter-arc; shader scrolls two stripe bands (`uv.y * 6.0 − time*1.8`, step 0.55) `#CFF0F5` over `#8FD8DE`, alpha→0 at bottom into 6 additive mist sprites (white, 0.4 opacity, 2.2 s loop, scale 0.8→1.4).

Island bob: `y = sin(t*0.5)*0.15`, `rotZ = sin(t*0.31)*0.6°`.

**Level growth**: each level-up extrudes a pre-authored rock shelf ring (scale 0→1, easeOutBack, 1.5 s; strata vertex colors `#C9A681`/`#8A9B6E`/`#7A6A58`) adding ~15% plantable area, AND the island's resting altitude rises +0.4 u per level — progression readable as both footprint and height.

### 3.2 Sky-sea
200×200 plane at y=−14. Fragment shader: `base = mix(seaDeep, seaShallow, exp(-distToIslandCenter*0.04))` (glows lighter beneath the island). Sparkle: 2 procedural voronoi layers (cell 3.0 / 7.0, scroll (0.03, 0.017) / (−0.02, 0.04)); `sparkle = smoothstep(0.05, 0.0, d) * #EAFBFF * (0.6 + 0.4*sin(time*2.0 + cellId*6.28))`. Fake reflection: vertical gradient boost `#C7E9F2` near horizon. One draw call; mobile drops voronoi layer 2 via `uQuality`.

**Pond** (CircleGeometry inset in grass): same shader + foam ring `step(fract(shoreDist*4.0 − time*0.5), 0.5)` white over `#9FE0DC`, 4 lily pads (flattened cylinders r=0.4, `accentGreen`).

### 3.3 Sky, day/night
3-stop gradient dome (colors §2). Cycle: **demo = 6-min full loop; signed-in = local clock**. Color keyframes at t = 0 / .25 / .4 / .5 / .75, **lerped in OKLab** (linear-sRGB is muddy at dusk).

**Lighting rig — exactly 3 lights:**
| Light | Values |
|---|---|
| Key DirectionalLight | intensity 1.4; elevation 20°→60° with time-of-day; the ONLY shadow: 1024px map, camera fit to r=11, `shadow.radius 4` (PCFSoft) |
| HemisphereLight | day `#BFE3FF`/`#E8C9A0` @ 0.55 · dusk `#F5B58C`/`#7C6B8F` @ 0.5 · night `#2A3B66`/`#1A2530` @ 0.35 |
| Fill DirectionalLight | opposite key, 0.25, no shadows |

**Night layer**: 220 fireflies = one `THREE.Points`, additive `#D9F2A8`, size `0.06 + 0.04*sin(t*3+id)`, per-id lissajous ±1.2 u, 3 s fade-in after dusk. 400 twinkle stars on the dome (hash-phased sin). House window emissives switch on staggered 200 ms. Lamps light one-by-one at dusk, 150 ms stagger, each with an emissive pop + soft chime — a nightly micro-ceremony.

**Post stack** (one EffectComposer): Bloom(0.55, threshold 0.82, mipmapBlur) + Vignette(darkness 0.55, offset 0.3) + HueSaturation(sat +0.08). **No runtime DoF.** Photo mode adds a custom 2-pass tilt-shift (9-tap gaussian on top+bottom 18% of screen). Mobile: mipmapBlur off, fireflies halved via dpr check.

### 3.4 Composition furniture
5 flat-shaded cloud blobs (3 merged icosa-d0 each, scale (1.6, 0.6, 1), white with `#FDEBD2` underside tint) orbiting r=18, y=+3.5, 90 s period. One distant mini-island (same lathe at 30% scale, desat `#B8CFDB`) at azimuth +120°, r=45. 3 blurred noise cloud-shadow sprites drift 0.15 u/s across a shadow-catcher plane.

### 3.5 Curved world
Single `curveWorld(shader)` helper in the same `onBeforeCompile`: after worldPosition, `float d = length(worldPos.xz − uCamPivot.xz); worldPos.y −= d*d*uCurve;` with `uCurve = 0.0065`. Rules: bend around the **camera pivot** (per-frame shared uniform), patch the **shadow-depth material** too (or shadows detach), exclude sky dome and UI sprites (`uCurve = 0` flag). On first load ease uCurve 0→0.0065 over 1200 ms cubicOut — the world visibly "curls up" as the intro beat.

---

## 4. Flora & Buildings (per unlock tier)

Universal pop-in (every prop, non-negotiable): scale 0→1.12 (280 ms backOut) →1.0 (140 ms) + 8-sprite `sparkle` burst + `pop_spawn` SFX.

| Tier | Asset | Recipe |
|---|---|---|
| Lv1–2 | **Flower** | stem cylinder r=0.03 h=0.35; 5 petal spheres r=0.09 squashed y×0.5 around center sphere `#FFD966`; petals random from `#F49FB6` `#FFD1DC` `#C9A8E8` `#FFE08A` |
| Lv3 | **Puffball tree** | trunk tapered cylinder (rT 0.12, rB 0.2, h 1.1, 6 seg, `#8A6248`); canopy = 3 icosa **detail 0** (radii 0.9/0.7/0.55, scaled (1, 0.8, 1)) at y 1.5/2.1/2.6, ±0.15 xz jitter, vertex lerp bottom-dark→top-light. Detail 0 is the style. |
| Lv3 | **Pine** | 3 cones r 0.9/0.65/0.4, h 0.9, 7 seg, 30% overlap |
| Lv3 | **Blossom** (spring) | puffball + 5 icosa-d0 r=0.18 `#F7C8D8` studs |
| Lv3 | **Path** | flattened boxes `pathSand`, pebble spheres `#D8C7A8` along edges |
| Lv4 | **Small house / stall** | box body, top vertices scaled in 8% (chamfer via position attribute), `wallCream`; roof = 4-sided cone rotated 45°, scale (1.15, 0.7, 1.15), `roofCoral`/`roofBlue`; door capsule-lathe `#8A6248`; chimney box `#E3B08A` + 3 additive smoke sprites, 4 s loop scale 0.2→0.6 alpha→0 |
| Lv5 | **Lamp** | cylinder post + icosa-d0 lantern, emissive `lampGlow` pulsing ±10% over 2.4 s at night |
| Lv6 | **Windmill** | lathe gumdrop body (bulge at 40% height); 4 blades = boxes (2.2, 0.35, 0.06), `wallCream` with `roofCoral` tips; **blade speed = 0.5 + 0.4 × pendingQuestCount rad/s** — the island works harder when you do |
| Lv7 | **Big house** | small-house recipe ×1.6 + second gable + 2 window emissives |
| Lv8–10 | **Critters** | §5 |

**Growth stages**: every plant has sprout → juvenile → full (existing `growthStage` field), advanced only by the daily rain ritual (§6.4). Butterflies (two quads flapping rotZ ±0.6 rad @ 8 Hz on lissajous paths) spawn only when island has >5 flowers — density is itself a reward.

---

## 5. Critters (Lv8+)

Bodies: 2 spheres + icosa-d0 head + cone ears/beak variants, meringue material, blob shadow (flattened dark circle sprite).

**Base FSM (all critters):**
```
idle(2–6s) → hopWander(3–5 parabolic hops, 350ms each, squash y0.8 on land)
           → sit(4–10s) → groom → idle
overlays: blink (eye y-scale 0→1, 120ms) every 3–7s
night: sleep curled near house, scale-Y breathing @ 0.25Hz (heart lv2+)
```
- Cursor within 1.5 u for >400 ms → 300 ms look-at lerp, 30% chance of one hop toward cursor.
- Click: 500 ms happy jump + heart emote bubble (billboard canvas sprite `#FF9EAA`, spring tension 400 friction 15, hold 1.2 s, fade 200 ms) + species SFX. Emote types: heart, music-note (near windmills), zzz (night), "!" (new quest — one critter sprints to the island edge and stares at the camera).
- **Friend moments**: two critters within 2 u → 15%/min chance: face each other, two synced hops, shared double-heart, one generative pluck. Rare enough to feel witnessed.

**Friendship & affinity** (4 ints on the island doc): cat→gmail, rabbit→calendar, dog→docs/drive, hamsters→sheets. Completing an affinity quest: critter seeks the new reward (max speed 0.6, 90 ms leg-bob sine), sniffs 1.2 s, emits heart (extruded heart shape `#FF9EAA`, floats +1.5 u over 900 ms easeOutQuad) = +1 point, 5 points per heart level (0–5 hearts).

| Hearts | Unlocked behavior |
|---|---|
| 1 | follows cursor raycast point at 2 u distance |
| 2 | sleeps curled by the house at night |
| 3 | brings a gift every 3 days (giftbox prop → cosmetic: tiny scarf mesh or flower-crown torus) |
| 4 | rides the windmill |
| 5 | duo-photo pose in photo mode |

This converts "do my email" into "feed my cat" — the emotional pitch of the game.

---

## 6. Core Loop & Celebrations

### 6.1 Quest arrival — physical, never a toast
Owl (two spheres + cone beak + plane wings flapping 6 Hz) flies in over 3 s, drops a letter into the mailbox; flag rotates up 90° (easeOutBounce, 400 ms), mailbox pulses emissive `#FFE8A3` @ 0.5 Hz. Click → letter unfolds (plane, fold-line rotation, 350 ms) showing the quest card.

### 6.2 The Bloom Burst — master completion timeline (~3.2 s, any input skips to end-state)

**Phase A — source-flavored delivery (t=0–900 ms), one per source:**
| Source | Delivery |
|---|---|
| gmail | Paper plane (6 tris, `#FFF9EF` body / `#FF9EAA` stripe) spawns 40 u off camera-left, cubic bezier with one barrel roll, 8 fading `#FFE8A3` sparkle quads (300 ms life), dive-bombs the spawn point |
| docs | Ink drop (icosphere `#7EA8F8`) falls 12 u over 500 ms easeInQuad, splashes to disc (scale 0→1.4→1, 350 ms), soaks into grass |
| sheets | 5 grass tiles domino-flip toward the spot (rotX 0→180°, 90 ms stagger, easeOutBack) |
| slides | Spotlight cone irises open (scale 0→1, 400 ms) + camera push-in |
| calendar | 900 ms micro time-lapse: key light sweeps 25°, sky lerps toward `#FFC98B` and back; 3 bell tones C5-E5-G5, 180 ms apart; reward materializes in an additive light cone (alpha 0.35) |

Concurrent: HUD quest card stamps a check (scale 1.4→1, 180 ms easeOutBack) + `quest_complete` chime at t=0; camera damped-lerps (maath.damp, λ=6) to r=19 framing the spawn point over 900 ms.

**Phase B — shared landing (t=900 ms onward, identical for all sources):**
- t=900: ground ring (flattened torus, additive `#FFE9A8`) scale 0→1.6 / 350 ms easeOutCubic, opacity 0.9→0.
- t=980: dust puff — 12 billboard quads `#FFF6E5`, radial 1.5–2.5 u/s, gravity −3, life 600 ms.
- t=1020: reward pops — react-spring `{mass:1, tension:280, friction:12}` (≈1.18 overshoot) + manual squash y0.6/xz1.3 resolving 380 ms + `pop_spawn`.
- t=1100: 40 instanced confetti triangles (celebration palette, spin 4–8 rad/s, life 1200 ms). Difficulty 4: double confetti + second ring.
- t=1150: five `+XP` motes (additive spheres) fly bezier arcs to the **rune ring** at the island base, 700 ms each, 60 ms stagger; each arrival fills runes + plays `xp_tick` pitched +2 semitones per mote (rising kalimba).
- t=2000: camera blends back to user over 800 ms.
- Reward lands in the **Pocket** if the player is present, or auto-plants at the spawn if idle >60 s.

### 6.3 Placement — Pocket + seed toss
Pocket dock bottom-center, max 5 slots, cards `#FFF6EC` with 2px `#E8D5C4` border. Drag onto island: ghost preview via raycast; valid = pulsing torus ring `#7FE3A0` (opacity 0.4→0.8 @ 1.2 Hz); invalid (water, occupied within 0.75 u poisson radius, slope >20°) = `#FF6B6B` + ghost tilts 8°. Release: seed arcs in a 500 ms parabola (easeOutQuad up / easeInQuad down), dust thunk (6 quads `#D9C7A9`), plants. Long-press placed asset → move mode (hover +0.3 u, shadow blob −20%). **Anti-hoarding**: Pocket items older than 24 h are auto-planted overnight by the Gardener (capsule + straw-hat torus/cone) with a "planted with love" sign — lapsed islands still visibly grow.

### 6.4 Streak — morning rain ritual
First quest of each day: 4 s rain shower (600 instanced streak quads, `#BFE3F2` @ 0.5 alpha, 14 u/s), every eligible plant stage-ups (400 ms easeOutBack pop + `#A8E6CF` sparkle), double rainbow (two torus arcs, gradient `#FF9EAA→#FFD3B6→#FFF6A5→#A8E6CF→#B5D8FF`, opacity 0.25) fades in 3 s. HUD flame flares 1.5× for 600 ms + `streak_fire`, all lamps pulse `#FFD9A0` ×2 emissive 400 ms. streakCount = fireflies orbiting the central lantern post at night (one `#FFE8A3` lissajous sprite per day, cap 30). **Miss a day: nothing dies** — sky tints overcast `#C9D4DC` until the next quest; the rain reads as forgiveness. 7-day streak: golden rain `#FFE9B8` + bonus `character_chance` roll.

### 6.5 Level-up — Island Ascension Quake (~2.5 s)
- t=0: white vignette flash 20% / 200 ms; ambience ducks −8 dB over 150 ms under a sub whoomp; camera pulls to r=14, elevation 25°, easeInOutCubic over 600 ms.
- t=200: anticipation — island sinks 0.4 u, easeInQuad 200 ms.
- t=400: **THUMP** — island springs up 0.9 u, 600 ms easeOutElastic, settling +0.4 u higher than before; camera shake (3-octave noise, amp 0.15, 500 ms decay); waterfalls burst 40% wider for 2 s.
- t=600/750/900: three shockwave rings (flat additive toruses `#FFF3B0`→transparent, scale 0→12 / 500 ms each).
- t=900: HUD "LEVEL N" letter-stagger 40 ms, scale overshoot 1.25; unlock card slides up.
- t=900–2400: new rock shelf extrudes (recipe §3.1), 3 flowers auto-bloom on it.
- t=1600: the newly unlocked asset descends on a parachute (half-lathe canopy `#FFD3B6`) onto the new shelf as a free sample.
- Sound: `levelup` (harp gliss → C-E-G-C bell arp + airy choir); ambience returns over 500 ms.
- t=2600: prompt "Your island grew — send a postcard?" (photo mode pre-framed, §11).

### 6.6 Sunday Postcard Retro
First open each Sunday: owl delivers an oversized golden envelope. Open → 12 s auto-tour: camera hops to each asset planted in the last 7 days in order (1.1 s per stop, easeInOutSine; each asset bows rotX 12° / 300 ms), pulls up to the Hero orbit; stat card slides in with quests-by-source rendered as a literal garden row (mini-flower `#FF9EAA` per gmail, mini-tree `#A8E6CF` per docs, mini-clock `#B5D8FF` per calendar, 120 ms stagger), XP, streak, and an Isle Rating (S/A/B — minimum grade B, labeled "Cozy", never punitive). Ends on the postcard-export button. Demo mode fabricates a week so first-timers see the payoff.

### 6.7 Ambient micro-events (idle retention)
Every 20–40 min (random): hot-air balloon (lathe teardrop, panels `#FF9EAA`/`#FFF6A5`) crosses the sky in 45 s; at night, a shooting star (additive line trail, 800 ms) — click within 2 s for +5 XP ("you made a wish").

---

## 7. Camera & Controls

- PerspectiveCamera **FOV 35** (diorama compression). Default: spherical r=24, polar 62° from zenith, azimuth −35°, target **(0, 1.2, 0)** — island in the lower ⅔, sky in the top ⅓.
- OrbitControls: azimuth unlimited; polar clamp 40°–75°; distance 16–34; `enablePan false`; damping 0.08. Wheel zoom in log-space smoothed with damp λ=6; FOV breathes 35°→37° at max zoom-out.
- **Idle drift**: after 8 s without input, azimuth +0.03 rad/s (eased in over 2 s) + sine elevation bob ±0.02 rad, period 11 s — recordings are never static. Input resumes with a 300 ms blend, never a snap.
- Double-click any object: 650 ms dolly framing it at 30% viewport height, cubicBezier(0.16, 1, 0.3, 1); drag or ESC releases.
- Every auto-move plays `whoosh_camera` at −20 dB.
- Mobile: pinch zoom + one-finger orbit at 0.7× sensitivity.
- `frameloop='demand'` + 30 fps invalidate ticks when `document.hidden` or no input for 60 s; full 60 fps otherwise.

---

## 8. UI Style

- HUD reuses existing tokens (`#E07A6E`, `#7EAED4`, `#6BAF8D`) over cream cards `#FFF6EC` / borders `#E8D5C4` — world and HUD are one brand.
- **XP is diegetic**: 12 emissive rune quads (`#8FD8FF`) ringing the island's rock base, filling clockwise as xp/xpToNextLevel; HUD carries only a small level chip + streak flame (two stacked spheres, shader displacement, gradient `#FFB347→#FFE29A`).
- "Everything is gummy": 3D hover = scale 1→1.06 spring {tension 300, friction 10} + 2° z-tilt wobble decaying 400 ms + white rim boost (strength 0.6, 120 ms). Press = squash y0.85/xz1.08 held 90 ms, release overshoots 1.1, `boop_squish` pitch ±3%. Hovering vegetation drives the wind uniform (sway 0→0.15 over 200 ms, springs back); flowers shed 2–3 petal particles in their own color.
- HTML buttons: `:active` scale 0.96 (120 ms); hover translateY(−2px) + soft shadow (150 ms); every click a 60 ms 200 Hz sine blip. Response to any pointer within 120 ms — nothing is inert.
- Quest drawer cards spring in {tension 200, friction 20}; completed cards get the 180 ms check-stamp.

---

## 9. Sound Design

Files generated offline via ElevenLabs script into `public/audio/`; runtime falls back to Web Audio synth. All SFX route through a duck bus (celebrations duck ambience −8 dB, 150 ms attack / 500 ms release).

| Name | Filename | Generation prompt |
|---|---|---|
| quest_complete | `quest_complete.mp3` | cheerful marimba and glockenspiel ascending three-note chime with soft sparkle tail, cozy game reward |
| levelup | `levelup.mp3` | warm harp glissando swelling into bright bell arpeggio with airy choir pad, magical fanfare, 2.5s |
| pop_spawn | `pop_spawn.mp3` | soft cartoon pop with tiny sparkle, gentle magic bubble burst |
| xp_tick | `xp_tick.mp3` | single very short bright kalimba pluck, clean |
| ui_tap | `ui_tap.mp3` | tiny soft muted wooden tap for cozy game UI |
| boop_squish | `boop_squish.mp3` | cute squishy jelly boop, playful |
| plant_flower | `plant_flower.mp3` | gentle dirt rustle with small bloom whoosh and chime |
| tree_grow | `tree_grow.mp3` | creaking wood stretch, leaves rustling upward, soft chime finish |
| build_house | `build_house.mp3` | quick playful hammer taps on wood ending in satisfying thunk and chime |
| critter_cat | `critter_cat.mp3` | tiny cute high-pitched cat chirp-meow, single |
| critter_rabbit | `critter_rabbit.mp3` | soft adorable squeaky rabbit chirp, single |
| critter_dog | `critter_dog.mp3` | small gentle puppy wuff, single |
| critter_hamster | `critter_hamster.mp3` | tiny cute hamster squeak-peep, single |
| streak_fire | `streak_fire.mp3` | warm whoosh with crackling ember sparkle, positive |
| whoosh_camera | `whoosh_camera.mp3` | soft airy wind pass |
| rain_ritual | `rain_ritual.mp3` | gentle warm rain shower with soft wind chimes, hopeful, 4s |
| owl_delivery | `owl_delivery.mp3` | soft wing flaps with a gentle paper flutter and mailbox clink |
| calendar_bells | `calendar_bells.mp3` | three soft ascending hand bells, C major, 180ms apart |
| ambient_day | `ambient_day.mp3` | gentle morning birdsong with soft breeze, loopable |
| ambient_night | `ambient_night.mp3` | quiet cricket chorus with occasional distant owl, loopable |
| ambient_water | `ambient_water.mp3` | soft waterfall with lapping water, loopable |

Mix rules: day/night crossfade 3 s; water volume inverse-square with camera distance to island edge, cap 0.4.

**Generative music layer** (Web Audio, always on + fallback): C-major pentatonic (C D E G A) plucks — triangle osc → lowpass 1200 Hz → 2 s convolver reverb (generated noise IR). Root pluck on quest complete; random scale note on critter pets; idle wind-chime cluster of 2–3 notes every 20–40 s at −18 dB. Level-up synth fallback: rising A3-C4-E4-A4 arp into a warm major chord, 1.2 s reverb tail.

---

## 10. Demo Mode & Onboarding (first 30 seconds, localStorage, no login)

Hard rule: **two celebrations + one level-up before the first account ask.**

- **0–2 s**: no splash. Camera starts inside cloud fog (`#FFF6EC`, high density); fog lifts over 1.8 s while the island springs 0.9→1 and the world curl (uCurve 0→0.0065, 1200 ms) plays; day birdsong fades in.
- **2–5 s**: one slow 90° hero orbit; "AIsleland" fades in (400 ms + wobble) with a single `#FFB6C1` pill: "Grow your island".
- **5–8 s**: exactly one mock quest card springs in: "Reply to Mia's email — +20 XP" with "Complete (demo)". All other UI hidden.
- **8–12 s**: click → full gmail paper-plane Bloom Burst → first flower.
- **12–25 s**: second mock quest (a Docs one, promising a tree) → ink-drop delivery, tree lathe-grows over 900 ms with `tree_grow`; demo XP is tuned so this completion triggers the **full Island Ascension** with "Trees + paths unlocked" and the parachute sample.
- **25–30 s**: soft non-blocking modal: "Connect Google to grow from your real tasks" / secondary "Keep playing demo"; wiggling cat silhouette teaser: "Reach level 8 to meet the cat".
- Demo persists to localStorage; demo day cycle is the 6-min loop; a fake week is generated so the Sunday Retro is previewable.

---

## 11. Viral / Photo Features

**One-tap postcard mode** (shutter button always top-right):
- Tap → camera flies 1200 ms easeInOutCubic to one of 3 curated orbits: **Hero** (35° elevation, ¾ view), **Cozy** (12° low, through-the-flowers foreground), **Aerial** (70° top-down). HUD hides; tilt-shift enables.
- Two sliders: time-of-day (drives the sun live) + one of 4 film filters as a color-LUT shader — Peach (lift `#FFEDE3`), Mint (shadows→`#DFF5EA`), Dusk (gradient map `#6C5B9E`/`#FF9EAA`), Mono-cozy (desat 70% + `#F2E8DA` tint).
- Critters auto-walk into frame and sit (pose per heart level; lv5 = duo pose).
- Export: second render at 1080×1350 (Instagram 4:5), pixelRatio 2, procedural postcard frame: 24px cream `#FFF9EF` border, sine-jittered torn-paper edge, corner stamp showing island level, caption "Day {streakCount} on {islandName} · aisleland.app".
- **The share prompt fires automatically after every level-up and at the end of every Sunday Retro** — peak-pride timing is the viral mechanic, not the feature.
- Dusk is the money hour: reward pops scheduled by Cloud Functions prefer delivery during the player's local dusk window when timing is flexible.

---

## 12. Performance Budget (60 fps mid laptop)

| System | Budget |
|---|---|
| Draw calls | ≤ 60 total; static island+props merged to ≤5 via mergeGeometries; critters/rewards instanced where >3 alike |
| Triangles | ≤ 120k scene total |
| Shadows | one 1024px map, key light only |
| Post | ≤ 2.2 ms (Bloom + Vignette + HueSat); tilt-shift photo-mode only |
| Particles | confetti/rain/fireflies all instanced or Points; rain 600 quads max; fireflies 220 (110 mobile) |
| Textures | zero files; 4px toon ramp + canvas emote sprites only |
| Idle | frameloop demand @ 30 fps ticks when hidden / 60 s no input |
| Mobile (dpr>2 or touch) | halve fireflies, drop voronoi layer 2, Bloom mipmapBlur off, dpr clamp 1.5, confetti 24, shadow map 512 |
| GC | pool all celebration particles/motes/rings; no per-frame allocations in the render loop |

Kill order under load (auto, via rolling 120-frame fps probe): voronoi layer 2 → cloud shadows → Bloom → firefly halving → shadow 512. The Meringue rim, curved world, and Bloom Burst are never cut — they are the brand.
---

## 13. v1 Implementation Scope (deviations decided by the director)

The document above is the north star. v1 ships the signature five (meringue material, gumdrop island,
curved world, Bloom Burst, postcard mode) with these pragmatic cuts:

- **Placement keeps the legacy 8×7 grid data model** (the Cloud Function writes gridX/gridY). Freeform LOOK
  is achieved with deterministic per-asset jitter (hash of asset id, ±0.35 u) at render time. The Pocket /
  seed-toss is deferred; rewards auto-plant during the Bloom Burst. Double-click a prop → move mode.
- **Owl/mailbox quest arrival** deferred → quest arrival is a UI toast + journal badge pulse.
- **Friendship/affinity meta, Sunday Retro, Gardener, hot-air balloon** deferred (need server schema work).
- **Level-up quake keeps the full §6.5 choreography minus permanent altitude/shelf growth** (island geometry
  is static in v1; the THUMP spring returns to rest height).
- **Curved world** implemented in the shared material factory (`src/three/materials.ts`), uCurve default
  0.004, applied to meringue materials only (sky/water/FX excluded). Shadow-depth patching skipped — keep
  the curve subtle.
- **Demo day cycle**: 6-minute loop starting at mid-morning (t=0.38), handled by integration (ClockSync).
- **XP rune ring**: module A renders 12 rune quads around the cliff base reading xp/xpToNextLevel from the
  store. HUD keeps a small level chip + streak flame.
- **Postcard export**: current canvas snapshot (PNG) with DOM-composited frame deferred; 3 curated photo
  orbits + time-of-day slider + filters ship.
