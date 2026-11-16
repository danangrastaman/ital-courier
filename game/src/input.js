// Orbital Courier — keyboard and mouse input.
// One job: turn browser events into a clean per-frame input state.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered: cleared each frame by the game
    this.mouse = { x: 0, y: 0, down: false, dragStart: null, dragging: false };
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
      this.mouse.dragging = false;
      this.mouse.dragStart = null;
    });

    canvas.addEventListener('mousedown', (e) => {
      const p = this.toLogical(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.down = true;
      this.mouse.dragStart = { x: p.x, y: p.y };
      this.mouse.dragging = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      const p = this.toLogical(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      if (this.mouse.down && this.mouse.dragStart) {
        const d = Math.hypot(p.x - this.mouse.dragStart.x, p.y - this.mouse.dragStart.y);
        if (d > 8) this.mouse.dragging = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      const p = this.toLogical(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.down = false;
      this.mouse.dragging = false;
      this.mouse.dragStart = null;
    });
  }

  /** Tell the input how the canvas is scaled on screen (for mouse mapping). */
  setViewport(scale, offsetX, offsetY) {
    this.scale = scale;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
  }

  toLogical(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.offsetX) / this.scale,
      y: (clientY - rect.top - this.offsetY) / this.scale,
    };
  }

  isDown(code) {
    return this.keys.has(code);
  }

  /** True only on the frame the key went down. */
  wasPressed(code) {
    return this.pressed.has(code);
  }

  /** True when any of the given codes was pressed this frame. */
  anyPressed(codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  /** Clear edge-triggered presses; called once per frame after update. */
  endFrame() {
    this.pressed.clear();
  }

  /** Was the mouse clicked (pressed and released) near a point? */
  clickedAt(x, y, radius) {
    return !this.mouse.down && this.mouse.x >= x - radius && this.mouse.x <= x + radius
      && this.mouse.y >= y - radius && this.mouse.y <= y + radius;
  }
}
