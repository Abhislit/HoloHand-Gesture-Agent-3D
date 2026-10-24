// Dr. Strange sling-ring portal.
//  - CircleDetector: watches a palm path and fires when the hand draws a closed loop.
//  - Portal: draws the orange spark ring, mandala runes and dark void on its own canvas that sits
//    BEHIND the 3D model (and behind the hand skeleton) but above the camera feed.
import { clamp } from './utils.js';

const TAU = Math.PI * 2;

export class CircleDetector {
  constructor() {
    this.pts = [];
  }
  reset() {
    this.pts.length = 0;
  }
  push(x, y, t) {
    const last = this.pts[this.pts.length - 1];
    if (last && Math.hypot(x - last.x, y - last.y) < 2) return null; // ignore jitter
    this.pts.push({ x, y, t });
    while (this.pts.length && t - this.pts[0].t > 1.6) this.pts.shift();
    return this.check();
  }
  /** centroid, radius stats and unwrapped sweep of the current palm path */
  measure() {
    const p = this.pts;
    if (p.length < 6) return null;
    let cx = 0, cy = 0;
    for (const q of p) {
      cx += q.x;
      cy += q.y;
    }
    cx /= p.length;
    cy /= p.length;
    const rs = p.map((q) => Math.hypot(q.x - cx, q.y - cy));
    const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
    const sd = Math.sqrt(rs.reduce((a, r) => a + (r - mean) ** 2, 0) / rs.length);
    let total = 0;
    let prev = Math.atan2(p[0].y - cy, p[0].x - cx);
    for (let i = 1; i < p.length; i++) {
      const a = Math.atan2(p[i].y - cy, p[i].x - cx);
      let d = a - prev;
      if (d > Math.PI) d -= TAU;
      if (d < -Math.PI) d += TAU;
      total += d;
      prev = a;
    }
    return { cx, cy, mean, sd, total };
  }
  /** 0..1 how far the hand has swept round the circle, for the live preview */
  progress() {
    const m = this.measure();
    return m ? clamp(Math.abs(m.total) / 5, 0, 1) : 0;
  }
  check() {
    const m = this.measure();
    if (!m || this.pts.length < 12) return null;
    if (m.mean < 42) return null;
    if (m.sd / m.mean > 0.42) return null; // not round enough
    if (Math.abs(m.total) < 5.0) return null; // ~290 degrees
    return { x: m.cx, y: m.cy, r: m.mean };
  }
}

// Sling-ring twist: the wrist rolls in place to open the portal.
// Drift keeps re-anchoring, so swinging the whole arm never counts as a twist.
export class TwistDetector {
  constructor() {
    this.reset();
  }
  reset() {
    this.sum = 0;
    this.anchor = null;
    this.active = 0;
    this.cool = 0;
  }
  /** roll: per-frame wrist roll (rad), palm: viewport px, t: seconds */
  push(roll, palm, t) {
    if (t < this.cool) return null;
    if (!this.anchor && palm) this.anchor = { x: palm.x, y: palm.y };
    const drift = this.anchor && palm ? Math.hypot(palm.x - this.anchor.x, palm.y - this.anchor.y) : 0;
    if (drift > 48) {
      this.sum = 0;
      this.anchor = palm ? { x: palm.x, y: palm.y } : null;
      return null;
    }
    if (Math.abs(roll) > 0.01) this.active = t;
    else if (t - this.active > 0.5) this.sum *= 0.9; // stalled: fade the sigil out
    if (Math.abs(this.sum) < 0.015) this.sum = 0;
    this.sum += roll;
    if (Math.abs(this.sum) >= 2.6) {
      const dir = Math.sign(this.sum);
      this.reset();
      this.cool = t + 1.2;
      return { dir };
    }
    return null;
  }
  /** 0..1 how far the wrist has rolled, for the sigil on the hand */
  progress() {
    return clamp(Math.abs(this.sum) / 2.6, 0, 1);
  }
}

export class Portal {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = 1;
    this.H = 1;
    this.DPR = 1;
    this.cx = 0;
    this.cy = 0;
    this.tx = 0; // centre the ring eases toward (the hand)
    this.ty = 0;
    this.preview = 0; // 0..1 ring forming under the hand while it circles
    this.R = 0; // target radius (eased toward Rt)
    this.Rt = 0;
    this.tilt = 0; // ring tilt, radians, eased toward tiltT
    this.tiltT = 0;
    this.k = 0; // 0 closed .. 1 fully open (eased)
    this.want = 0; // 1 opening, 0 closing
    this.rot = 0;
    this.sparks = [];
    this.time = 0;
  }
  get isOpen() {
    return this.want === 1;
  }
  get visible() {
    return this.k > 0.002 || this.sparks.length > 0 || this.preview > 0.01;
  }
  resize(W, H, DPR) {
    this.W = W;
    this.H = H;
    this.DPR = DPR;
    this.canvas.width = W * DPR;
    this.canvas.height = H * DPR;
  }
  open(x, y, r) {
    const minSide = Math.min(this.W, this.H);
    this.cx = x;
    this.cy = y;
    this.tx = x;
    this.ty = y;
    this.preview = 0;
    this.Rt = clamp(r > 0 ? r : minSide * 0.3, minSide * 0.16, minSide * 0.46);
    this.R = this.Rt;
    this.want = 1;
    this.burst(x, y, this.R * 0.6, 90);
  }
  close() {
    if (this.want) this.burst(this.cx, this.cy, this.R * 0.9, 60);
    this.want = 0;
  }
  toggle(x, y, r) {
    this.isOpen ? this.close() : this.open(x, y, r);
  }
  /** keep the ring centred on the hand; r > 0 also tracks the hand's size */
  follow(x, y, r) {
    this.tx = x;
    this.ty = y;
    this.preview = 0;
    if (r > 0) this.sizeTo(r);
  }
  /** show the ring forming under the hand; p is 0..1 sweep progress */
  aim(x, y, p, r) {
    this.tx = x;
    this.ty = y;
    this.preview = p;
    if (r > 0) this.sizeTo(r);
  }
  /** tilt the ring with the wrist, radians */
  tiltTo(a) {
    this.tiltT = clamp(a, -1, 1);
  }
  sizeTo(r) {
    const minSide = Math.min(this.W, this.H);
    this.Rt = clamp(r, minSide * 0.16, minSide * 0.46);
  }
  stop() {
    this.preview = 0;
  }

  /** small spray of sparks, used for the spell trail and the opening burst */
  emit(x, y, n = 3, speed = 160) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = speed * (0.3 + Math.random() * 0.9);
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: 0, max: 0.35 + Math.random() * 0.5, size: 1 + Math.random() * 1.8 });
    }
    if (this.sparks.length > 900) this.sparks.splice(0, this.sparks.length - 900);
  }
  burst(x, y, radius, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      this.emit(x + Math.cos(a) * radius, y + Math.sin(a) * radius, 1, 260);
    }
  }

  update(dt) {
    this.time += dt;
    const follow = Math.min(1, dt * 14);
    this.cx += (this.tx - this.cx) * follow;
    this.cy += (this.ty - this.cy) * follow;
    this.R += (this.Rt - this.R) * follow;
    this.tilt += (this.tiltT - this.tilt) * follow;
    const speed = this.want ? 2.1 : 3.2;
    this.k = clamp(this.k + (this.want ? 1 : -1) * dt * speed, 0, 1);
    this.rot += dt * (0.9 + this.k * 0.6);

    // ring throws sparks off tangentially, like the film
    if (this.k > 0.05) {
      const n = Math.round(10 * this.k + 2);
      const r = this.R * this.ease(this.k);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const tx = -Math.sin(a), ty = Math.cos(a);
        const out = 40 + Math.random() * 120;
        const sp = 90 + Math.random() * 190;
        this.sparks.push({
          x: this.cx + Math.cos(a) * r * (0.99 + Math.random() * 0.03),
          y: this.cy + Math.sin(a) * r * (0.99 + Math.random() * 0.03),
          vx: tx * sp + Math.cos(a) * out,
          vy: ty * sp + Math.sin(a) * out + 30,
          life: 0,
          max: 0.35 + Math.random() * 0.75,
          size: 0.8 + Math.random() * 2,
        });
      }
      if (this.sparks.length > 900) this.sparks.splice(0, this.sparks.length - 900);
    }
    for (const s of this.sparks) {
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 1 - 1.4 * dt;
      s.vy = s.vy * (1 - 1.4 * dt) + 120 * dt; // gentle gravity
    }
    this.sparks = this.sparks.filter((s) => s.life < s.max);
  }

  ease(k) {
    // easeOutBack: slight overshoot as the portal snaps open
    const c1 = 1.4, c3 = c1 + 1;
    return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
  }

  draw() {
    const { ctx, W, H, DPR } = this;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!this.visible) return;

    // tilt the whole mark with the wrist; sparks stay in world space
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(this.tilt);
    ctx.translate(-this.cx, -this.cy);

    // live mark under the hand while the circle is being drawn
    if (this.preview > 0.01 && this.k < 0.5) {
      const rr = Math.min(this.W, this.H) * (0.1 + 0.08 * this.preview);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + 0.55 * this.preview;
      ctx.strokeStyle = 'rgba(255, 165, 45, 0.95)';
      ctx.shadowColor = 'rgba(255, 140, 20, 1)';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, rr, -Math.PI / 2, -Math.PI / 2 + TAU * this.preview);
      ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(255, 220, 150, 0.9)';
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, 2.6, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    if (this.k > 0.002) {
      const r = this.R * Math.max(0, this.ease(this.k));
      const a = clamp(this.k * 1.6, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;

      // the void inside the portal: dark centre, ember-coloured rim
      const g = ctx.createRadialGradient(this.cx, this.cy, r * 0.05, this.cx, this.cy, r);
      g.addColorStop(0, 'rgba(8, 4, 2, 0.88)');
      g.addColorStop(0.72, 'rgba(26, 10, 3, 0.8)');
      g.addColorStop(1, 'rgba(255, 130, 20, 0.35)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, r, 0, TAU);
      ctx.fill();

      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      // outer glow halo
      ctx.shadowColor = 'rgba(255, 140, 20, 1)';
      ctx.shadowBlur = 34;
      ctx.strokeStyle = 'rgba(255, 150, 30, 0.95)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, r, 0, TAU);
      ctx.stroke();
      ctx.shadowBlur = 14;
      ctx.strokeStyle = 'rgba(255, 230, 150, 0.95)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, r, 0, TAU);
      ctx.stroke();

      // spinning dashed mandala rings
      const rings = [
        { f: 0.9, w: 2, dash: [26, 14], dir: 1, sp: 1.0 },
        { f: 0.78, w: 1.6, dash: [4, 10], dir: -1, sp: 1.6 },
        { f: 0.62, w: 2.4, dash: [60, 22, 6, 22], dir: 1, sp: 0.7 },
      ];
      ctx.shadowBlur = 10;
      ctx.strokeStyle = 'rgba(255, 170, 60, 0.85)';
      for (const rg of rings) {
        ctx.lineWidth = rg.w;
        ctx.setLineDash(rg.dash);
        ctx.lineDashOffset = -this.rot * 60 * rg.dir * rg.sp;
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, r * rg.f, 0, TAU);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // rotating square + triangle sigils (the Eye of Agamotto / Vishanti feel)
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(255, 190, 90, 0.7)';
      this.poly(4, r * 0.7, this.rot * 0.5);
      this.poly(4, r * 0.7, this.rot * 0.5 + Math.PI / 4);
      ctx.strokeStyle = 'rgba(255, 150, 40, 0.6)';
      this.poly(3, r * 0.5, -this.rot * 0.8);
      ctx.restore();
    }

    ctx.restore(); // end tilt

    // sparks
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.sparks) {
      const t = s.life / s.max;
      const al = 1 - t;
      ctx.fillStyle = `rgba(255, ${Math.round(210 - 120 * t)}, ${Math.round(80 - 60 * t)}, ${al})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * (1 - t * 0.5), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  poly(n, r, rot) {
    const { ctx } = this;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = rot + (i / n) * TAU;
      const x = this.cx + Math.cos(a) * r, y = this.cy + Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
}
