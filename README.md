# Orbital Courier

A complete original browser game: slingshot the stars, deliver the cargo.

You are a courier pilot in the Drift. Pick up cargo at the amber beacons and
deliver it to the stations — 12 deliveries across 3 sectors wins the run.
Gravity is free: slingshot around planets to save fuel. Thrusters burn fuel,
so every burn is a choice. Dodge drifting asteroids and solar flares, keep
your hull intact, chain clean deliveries for combo bonuses, and pick one of
three upgrades after each sector.

## How to play

- **WASD / arrow keys** — thrust
- **SPACE** — brake
- **Mouse drag near your ship, release** — slingshot launch (free, no fuel)
- **P / ESC** — pause · **R** — restart · **M** — mute
- **1 / 2 / 3** or click — choose an upgrade between sectors

## Run it

Serve `game/` with any static server and open `index.html` in desktop Chrome,
for example:

```sh
python3 -m http.server --directory game 8080
```

No network requests, no build step, no libraries — plain ES modules and
canvas 2D, with all sound synthesized live through WebAudio.

## Layout

- `main.ts` — entry program: copies `game/` + `screenshots/` to the output
  directory and writes `dossier.json` with `vendor/makefun-game.ts`.
- `game/index.html`, `game/style.css` — the page.
- `game/src/config.js` — tuning constants, palette, upgrades.
- `game/src/random.js` — seeded random numbers.
- `game/src/audio.js` — WebAudio sound effects and generative music.
- `game/src/levels.js` — sector layouts (planets, stations, beacons, hazards).
- `game/src/physics.js` — gravity, integration, bounces, collisions.
- `game/src/particles.js` — particles and floating score text.
- `game/src/input.js` — keyboard and mouse input.
- `game/src/game.js` — state machine and rules.
- `game/src/render.js` — all canvas drawing (world, HUD, screens).
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=`).
- `game/src/main.js` — bootstrap and fixed-step loop.
- `screenshots/` — real renders of the game's own code (title, play,
  upgrade, victory).
- `vendor/makefun-game.ts` — the kit's dossier library, copied unchanged.

## License

MIT — see `LICENSE`.
