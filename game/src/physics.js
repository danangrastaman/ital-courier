// Orbital Courier — movement physics.
// One job: gravity, integration, bounces and circle collisions.

import { GRAVITY, MAX_SPEED, DRAG, BOUNCE, VIEW_W, VIEW_H } from './config.js';

/** Pull the ship toward every planet, scaled by mass over distance squared. */
export function applyGravity(ship, planets, dt) {
  for (const p of planets) {
    const dx = p.x - ship.x;
    const dy = p.y - ship.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq) || 1;
    const pull = (GRAVITY * p.mass) / Math.max(distSq, p.r * p.r * 0.9);
    ship.vx += (dx / dist) * pull * dt;
    ship.vy += (dy / dist) * pull * dt;
  }
}

/** Move the ship, apply drag, clamp speed, and bounce softly off the world edges. */
export function integrate(ship, dt) {
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
  const dragFactor = Math.max(0, 1 - DRAG * dt);
  ship.vx *= dragFactor;
  ship.vy *= dragFactor;
  const speed = Math.hypot(ship.vx, ship.vy);
  if (speed > MAX_SPEED) {
    ship.vx = (ship.vx / speed) * MAX_SPEED;
    ship.vy = (ship.vy / speed) * MAX_SPEED;
  }
  const m = 16; // margin: the ship's nose
  if (ship.x < m) { ship.x = m; ship.vx = Math.abs(ship.vx) * BOUNCE; }
  if (ship.x > VIEW_W - m) { ship.x = VIEW_W - m; ship.vx = -Math.abs(ship.vx) * BOUNCE; }
  if (ship.y < m) { ship.y = m; ship.vy = Math.abs(ship.vy) * BOUNCE; }
  if (ship.y > VIEW_H - m) { ship.y = VIEW_H - m; ship.vy = -Math.abs(ship.vy) * BOUNCE; }
}

/** True when two circles overlap. */
export function circlesOverlap(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.r + b.r;
  return dx * dx + dy * dy < r * r;
}

/**
 * Bounce the ship off a planet: reflect the velocity around the surface
 * normal and push the ship out so it does not stick.
 */
export function bounceOffPlanet(ship, planet) {
  const dx = ship.x - planet.x;
  const dy = ship.y - planet.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  const dot = ship.vx * nx + ship.vy * ny;
  if (dot < 0) {
    ship.vx -= 2 * dot * nx;
    ship.vy -= 2 * dot * ny;
    ship.vx *= BOUNCE;
    ship.vy *= BOUNCE;
  }
  const minDist = planet.r + 14;
  ship.x = planet.x + nx * minDist;
  ship.y = planet.y + ny * minDist;
}

/** Distance between two points. */
export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
