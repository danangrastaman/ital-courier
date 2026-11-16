// Orbital Courier — deterministic screenshot scenes.
// One job: put the game in a fixed, good-looking state for each ?shot= scene
// (title, play, upgrade, victory, gameover) so screenshots are reproducible.

import { mulberry32 } from './random.js';
import { buildSector, spawnShip } from './levels.js';
import { UPGRADES } from './config.js';

/** Place the ship mid-flight with a visible trail, for the play scene. */
function poseFlyingShip(game) {
  const ship = game.ship;
  ship.x = 560;
  ship.y = 380;
  ship.vx = 150;
  ship.vy = -60;
  ship.angle = Math.atan2(-60, 150);
  ship.fuel = 72;
  ship.cargo = true;
  ship.thrusting = true;
  game.trail = [];
  for (let i = 0; i < 42; i++) {
    game.trail.push({ x: 560 - i * 4.5, y: 380 + i * 1.6 });
  }
  game.particles.burst(540, 390, 12, '#3fe0c5', 120);
  game.particles.burst(700, 300, 10, '#ffb347', 100);
  game.texts.add(700, 280, '+150 CR', '#ffd166');
}

/**
 * Configure the game for a screenshot scene. `seed` fixes the sector layout.
 * The caller draws one frame afterwards and sets window.__shotReady.
 */
export function setupShot(game, scene, seed) {
  const rng = mulberry32(seed || 20261116);
  game.state = scene === 'play' ? 'playing'
    : scene === 'upgrade' ? 'upgrade'
    : scene === 'victory' ? 'victory'
    : scene === 'gameover' ? 'gameover'
    : 'title';

  if (scene === 'victory') {
    game.credits = 1840;
    game.elapsed = 342;
    game.deliveriesDone = 12;
    game.bestCombo = 4;
    game.stars = 3;
    game.best = 1840;
    game.sector = buildSector(2, mulberry32(7));
    spawnShip(game.sector, game.ship);
    game.ship.x = 640;
    game.ship.y = 360;
    game.ship.fuel = 64;
    return;
  }
  if (scene === 'gameover') {
    game.credits = 520;
    game.elapsed = 187;
    game.deliveriesDone = 5;
    game.bestCombo = 2;
    game.best = 940;
    game.endReason = 'Hull breached. Your courier run ends here.';
    game.sector = buildSector(1, mulberry32(11));
    spawnShip(game.sector, game.ship);
    game.ship.x = 640;
    game.ship.y = 360;
    game.ship.hull = 0;
    game.particles.burst(640, 360, 40, '#ff5a6e', 260);
    return;
  }
  if (scene === 'upgrade') {
    game.credits = 450;
    game.elapsed = 148;
    game.deliveriesDone = 3;
    game.bestCombo = 2;
    game.sectorIndex = 0;
    game.upgradeChoices = UPGRADES.slice(0, 3);
    game.sector = buildSector(0, rng);
    spawnShip(game.sector, game.ship);
    game.ship.x = 640;
    game.ship.y = 360;
    return;
  }

  // title and play share a sector-1 backdrop.
  game.sector = buildSector(0, rng);
  spawnShip(game.sector, game.ship);
  if (scene === 'play') {
    game.credits = 340;
    game.elapsed = 95;
    game.deliveriesDone = 2;
    game.combo = 2;
    game.bestCombo = 2;
    game.best = 940;
    game.delivery = {
      phase: 'dropoff',
      pickup: game.sector.beacons[0],
      dropoff: game.sector.stations[1],
      timer: 12,
    };
    poseFlyingShip(game);
    // A flare warning makes the play shot dramatic.
    game.flare = { state: 'warn', timer: 2.5, radius: 0 };
  } else {
    game.best = 940;
    game.ship.x = 640;
    game.ship.y = 430;
    game.ship.vx = 24;
    game.ship.vy = -8;
  }
}
