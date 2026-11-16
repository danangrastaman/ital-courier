// Orbital Courier — bootstrap and fixed-step game loop.
// One job: wire the canvas, input, sound and game together; run the loop;
// render one deterministic frame in ?shot= mode for screenshots.

import { VIEW_W, VIEW_H } from './config.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { drawGame } from './render.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const input = new Input(canvas);
const sound = new SoundEngine();
const game = new Game(canvas, input, sound);

// Exposed for play-testing and for the screenshot harness.
window.__game = game;
window.__shotReady = false;

/** Fit the 1280x720 canvas into the window, letterboxed. */
function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  const w = Math.floor(VIEW_W * scale);
  const h = Math.floor(VIEW_H * scale);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  input.setViewport(scale, (window.innerWidth - w) / 2, (window.innerHeight - h) / 2);
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// Audio needs a user gesture: unlock it on the first key or pointer press.
const unlock = () => sound.ensure();
window.addEventListener('keydown', unlock, { once: true });
window.addEventListener('pointerdown', unlock, { once: true });

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') || 20261116);

if (shot) {
  // Screenshot mode: one deterministic frame, then signal readiness.
  setupShot(game, shot, seed);
  drawGame(ctx, game);
  window.__shotReady = true;
} else {
  // Live mode: fixed 1/60 s steps, decoupled from the display rate.
  const STEP = 1 / 60;
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += elapsed;
    let guard = 0;
    while (acc >= STEP && guard < 5) {
      game.update(STEP);
      acc -= STEP;
      guard++;
    }
    if (guard === 5) acc = 0;
    drawGame(ctx, game);
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
