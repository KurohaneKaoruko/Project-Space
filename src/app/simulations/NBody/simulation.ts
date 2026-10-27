export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  radius: number;
  hue: number;
}

export interface NBodyParams {
  /** 引力常数倍率 */
  g: number;
  /** 时间流速倍率 */
  speed: number;
  /** 软化长度（防近距奇点，px） */
  softening: number;
  /** 轨迹持续度 0~1（1 ≈ 几乎不消散） */
  trail: number;
  /** 碰撞并合（动量守恒） */
  merge: boolean;
}

export interface NBodyStats {
  bodies: number;
  time: number;
  ke: number;
  collisions: number;
}

export const NBODY_DEFAULTS: NBodyParams = {
  g: 1,
  speed: 1,
  softening: 16,
  trail: 0.85,
  merge: true,
};

/** 每帧基础时间步（速度 Verlet 要求步长小于最内圈周期的 1/20 才能长期稳定） */
const BASE_DT = 0.55;

/** 质量 → 半径（体积≈质量） */
export function radiusForMass(mass: number): number {
  return 2.4 + Math.cbrt(mass) * 1.05;
}

/** 质量 → 色相：轻质量青色 → 重质量橙红 */
export function hueForMass(mass: number): number {
  return 195 - Math.min(170, Math.log10(mass + 1) * 52);
}

/**
 * N 体引力模拟：半隐式欧拉积分 + Plummer 软化；
 * 轨迹用独立离屏画布 destination-out 逐渐擦除实现拖尾。
 */
export class NBodySim {
  bodies: Body[] = [];
  time = 0;
  collisions = 0;
  running = false;
  params: NBodyParams = { ...NBODY_DEFAULTS };
  /** 指针发射预览（页面注入，渲染时画瞄准线） */
  aim: { x1: number; y1: number; x2: number; y2: number; mass: number } | null = null;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private trail: HTMLCanvasElement;
  private trailCtx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private raf = 0;
  private lastEmit = 0;
  private onFrameCb: ((s: NBodyStats) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.trail = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const tctx = this.trail.getContext('2d');
    if (!ctx || !tctx) throw new Error('canvas 2d context unavailable');
    this.ctx = ctx;
    this.trailCtx = tctx;
  }

  setOnFrame(cb: ((s: NBodyStats) => void) | null) {
    this.onFrameCb = cb;
  }

  resize(w: number, h: number) {
    const dpr = window.devicePixelRatio || 1;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.trail.width = this.canvas.width;
    this.trail.height = this.canvas.height;
    this.trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.clearTrail();
  }

  clearTrail() {
    this.trailCtx.clearRect(0, 0, this.w, this.h);
  }

  setParams(p: Partial<NBodyParams>) {
    this.params = { ...this.params, ...p };
  }

  clear() {
    this.bodies = [];
    this.time = 0;
    this.collisions = 0;
    this.clearTrail();
    this.emitNow();
  }

  addBody(x: number, y: number, vx: number, vy: number, mass: number, hue = hueForMass(mass)) {
    this.bodies.push({ x, y, vx, vy, mass, radius: radiusForMass(mass), hue });
  }

  /** 绕 (cx,cy) 处 centerMass 的圆轨道切向速度 */
  private circularVelocity(cx: number, cy: number, centerMass: number, x: number, y: number, dir = 1) {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.hypot(dx, dy) || 1;
    const v = (Math.sqrt((this.params.g * centerMass) / r) || 0) * dir;
    return { vx: (-dy / r) * v, vy: (dx / r) * v };
  }

  /* ---------------- 预设场景 ---------------- */

  presetSolar() {
    this.clear();
    const cx = this.w / 2;
    const cy = this.h / 2;
    const M = 5000;
    this.addBody(cx, cy, 0, 0, M, 48);
    const radii = [70, 110, 155, 205, 265, 330];
    radii.forEach((r, i) => {
      const a = Math.random() * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const v = this.circularVelocity(cx, cy, M, x, y, i % 3 === 2 ? -1 : 1);
      this.addBody(x, y, v.vx, v.vy, 8 + i * 7, 200 + i * 14);
    });
    // 大偏心率彗星：远点切向速度只给 0.42 倍圆轨道速度
    const a = -Math.PI / 3;
    const x = cx + Math.cos(a) * 360;
    const y = cy + Math.sin(a) * 360;
    const v = this.circularVelocity(cx, cy, M, x, y, 1);
    this.addBody(x, y, v.vx * 0.42, v.vy * 0.42, 5, 320);
  }

  presetBinary() {
    this.clear();
    const cx = this.w / 2;
    const cy = this.h / 2;
    const d = 190;
    const m1 = 3000;
    const m2 = 3000;
    const vRel = Math.sqrt((this.params.g * (m1 + m2)) / d);
    const v1 = (vRel * m2) / (m1 + m2);
    const v2 = (vRel * m1) / (m1 + m2);
    this.addBody(cx - d / 2, cy, 0, -v1, m1, 15);
    this.addBody(cx + d / 2, cy, 0, v2, m2, 205);
    [300, 380].forEach((r, i) => {
      const x = cx + r;
      const y = cy;
      const v = this.circularVelocity(cx, cy, m1 + m2, x, y, 1);
      this.addBody(x, y, v.vx, v.vy, 10 + i * 10, 160 + i * 40);
    });
  }

  presetGalaxies() {
    this.clear();
    const mk = (cx: number, cy: number, dvx: number, dvy: number, hue: number) => {
      const core = 3600;
      this.addBody(cx, cy, dvx, dvy, core, hue);
      for (let i = 0; i < 110; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const r = 26 + Math.sqrt(Math.random()) * 105;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        const v = this.circularVelocity(cx, cy, core, x, y, 1);
        this.addBody(x, y, v.vx + dvx, v.vy + dvy, 3 + Math.random() * 7, hue + (Math.random() * 26 - 13));
      }
    };
    mk(this.w * 0.28, this.h * 0.32, 0.9, 0.5, 22);
    mk(this.w * 0.72, this.h * 0.68, -0.9, -0.5, 208);
  }

  presetCluster(n = 140) {
    this.clear();
    const cx = this.w / 2;
    const cy = this.h / 2;
    const rMax = Math.min(this.w, this.h) * 0.3;
    let mvx = 0;
    let mvy = 0;
    let mTot = 0;
    const draft: { x: number; y: number; vx: number; vy: number; mass: number }[] = [];
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * rMax;
      const mass = 4 + Math.random() * 18;
      const vx = (Math.random() - 0.5) * 1.6;
      const vy = (Math.random() - 0.5) * 1.6;
      mvx += vx * mass;
      mvy += vy * mass;
      mTot += mass;
      draft.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx, vy, mass });
    }
    for (const b of draft) {
      this.addBody(b.x, b.y, b.vx - mvx / mTot, b.vy - mvy / mTot, b.mass);
    }
  }

  /* ---------------- 物理推进 ---------------- */

  /** 单帧推进（供主循环与「单步」共用） */
  advance() {
    const speed = this.params.speed;
    const sub = Math.max(1, Math.ceil((speed * BASE_DT) / 0.25));
    const dt = (speed * BASE_DT) / sub;
    for (let s = 0; s < sub; s += 1) this.stepOnce(dt);
  }

  private stepOnce(dt: number) {
    const bs = this.bodies;
    const n = bs.length;
    const g = this.params.g;
    const soft2 = this.params.softening * this.params.softening;
    if (n === 0) return;

    // 速度 Verlet（kick-drift-kick）：辛积分器，长期能量误差有界，轨道不漂移
    const ax = new Float64Array(n);
    const ay = new Float64Array(n);
    const accel = () => {
      ax.fill(0);
      ay.fill(0);
      for (let i = 0; i < n; i += 1) {
        const bi = bs[i];
        for (let j = i + 1; j < n; j += 1) {
          const bj = bs[j];
          const dx = bj.x - bi.x;
          const dy = bj.y - bi.y;
          const r2 = dx * dx + dy * dy + soft2;
          const f = g / (Math.sqrt(r2) * r2); // 1/r³
          ax[i] += f * bj.mass * dx;
          ay[i] += f * bj.mass * dy;
          ax[j] -= f * bi.mass * dx;
          ay[j] -= f * bi.mass * dy;
        }
      }
    };
    const half = dt / 2;
    accel();
    for (let i = 0; i < n; i += 1) {
      const b = bs[i];
      b.vx += ax[i] * half;
      b.vy += ay[i] * half;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    accel();
    for (let i = 0; i < n; i += 1) {
      const b = bs[i];
      b.vx += ax[i] * half;
      b.vy += ay[i] * half;
    }
    this.time += dt;
    if (this.params.merge) this.mergeCollisions();
  }

  /** 碰撞并合：动量守恒；dead 按索引标记，已死天体不再参与配对 */
  private mergeCollisions() {
    const bs = this.bodies;
    const dead = new Set<number>();
    for (let i = 0; i < bs.length; i += 1) {
      if (dead.has(i)) continue;
      for (let j = i + 1; j < bs.length; j += 1) {
        if (dead.has(j)) continue;
        const a = bs[i];
        const b = bs[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const rr = (a.radius + b.radius) * 0.45;
        if (dx * dx + dy * dy < rr * rr) {
          const m = a.mass + b.mass;
          const big = a.mass >= b.mass ? a : b;
          const smallIdx = a.mass >= b.mass ? j : i;
          big.vx = (a.vx * a.mass + b.vx * b.mass) / m;
          big.vy = (a.vy * a.mass + b.vy * b.mass) / m;
          big.x = (a.x * a.mass + b.x * b.mass) / m;
          big.y = (a.y * a.mass + b.y * b.mass) / m;
          big.mass = m;
          big.radius = radiusForMass(m);
          dead.add(smallIdx);
          this.collisions += 1;
          if (dead.has(i)) break; // a 被吞，终止外层继续配对
        }
      }
    }
    if (dead.size > 0) this.bodies = bs.filter((_, idx) => !dead.has(idx));
  }

  stats(): NBodyStats {
    let ke = 0;
    for (const b of this.bodies) ke += 0.5 * b.mass * (b.vx * b.vx + b.vy * b.vy);
    return { bodies: this.bodies.length, time: this.time, ke, collisions: this.collisions };
  }

  private emitNow() {
    if (this.onFrameCb) this.onFrameCb(this.stats());
  }

  private loop = () => {
    if (this.running) this.advance();
    this.render();
    const now = performance.now();
    if (this.onFrameCb && now - this.lastEmit > 150) {
      this.lastEmit = now;
      this.onFrameCb(this.stats());
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  startLoop() {
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  }

  dispose() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.running = false;
    this.onFrameCb = null;
  }

  /* ---------------- 渲染 ---------------- */

  private render() {
    const { ctx, w, h } = this;
    const tc = this.trailCtx;
    tc.globalCompositeOperation = 'destination-out';
    tc.fillStyle = `rgba(0,0,0,${(1 - this.params.trail) * 0.55 + 0.006})`;
    tc.fillRect(0, 0, w, h);
    tc.globalCompositeOperation = 'source-over';
    for (const b of this.bodies) {
      tc.beginPath();
      tc.arc(b.x, b.y, Math.max(1, b.radius * 0.55), 0, Math.PI * 2);
      tc.fillStyle = `hsl(${b.hue} 85% 62%)`;
      tc.fill();
    }

    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(this.trail, 0, 0, w, h);
    for (const b of this.bodies) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 2.1, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${b.hue} 90% 60% / 0.16)`;
      ctx.fill();
      const grad = ctx.createRadialGradient(
        b.x - b.radius * 0.3,
        b.y - b.radius * 0.35,
        b.radius * 0.1,
        b.x,
        b.y,
        b.radius,
      );
      grad.addColorStop(0, `hsl(${b.hue} 95% 78%)`);
      grad.addColorStop(1, `hsl(${b.hue} 85% 52%)`);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    if (this.aim) {
      const { x1, y1, x2, y2 } = this.aim;
      ctx.strokeStyle = 'rgba(148,163,184,0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(x1, y1, radiusForMass(this.aim.mass), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(59,130,246,0.9)';
      ctx.stroke();
    }
  }
}
