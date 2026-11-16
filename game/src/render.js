// Orbital Courier — all canvas drawing.
// One job: the world, the HUD and every screen, from the game state.

import { VIEW_W, VIEW_H, COLORS, TOTAL_DELIVERIES, SHIP_RADIUS } from './config.js';
import { mulberry32, range } from './random.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A soft pre-rendered nebula backdrop, made once per game. */
function nebulaBlobs(g) {
  const blobs = [
    [300, 180, 320, COLORS.nebulaA],
    [980, 520, 380, COLORS.nebulaB],
    [1050, 140, 260, COLORS.nebulaC],
    [180, 580, 240, COLORS.nebulaB],
  ];
  for (const [x, y, r, color] of blobs) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** Deterministic starfield, three parallax layers (parallax is visual only). */
function makeStars() {
  const rng = mulberry32(987654321);
  const stars = [];
  for (let i = 0; i < 190; i++) {
    stars.push({
      x: range(rng, 0, VIEW_W),
      y: range(rng, 0, VIEW_H),
      r: range(rng, 0.5, 1.9),
      tw: range(rng, 0, Math.PI * 2),
      layer: i % 3,
    });
  }
  return stars;
}

/**
 * The static backdrop (space gradient + nebula + stars) rendered once into an
 * offscreen canvas, so each frame is one drawImage instead of many gradients.
 */
function backgroundSprite(game) {
  const c = document.createElement('canvas');
  c.width = VIEW_W;
  c.height = VIEW_H;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, COLORS.spaceTop);
  grad.addColorStop(1, COLORS.spaceBottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  nebulaBlobs(g);
  const stars = makeStars();
  game._stars = stars;
  for (const s of stars) {
    g.globalAlpha = 0.5 + s.layer * 0.2;
    g.fillStyle = COLORS.star;
    g.beginPath();
    g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  return c;
}

function drawBackground(ctx, game) {
  if (!game._bg) game._bg = backgroundSprite(game);
  ctx.drawImage(game._bg, 0, 0);
  // A few twinkling stars on top keep the sky alive.
  for (let i = 0; i < game._stars.length; i += 3) {
    const s = game._stars[i];
    const twinkle = 0.55 + 0.45 * Math.sin(game.time * 1.6 + s.tw);
    ctx.globalAlpha = twinkle * 0.7;
    ctx.fillStyle = COLORS.star;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Pre-render one planet (glow, body, bands, ring) to an offscreen sprite. */
function planetSprite(p) {
  const pad = Math.ceil(p.r * 1.6);
  const size = pad * 2;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const cx = pad;
  const cy = pad;
  const glow = g.createRadialGradient(cx, cy, p.r * 0.8, cx, cy, p.r * 1.5);
  glow.addColorStop(0, p.atmo);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.beginPath();
  g.arc(cx, cy, p.r * 1.5, 0, Math.PI * 2);
  g.fill();
  const body = g.createRadialGradient(cx - p.r * 0.35, cy - p.r * 0.35, p.r * 0.1, cx, cy, p.r);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.25, p.color);
  body.addColorStop(1, '#1a1030');
  g.fillStyle = body;
  g.beginPath();
  g.arc(cx, cy, p.r, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.beginPath();
  g.arc(cx, cy, p.r, 0, Math.PI * 2);
  g.clip();
  g.globalAlpha = 0.18;
  g.fillStyle = '#ffffff';
  g.fillRect(cx - p.r, cy - p.r * 0.45, p.r * 2, p.r * 0.22);
  g.fillRect(cx - p.r, cy + p.r * 0.2, p.r * 2, p.r * 0.16);
  g.globalAlpha = 1;
  g.restore();
  if (p.ring) {
    g.save();
    g.translate(cx, cy);
    g.rotate(-0.35);
    g.strokeStyle = 'rgba(230, 220, 255, 0.55)';
    g.lineWidth = 5;
    g.beginPath();
    g.ellipse(0, 0, p.r * 1.55, p.r * 0.42, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }
  return { canvas: c, pad };
}

/** Pre-render the sun's glow to an offscreen sprite. */
function sunSprite(game, warning) {
  const sun = game.sector.sun;
  const pad = Math.ceil(sun.r * 2.4);
  const size = pad * 2;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(pad, pad, 0, pad, pad, sun.r * 2.4);
  grad.addColorStop(0, warning ? 'rgba(255, 90, 90, 0.9)' : 'rgba(255, 220, 120, 0.95)');
  grad.addColorStop(0.4, warning ? 'rgba(255, 60, 40, 0.35)' : 'rgba(255, 170, 60, 0.35)');
  grad.addColorStop(1, 'rgba(255, 120, 40, 0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(pad, pad, sun.r * 2.4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffd76a';
  g.beginPath();
  g.arc(pad, pad, sun.r * 0.62, 0, Math.PI * 2);
  g.fill();
  return { canvas: c, pad };
}

/** Rebuild the sector's sprites when the sector changes. */
function ensureSprites(game) {
  if (game._spriteSector === game.sector) return;
  game._spriteSector = game.sector;
  game._planetSprites = game.sector.planets.map((p) => planetSprite(p));
  game._sunSprite = sunSprite(game, false);
  game._sunSpriteWarn = sunSprite(game, true);
}

function drawSun(ctx, game) {
  ensureSprites(game);
  const sun = game.sector.sun;
  const warning = game.flare.state === 'warn';
  const pulse = warning ? 1 + 0.25 * Math.sin(game.time * 14) : 1;
  const sprite = warning ? game._sunSpriteWarn : game._sunSprite;
  const w = sprite.canvas.width * pulse;
  ctx.drawImage(sprite.canvas, sun.x - w / 2, sun.y - w / 2, w, w);
  ctx.fillStyle = 'rgba(255, 240, 180, 0.9)';
  ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SUN', sun.x, sun.y + sun.r + 18);
}

function drawPlanets(ctx, game) {
  ensureSprites(game);
  game.sector.planets.forEach((p, i) => {
    const sprite = game._planetSprites[i];
    ctx.drawImage(sprite.canvas, p.x - sprite.pad, p.y - sprite.pad);
  });
}

function drawStations(ctx, game) {
  for (const s of game.sector.stations) {
    const spin = game.time * 0.4;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(spin);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * s.r;
      const py = Math.sin(a) * s.r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(10, 16, 40, 0.85)';
    ctx.fill();
    ctx.rotate(-spin);
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Docking lights.
    const blink = 0.5 + 0.5 * Math.sin(game.time * 3 + s.x);
    ctx.fillStyle = s.color;
    ctx.globalAlpha = blink;
    ctx.beginPath();
    ctx.arc(s.x + s.r + 10, s.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Label.
    ctx.fillStyle = COLORS.hud;
    ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.name, s.x, s.y - s.r - 12);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('STATION', s.x, s.y + s.r + 20);
  }
}

function drawBeacons(ctx, game) {
  for (const b of game.sector.beacons) {
    const isTarget = game.delivery && game.delivery.phase === 'pickup' && game.delivery.pickup === b;
    const pulse = 1 + 0.12 * Math.sin(game.time * 4 + b.x);
    ctx.save();
    ctx.translate(b.x, b.y);
    if (isTarget) {
      ctx.strokeStyle = COLORS.amber;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(game.time * 5);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, (b.r + 12) * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(255, 179, 71, 0.18)';
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Cargo crate.
    ctx.fillStyle = COLORS.amber;
    ctx.fillRect(-9, -9, 18, 18);
    ctx.fillStyle = '#7a4a12';
    ctx.fillRect(-9, -3, 18, 3);
    ctx.restore();
    ctx.fillStyle = COLORS.hud;
    ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.name, b.x, b.y - b.r - 10);
  }
}

function drawAsteroids(ctx, game) {
  for (const a of game.sector.asteroids) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);
    ctx.fillStyle = '#8d7f74';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const rr = a.r * (0.8 + ((i * 37) % 10) / 40);
      const px = Math.cos(ang) * rr;
      const py = Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(-a.r * 0.3, -a.r * 0.2, a.r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawFuelCells(ctx, game) {
  for (const cell of game.sector.fuelCells) {
    if (cell.taken) continue;
    const bob = Math.sin(cell.bob) * 4;
    ctx.save();
    ctx.translate(cell.x, cell.y + bob);
    ctx.fillStyle = 'rgba(63, 224, 197, 0.2)';
    ctx.beginPath();
    ctx.arc(0, 0, cell.r + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.teal;
    ctx.fillRect(-4, -9, 8, 18);
    ctx.fillStyle = '#0b3d34';
    ctx.fillRect(-4, -3, 8, 3);
    ctx.restore();
  }
}

function drawShip(ctx, game) {
  const ship = game.ship;
  if (ship.invuln > 0 && Math.floor(game.time * 12) % 2 === 0) return; // blink while protected
  ctx.save();
  ctx.translate(ship.x, ship.y);
  // Engine trail.
  ctx.strokeStyle = 'rgba(63, 224, 197, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < game.trail.length; i++) {
    const t = game.trail[i];
    if (i === 0) ctx.moveTo(t.x - ship.x, t.y - ship.y);
    else ctx.lineTo(t.x - ship.x, t.y - ship.y);
  }
  ctx.stroke();
  ctx.rotate(ship.angle);
  // Engine flame.
  if (ship.thrusting) {
    const flick = 14 + Math.random() * 10;
    ctx.fillStyle = '#ff9a3d';
    ctx.beginPath();
    ctx.moveTo(-12, -5);
    ctx.lineTo(-12 - flick, 0);
    ctx.lineTo(-12, 5);
    ctx.closePath();
    ctx.fill();
  }
  // Hull: a courier dart.
  ctx.fillStyle = '#e8ecff';
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3f6fd1';
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-2, -6);
  ctx.lineTo(-2, 6);
  ctx.closePath();
  ctx.fill();
  // Cockpit.
  ctx.fillStyle = '#0b1030';
  ctx.beginPath();
  ctx.arc(6, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Cargo aboard.
  if (ship.cargo) {
    ctx.fillStyle = COLORS.amber;
    ctx.fillRect(-8, -14, 10, 7);
  }
  ctx.restore();
}

function drawSlingshot(ctx, game) {
  const ship = game.ship;
  const m = game.input.mouse;
  if (!game.slingshot || !m.down) return;
  const dx = m.x - game.slingshot.x;
  const dy = m.y - game.slingshot.y;
  const dist = Math.hypot(dx, dy);
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ship.x, ship.y);
  ctx.lineTo(ship.x - dx, ship.y - dy);
  ctx.stroke();
  ctx.setLineDash([]);
  if (dist > 14) {
    ctx.fillStyle = COLORS.teal;
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RELEASE TO LAUNCH', ship.x - dx * 0.5, ship.y - dy * 0.5 - 12);
  }
  ctx.restore();
}

function drawFlare(ctx, game) {
  const f = game.flare;
  if (f.state === 'warn') {
    ctx.save();
    const text = '⚠ SOLAR FLARE INCOMING — GET CLEAR ⚠';
    ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
    const w = ctx.measureText(text).width + 36;
    ctx.fillStyle = 'rgba(4, 6, 20, 0.72)';
    roundRect(ctx, VIEW_W / 2 - w / 2, 88, w, 40, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 90, 90, 0.6)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, VIEW_W / 2 - w / 2, 88, w, 40, 10);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 60, 60, 0.95)';
    ctx.textAlign = 'center';
    const blink = Math.floor(game.time * 4) % 2 === 0;
    if (blink) ctx.fillText(text, VIEW_W / 2, 116);
    ctx.restore();
    return;
  }
  if (f.state !== 'active') return;
  const sun = game.sector.sun;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 120, 50, 0.85)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(sun.x, sun.y, f.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 200, 90, 0.5)';
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.arc(sun.x, sun.y, f.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawObjectiveGuide(ctx, game) {
  const target = game.objectiveTarget();
  if (!target || game.state !== 'playing') return;
  const ship = game.ship;
  const dx = target.x - ship.x;
  const dy = target.y - ship.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 120) return;
  // Dotted guide line from the ship toward the objective.
  ctx.save();
  ctx.strokeStyle = 'rgba(223, 230, 255, 0.28)';
  ctx.setLineDash([2, 10]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ship.x + (dx / dist) * 30, ship.y + (dy / dist) * 30);
  ctx.lineTo(target.x - (dx / dist) * 30, target.y - (dy / dist) * 30);
  ctx.stroke();
  ctx.setLineDash([]);
  // Distance readout at the midpoint.
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(dist)}m`, (ship.x + target.x) / 2, (ship.y + target.y) / 2 - 8);
  ctx.restore();
}

function drawBar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(ctx, x, y, w, h, 5);
  ctx.fill();
  ctx.fillStyle = color;
  if (frac > 0) {
    roundRect(ctx, x + 2, y + 2, Math.max(4, (w - 4) * Math.max(0, Math.min(1, frac))), h - 4, 4);
    ctx.fill();
  }
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y - 6);
}

function drawHud(ctx, game) {
  const ship = game.ship;
  ctx.save();
  // Top bar.
  ctx.fillStyle = 'rgba(5, 8, 26, 0.72)';
  ctx.fillRect(0, 0, VIEW_W, 64);
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 64.5);
  ctx.lineTo(VIEW_W, 64.5);
  ctx.stroke();

  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`◈ ${game.credits} CR`, 18, 28);
  ctx.font = '13px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  ctx.fillText(`BEST ${game.best} CR`, 18, 50);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(game.sector ? game.sector.name : '', VIEW_W / 2, 26);
  ctx.font = '13px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.amber;
  ctx.fillText(`DELIVERIES ${game.deliveriesDone}/${TOTAL_DELIVERIES}   ·   ${Math.floor(game.elapsed / 60)}:${String(Math.floor(game.elapsed % 60)).padStart(2, '0')}`, VIEW_W / 2, 48);

  // Hull hearts.
  ctx.textAlign = 'right';
  let hearts = '';
  for (let i = 0; i < ship.hullMax; i++) hearts += i < ship.hull ? '♥' : '♡';
  ctx.fillStyle = COLORS.hull;
  ctx.font = '20px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(hearts, VIEW_W - 18, 30);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(game.combo > 1 ? `COMBO ×${(1 + (game.combo - 1) * 0.25).toFixed(2)}` : 'NO COMBO', VIEW_W - 18, 52);

  // Fuel bar, bottom-left.
  drawBar(ctx, 18, VIEW_H - 52, 220, 14, ship.fuel / ship.fuelMax, COLORS.fuel, `FUEL ${Math.ceil(ship.fuel)} / ${ship.fuelMax}`);
  // Objective, bottom-center.
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.title;
  ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(game.objectiveText(), VIEW_W / 2, VIEW_H - 26);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('WASD / arrows thrust · SPACE brake · drag near ship to slingshot · P pause · M mute', VIEW_W / 2, VIEW_H - 8);
  ctx.restore();
}

function drawPanel(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.panel;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 14);
  ctx.stroke();
}

function drawTitle(ctx, game) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 6, 20, 0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.title;
  ctx.font = 'bold 72px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('ORBITAL COURIER', VIEW_W / 2, 170);
  ctx.fillStyle = COLORS.teal;
  ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('— SLINGSHOT THE STARS. DELIVER THE CARGO. —', VIEW_W / 2, 208);

  drawPanel(ctx, 340, 250, 600, 210);
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 17px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('HOW TO FLY', VIEW_W / 2, 282);
  ctx.font = '15px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  const lines = [
    'Pick up cargo at the amber beacon, then deliver it to a station.',
    'Gravity is free: slingshot around planets. Thrusters burn fuel.',
    'Drag near your ship and release to launch. WASD thrusts, SPACE brakes.',
    'Dodge asteroids and solar flares. 12 deliveries across 3 sectors wins.',
    'Finish a sector to pick 1 of 3 upgrades. Chain clean deliveries for combos.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 312 + i * 26));

  const blink = 0.6 + 0.4 * Math.sin(game.time * 3);
  ctx.globalAlpha = blink;
  ctx.fillStyle = COLORS.amber;
  ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('CLICK OR PRESS ENTER TO LAUNCH', VIEW_W / 2, 520);
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '14px "Segoe UI", system-ui, sans-serif';
  if (game.best > 0) ctx.fillText(`BEST RUN: ${game.best} CR`, VIEW_W / 2, 556);
  ctx.fillText('A complete original game · sound on for the full ride (M mutes)', VIEW_W / 2, 582);
  ctx.restore();
}

function drawUpgrade(ctx, game) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 6, 20, 0.62)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.title;
  ctx.font = 'bold 40px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`SECTOR ${game.sectorIndex + 1} COMPLETE`, VIEW_W / 2, 130);
  ctx.fillStyle = COLORS.hud;
  ctx.font = '18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`Deliveries done: ${game.deliveriesDone}/${TOTAL_DELIVERIES}   ·   Credits: ${game.credits}`, VIEW_W / 2, 168);
  ctx.fillStyle = COLORS.teal;
  ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('CHOOSE ONE UPGRADE — click a card or press 1 / 2 / 3', VIEW_W / 2, 212);
  game.upgradeChoices.forEach((up, i) => {
    const x = 240 + i * 280;
    const y = 250;
    const hover = game.input.mouse.x >= x && game.input.mouse.x <= x + 260
      && game.input.mouse.y >= y && game.input.mouse.y <= y + 220;
    ctx.fillStyle = hover ? 'rgba(30, 44, 96, 0.95)' : COLORS.panel;
    roundRect(ctx, x, y, 260, 220, 14);
    ctx.fill();
    ctx.strokeStyle = hover ? COLORS.teal : COLORS.panelEdge;
    ctx.lineWidth = hover ? 2.5 : 1.5;
    roundRect(ctx, x, y, 260, 220, 14);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '44px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(up.icon, x + 130, y + 66);
    ctx.fillStyle = COLORS.title;
    ctx.font = 'bold 19px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(up.name, x + 130, y + 108);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '14px "Segoe UI", system-ui, sans-serif';
    wrapText(ctx, up.desc, x + 130, y + 140, 220, 20);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`[ ${i + 1} ]`, x + 130, y + 200);
  });
  ctx.restore();
}

function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, cx, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, cx, yy);
}

function drawPause(ctx, game) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 6, 20, 0.66)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.title;
  ctx.font = 'bold 52px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, 320);
  ctx.fillStyle = COLORS.hud;
  ctx.font = '18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('P / ESC to resume · R to restart from sector 1', VIEW_W / 2, 364);
  ctx.restore();
}

function drawEnd(ctx, game, victory) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 6, 20, 0.68)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawPanel(ctx, 330, 150, 620, 400);
  ctx.textAlign = 'center';
  if (victory) {
    ctx.fillStyle = COLORS.title;
    ctx.font = 'bold 48px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('ROUTE COMPLETE!', VIEW_W / 2, 222);
    ctx.font = '40px "Segoe UI", system-ui, sans-serif';
    let stars = '';
    for (let i = 0; i < 3; i++) stars += i < game.stars ? '★' : '☆';
    ctx.fillStyle = COLORS.amber;
    ctx.fillText(stars, VIEW_W / 2, 282);
    ctx.fillStyle = COLORS.hud;
    ctx.font = '17px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('All 12 deliveries made. The Drift runs on time again.', VIEW_W / 2, 320);
  } else {
    ctx.fillStyle = COLORS.danger;
    ctx.font = 'bold 48px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('RUN OVER', VIEW_W / 2, 222);
    ctx.fillStyle = COLORS.hud;
    ctx.font = '17px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(game.endReason, VIEW_W / 2, 272);
    ctx.fillText(`You delivered ${game.deliveriesDone} of ${TOTAL_DELIVERIES} parcels.`, VIEW_W / 2, 306);
  }
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
  const mins = Math.floor(game.elapsed / 60);
  const secs = String(Math.floor(game.elapsed % 60)).padStart(2, '0');
  ctx.fillText(`CREDITS  ${game.credits}    ·    TIME  ${mins}:${secs}    ·    BEST COMBO ×${game.bestCombo}`, VIEW_W / 2, 380);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`BEST RUN: ${game.best} CR`, VIEW_W / 2, 414);
  const blink = 0.6 + 0.4 * Math.sin(game.time * 3);
  ctx.globalAlpha = blink;
  ctx.fillStyle = COLORS.amber;
  ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('PRESS R OR CLICK TO FLY AGAIN · ESC FOR TITLE', VIEW_W / 2, 486);
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Draw one frame for the current state. */
export function drawGame(ctx, game) {
  ctx.save();
  if (game.shake > 0) {
    ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
  }
  drawBackground(ctx, game);
  if (game.sector) {
    drawSun(ctx, game);
    drawPlanets(ctx, game);
    drawStations(ctx, game);
    drawBeacons(ctx, game);
    drawAsteroids(ctx, game);
    drawFuelCells(ctx, game);
    drawFlare(ctx, game);
    drawObjectiveGuide(ctx, game);
    if (game.state !== 'title') drawShip(ctx, game);
    game.particles.draw(ctx);
    game.texts.draw(ctx);
    drawSlingshot(ctx, game);
  }
  ctx.restore();

  if (game.state === 'title') drawTitle(ctx, game);
  else if (game.state === 'upgrade') drawUpgrade(ctx, game);
  else if (game.state === 'paused') {
    drawHud(ctx, game);
    drawPause(ctx, game);
  } else if (game.state === 'victory') drawEnd(ctx, game, true);
  else if (game.state === 'gameover') drawEnd(ctx, game, false);
  else drawHud(ctx, game);
}
