/**
 * 鸟群算法（Boids, Craig Reynolds 1986）
 * 三条局部规则涌现群体智能：
 *   分离 Separation —— 避免与近邻挤撞
 *   对齐 Alignment  —— 趋向近邻平均航向
 *   聚合 Cohesion   —— 趋向近邻质心
 * 另支持捕食者追击与指针驱赶（逃逸力），环绕/反弹两种边界。
 */
export interface Boid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hue: number;
}

export interface Predator {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface BoidParams {
  count: number;
  /** 邻域感知半径（px） */
  vision: number;
  /** 分离半径（px） */
  sepRadius: number;
  /** 分离 / 对齐 / 聚合权重 */
  wSep: number;
  wAli: number;
  wCoh: number;
  /** 巡航速度（px/帧） */
  speed: number;
  /** 最大转向力 */
  maxForce: number;
  /** 轨迹残影持续 0~1 */
  trail: number;
  /** 捕食者数量 */
  predators: number;
  /** 边界模式 */
  edge: 'wrap' | 'bounce';
}

export interface BoidStats {
  count: number;
  predators: number;
  avgNeighbors: number;
  avgSpeed: number;
}

export const BOID_DEFAULTS: BoidParams = {
  count: 140,
  vision: 60,
  sepRadius: 24,
  wSep: 1.4,
  wAli: 1.0,
  wCoh: 0.9,
  speed: 2.2,
  maxForce: 0.08,
  trail: 0.75,
  predators: 0,
  edge: 'wrap',
};

const FLEE_RADIUS = 100;
const FLEE_WEIGHT = 2.4;

export class BoidsSim {
  boids: Boid[] = [];
  predators: Predator[] = [];
  running = false;
  params: BoidParams = { ...BOID_DEFAULTS };
  /** 指针驱赶点（页面注入，null = 无） */
  repel: { x: number; y: number } | null = null;
  private lastAvgNeighbors = 0;
  private lastAvgSpeed = 0;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private trailCanvas: HTMLCanvasElement;
  private trailCtx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private raf = 0;
  private lastEmit = 0;
  private onFrameCb: ((s: BoidStats) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.trailCanvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const tctx = this.trailCanvas.getContext('2d');
    if (!ctx || !tctx) throw new Error('canvas 2d context unavailable');
    this.ctx = ctx;
    this.trailCtx = tctx;
  }

  setOnFrame(cb: ((s: BoidStats) => void) | null) {
    this.onFrameCb = cb;
  }

  resize(w: number, h: number) {
    const dpr = window.devicePixelRatio || 1;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.trailCanvas.width = this.canvas.width;
    this.trailCanvas.height = this.canvas.height;
    this.trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.trailCtx.clearRect(0, 0, w, h);
  }

  setParams(p: Partial<BoidParams>) {
    const prevCount = this.params.count;
    const prevPred = this.params.predators;
    this.params = { ...this.params, ...p };
    if (this.params.count !== prevCount) this.syncCount();
    if (this.params.predators !== prevPred) this.syncPredators();
  }

  private spawnBoid(x?: number, y?: number, hue = 190 + Math.random() * 16): Boid {
    return {
      x: x ?? Math.random() * this.w,
      y: y ?? Math.random() * this.h,
      vx: (Math.random() - 0.5) * this.params.speed * 2,
      vy: (Math.random() - 0.5) * this.params.speed * 2,
      hue,
    };
  }

  private syncCount() {
    while (this.boids.length > this.params.count) this.boids.pop();
    while (this.boids.length < this.params.count) {
      // 新鸟在随机老鸟附近出生（自然并入群），无老鸟则随机
      const anchor = this.boids.length > 0 ? this.boids[Math.floor(Math.random() * this.boids.length)] : null;
      this.boids.push(
        anchor
          ? this.spawnBoid(anchor.x + (Math.random() - 0.5) * 60, anchor.y + (Math.random() - 0.5) * 60, anchor.hue)
          : this.spawnBoid(),
      );
    }
  }

  private syncPredators() {
    while (this.predators.length > this.params.predators) this.predators.pop();
    while (this.predators.length < this.params.predators) {
      this.predators.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        vx: this.params.speed,
        vy: 0,
      });
    }
  }

  /* ---------------- 预设 ---------------- */

  presetFree() {
    this.boids = [];
    for (let i = 0; i < this.params.count; i += 1) this.boids.push(this.spawnBoid());
  }

  presetTwoGroups() {
    const half = Math.floor(this.params.count / 2);
    this.boids = [];
    const mk = (cx: number, cy: number, n: number, hue: number) => {
      for (let i = 0; i < n; i += 1) {
        this.boids.push(this.spawnBoid(cx + (Math.random() - 0.5) * 140, cy + (Math.random() - 0.5) * 140, hue));
      }
    };
    mk(this.w * 0.25, this.h * 0.3, half, 190);
    mk(this.w * 0.75, this.h * 0.7, this.params.count - half, 30);
  }

  /** 重置（保持当前参数与捕食者配置） */
  respawn() {
    if (this.params.predators === 0) {
      this.predators = [];
    }
    this.presetFree();
  }

  /* ---------------- 行为 ---------------- */

  /** Reynolds 转向：期望速度 - 当前速度，限幅后乘权重 */
  private steer(b: Boid, tx: number, ty: number, weight: number): [number, number] {
    const d = Math.hypot(tx, ty);
    if (d < 1e-4) return [0, 0];
    const dvx = (tx / d) * this.params.speed - b.vx;
    const dvy = (ty / d) * this.params.speed - b.vy;
    const dm = Math.hypot(dvx, dvy);
    if (dm < 1e-6) return [0, 0];
    const lim = (Math.min(dm, this.params.maxForce) / dm) * weight;
    return [dvx * lim, dvy * lim];
  }

  /** 单帧推进（供主循环与「单步」共用） */
  advance() {
    const p = this.params;
    this.syncPredators();
    const bs = this.boids;
    const n = bs.length;
    if (n === 0) return;
    const vision2 = p.vision * p.vision;
    const sep2 = p.sepRadius * p.sepRadius;
    let neighborSum = 0;
    let speedSum = 0;

    for (let i = 0; i < n; i += 1) {
      const b = bs[i];
      let sx = 0;
      let sy = 0; // 分离方向累计
      let ax = 0;
      let ay = 0; // 邻居速度和
      let cx = 0;
      let cy = 0; // 邻居位置和
      let nc = 0;
      for (let j = 0; j < n; j += 1) {
        if (j === i) continue;
        const o = bs[j];
        const dx = o.x - b.x;
        const dy = o.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > vision2) continue;
        nc += 1;
        ax += o.vx;
        ay += o.vy;
        cx += o.x;
        cy += o.y;
        if (d2 < sep2 && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const f = (p.sepRadius - d) / p.sepRadius; // 越近越强
          sx -= (dx / d) * f;
          sy -= (dy / d) * f;
        }
      }
      neighborSum += nc;

      let fx = 0;
      let fy = 0;
      if (nc > 0) {
        if (p.wCoh > 0) {
          const [gx, gy] = this.steer(b, cx / nc - b.x, cy / nc - b.y, p.wCoh);
          fx += gx;
          fy += gy;
        }
        if (p.wAli > 0) {
          const [gx, gy] = this.steer(b, ax, ay, p.wAli);
          fx += gx;
          fy += gy;
        }
      }
      if (p.wSep > 0) {
        const [gx, gy] = this.steer(b, sx, sy, p.wSep);
        fx += gx;
        fy += gy;
      }

      // 逃逸：捕食者 + 指针驱赶
      const threats = this.predators as ({ x: number; y: number } | null)[];
      const repel = this.repel;
      const repelObj = repel ? [repel] : [];
      for (const t of [...threats, ...repelObj]) {
        if (!t) continue;
        const dx = b.x - t.x;
        const dy = b.y - t.y;
        const d = Math.hypot(dx, dy);
        if (d > FLEE_RADIUS || d < 1e-4) continue;
        // 逃逸用直接冲量（越近越强）而非 steer()——steer 的期望速度上限是巡航值，
        // 逃逸永远无法超过它，惊吓加速就失效了
        const panic = ((1 - d / FLEE_RADIUS) * FLEE_WEIGHT * 2.2) / d;
        fx += dx * panic;
        fy += dy * panic;
      }

      b.vx += fx;
      b.vy += fy;

      // 限速：上限 1.8×巡航（逃逸加速空间）；下限仅防完全停滞（极小值，
      // 不能钳到巡航的几十%——那会把「反向中的逃逸速度」硬拉回原方向）
      const v = Math.hypot(b.vx, b.vy) || 1e-6;
      const vmax = p.speed * 1.8;
      const vmin = p.speed * 0.1;
      if (v > vmax) {
        b.vx = (b.vx / v) * vmax;
        b.vy = (b.vy / v) * vmax;
      } else if (v < vmin) {
        b.vx = (b.vx / v) * vmin;
        b.vy = (b.vy / v) * vmin;
      }
      speedSum += Math.hypot(b.vx, b.vy);

      // 温和回归巡航速度（4%/帧）：三规则都是转向力，速度幅值在对齐一致后
      // 会自发漂移到初始随机水平；逃逸力(~0.42/帧)远大于此项(~0.06/帧)，加速不受影响
      b.vx += ((b.vx / v) * p.speed - b.vx) * 0.04;
      b.vy += ((b.vy / v) * p.speed - b.vy) * 0.04;

      // 位置积分（速度 → 位移）
      b.x += b.vx;
      b.y += b.vy;

      this.applyEdges(b);
    }

    // 捕食者：追最近鸟，速度 1.35×
    for (const pd of this.predators) {
      let best: Boid | null = null;
      let bestD = Infinity;
      for (const b of bs) {
        const d = (b.x - pd.x) ** 2 + (b.y - pd.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = b;
        }
      }
      if (best) {
        const dx = best.x - pd.x;
        const dy = best.y - pd.y;
        const d = Math.hypot(dx, dy) || 1;
        const target = p.speed * 1.35;
        pd.vx += ((dx / d) * target - pd.vx) * 0.06;
        pd.vy += ((dy / d) * target - pd.vy) * 0.06;
        const v = Math.hypot(pd.vx, pd.vy) || 1;
        if (v > target) {
          pd.vx = (pd.vx / v) * target;
          pd.vy = (pd.vy / v) * target;
        }
      }
      pd.x += pd.vx;
      pd.y += pd.vy;
      this.applyEdges(pd as unknown as Boid);
    }

    this.lastAvgNeighbors = n > 0 ? neighborSum / n : 0;
    this.lastAvgSpeed = n > 0 ? speedSum / n : 0;
  }

  private applyEdges(b: Boid) {
    if (this.params.edge === 'wrap') {
      if (b.x < 0) b.x += this.w;
      else if (b.x >= this.w) b.x -= this.w;
      if (b.y < 0) b.y += this.h;
      else if (b.y >= this.h) b.y -= this.h;
    } else {
      if (b.x < 0) {
        b.x = 0;
        b.vx = Math.abs(b.vx);
      } else if (b.x > this.w) {
        b.x = this.w;
        b.vx = -Math.abs(b.vx);
      }
      if (b.y < 0) {
        b.y = 0;
        b.vy = Math.abs(b.vy);
      } else if (b.y > this.h) {
        b.y = this.h;
        b.vy = -Math.abs(b.vy);
      }
    }
  }

  stats(): BoidStats {
    return {
      count: this.boids.length,
      predators: this.predators.length,
      avgNeighbors: this.lastAvgNeighbors,
      avgSpeed: this.lastAvgSpeed,
    };
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
    tc.fillStyle = `rgba(0,0,0,${(1 - this.params.trail) * 0.55 + 0.01})`;
    tc.fillRect(0, 0, w, h);
    tc.globalCompositeOperation = 'source-over';
    for (const b of this.boids) {
      const ang = Math.atan2(b.vy, b.vx);
      tc.save();
      tc.translate(b.x, b.y);
      tc.rotate(ang);
      tc.fillStyle = `hsl(${b.hue} 85% 60% / 0.55)`;
      tc.beginPath();
      tc.moveTo(5, 0);
      tc.lineTo(-3, 2.2);
      tc.lineTo(-3, -2.2);
      tc.closePath();
      tc.fill();
      tc.restore();
    }

    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(this.trailCanvas, 0, 0, w, h);

    // 鸟：朝向速度方向的三角
    for (const b of this.boids) {
      const ang = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(ang);
      ctx.fillStyle = `hsl(${b.hue} 90% 66%)`;
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-4.2, 3.4);
      ctx.lineTo(-2.2, 0);
      ctx.lineTo(-4.2, -3.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 捕食者：红色大三角 + 警戒圈
    for (const p of this.predators) {
      const ang = Math.atan2(p.vy, p.vx);
      ctx.beginPath();
      ctx.arc(p.x, p.y, FLEE_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(239,68,68,0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(-8, 6);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-8, -6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 指针驱赶波纹
    if (this.repel) {
      ctx.beginPath();
      ctx.arc(this.repel.x, this.repel.y, FLEE_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(250,204,21,0.25)';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.repel.x, this.repel.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(250,204,21,0.8)';
      ctx.fill();
    }
  }
}
