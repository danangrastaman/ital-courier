// Orbital Courier — particles and floating score text.
// One job: short-lived visual feedback for every event.

export class Particles {
  constructor() {
    this.list = [];
  }

  spawn(x, y, vx, vy, life, size, color) {
    this.list.push({ x, y, vx, vy, life, maxLife: life, size, color });
  }

  /** A radial burst of sparks. */
  burst(x, y, count, color, speed) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (speed || 140) * (0.3 + Math.random() * 0.7);
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.5 + Math.random() * 0.5, 2 + Math.random() * 3, color);
    }
  }

  /** A soft engine exhaust puff behind the ship. */
  exhaust(x, y, angle) {
    const spread = 0.5;
    const a = angle + Math.PI + (Math.random() - 0.5) * spread;
    const s = 60 + Math.random() * 60;
    this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.3 + Math.random() * 0.25, 2 + Math.random() * 2, '#ffb347');
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 1.6 * dt;
      p.vy *= 1 - 1.6 * dt;
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

export class FloatTexts {
  constructor() {
    this.list = [];
  }

  add(x, y, text, color) {
    this.list.push({ x, y, text, color: color || '#ffe9b0', life: 1.4 });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      t.life -= dt;
      t.y -= 28 * dt;
      if (t.life <= 0) this.list.splice(i, 1);
    }
  }

  draw(ctx) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px "Segoe UI", system-ui, sans-serif';
    for (const t of this.list) {
      ctx.globalAlpha = Math.min(1, t.life / 0.6);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
