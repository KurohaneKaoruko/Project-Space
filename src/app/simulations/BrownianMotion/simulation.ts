/**
 * 布朗运动：二维随机游走粒子群。
 * 每帧每粒子按「方向持久 + 随机扰动」模型游走（视觉上更接近真实布朗轨迹），
 * 并记录均方位移 MSD（mean squared displacement）随时间曲线数据。
 */
export interface BrownianParams {
  /** 粒子数 */
  count: number;
  /** 扰动强度（每帧角度扰动标准差，弧度） */
  jitter: number;
  /** 恒定速度分量 */
  speed: number;
  /** 轨迹长度（帧数，0 = 不画轨迹） */
  trail: number;
  /** 温度倍率：扰动 × 速度同乘 */
  temperature: number;
}

export interface BrownianStats {
  t: number;
  msd: number; // 均方位移（px²）
  displacement: number; // RMS 位移 px
  samples: number;
}

interface Particle {
  x: number;
  y: number;
  ox: number; // 出生点（用于位移统计）
  oy: number;
  angle: number;
  hue: number;
  /** 轨迹缓冲（定长数组，超出即 shift） */
  tx: number[];
  ty: number[];
}

export const BROWNIAN_DEFAULTS: BrownianParams = {
  count: 60,
  jitter: 0.9,
  speed: 1.1,
  trail: 240,
  temperature: 1,
};

export class BrownianSim {
  particles: Particle[] = [];
  t = 0;
  running = false;
  params: BrownianParams = { ...BROWNIAN_DEFAULTS };
  /** MSD 曲线采样（每 10 帧一个点） */
  msdSeries: number[] = [];

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private raf = 0;
  private frame = 0;
  private lastEmit = 0;
  private onFrameCb: ((s: BrownianStats) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');
    this.ctx = ctx;
  }

  setOnFrame(cb: ((s: BrownianStats) => void) | null) {
    this.onFrameCb = cb;
  }

  resize(w: number, h: number) {
    const dpr = window.devicePixelRatio || 1;
    const first = this.w === 0;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (first) this.respawn();
  }

  setParams(p: Partial<BrownianParams>) {
    const prevCount = this.params.count;
    this.params = { ...this.params, ...p };
    if (this.params.count !== prevCount) this.syncCount();
  }

  private syncCount() {
    while (this.particles.length > this.params.count) this.particles.pop();
    while (this.particles.length < this.params.count) this.spawn();
  }

  private spawn() {
    const x = this.w * (0.2 + Math.random() * 0.6);
    const y = this.h * (0.2 + Math.random() * 0.6);
    this.particles.push({
      x,
      y,
      ox: x,
      oy: y,
      angle: Math.random() * Math.PI * 2,
      hue: 205 + Math.random() * 120,
      tx: [],
      ty: [],
    });
  }

  respawn() {
    this.particles = [];
    this.t = 0;
    this.frame = 0;
    this.msdSeries = [];
    this.syncCount();
    this.emitNow();
  }

  clearTrails() {
    for (const p of this.particles) {
      p.tx = [];
      p.ty = [];
    }
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  private emitNow() {
    if (this.onFrameCb) this.onFrameCb(this.stats());
  }

  stats(): BrownianStats {
    const n = this.particles.length;
    let sum = 0;
    for (const p of this.particles) {
      const dx = p.x - p.ox;
      const dy = p.y - p.oy;
      sum += dx * dx + dy * dy;
    }
    const msd = n > 0 ? sum / n : 0;
    return { t: this.t, msd, displacement: Math.sqrt(msd), samples: this.msdSeries.length };
  }

  /** 单帧推进 */
  advance() {
    const { jitter, speed, temperature, trail } = this.params;
    const cap = Math.max(2, trail);
    const w = this.w;
    const h = this.h;
    for (const p of this.particles) {
      p.angle += (Math.random() + Math.random() + Math.random() - 1.5) * jitter * temperature;
      const v = speed * temperature;
      p.x += Math.cos(p.angle) * v;
      p.y += Math.sin(p.angle) * v;
      // 边界反弹
      if (p.x < 0) {
        p.x = 0;
        p.angle = Math.PI - p.angle;
      } else if (p.x > w) {
        p.x = w;
        p.angle = Math.PI - p.angle;
      }
      if (p.y < 0) {
        p.y = 0;
        p.angle = -p.angle;
      } else if (p.y > h) {
        p.y = h;
        p.angle = -p.angle;
      }
      // 记录轨迹（定长缓冲，超出 shift）
      p.tx.push(p.x);
      p.ty.push(p.y);
      if (p.tx.length > cap) {
        p.tx.shift();
        p.ty.shift();
      }
    }
    this.t += 1;
    this.frame += 1;
    if (this.frame % 10 === 0) {
      this.msdSeries.push(this.stats().msd);
      // 曲线数据上限，防止内存无限增长
      if (this.msdSeries.length > 400) this.msdSeries.shift();
    }
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

  render() {
    const { ctx, w, h } = this;
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, w, h);

    // 边框刻度参考线（弱网格）
    ctx.strokeStyle = 'rgba(148,163,184,0.07)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= w; gx += 80) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = 0; gy <= h; gy += 80) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    // 轨迹
    ctx.lineWidth = 1.2;
    for (const p of this.particles) {
      const n = p.tx.length;
      if (n < 2) continue;
      ctx.strokeStyle = `hsl(${p.hue} 80% 60% / 0.4)`;
      ctx.beginPath();
      ctx.moveTo(p.tx[0], p.ty[0]);
      for (let i = 1; i < n; i += 1) ctx.lineTo(p.tx[i], p.ty[i]);
      ctx.stroke();
    }

    // 粒子本体 + 出生点
    for (const p of this.particles) {
      // 出生点十字
      ctx.strokeStyle = `hsl(${p.hue} 70% 55% / 0.5)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.ox - 4, p.oy);
      ctx.lineTo(p.ox + 4, p.oy);
      ctx.moveTo(p.ox, p.oy - 4);
      ctx.lineTo(p.ox, p.oy + 4);
      ctx.stroke();
      // 本体
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${p.hue} 90% 68%)`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${p.hue} 90% 65% / 0.18)`;
      ctx.fill();
    }
  }
}
