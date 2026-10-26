export type TSPTheme = 'dark' | 'light';

export type TSPConfig = {
  cityCount: number;
  antCount: number;
  alpha: number;
  beta: number;
  evaporation: number;
  deposit: number;
  stepsPerSecond: number;
  showPheromones: boolean;
  showBest: boolean;
  theme: TSPTheme;
};

type City = {
  x: number;
  y: number;
};

type AntState = {
  path: Int32Array;
  visited: Uint8Array;
  step: number;
  current: number;
  prev: number;
  length: number;
  done: boolean;
  color: string;
};

type Palette = {
  bg: string;
  city: string;
  cityStroke: string;
  best: string;
  pheromone: [number, number, number];
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export class TSPAntColonySim {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private width = 1;
  private height = 1;

  private cities: City[] = [];
  private distances = new Float32Array(0);
  private pheromones = new Float32Array(0);
  private selectionWeights = new Float32Array(0);

  private ants: AntState[] = [];

  private iteration = 0;
  private bestLength = Number.POSITIVE_INFINITY;
  private bestTour: Int32Array | null = null;

  private running = false;
  private raf = 0;
  private lastTime = 0;
  private accSteps = 0;
  private renderPhase = 1;

  private stepsPerSecond = 60;
  private cityCount = 28;
  private antCount = 20;
  private alpha = 1;
  private beta = 3;
  private evaporation = 0.4;
  private deposit = 1;
  private showPheromones = true;
  private showBest = true;
  private theme: TSPTheme = 'dark';
  private palette: Palette = {
    bg: '#0A0A0F',
    city: '#F4F4F5',
    cityStroke: '#27272A',
    best: '#F59E0B',
    pheromone: [56, 189, 248],
  };

  private antColors = ['#F97316', '#22C55E', '#38BDF8', '#EAB308', '#A855F7', '#EF4444', '#14B8A6'];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = true;
  }

  getStats() {
    return {
      iteration: this.iteration,
      bestLength: this.bestLength,
      ants: this.antCount,
      cities: this.cityCount,
    };
  }

  setConfig(next: Partial<TSPConfig>) {
    if (typeof next.stepsPerSecond === 'number') this.stepsPerSecond = clamp(next.stepsPerSecond, 1, 240);
    if (typeof next.alpha === 'number') this.alpha = clamp(next.alpha, 0.1, 8);
    if (typeof next.beta === 'number') this.beta = clamp(next.beta, 0.1, 12);
    if (typeof next.evaporation === 'number') this.evaporation = clamp(next.evaporation, 0.01, 0.9);
    if (typeof next.deposit === 'number') this.deposit = clamp(next.deposit, 0.05, 10);
    if (typeof next.showBest === 'boolean') this.showBest = next.showBest;
    if (typeof next.showPheromones === 'boolean') this.showPheromones = next.showPheromones;
    if (next.theme) this.setTheme(next.theme);
    if (typeof next.antCount === 'number') this.setAntCount(next.antCount);
    if (typeof next.cityCount === 'number') this.setCityCount(next.cityCount);
    this.render();
  }

  resize(width: number, height: number) {
    const nextW = Math.max(1, Math.floor(width));
    const nextH = Math.max(1, Math.floor(height));
    const prevW = this.width;
    const prevH = this.height;
    this.width = nextW;
    this.height = nextH;
    this.canvas.width = nextW;
    this.canvas.height = nextH;

    if (this.cities.length === 0 || prevW <= 1 || prevH <= 1) {
      this.randomizeCities(this.cityCount);
      return;
    }

    if (prevW > 1 && prevH > 1) {
      const sx = nextW / prevW;
      const sy = nextH / prevH;
      const margin = this.getMargin();
      for (const city of this.cities) {
        city.x = clamp(city.x * sx, margin, nextW - margin);
        city.y = clamp(city.y * sy, margin, nextH - margin);
      }
      this.computeDistances();
    }

    this.render();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accSteps = 0;
    this.loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  step(steps: number) {
    const n = Math.max(1, Math.floor(steps));
    for (let i = 0; i < n; i++) this.stepOne();
    this.renderPhase = 1;
    this.render();
  }

  reset() {
    this.resetStats();
    this.initPheromones();
    this.resetAnts();
    this.renderPhase = 1;
    this.render();
  }

  randomizeCities(count: number = this.cityCount) {
    this.cityCount = clamp(Math.floor(count), 6, 80);
    const n = this.cityCount;
    const margin = this.getMargin();
    const minDist = Math.max(12, Math.min(this.width, this.height) * 0.06);

    const cities: City[] = [];
    const triesLimit = 200;

    for (let i = 0; i < n; i++) {
      let placed = false;
      let x = margin;
      let y = margin;
      for (let t = 0; t < triesLimit; t++) {
        x = margin + Math.random() * (this.width - margin * 2);
        y = margin + Math.random() * (this.height - margin * 2);
        let ok = true;
        for (let j = 0; j < cities.length; j++) {
          const dx = cities[j].x - x;
          const dy = cities[j].y - y;
          if (dx * dx + dy * dy < minDist * minDist) {
            ok = false;
            break;
          }
        }
        if (ok) {
          placed = true;
          break;
        }
      }
      cities.push({ x, y });
      if (!placed) {
        cities[i].x = x;
        cities[i].y = y;
      }
    }

    this.cities = cities;
    this.selectionWeights = new Float32Array(n);
    this.computeDistances();
    this.initPheromones();
    this.resetStats();
    this.resetAnts();
    this.renderPhase = 1;
    this.render();
  }

  private resetStats() {
    this.iteration = 0;
    this.bestLength = Number.POSITIVE_INFINITY;
    this.bestTour = null;
  }

  private setTheme(theme: TSPTheme) {
    this.theme = theme;
    if (theme === 'light') {
      this.palette = {
        bg: '#FFFFFF',
        city: '#0F172A',
        cityStroke: '#CBD5F5',
        best: '#F97316',
        pheromone: [14, 165, 233],
      };
    } else {
      this.palette = {
        bg: '#0A0A0F',
        city: '#F4F4F5',
        cityStroke: '#27272A',
        best: '#F59E0B',
        pheromone: [56, 189, 248],
      };
    }
  }

  private setAntCount(count: number) {
    this.antCount = clamp(Math.floor(count), 1, 60);
    this.resetAnts();
  }

  private setCityCount(count: number) {
    this.randomizeCities(count);
  }

  private initPheromones() {
    const n = this.cityCount;
    this.pheromones = new Float32Array(n * n);
    this.pheromones.fill(1);
    for (let i = 0; i < n; i++) this.pheromones[i * n + i] = 0;
  }

  private computeDistances() {
    const n = this.cityCount;
    const dist = new Float32Array(n * n);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = this.cities[i].x - this.cities[j].x;
        const dy = this.cities[i].y - this.cities[j].y;
        const d = Math.hypot(dx, dy);
        dist[i * n + j] = d;
        dist[j * n + i] = d;
      }
    }
    this.distances = dist;
  }

  private resetAnts() {
    const n = this.cityCount;
    this.ants = [];
    for (let i = 0; i < this.antCount; i++) {
      const start = Math.floor(Math.random() * n);
      const visited = new Uint8Array(n);
      visited[start] = 1;
      const path = new Int32Array(n + 1);
      path[0] = start;
      this.ants.push({
        path,
        visited,
        step: 1,
        current: start,
        prev: start,
        length: 0,
        done: false,
        color: this.antColors[i % this.antColors.length],
      });
    }
  }

  private stepOne() {
    if (this.cityCount <= 1 || this.ants.length === 0) return;

    let doneCount = 0;
    for (const ant of this.ants) {
      if (ant.done) {
        doneCount += 1;
        continue;
      }
      this.advanceAnt(ant);
      if (ant.done) doneCount += 1;
    }

    if (doneCount === this.ants.length) {
      this.finishIteration();
    }
  }

  private finishIteration() {
    for (const ant of this.ants) {
      if (ant.length < this.bestLength) {
        this.bestLength = ant.length;
        this.bestTour = ant.path.slice();
      }
    }
    this.updatePheromones();
    this.iteration += 1;
    this.resetAnts();
  }

  private advanceAnt(ant: AntState) {
    if (ant.step >= this.cityCount) {
      ant.done = true;
      return;
    }
    const next = this.pickNextCity(ant);
    ant.prev = ant.current;
    ant.path[ant.step] = next;
    ant.visited[next] = 1;
    ant.length += this.getDistance(ant.current, next);
    ant.current = next;
    ant.step += 1;

    if (ant.step === this.cityCount) {
      ant.length += this.getDistance(ant.current, ant.path[0]);
      ant.path[this.cityCount] = ant.path[0];
      ant.done = true;
    }
  }

  private pickNextCity(ant: AntState) {
    const n = this.cityCount;
    const current = ant.current;
    const weights = this.selectionWeights;
    let sum = 0;

    for (let j = 0; j < n; j++) {
      if (ant.visited[j]) {
        weights[j] = 0;
        continue;
      }
      const d = this.distances[current * n + j];
      if (d <= 0) {
        weights[j] = 0;
        continue;
      }
      const tau = Math.pow(this.pheromones[current * n + j], this.alpha);
      const eta = Math.pow(1 / d, this.beta);
      const w = tau * eta;
      weights[j] = w;
      sum += w;
    }

    if (sum <= 0) return this.pickRandomUnvisited(ant.visited);

    let r = Math.random() * sum;
    for (let j = 0; j < n; j++) {
      if (weights[j] <= 0) continue;
      r -= weights[j];
      if (r <= 0) return j;
    }
    return this.pickRandomUnvisited(ant.visited);
  }

  private pickRandomUnvisited(visited: Uint8Array) {
    const n = visited.length;
    let count = 0;
    for (let i = 0; i < n; i++) if (!visited[i]) count += 1;
    let pick = Math.floor(Math.random() * Math.max(1, count));
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      if (pick === 0) return i;
      pick -= 1;
    }
    return 0;
  }

  private updatePheromones() {
    const n = this.cityCount;
    const decay = 1 - this.evaporation;
    for (let i = 0; i < this.pheromones.length; i++) {
      this.pheromones[i] *= decay;
      if (this.pheromones[i] < 1e-6) this.pheromones[i] = 1e-6;
    }

    for (const ant of this.ants) {
      const deposit = this.deposit / ant.length;
      if (!Number.isFinite(deposit)) continue;
      for (let i = 0; i < n; i++) {
        const a = ant.path[i];
        const b = ant.path[i + 1];
        const idx = a * n + b;
        const idx2 = b * n + a;
        this.pheromones[idx] += deposit;
        this.pheromones[idx2] += deposit;
      }
    }
  }

  private getDistance(a: number, b: number) {
    return this.distances[a * this.cityCount + b];
  }

  private getMargin() {
    return Math.max(24, Math.min(this.width, this.height) * 0.08);
  }

  private loop = (t: number = performance.now()) => {
    if (!this.running) return;
    const dt = Math.min(0.1, Math.max(0, (t - this.lastTime) / 1000));
    this.lastTime = t;

    this.accSteps += dt * this.stepsPerSecond;
    const maxSteps = 200;
    let steps = Math.floor(this.accSteps);
    if (steps > maxSteps) steps = maxSteps;
    if (steps >= 1) {
      for (let i = 0; i < steps; i++) this.stepOne();
      this.accSteps -= steps;
    }

    const phase = this.accSteps - Math.floor(this.accSteps);
    this.renderPhase = clamp(phase, 0, 1);
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private render() {
    const ctx = this.ctx;
    ctx.fillStyle = this.palette.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.showPheromones) this.drawPheromones();
    if (this.showBest) this.drawBestPath();
    this.drawCities();
    this.drawAnts();
  }

  private drawPheromones() {
    const n = this.cityCount;
    if (n <= 1) return;
    let max = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const p = this.pheromones[i * n + j];
        if (p > max) max = p;
      }
    }
    if (max <= 0) max = 1;

    const minDim = Math.min(this.width, this.height);
    const minLine = Math.max(0.5, minDim * 0.001);
    const maxLine = minLine * 4;
    const [r, g, b] = this.palette.pheromone;

    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    for (let i = 0; i < n; i++) {
      const a = this.cities[i];
      for (let j = i + 1; j < n; j++) {
        const p = this.pheromones[i * n + j];
        const intensity = p / max;
        if (intensity < 0.02) continue;
        const alpha = 0.05 + intensity * 0.45;
        this.ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        this.ctx.lineWidth = minLine + intensity * (maxLine - minLine);
        const bCity = this.cities[j];
        this.ctx.beginPath();
        this.ctx.moveTo(a.x, a.y);
        this.ctx.lineTo(bCity.x, bCity.y);
        this.ctx.stroke();
      }
    }
  }

  private drawBestPath() {
    if (!this.bestTour || this.bestTour.length === 0) return;
    const n = this.cityCount;
    if (n <= 1) return;
    const minDim = Math.min(this.width, this.height);
    this.ctx.strokeStyle = this.palette.best;
    this.ctx.lineWidth = Math.max(1.5, minDim * 0.003);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.beginPath();
    const first = this.bestTour[0];
    this.ctx.moveTo(this.cities[first].x, this.cities[first].y);
    for (let i = 1; i <= n; i++) {
      const idx = this.bestTour[i];
      this.ctx.lineTo(this.cities[idx].x, this.cities[idx].y);
    }
    this.ctx.stroke();
  }

  private drawCities() {
    const minDim = Math.min(this.width, this.height);
    const radius = Math.max(3, minDim * 0.006);
    const strokeW = Math.max(1, minDim * 0.0015);
    this.ctx.fillStyle = this.palette.city;
    this.ctx.strokeStyle = this.palette.cityStroke;
    this.ctx.lineWidth = strokeW;

    for (const city of this.cities) {
      this.ctx.beginPath();
      this.ctx.arc(city.x, city.y, radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    }
  }

  private drawAnts() {
    if (this.ants.length === 0) return;
    const minDim = Math.min(this.width, this.height);
    const radius = Math.max(2, minDim * 0.004);
    for (const ant of this.ants) {
      const t = ant.done ? 1 : clamp(this.renderPhase, 0, 1);
      const from = this.cities[ant.prev];
      const to = this.cities[ant.current];
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      this.ctx.fillStyle = ant.color;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
}
