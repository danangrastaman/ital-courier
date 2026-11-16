// Orbital Courier — game state and update logic.
// One job: the state machine (title → playing → upgrade → victory / game over)
// and every rule: deliveries, fuel, hull, flares, asteroids, scoring.

import {
  VIEW_W, VIEW_H, THRUST, BRAKE, FUEL_MAX, FUEL_DRAIN, FUEL_BRAKE_DRAIN,
  SLINGSHOT_POWER, SLINGSHOT_MAX, SHIP_RADIUS, PICKUP_RADIUS, DELIVER_RADIUS,
  HULL_MAX, INVULN_TIME, SECTORS, TOTAL_DELIVERIES, CREDIT_DELIVERY,
  CREDIT_TIME_BONUS, CREDIT_FUEL_BONUS, COMBO_STEP, FLARE_WARN, FLARE_SPEED,
  UPGRADES, BEST_KEY,
} from './config.js';
import { mulberry32, shuffle, pick } from './random.js';
import { buildSector, spawnShip } from './levels.js';
import { applyGravity, integrate, circlesOverlap, bounceOffPlanet, distance } from './physics.js';
import { Particles, FloatTexts } from './particles.js';

export class Game {
  constructor(canvas, input, sound) {
    this.canvas = canvas;
    this.input = input;
    this.sound = sound;
    this.particles = new Particles();
    this.texts = new FloatTexts();
    this.state = 'title';
    this.time = 0;
    this.elapsed = 0;
    this.credits = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.deliveriesDone = 0;
    this.sectorIndex = 0;
    this.sector = null;
    this.ship = this.freshShip();
    this.delivery = null;
    this.deliveredInSector = 0;
    this.trail = [];
    this.shake = 0;
    this.flare = { state: 'idle', timer: 20, radius: 0 };
    this.upgradeChoices = [];
    this.muted = false;
    this.stars = 0;
    this.endReason = '';
    this.best = 0;
    this.strandedTimer = 0;
    this.prevMouseDown = false;
    this.click = null; // {x, y} set on a click (down→up without a drag)
    this.slingshot = null; // {x, y} drag start while aiming
    this.sectorTime = 0;
    try {
      this.best = Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
    } catch (err) {
      this.best = 0;
    }
  }

  freshShip() {
    return {
      x: VIEW_W / 2, y: VIEW_H / 2, vx: 0, vy: 0, angle: -Math.PI / 2,
      fuel: FUEL_MAX, fuelMax: FUEL_MAX, hull: HULL_MAX, hullMax: HULL_MAX,
      thrustMul: 1, fuelMul: 1, pickupMul: 1, brakeMul: 1, cellBonus: 0,
      invuln: 0, cargo: false, thrusting: false,
    };
  }

  // ---------------------------------------------------------- flow

  startGame() {
    this.credits = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.deliveriesDone = 0;
    this.elapsed = 0;
    this.ship = this.freshShip();
    this.state = 'playing';
    this.startSector(0);
    this.sound.ensure();
    this.sound.startMusic();
    this.sound.click();
  }

  startSector(index) {
    this.sectorIndex = index;
    const rng = mulberry32(20261116 + index * 7919 + this.deliveriesDone * 13);
    this.sector = buildSector(index, rng);
    spawnShip(this.sector, this.ship);
    this.ship.cargo = false;
    this.trail = [];
    this.flare = { state: 'idle', timer: this.sector.flareEvery, radius: 0 };
    this.sectorTime = 0;
    this.deliveredInSector = 0;
    this.nextDelivery();
  }

  nextDelivery() {
    const rng = mulberry32(Date.now() % 2147483647 + this.deliveriesDone * 101);
    const pickup = pick(rng, this.sector.beacons);
    let dropoff = pick(rng, this.sector.stations);
    if (this.delivery && dropoff === this.delivery.dropoff) {
      dropoff = this.sector.stations[(this.sector.stations.indexOf(dropoff) + 1) % this.sector.stations.length];
    }
    this.delivery = {
      phase: 'pickup',
      pickup,
      dropoff,
      timer: 0,
    };
  }

  sectorComplete() {
    if (this.sectorIndex >= SECTORS.length - 1) {
      this.winGame();
      return;
    }
    const rng = mulberry32(Date.now() % 2147483647 + this.credits);
    this.upgradeChoices = shuffle(rng, UPGRADES).slice(0, 3);
    this.state = 'upgrade';
    this.sound.deliver();
  }

  winGame() {
    this.state = 'victory';
    const hullBonus = this.ship.hull >= this.ship.hullMax ? 1 : 0;
    this.stars = this.elapsed < 300 && hullBonus ? 3 : this.elapsed < 480 ? 2 : 1;
    this.sound.victory();
    this.sound.stopMusic();
    this.saveBest();
  }

  loseGame(reason) {
    this.state = 'gameover';
    this.endReason = reason;
    this.sound.gameOver();
    this.sound.stopMusic();
    this.saveBest();
  }

  saveBest() {
    if (this.credits > this.best) {
      this.best = this.credits;
      try {
        window.localStorage.setItem(BEST_KEY, String(this.best));
      } catch (err) { /* storage unavailable */ }
    }
  }

  chooseUpgrade(i) {
    const up = this.upgradeChoices[i];
    if (!up) return;
    up.apply(this.ship);
    this.texts.add(this.ship.x, this.ship.y - 30, up.name + ' INSTALLED', '#3fe0c5');
    this.sound.pickup();
    this.startSector(this.sectorIndex + 1);
    this.state = 'playing';
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.sound.thrustStop();
    } else if (this.state === 'paused') {
      this.state = 'playing';
    }
  }

  toTitle() {
    this.state = 'title';
    this.sound.stopMusic();
    this.sound.thrustStop();
  }

  // ---------------------------------------------------------- damage & scoring

  damage(amount, cause) {
    const ship = this.ship;
    if (ship.invuln > 0 || this.state !== 'playing') return;
    ship.hull -= amount;
    ship.invuln = INVULN_TIME;
    this.combo = 0;
    this.shake = 16;
    this.sound.crash();
    this.particles.burst(ship.x, ship.y, 26, '#ff5a6e', 220);
    this.texts.add(ship.x, ship.y - 26, cause, '#ff5a6e');
    if (ship.hull <= 0) {
      this.particles.burst(ship.x, ship.y, 60, '#ffb347', 320);
      this.loseGame(cause === 'STRANDED' ? 'Out of fuel, drifting in the dark.' : 'Hull breached. Your courier run ends here.');
    }
  }

  deliverCargo() {
    const d = this.delivery;
    const timeBonus = Math.max(0, Math.round(CREDIT_TIME_BONUS * (1 - d.timer / 60)));
    const fuelBonus = Math.round(CREDIT_FUEL_BONUS * (this.ship.fuel / this.ship.fuelMax));
    const comboMul = 1 + this.combo * COMBO_STEP;
    const earned = Math.round((CREDIT_DELIVERY + timeBonus + fuelBonus) * comboMul);
    this.credits += earned;
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.deliveriesDone += 1;
    this.deliveredInSector += 1;
    this.ship.cargo = false;
    this.ship.fuel = this.ship.fuelMax; // the station refuels you on delivery
    this.sound.deliver();
    this.particles.burst(this.ship.x, this.ship.y, 30, '#ffd166', 200);
    this.texts.add(this.ship.x, this.ship.y - 30, `+${earned} CR`, '#ffd166');
    if (this.deliveredInSector >= this.sector.deliveries) {
      this.sectorComplete();
    } else {
      this.nextDelivery();
    }
  }

  // ---------------------------------------------------------- update

  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 30);
    this.particles.update(dt);
    this.texts.update(dt);

    // Click detection: mouse released without a drag.
    const m = this.input.mouse;
    if (this.prevMouseDown && !m.down && !this.slingshot) {
      this.click = { x: m.x, y: m.y };
    } else if (!this.prevMouseDown && m.down) {
      this.click = null;
    }
    this.prevMouseDown = m.down;

    if (this.input.wasPressed('KeyM')) {
      this.muted = !this.muted;
      this.sound.setMuted(this.muted);
    }

    if (this.state === 'title') {
      if (this.input.anyPressed(['Enter', 'Space']) || this.click) {
        this.click = null;
        this.startGame();
      }
      return;
    }
    if (this.state === 'victory' || this.state === 'gameover') {
      if (this.input.anyPressed(['KeyR', 'Enter', 'Space']) || this.click) {
        this.click = null;
        this.startGame();
      }
      if (this.input.wasPressed('Escape')) this.toTitle();
      return;
    }
    if (this.state === 'upgrade') {
      if (this.input.wasPressed('Digit1')) this.chooseUpgrade(0);
      else if (this.input.wasPressed('Digit2')) this.chooseUpgrade(1);
      else if (this.input.wasPressed('Digit3')) this.chooseUpgrade(2);
      else if (this.click) {
        const c = this.click;
        this.click = null;
        for (let i = 0; i < 3; i++) {
          const x = 240 + i * 280;
          if (c.x >= x && c.x <= x + 260 && c.y >= 250 && c.y <= 470) this.chooseUpgrade(i);
        }
      }
      return;
    }
    if (this.state === 'paused') {
      if (this.input.wasPressed('KeyP') || this.input.wasPressed('Escape')) this.togglePause();
      if (this.input.wasPressed('KeyR')) this.startGame();
      return;
    }
    if (this.state !== 'playing') return;

    if (this.input.wasPressed('KeyP') || this.input.wasPressed('Escape')) {
      this.togglePause();
      return;
    }
    if (this.input.wasPressed('KeyR')) {
      this.startGame();
      return;
    }

    this.updatePlaying(dt);
  }

  updatePlaying(dt) {
    const ship = this.ship;
    const input = this.input;
    this.elapsed += dt;
    this.sectorTime += dt;
    ship.invuln = Math.max(0, ship.invuln - dt);

    // --- thrust (keyboard) ---
    let tx = 0;
    let ty = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) ty -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) ty += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) tx -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) tx += 1;
    const thrusting = (tx !== 0 || ty !== 0) && ship.fuel > 0;
    if (thrusting) {
      const len = Math.hypot(tx, ty);
      const ax = (tx / len) * THRUST * ship.thrustMul;
      const ay = (ty / len) * THRUST * ship.thrustMul;
      ship.vx += ax * dt;
      ship.vy += ay * dt;
      ship.angle = Math.atan2(ay, ax);
      ship.fuel = Math.max(0, ship.fuel - FUEL_DRAIN * ship.fuelMul * dt);
      this.sound.ensure();
      this.sound.thrustStart();
      this.particles.exhaust(ship.x - Math.cos(ship.angle) * 16, ship.y - Math.sin(ship.angle) * 16, ship.angle);
    } else {
      this.sound.thrustStop();
    }
    ship.thrusting = thrusting;

    // --- brake ---
    if (input.isDown('Space') && ship.fuel > 0) {
      const speed = Math.hypot(ship.vx, ship.vy);
      if (speed > 1) {
        const f = Math.max(0, 1 - (BRAKE * ship.brakeMul * dt) / speed);
        ship.vx *= f;
        ship.vy *= f;
        ship.fuel = Math.max(0, ship.fuel - FUEL_BRAKE_DRAIN * ship.fuelMul * dt);
      }
    }

    // --- slingshot (mouse drag from the ship, release to launch) ---
    const m = input.mouse;
    if (m.down && !this.slingshot) {
      if (Math.hypot(m.x - ship.x, m.y - ship.y) < 90) {
        this.slingshot = { x: m.x, y: m.y };
      }
    }
    if (this.slingshot && !m.down) {
      const dx = m.x - this.slingshot.x;
      const dy = m.y - this.slingshot.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 14) {
        const power = Math.min(SLINGSHOT_MAX, dist * SLINGSHOT_POWER);
        ship.vx += (-dx / dist) * power;
        ship.vy += (-dy / dist) * power;
        ship.angle = Math.atan2(-dy, -dx);
        this.particles.burst(ship.x, ship.y, 14, '#3fe0c5', 160);
        this.sound.blip(300, 0.15, 'sine', 0.15, 700);
      }
      this.slingshot = null;
    }

    // --- physics ---
    applyGravity(ship, this.sector.planets, dt);
    integrate(ship, dt);
    if (Math.hypot(ship.vx, ship.vy) > 20) {
      ship.angle = Math.atan2(ship.vy, ship.vx);
    }

    // Engine trail.
    this.trail.push({ x: ship.x, y: ship.y });
    if (this.trail.length > 42) this.trail.shift();

    // --- planet collisions ---
    for (const p of this.sector.planets) {
      if (circlesOverlap({ x: ship.x, y: ship.y, r: SHIP_RADIUS }, p)) {
        bounceOffPlanet(ship, p);
        this.damage(1, 'PLANET IMPACT');
      }
    }

    // --- asteroids drift and collide ---
    for (const a of this.sector.asteroids) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot += a.spin * dt;
      if (a.x < -30) a.x = VIEW_W + 30;
      if (a.x > VIEW_W + 30) a.x = -30;
      if (a.y < -30) a.y = VIEW_H + 30;
      if (a.y > VIEW_H + 30) a.y = -30;
      if (circlesOverlap({ x: ship.x, y: ship.y, r: SHIP_RADIUS }, a)) {
        const dx = ship.x - a.x;
        const dy = ship.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        ship.vx = (dx / d) * 240;
        ship.vy = (dy / d) * 240;
        a.vx = -(dx / d) * 60;
        a.vy = -(dy / d) * 60;
        this.damage(1, 'ASTEROID HIT');
      }
    }

    // --- solar flare ---
    this.updateFlare(dt);

    // --- deliveries ---
    const d = this.delivery;
    if (d) {
      d.timer += dt;
      const pickupR = PICKUP_RADIUS * ship.pickupMul;
      const target = d.phase === 'pickup' ? d.pickup : d.dropoff;
      const targetR = d.phase === 'pickup' ? pickupR : DELIVER_RADIUS;
      if (distance(ship, target) < targetR + SHIP_RADIUS) {
        if (d.phase === 'pickup') {
          ship.cargo = true;
          d.phase = 'dropoff';
          d.timer = 0;
          this.sound.pickup();
          this.particles.burst(target.x, target.y, 22, '#ffb347', 180);
          this.texts.add(target.x, target.y - 30, 'CARGO SECURED', '#ffb347');
        } else {
          this.deliverCargo();
        }
      }
    }

    // --- fuel cells ---
    for (const cell of this.sector.fuelCells) {
      if (cell.taken) continue;
      cell.bob += dt;
      if (distance(ship, cell) < 22 + SHIP_RADIUS) {
        cell.taken = true;
        ship.fuel = Math.min(ship.fuelMax, ship.fuel + 30 + ship.cellBonus * 10);
        this.sound.fuelCell();
        this.particles.burst(cell.x, cell.y, 16, '#3fe0c5', 140);
        this.texts.add(cell.x, cell.y - 20, '+FUEL', '#3fe0c5');
      }
    }

    // --- stranded: no fuel and barely moving ---
    const speed = Math.hypot(ship.vx, ship.vy);
    if (ship.fuel <= 0 && speed < 12) {
      this.strandedTimer += dt;
      if (this.strandedTimer > 4) this.damage(99, 'STRANDED');
    } else {
      this.strandedTimer = 0;
    }
  }

  updateFlare(dt) {
    const f = this.flare;
    const sun = this.sector.sun;
    if (f.state === 'idle') {
      f.timer -= dt;
      if (f.timer <= 0) {
        f.state = 'warn';
        f.timer = FLARE_WARN;
        this.sound.alarm();
      }
      return;
    }
    if (f.state === 'warn') {
      f.timer -= dt;
      if (f.timer <= 0) {
        f.state = 'active';
        f.radius = sun.r;
        this.sound.noise(0.8, 0.35, 1200);
      }
      return;
    }
    // active: the ring expands from the sun.
    f.radius += FLARE_SPEED * dt;
    const dist = distance(this.ship, sun);
    if (Math.abs(dist - f.radius) < 30 && this.ship.invuln <= 0) {
      const dx = (this.ship.x - sun.x) / (dist || 1);
      const dy = (this.ship.y - sun.y) / (dist || 1);
      this.ship.vx += dx * 260;
      this.ship.vy += dy * 260;
      this.damage(1, 'SOLAR FLARE');
    }
    if (f.radius > 1700) {
      f.state = 'idle';
      f.timer = this.sector.flareEvery;
      f.radius = 0;
    }
  }

  /** Objective text for the HUD. */
  objectiveText() {
    if (!this.delivery) return '';
    if (this.delivery.phase === 'pickup') return `PICK UP cargo at the ${this.delivery.pickup.name} beacon`;
    return `DELIVER cargo to ${this.delivery.dropoff.name} station`;
  }

  /** Where the HUD arrow should point. */
  objectiveTarget() {
    if (!this.delivery) return null;
    return this.delivery.phase === 'pickup' ? this.delivery.pickup : this.delivery.dropoff;
  }
}
