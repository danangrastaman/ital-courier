// Orbital Courier — sector layouts.
// One job: build each sector's planets, stations, beacons and hazards.

import { SECTORS, VIEW_W, VIEW_H, ASTEROID_MIN_R, ASTEROID_MAX_R } from './config.js';
import { range, rangeInt, pick, shuffle } from './random.js';

const PLANET_COLORS = [
  { body: '#c96f3f', atmo: 'rgba(255, 150, 80, 0.35)', ring: true },
  { body: '#4f7ec2', atmo: 'rgba(90, 160, 255, 0.35)', ring: false },
  { body: '#7a5fb0', atmo: 'rgba(170, 130, 255, 0.35)', ring: false },
  { body: '#3f9e7a', atmo: 'rgba(80, 220, 170, 0.30)', ring: true },
  { body: '#b04f6e', atmo: 'rgba(255, 110, 150, 0.30)', ring: false },
];

const STATION_NAMES = ['HAVEN', 'WAYPOINT', 'ANCHOR', 'LANTERN', 'OUTPOST', 'HARBOUR'];
const BEACON_NAMES = ['CARGO', 'SUPPLY', 'PARCEL', 'CRATE'];

/** Keep two circles apart by at least `gap` pixels. */
function farEnough(x, y, placed, gap) {
  for (const p of placed) {
    if (Math.hypot(x - p.x, y - p.y) < gap + p.r) return false;
  }
  return true;
}

/**
 * Build one sector: a sun at a corner, planets with gravity, two stations,
 * cargo beacons, drifting asteroids and a few fuel cells.
 */
export function buildSector(index, rng) {
  const def = SECTORS[index];
  const placed = [];
  const planets = [];
  const colors = shuffle(rng, PLANET_COLORS);
  for (let i = 0; i < def.planets; i++) {
    let x = 0;
    let y = 0;
    let r = 0;
    for (let tries = 0; tries < 60; tries++) {
      r = range(rng, 42, 78);
      x = range(rng, 170, VIEW_W - 170);
      y = range(rng, 150, VIEW_H - 130);
      if (farEnough(x, y, placed, 150)) break;
    }
    const color = colors[i % colors.length];
    planets.push({ x, y, r, mass: r * r * 0.055, color: color.body, atmo: color.atmo, ring: color.ring });
    placed.push({ x, y, r });
  }

  // The sun sits in a corner so its flare ring sweeps the whole sector.
  const sun = { x: pick(rng, [70, VIEW_W - 70]), y: pick(rng, [70, VIEW_H - 70]), r: 46 };

  const stations = [];
  const stationNames = shuffle(rng, STATION_NAMES);
  for (let i = 0; i < 2; i++) {
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 60; tries++) {
      x = range(rng, 110, VIEW_W - 110);
      y = range(rng, 110, VIEW_H - 110);
      if (farEnough(x, y, placed, 120)) break;
    }
    stations.push({ x, y, r: 34, name: stationNames[i], color: i === 0 ? '#3fe0c5' : '#ffd166' });
    placed.push({ x, y, r: 34 });
  }

  const beacons = [];
  for (let i = 0; i < 3; i++) {
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 60; tries++) {
      x = range(rng, 90, VIEW_W - 90);
      y = range(rng, 90, VIEW_H - 90);
      if (farEnough(x, y, placed, 90)) break;
    }
    beacons.push({ x, y, r: 26, name: BEACON_NAMES[i % BEACON_NAMES.length] });
    placed.push({ x, y, r: 26 });
  }

  const asteroids = [];
  for (let i = 0; i < def.asteroids; i++) {
    const angle = range(rng, 0, Math.PI * 2);
    const speed = range(rng, 12, 42);
    asteroids.push({
      x: range(rng, 60, VIEW_W - 60),
      y: range(rng, 60, VIEW_H - 60),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: range(rng, ASTEROID_MIN_R, ASTEROID_MAX_R),
      rot: range(rng, 0, Math.PI * 2),
      spin: range(rng, -0.8, 0.8),
    });
  }

  const fuelCells = [];
  for (let i = 0; i < 3; i++) {
    fuelCells.push({
      x: range(rng, 80, VIEW_W - 80),
      y: range(rng, 80, VIEW_H - 80),
      r: 14,
      taken: false,
      bob: range(rng, 0, Math.PI * 2),
    });
  }

  return {
    index,
    name: def.name,
    deliveries: def.deliveries,
    flareEvery: def.flareEvery,
    sun,
    planets,
    stations,
    beacons,
    asteroids,
    fuelCells,
  };
}

/** A fresh ship at the sector's start, docked beside the first station. */
export function spawnShip(sector, ship) {
  const s = sector.stations[0];
  ship.x = s.x + s.r + 60;
  ship.y = s.y;
  ship.vx = 0;
  ship.vy = 0;
  ship.angle = 0;
  ship.invuln = 0;
  ship.cargo = false;
}
