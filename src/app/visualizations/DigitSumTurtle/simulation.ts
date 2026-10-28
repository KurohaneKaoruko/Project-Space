export interface DigitSumTurtleConfig {
  base: number;
  divs: number;
  dir: 1 | -1;
  speed: number;
  startHeading: number;
  follow: boolean;
  color: string;
  rainbow: boolean;
  rainbowPeriod: number;
  lineWidth: number;
  startK: number;
}

export interface DigitSumTurtleStats {
  k: number;
  segments: number;
  turns: number;
  rate: number;
  capHit: boolean;
}

export interface DigitParityEngine {
  readonly k: number;
  setK(k: number): void;
  setBase(base: number): void;
  stepParity(): 0 | 1;
}

/* 数位和奇偶引擎：维护 pending k 的 n 进制数位与数位和，推进均摊 O(1) */
export function createDigitParityEngine(base: number, startK = 0): DigitParityEngine {
  let k = 0;
  let digits: number[] = [0];
  let dsum = 0;
  let b = Math.max(2, Math.floor(base));

  const build = (kk: number) => {
    k = Math.max(0, Math.floor(kk));
    digits = [0];
    dsum = 0;
    let t = k;
    while (t > 0) {
      const d = t % b;
      digits.push(d);
      dsum += d;
      t = Math.floor(t / b);
    }
  };
  build(startK);

  return {
    get k() {
      return k;
    },
    setK: build,
    setBase(nb: number) {
      b = Math.max(2, Math.floor(nb));
      build(k);
    },
    stepParity() {
      const p = (dsum & 1) as 0 | 1;
      let i = 0;
      for (;;) {
        const d = digits[i] ?? 0;
        if (d === b - 1) {
          digits[i] = 0;
          dsum -= b - 1;
          i += 1;
        } else {
          digits[i] = d + 1;
          dsum += 1;
          break;
        }
      }
      k += 1;
      return p;
    },
  };
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Camera {
  x: number;
  y: number;
  s: number;
}

const MAX_SEGMENTS = 8000000;
const CHUNK = 8192;
const BG = '#09090b';

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export interface DigitSumTurtleSimOptions {
  config?: Partial<DigitSumTurtleConfig>;
  dotEl?: HTMLElement | null;
  onFollowChange?: (v: boolean) => void;
}

export class DigitSumTurtleSim {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dotEl: HTMLElement | null;
  private onFollowChange: ((v: boolean) => void) | null;

  private cfg: DigitSumTurtleConfig = {
    base: 2,
    divs: 6,
    dir: -1,
    speed: 2000,
    startHeading: 60,
    follow: true,
    color: '#60a5fa',
    rainbow: false,
    rainbowPeriod: 8192,
    lineWidth: 1.4,
    startK: 0,
  };

  private engine: DigitParityEngine = createDigitParityEngine(2, 0);
  private tx = 0;
  private ty = 0;
  private th = 0;
  private turnCount = 0;

  private segs = new Float32Array(65536);
  private segCount = 0;
  private drawn = 0;
  private chunkBox: Box[] = [];
  private chunkPaths: (Path2D | null)[] = [];
  private bbox: Box | null = null;
  private capHit = false;
  private drawnCam: Camera = { x: 0, y: 0, s: 1 };
  private drawBudgetMs = 10;

  private cam: Camera = { x: 0, y: 0, s: 40 };
  private needsRedraw = true;

  private cssW = 300;
  private cssH = 150;
  private dpr = 1;

  private running = false;
  private raf = 0;
  private lastStatsT = 0;
  private lastK = 0;
  private rate = 0;

  private ptrs = new Map<number, { x: number; y: number }>();
  private lastPX = 0;
  private lastPY = 0;
  private pinchD = 0;

  constructor(canvas: HTMLCanvasElement, options: DigitSumTurtleSimOptions = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('canvas 2d context unavailable');
    this.ctx = ctx;
    this.dotEl = options.dotEl ?? null;
    this.onFollowChange = options.onFollowChange ?? null;
    if (options.config) Object.assign(this.cfg, options.config);
    this.reset();
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
  }

  setConfig(patch: Partial<DigitSumTurtleConfig>): void {
    const prevBase = this.cfg.base;
    Object.assign(this.cfg, patch);
    if (patch.base !== undefined && patch.base !== prevBase) {
      this.engine.setBase(this.cfg.base);
    }
    if (
      patch.color !== undefined ||
      patch.rainbow !== undefined ||
      patch.rainbowPeriod !== undefined ||
      patch.lineWidth !== undefined
    ) {
      this.needsRedraw = true;
    }
  }

  start(): void {
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  step(n: number): void {
    const budget = Math.max(1, Math.floor(n));
    for (let i = 0; i < budget; i++) {
      if (this.engine.stepParity()) this.turn();
      else this.forward();
    }
    this.drawNew();
  }

  reset(): void {
    this.engine.setBase(this.cfg.base);
    this.engine.setK(this.cfg.startK);
    this.tx = 0;
    this.ty = 0;
    this.th = (this.cfg.startHeading * Math.PI) / 180;
    this.turnCount = 0;
    this.segs = new Float32Array(65536);
    this.segCount = 0;
    this.drawn = 0;
    this.chunkBox = [];
    this.chunkPaths = [];
    this.bbox = null;
    this.capHit = false;
    this.cam = { x: 0, y: 0, s: Math.max(8, Math.min(this.cssW, this.cssH) / 28) };
    this.needsRedraw = true;
    this.rate = 0;
    this.lastK = this.engine.k;
    this.lastStatsT = performance.now();
    this.updateDot();
  }

  fit(): void {
    const t = this.fitTarget();
    this.cam = t;
    this.needsRedraw = true;
    this.updateDot();
  }

  resize(cssW: number, cssH: number): void {
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    // 布局尺寸交给 CSS w-full/h-full，避免 inline px 宽度撑死 flex 项 min-content
    this.needsRedraw = true;
  }

  getStats(): DigitSumTurtleStats {
    return {
      k: this.engine.k,
      segments: this.segCount,
      turns: this.turnCount,
      rate: this.rate,
      capHit: this.capHit,
    };
  }

  /* ---------- 内部：主循环 ---------- */

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const t0 = now;
    this.followStep();
    if (this.needsRedraw) {
      this.redraw();
      this.needsRedraw = false;
    }
    if (this.running) {
      this.stepBudget(t0, this.drawBudgetMs);
      this.drawNew();
    }
    this.drawBudgetMs = Math.max(2, Math.min(10, 10 - (performance.now() - t0)));
    if (now - this.lastStatsT > 400) {
      const dt = now - this.lastStatsT;
      this.rate = dt > 0 ? Math.round(((this.engine.k - this.lastK) * 1000) / dt) || 0 : 0;
      this.lastK = this.engine.k;
      this.lastStatsT = now;
    }
    this.updateDot();
  };

  private stepBudget(frameStart: number, budgetMs: number): void {
    const speed = Math.max(1, this.cfg.speed);
    const deadline = frameStart + budgetMs;
    let n = 0;
    while (n < speed) {
      const batch = Math.min(1024, speed - n);
      for (let j = 0; j < batch; j++) {
        if (this.engine.stepParity()) this.turn();
        else this.forward();
      }
      n += batch;
      if (performance.now() > deadline) break;
    }
  }

  private turn(): void {
    this.th += this.cfg.dir * ((2 * Math.PI) / this.cfg.divs);
    this.turnCount += 1;
  }

  private forward(): void {
    const nx = this.tx + Math.cos(this.th);
    const ny = this.ty + Math.sin(this.th);
    if (!this.capHit) this.pushSeg(this.tx, this.ty, nx, ny);
    this.tx = nx;
    this.ty = ny;
  }

  /* ---------- 线段存储 ---------- */

  private pushSeg(x1: number, y1: number, x2: number, y2: number): void {
    if (this.segCount >= MAX_SEGMENTS) {
      this.capHit = true;
      return;
    }
    if (this.segCount * 4 === this.segs.length) {
      const next = new Float32Array(this.segs.length * 2);
      next.set(this.segs);
      this.segs = next;
    }
    const o = this.segCount * 4;
    this.segs[o] = x1;
    this.segs[o + 1] = y1;
    this.segs[o + 2] = x2;
    this.segs[o + 3] = y2;
    const ci = (this.segCount / CHUNK) | 0;
    let cb = this.chunkBox[ci];
    if (!cb) {
      cb = { x0: 1e30, y0: 1e30, x1: -1e30, y1: -1e30 };
      this.chunkBox[ci] = cb;
    }
    if (x1 < cb.x0) cb.x0 = x1;
    if (y1 < cb.y0) cb.y0 = y1;
    if (x2 > cb.x1) cb.x1 = x2;
    if (y2 > cb.y1) cb.y1 = y2;
    if (!this.bbox) this.bbox = { x0: x1, y0: y1, x1: x2, y1: y2 };
    else {
      const b = this.bbox;
      if (x1 < b.x0) b.x0 = x1;
      if (y1 < b.y0) b.y0 = y1;
      if (x2 > b.x1) b.x1 = x2;
      if (y2 > b.y1) b.y1 = y2;
    }
    this.segCount += 1;
    if (this.segCount % CHUNK === 0) {
      const ci = this.segCount / CHUNK - 1;
      this.chunkPaths[ci] = this.buildChunkPath(ci);
    }
  }

  private buildChunkPath(ci: number): Path2D {
    const p = new Path2D();
    const from = ci * CHUNK;
    const to = Math.min(this.segCount, from + CHUNK);
    let o = from * 4;
    p.moveTo(this.segs[o], this.segs[o + 1]);
    for (let i = from + 1; i < to; i++) {
      o = i * 4;
      p.lineTo(this.segs[o + 2], this.segs[o + 3]);
    }
    return p;
  }

  /* ---------- 相机与绘制 ---------- */

  private setCamTransform(): void {
    const m = this.dpr * this.cam.s;
    this.ctx.setTransform(m, 0, 0, m, this.dpr * (this.cssW / 2 - this.cam.x * this.cam.s), this.dpr * (this.cssH / 2 - this.cam.y * this.cam.s));
  }

  private viewRect(): Box {
    const hw = this.cssW / 2 / this.cam.s;
    const hh = this.cssH / 2 / this.cam.s;
    return { x0: this.cam.x - hw, y0: this.cam.y - hh, x1: this.cam.x + hw, y1: this.cam.y + hh };
  }

  private static rectsHit(a: Box, b: Box): boolean {
    return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  }

  private colorForIndex(i: number): string {
    if (!this.cfg.rainbow) return this.cfg.color;
    const h = (((i / this.cfg.rainbowPeriod) * 360) % 360 + 360) % 360;
    return 'hsl(' + h.toFixed(1) + ',85%,58%)';
  }

  private strokeRange(from: number, to: number, color: string): void {
    if (to <= from) return;
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.beginPath();
    let o = from * 4;
    ctx.moveTo(this.segs[o], this.segs[o + 1]);
    for (let i = from + 1; i < to; i++) {
      o = i * 4;
      ctx.lineTo(this.segs[o + 2], this.segs[o + 3]);
    }
    ctx.stroke();
  }

  private strokeChunksIn(rect: Box): void {
    const nCh = Math.ceil(this.segCount / CHUNK);
    for (let c = 0; c < nCh; c++) {
      const cb = this.chunkBox[c];
      if (cb && !DigitSumTurtleSim.rectsHit(cb, rect)) continue;
      const cached = this.chunkPaths[c];
      if (cached) {
        this.ctx.strokeStyle = this.colorForIndex(c * CHUNK);
        this.ctx.stroke(cached);
      } else {
        this.strokeRange(c * CHUNK, Math.min(this.segCount, (c + 1) * CHUNK), this.colorForIndex(c * CHUNK));
      }
    }
  }

  private redraw(): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.setCamTransform();
    ctx.lineWidth = this.cfg.lineWidth / this.cam.s;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    this.strokeChunksIn(this.viewRect());
    this.drawn = this.segCount;
    this.drawnCam = { x: this.cam.x, y: this.cam.y, s: this.cam.s };
  }

  private drawNew(): void {
    if (this.segCount <= this.drawn) return;
    this.setCamTransform();
    this.ctx.lineWidth = this.cfg.lineWidth / this.cam.s;
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.strokeRange(this.drawn, this.segCount, this.colorForIndex(this.drawn));
    this.drawn = this.segCount;
  }

  private fitTarget(): Camera {
    if (!this.bbox) return { x: this.cam.x, y: this.cam.y, s: this.cam.s };
    const b = this.bbox;
    const bw = Math.max(b.x1 - b.x0, 1e-9);
    const bh = Math.max(b.y1 - b.y0, 1e-9);
    const s = clamp(Math.min(this.cssW / (bw * 1.12), this.cssH / (bh * 1.12)), 1e-7, 1e7);
    return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, s };
  }

  /* 镜头跟随：向“完整图案”目标平滑过渡（位置线性、缩放对数空间） */
  private followStep(): void {
    if (!this.cfg.follow) return;
    const t = this.fitTarget();
    const posEps = 0.05 / this.cam.s;
    const scaleEps = 1e-4;
    if (
      Math.abs(t.x - this.cam.x) < posEps &&
      Math.abs(t.y - this.cam.y) < posEps &&
      Math.abs(Math.log(t.s / this.cam.s)) < scaleEps
    ) {
      this.cam = t;
      return;
    }
    const e = 0.12;
    this.cam = {
      x: this.cam.x + (t.x - this.cam.x) * e,
      y: this.cam.y + (t.y - this.cam.y) * e,
      s: clamp(this.cam.s * Math.pow(t.s / this.cam.s, e), 1e-7, 1e7),
    };
    const pxDrift = Math.hypot(this.cam.x - this.drawnCam.x, this.cam.y - this.drawnCam.y) * this.cam.s;
    const scaleDrift = Math.abs(Math.log(this.cam.s / this.drawnCam.s));
    if (pxDrift > 1.5 || scaleDrift > 0.02) this.needsRedraw = true;
  }

  private userTookCamera(): void {
    if (this.cfg.follow) {
      this.cfg.follow = false;
      this.onFollowChange?.(false);
    }
  }

  /* ---------- 平移快速路径：自拷贝位图 + 补画露出条带 ---------- */

  private devRect2World(x0: number, y0: number, x1: number, y1: number): Box {
    const wx = (x: number) => this.cam.x + (x / this.dpr - this.cssW / 2) / this.cam.s;
    const wy = (y: number) => this.cam.y + (y / this.dpr - this.cssH / 2) / this.cam.s;
    return { x0: wx(x0), y0: wy(y0), x1: wx(x1), y1: wy(y1) };
  }

  private panBy(dxCss: number, dyCss: number): void {
    if (this.needsRedraw) this.redraw();
    const dx = Math.round(dxCss * this.dpr);
    const dy = Math.round(dyCss * this.dpr);
    if (!dx && !dy) return;
    this.cam = { x: this.cam.x - dx / this.dpr / this.cam.s, y: this.cam.y - dy / this.dpr / this.cam.s, s: this.cam.s };
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.canvas, dx, dy);
    ctx.fillStyle = BG;
    const rects: Box[] = [];
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (dx > 0) {
      ctx.fillRect(0, 0, dx, h);
      rects.push(this.devRect2World(0, 0, dx, h));
    } else if (dx < 0) {
      ctx.fillRect(w + dx, 0, -dx, h);
      rects.push(this.devRect2World(w + dx, 0, w, h));
    }
    if (dy > 0) {
      ctx.fillRect(0, 0, w, dy);
      rects.push(this.devRect2World(0, 0, w, dy));
    } else if (dy < 0) {
      ctx.fillRect(0, h + dy, w, -dy);
      rects.push(this.devRect2World(0, h + dy, w, h));
    }
    this.setCamTransform();
    ctx.lineWidth = this.cfg.lineWidth / this.cam.s;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const r of rects) this.strokeChunksIn(r);
  }

  private zoomAt(sxCss: number, syCss: number, factor: number): void {
    const wx = this.cam.x + (sxCss - this.cssW / 2) / this.cam.s;
    const wy = this.cam.y + (syCss - this.cssH / 2) / this.cam.s;
    const s = clamp(this.cam.s * factor, 1e-7, 1e7);
    this.cam = { x: wx - (sxCss - this.cssW / 2) / s, y: wy - (syCss - this.cssH / 2) / s, s };
    this.needsRedraw = true;
    this.userTookCamera();
  }

  private updateDot(): void {
    if (!this.dotEl) return;
    const sx = (this.tx - this.cam.x) * this.cam.s + this.cssW / 2;
    const sy = (this.ty - this.cam.y) * this.cam.s + this.cssH / 2;
    this.dotEl.style.transform = 'translate(' + sx + 'px,' + sy + 'px)';
  }

  /* ---------- 指针事件 ---------- */

  private onPointerDown = (e: PointerEvent): void => {
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* 忽略 */
    }
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.ptrs.size === 1) {
      this.lastPX = e.clientX;
      this.lastPY = e.clientY;
    } else if (this.ptrs.size === 2) {
      const [a, b] = [...this.ptrs.values()];
      this.pinchD = Math.hypot(a.x - b.x, a.y - b.y);
    }
    this.userTookCamera();
  };

  private onPointerMove = (e: PointerEvent): void => {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.ptrs.size === 1) {
      this.panBy(e.clientX - this.lastPX, e.clientY - this.lastPY);
      this.lastPX = e.clientX;
      this.lastPY = e.clientY;
    } else if (this.ptrs.size === 2) {
      const [a, b] = [...this.ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchD > 0 && d > 0) {
        const rect = this.canvas.getBoundingClientRect();
        this.zoomAt((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, d / this.pinchD);
      }
      this.pinchD = d;
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.ptrs.delete(e.pointerId) && this.ptrs.size === 1) {
      const [p] = [...this.ptrs.values()];
      this.lastPX = p.x;
      this.lastPY = p.y;
    }
    this.pinchD = 0;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    this.zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.00125));
  };
}
