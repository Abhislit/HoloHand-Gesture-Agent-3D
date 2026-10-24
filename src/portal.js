import { clamp, angleDelta, damp } from './utils.js';

const TAU = Math.PI * 2;
const SPIN_NEED = TAU;

export class Portal {
  constructor() {
    this.open = 0;
    this.armed = false;
    this.cx = 0.5;
    this.cy = 0.5;
    this.r = 0.3;
    this.hands = new Map();
  }

  update(hands, dt) {
    const live = hands.filter((h) => !h.held).slice(0, 2);
    const both = live.length === 2 && live.every((h) => h.gesture === 'OPEN');
    const seen = new Set();
    let spin = 0;

    for (const h of live) {
      seen.add(h.id);
      let s = this.hands.get(h.id);
      if (!s) {
        s = { ax: h.palm.x, ay: h.palm.y, ang: null, spin: 0 };
        this.hands.set(h.id, s);
      }
      const k = 1 - Math.exp(-1.4 * dt);
      s.ax += (h.palm.x - s.ax) * k;
      s.ay += (h.palm.y - s.ay) * k;
      const dx = h.palm.x - s.ax;
      const dy = h.palm.y - s.ay;
      if (both && Math.hypot(dx, dy) > 0.02) {
        const ang = Math.atan2(dy, dx);
        if (s.ang !== null) s.spin = s.spin * Math.exp(-1.4 * dt) + Math.abs(angleDelta(s.ang, ang));
        s.ang = ang;
      } else {
        s.ang = null;
        s.spin *= Math.exp(-2.5 * dt);
      }
      spin += s.spin;
    }
    for (const id of this.hands.keys()) if (!seen.has(id)) this.hands.delete(id);

    if (both && spin >= SPIN_NEED) this.armed = true;
    if (!both) this.armed = false;
    this.open = damp(this.open, this.armed ? 1 : 0, this.armed ? 10 : 3.2, dt);

    if (live.length >= 2) {
      const a = live[0].palm;
      const b = live[1].palm;
      this.cx = damp(this.cx, clamp((a.x + b.x) / 2, 0.18, 0.82), 8, dt);
      this.cy = damp(this.cy, clamp((a.y + b.y) / 2, 0.15, 0.85), 8, dt);
      this.r = damp(this.r, clamp(Math.hypot(a.x - b.x, a.y - b.y) * 1.6, 0.2, 0.62), 8, dt);
    }
  }

  draw(ctx, t, W, H) {
    const o = this.open;
    if (o < 0.01) return;
    const R = this.r * Math.min(W, H) * (0.86 + 0.14 * o) * o;
    const a = Math.min(1, o);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(this.cx * W, this.cy * H);

    const g = ctx.createRadialGradient(0, 0, R * 0.15, 0, 0, R);
    g.addColorStop(0, 'rgba(70,30,120,0)');
    g.addColorStop(0.72, `rgba(120,60,210,${0.16 * a})`);
    g.addColorStop(0.94, `rgba(255,190,90,${0.5 * a})`);
    g.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.fill();

    ctx.shadowColor = `rgba(255,170,60,${0.95 * a})`;
    ctx.shadowBlur = 24 + 10 * Math.sin(t * 6);
    ctx.strokeStyle = `rgba(255,196,96,${a})`;
    ctx.lineWidth = Math.max(2, R * 0.03);
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const n = 54;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + t * (0.6 + (i % 7) * 0.05) + Math.sin(i * 12.9) * 0.4;
      const rr = R * (0.97 + 0.05 * Math.sin(i * 3.7 + t * 2));
      ctx.fillStyle = `rgba(255,${180 + (i % 3) * 25},110,${a * (0.5 + 0.5 * Math.sin(i * 5.3 + t * 4))})`;
      ctx.beginPath();
      ctx.arc(Math.cos(ang) * rr, Math.sin(ang) * rr, 1.2 + 1.6 * Math.abs(Math.sin(i * 2.1 + t * 3)), 0, TAU);
      ctx.fill();
    }

    ctx.strokeStyle = `rgba(255,240,200,${0.55 * a})`;
    ctx.lineWidth = Math.max(1, R * 0.012);
    for (const off of [0, Math.PI]) {
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.9, t * 1.4 + off, t * 1.4 + off + 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }
}
