'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';
import InstrumentPanel from '../components/InstrumentPanel';
import ControlPanel, { Field, Section } from '../components/ControlPanel';
import CodeRunner from '../components/CodeRunner';
import LiveControls from '../components/LiveControls';
import { useLiveSolver } from '../lib/useLiveSolver';
import { mulberry32, randomPoints } from '../lib/generate';
import { CLASS_META, type TestCase } from '../lib/types';

type Point = [number, number];

interface TspInput {
  points: Point[];
}

interface TspStep {
  tour: number[];
  length: number;
  note: string;
  /** 蚁群专用：信息素矩阵（行列索引 = 真实节点编号） */
  pheromone?: number[][];
  /** 信息素快照对应的节点编号（采样时行列 ≠ 节点编号，需要这层映射） */
  pheromoneNodes?: number[];
  best?: number[];
  bestLength?: number;
}

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function tourLength(tour: number[], points: Point[]): number {
  let total = 0;
  for (let i = 0; i < tour.length; i++) {
    total += dist(points[tour[i]], points[tour[(i + 1) % tour.length]]);
  }
  return total;
}

function isPermutation(output: unknown, input: TspInput): boolean {
  if (!Array.isArray(output) || output.length !== input.points.length) return false;
  const seen = new Set<number>();
  for (const v of output) {
    if (!Number.isInteger(v) || v < 0 || v >= input.points.length || seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}

/** 最优解（仅 ≤10 点，作为参照） */
function optimalTour(points: Point[]): { tour: number[]; length: number } {
  const n = points.length;
  if (n > 10) return { tour: [], length: Number.NaN };
  let best: number[] = [];
  let bestLen = Infinity;
  const used = new Array(n).fill(false);
  const cur: number[] = [0];
  used[0] = true;

  const dfs = () => {
    if (cur.length === n) {
      const len = tourLength(cur, points);
      if (len < bestLen) {
        bestLen = len;
        best = [...cur];
      }
      return;
    }
    for (let j = 1; j < n; j++) {
      if (used[j]) continue;
      used[j] = true;
      cur.push(j);
      dfs();
      cur.pop();
      used[j] = false;
    }
  };

  dfs();
  return { tour: best, length: bestLen };
}

/** log10(n!) 用对数累加，避免溢出 */
function factorialLog10(n: number): number {
  let s = 0;
  for (let i = 2; i <= n; i++) s += Math.log10(i);
  return s;
}

const CASES: TestCase<TspInput, number[]>[] = [
  {
    name: '7 点 · 环形',
    input: {
      points: [
        [50, 20],
        [90, 45],
        [85, 95],
        [45, 110],
        [15, 80],
        [10, 40],
        [50, 65],
      ],
    },
    expected: [],
    validate: isPermutation,
  },
  {
    name: '6 点 · 两簇',
    input: {
      points: [
        [20, 30],
        [30, 25],
        [25, 45],
        [80, 70],
        [95, 65],
        [85, 90],
      ],
    },
    expected: [],
    validate: isPermutation,
  },
  {
    name: '8 点 · 散布',
    input: {
      points: [
        [12, 18],
        [48, 8],
        [88, 22],
        [70, 58],
        [96, 92],
        [40, 78],
        [8, 66],
        [52, 44],
      ],
    },
    expected: [],
    validate: isPermutation,
  },
];

/* ---------------- 算法 ---------------- */

function nnTour(points: Point[]): number[] {
  const n = points.length;
  const visited = new Array(n).fill(false);
  const tour = [0];
  visited[0] = true;
  while (tour.length < n) {
    const last = tour[tour.length - 1];
    let best = -1;
    let bestDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (visited[j]) continue;
      const d = dist(points[last], points[j]);
      if (d < bestDist) {
        bestDist = d;
        best = j;
      }
    }
    tour.push(best);
    visited[best] = true;
  }
  return tour;
}

function* nnGen(points: Point[]): Generator<TspStep, number[], void> {
  const n = points.length;
  const visited = new Array(n).fill(false);
  const tour = [0];
  visited[0] = true;
  yield { tour: [...tour], length: 0, note: '从点 0 出发' };

  while (tour.length < n) {
    const last = tour[tour.length - 1];
    let best = -1;
    let bestDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (visited[j]) continue;
      const d = dist(points[last], points[j]);
      if (d < bestDist) {
        bestDist = d;
        best = j;
      }
    }
    tour.push(best);
    visited[best] = true;
    yield {
      tour: [...tour],
      length: tourLength(tour, points),
      note: `从 ${last} 走向最近的未访问点 ${best}（${bestDist.toFixed(1)}）`,
    };
  }

  yield { tour: [...tour], length: tourLength(tour, points), note: '回到起点，形成闭合回路' };
  return tour;
}

function* twoOptGen(points: Point[]): Generator<TspStep, number[], void> {
  let tour = nnTour(points);
  yield { tour: [...tour], length: tourLength(tour, points), note: '以最近邻解为初始回路' };

  let improved = true;
  let guard = 0;
  while (improved && guard++ < 100) {
    improved = false;
    for (let i = 0; i < tour.length - 1; i++) {
      for (let j = i + 2; j < tour.length; j++) {
        if (i === 0 && j === tour.length - 1) continue;
        const a = tour[i];
        const b = tour[i + 1];
        const c = tour[j];
        const d = tour[(j + 1) % tour.length];
        const delta =
          dist(points[a], points[c]) +
          dist(points[b], points[d]) -
          dist(points[a], points[b]) -
          dist(points[c], points[d]);
        if (delta < -1e-9) {
          const segment = tour.slice(i + 1, j + 1).reverse();
          tour = [...tour.slice(0, i + 1), ...segment, ...tour.slice(j + 1)];
          yield {
            tour: [...tour],
            length: tourLength(tour, points),
            note: `2-opt：反转 ${i + 1}..${j} 段，缩短 ${(-delta).toFixed(2)}`,
          };
          improved = true;
        }
      }
    }
  }

  yield { tour: [...tour], length: tourLength(tour, points), note: '没有可改进的 2-opt 变换，停止' };
  return tour;
}

function* bruteGen(points: Point[]): Generator<TspStep, number[], void> {
  const n = points.length;
  const used = new Array(n).fill(false);
  const cur = [0];
  used[0] = true;
  let bestLen = Infinity;
  let best: number[] = [0];

  function* dfs(): Generator<TspStep, void, void> {
    if (cur.length === n) {
      const len = tourLength(cur, points);
      if (len < bestLen - 1e-9) {
        bestLen = len;
        best = [...cur];
        yield { tour: [...cur], length: len, note: `枚举到更短回路 ${len.toFixed(2)}` };
      }
      return;
    }
    for (let j = 1; j < n; j++) {
      if (used[j]) continue;
      used[j] = true;
      cur.push(j);
      yield* dfs();
      cur.pop();
      used[j] = false;
    }
  }

  yield* dfs();
  return best;
}

/** 蚁群算法：每只蚂蚁走完一圈产出一帧，并展示信息素浓度 */
function* acoGen(
  points: Point[],
  ants: number,
  rho: number,
): Generator<TspStep, number[], void> {
  const n = points.length;
  const tau = Array.from({ length: n }, () => new Array(n).fill(1));
  // 预计算 eta^BETA（BETA=3）：内层选择循环从 2 次 pow 降为 2 次乘法（n=1024 时每圈省千万次 pow）
  const etaB = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i === j ? 0 : Math.pow(1 / Math.max(dist(points[i], points[j]), 1e-9), 3),
    ),
  );
  // 大实例（n² > 14400）不再每步全量拷贝信息素矩阵：拷贝 100 万元素/步会把内存吃满。
  // 快照按均匀间隔采 60 个真实节点（行列索引 = pheromoneNodes 里的节点编号），
  // 算法本体仍用完整矩阵；渲染端按 pheromoneNodes 把浓度画到正确的节点对上。
  const SAMPLE = 60;
  const sampleNodes =
    n <= SAMPLE
      ? Array.from({ length: n }, (_, i) => i)
      : Array.from({ length: SAMPLE }, (_, i) => Math.floor((i * n) / SAMPLE));
  const snap = (): { tau: number[][]; nodes: number[] } => {
    if (n <= SAMPLE) return { tau: tau.map((r) => [...r]), nodes: sampleNodes };
    const k = sampleNodes.length;
    const out = Array.from({ length: k }, (_, i) => {
      const row = tau[sampleNodes[i]];
      return Array.from({ length: k }, (_, j) => row[sampleNodes[j]]);
    });
    return { tau: out, nodes: sampleNodes };
  };

  const rnd = mulberry32(7);
  let best: number[] = [];
  let bestLen = Infinity;

  {
    const s = snap();
    yield {
      tour: [],
      length: 0,
      note: `初始信息素均匀分布，${ants} 只蚂蚁持续搜索`,
      pheromone: s.tau,
      pheromoneNodes: s.nodes,
    };
  }

  // 不设轮数上限：一直跑到用户手动停止
  for (let iter = 0; ; iter++) {
    const tours: number[][] = [];

    for (let k = 0; k < ants; k++) {
      const start = Math.floor(rnd() * n);
      const visited = new Array(n).fill(false);
      const tour = [start];
      visited[start] = true;

      while (tour.length < n) {
        const cur = tour[tour.length - 1];
        let total = 0;
        const weights = new Array(n).fill(0);
        const tauRow = tau[cur];
        const etaRow = etaB[cur];
        for (let j = 0; j < n; j++) {
          if (visited[j]) continue;
          const w = tauRow[j] * etaRow[j];
          weights[j] = w;
          total += w;
        }

        let pick = -1;
        if (total <= 0) {
          pick = weights.findIndex((w, j) => !visited[j] && w >= 0);
        } else {
          let r = rnd() * total;
          for (let j = 0; j < n; j++) {
            if (visited[j]) continue;
            r -= weights[j];
            if (r <= 0) {
              pick = j;
              break;
            }
          }
        }
        if (pick === -1) pick = weights.findIndex((w, j) => !visited[j]);
        tour.push(pick);
        visited[pick] = true;
      }

      const len = tourLength(tour, points);
      tours.push(tour);
      const improved = len < bestLen;
      if (improved) {
        bestLen = len;
        best = [...tour];
      }

      {
        const s = snap();
        yield {
          tour: [...tour],
          length: len,
          note: `第 ${iter + 1} 轮 · 第 ${k + 1} 只蚂蚁：${len.toFixed(2)}${improved ? '（刷新最优）' : ''}`,
          pheromone: s.tau,
          pheromoneNodes: s.nodes,
          best: [...best],
          bestLength: bestLen,
        };
      }
    }
    // 挥发（只处理 i<j 上三角，等价且省一半）
    for (let i = 0; i < n; i++) {
      const row = tau[i];
      for (let j = i + 1; j < n; j++) {
        const v = row[j] * (1 - rho);
        row[j] = v;
        tau[j][i] = v;
      }
    }
    // 本轮所有蚂蚁按路径长度沉积信息素
    for (const t of tours) {
      const add = 1 / tourLength(t, points);
      for (let i = 0; i < n; i++) {
        const a = t[i];
        const b = t[(i + 1) % n];
        tau[a][b] += add;
        tau[b][a] += add;
      }
    }

  }
  // 理论上到不了这里（无限循环），只为满足类型
  return best;
}

const TEMPLATE = `function solve(input) {
  const { points } = input;

  // TODO: 返回一个访问所有点的顺序（0..n-1 的排列）
  // 例如 [0, 2, 1, 3]，首尾自动相连
  return points.map((_, i) => i);
}`;

const SOLUTION = `function solve(input) {
  const { points } = input;
  const n = points.length;
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  const visited = new Array(n).fill(false);
  const tour = [0];
  visited[0] = true;
  while (tour.length < n) {
    const last = tour[tour.length - 1];
    let best = -1;
    let bestDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (visited[j]) continue;
      const dd = d(points[last], points[j]);
      if (dd < bestDist) { bestDist = dd; best = j; }
    }
    tour.push(best);
    visited[best] = true;
  }

  const len = (t) => t.reduce((s, v, i) => s + d(points[v], points[t[(i + 1) % t.length]]), 0);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const before = len(tour);
        const next = [...tour.slice(0, i + 1), ...tour.slice(i + 1, j + 1).reverse(), ...tour.slice(j + 1)];
        if (len(next) < before - 1e-9) { tour = next; improved = true; }
      }
    }
  }
  return tour;
}`;

type AlgoKey = 'nn' | '2opt' | 'aco' | 'brute';

export default function TspPage() {
  const [algo, setAlgo] = useState<AlgoKey>('2opt');
  const [count, setCount] = useState(12);
  const [spread, setSpread] = useState(0.8);
  const [seed, setSeed] = useState(4);
  const [speed, setSpeed] = useState(1);

  const [ants, setAnts] = useState(8);
  const [rho, setRho] = useState(0.4);

  const input = useMemo<TspInput>(() => ({ points: randomPoints(count, spread, seed) }), [count, spread, seed]);
  const points = input.points;

  const canBrute = points.length <= 10;
  const activeAlgo: AlgoKey = algo === 'brute' && !canBrute ? '2opt' : algo;

  const factory = useCallback(() => {
    if (activeAlgo === 'nn') return nnGen(points);
    if (activeAlgo === 'aco') return acoGen(points, ants, rho);
    if (activeAlgo === 'brute') return bruteGen(points);
    return twoOptGen(points);
  }, [activeAlgo, points, ants, rho]);

  const solver = useLiveSolver<TspStep, number[]>(factory, [activeAlgo, points, ants, rho], {
    stepsPerFrame: speed,
  });

  const optimal = useMemo(() => optimalTour(points), [points]);

  const step: TspStep =
    solver.current ?? { tour: [], length: 0, note: '尚未开始，点「开始求解」' };
  const tour = solver.result ?? step.tour;

  const started = solver.stepCount > 0;


  const current = step.length || (started ? tourLength(tour, points) : 0);
  const hasOptimal = started && Number.isFinite(optimal.length) && optimal.length > 0;
  const gap = hasOptimal ? ((current - optimal.length) / optimal.length) * 100 : Number.NaN;

  // 测量画布容器尺寸：viewBox 与容器比例保持一致，空间才不会浪费
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [mapSize, setMapSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const update = () => setMapSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const view = useMemo(() => {
    // 未测量完成前先用 2:1 的默认比例，首帧后立刻被真实尺寸替换
    const W = mapSize.w > 0 ? Math.max(320, mapSize.w) : 1000;
    // SVG 有 max-h-[480px]：测量高度按 480 封顶，viewBox 比例才与实际渲染框一致
    const H = mapSize.h > 0 ? Math.min(480, Math.max(240, mapSize.h)) : 480;
    const PAD = 30;
    // 按点云实际包围盒缩放（X/Y 独立，铺满画布不留大片空白）；
    // 距离仍按原始坐标计算，投影只是视觉拉伸，不影响算法与长度对比
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of points) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    // 单点/重合点兜底：至少给 1 单位跨度
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const scaleX = (W - PAD * 2) / spanX;
    const scaleY = (H - PAD * 2) / spanY;

    return {
      width: W,
      height: H,
      pos: points.map(([x, y]) => ({
        x: PAD + (x - minX) * scaleX,
        y: H - (PAD + (y - minY) * scaleY),
      })),
    };
  }, [points, mapSize]);

  // 点越多，半径越小、编号越早隐藏
  const nodeR = points.length <= 16 ? 7 : points.length <= 30 ? 5 : points.length <= 45 ? 3.6 : points.length <= 80 ? 2.8 : points.length <= 300 ? 2.2 : 1.4;
  const showLabels = points.length <= 24;

  const path = step.tour.map((node) => `${view.pos[node].x},${view.pos[node].y}`).join(' ');
  const closed = step.tour.length === points.length;
  const last = step.tour[step.tour.length - 1];

  // 蚁群模式：地图只画历史最优回路（试探路径每只蚂蚁都不同，画出来会一直变来变去）；
  // 当前蚂蚁的路径长度仍通过读数展示
  const acoBestPath =
    activeAlgo === 'aco' && step.best && step.best.length
      ? [...step.best, step.best[0]].map((node) => `${view.pos[node].x},${view.pos[node].y}`).join(' ')
      : '';
  const linePath = activeAlgo === 'aco' ? acoBestPath : path;
  const lineClosed = activeAlgo === 'aco' ? acoBestPath.length > 0 : closed;

  // 蚁群信息素：min-max 对比度拉伸后画线。快照行列通过 pheromoneNodes 映射到真实节点。
  // 不用 tau/max：初始均匀浓度下大部分边相等、全部贴着 max，看不出层次；
  // 拉伸后未被沉积的边 → t=0（隐没），被蚂蚁偏好的边 → 高亮，浓度分化一目了然
  const pheromoneEdges = useMemo(() => {
    if (!step.pheromone || activeAlgo !== 'aco') return [];
    const tau = step.pheromone;
    const nodes = step.pheromoneNodes ?? tau.map((_, i) => i);
    let min = Infinity;
    let max = 0;
    for (let i = 0; i < tau.length; i++) {
      for (let j = i + 1; j < tau.length; j++) {
        const v = tau[i][j];
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    // 浓度还没分化（极差太小）：不画，避免全屏噪声
    if (max - min < 1e-6) return [];
    const pairs: { a: number; b: number; t: number }[] = [];
    for (let i = 0; i < tau.length; i++) {
      for (let j = i + 1; j < tau.length; j++) {
        const t = (tau[i][j] - min) / (max - min);
        if (t > 0.12) pairs.push({ a: nodes[i], b: nodes[j], t });
      }
    }
    pairs.sort((a, b) => b.t - a.t);
    return pairs.slice(0, 400);
  }, [step.pheromone, step.pheromoneNodes, activeAlgo]);

  return (
    <main className="min-h-screen bg-zinc-50">
      <Navigation
        title="旅行商问题"
        header={
          <>
            <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${CLASS_META['NPH'].chip}`}>
              {CLASS_META['NPH'].label}
            </span>
            <span className="font-mono text-sm font-bold tracking-wide text-zinc-900">旅行商问题</span>
          </>
        }
        actions={<CodeRunner template={TEMPLATE} solution={SOLUTION} cases={CASES} />}
      />

      <div className="flex min-h-screen flex-col px-4 pb-6 pt-16 sm:px-6 lg:px-8 lg:pb-6">
        <div className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col gap-4 lg:min-h-0 lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
            <div className="flex min-h-0 flex-1 flex-col">
              <InstrumentPanel
                label="MAP"
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                meta={`${points.length} points`}
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    {activeAlgo === 'nn'
                      ? 'NEAREST_NEIGHBOR'
                      : activeAlgo === '2opt'
                        ? '2-OPT'
                        : activeAlgo === 'aco'
                          ? 'ANT_COLONY'
                          : 'BRUTE_FORCE'}
                  </span>
                }
              >
                <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
                <div ref={mapRef} className="flex min-h-0 flex-1 items-center justify-center p-2">
                  <svg
                    viewBox={`0 0 ${view.width} ${view.height}`}
                    className="h-full max-h-[480px] w-full"
                    preserveAspectRatio="xMidYMid meet"
                    role="img"
                    aria-label="旅行商路径"
                  >
                    <defs>
                      <filter id="tsp-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    {/* 信息素浓度：紫色「高速路」，粗细 = 浓度^3 放大层次 */}
                    {pheromoneEdges.map(({ a, b, t }) => (
                      <line
                        key={`p-${a}-${b}`}
                        x1={view.pos[a].x}
                        y1={view.pos[a].y}
                        x2={view.pos[b].x}
                        y2={view.pos[b].y}
                        stroke="#a855f7"
                        strokeWidth={0.5 + t * t * t * 6}
                        opacity={0.08 + t * t * 0.5}
                      />
                    ))}

                    {linePath && (
                      <>
                        <polyline
                          points={linePath}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth={6}
                          strokeOpacity={0.18}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                        <polyline
                          points={linePath}
                          fill="none"
                          stroke="#60a5fa"
                          strokeWidth={2.8}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      </>
                    )}

                    {linePath && !lineClosed && (
                      <line
                        x1={view.pos[last].x}
                        y1={view.pos[last].y}
                        x2={view.pos[step.tour[0]].x}
                        y2={view.pos[step.tour[0]].y}
                        stroke="#60a5fa"
                        strokeWidth={2.2}
                        strokeDasharray="5 4"
                        opacity={0.85}
                      />
                    )}

                    {points.map((_, i) => {
                      const dense = points.length > 200;
                      return (
                        <g key={i}>
                          {!dense && (
                            <circle cx={view.pos[i].x} cy={view.pos[i].y} r={nodeR * 2.6} fill="#3b82f6" opacity={0.12} />
                          )}
                          {dense ? (
                            // 大规模：纯色小方点，不带滤镜（上千个高斯模糊会把绘制拖垮）
                            <circle cx={view.pos[i].x} cy={view.pos[i].y} r={nodeR} fill="#93c5fd" />
                          ) : (
                            <circle cx={view.pos[i].x} cy={view.pos[i].y} r={nodeR} fill="#93c5fd" filter="url(#tsp-glow)" />
                          )}
                          {showLabels && (
                            <text
                              x={view.pos[i].x}
                              y={view.pos[i].y - nodeR - 7}
                              textAnchor="middle"
                              fontSize="11"
                              fontFamily="monospace"
                              fill="#a1a1aa"
                            >
                              {i}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>


                {/* 右侧信息条（并入画布） */}
                <div className="flex shrink-0 flex-col justify-center gap-5 border-t border-white/[0.06] p-4 sm:w-[240px] sm:border-l sm:border-t-0">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">
                      当前长度
                    </div>
                    <div className="mt-1 font-mono text-3xl font-black tabular-nums text-zinc-100">
                      {current.toFixed(2)}
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-baseline justify-between font-mono text-[10px] text-zinc-500">
                        <span>最优</span>
                        <span className="tabular-nums text-zinc-300">
                          {hasOptimal ? optimal.length.toFixed(2) : '—'}
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            !hasOptimal
                              ? 'bg-white/20'
                              : gap < 0.01
                                ? 'bg-emerald-500'
                                : gap < 5
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                          }`}
                          style={{
                            width: hasOptimal
                              ? `${Math.min(100, (optimal.length / Math.max(current, 1)) * 100)}%`
                              : '0%',
                          }}
                        />
                      </div>
                      <div className="flex items-baseline justify-between font-mono text-[10px] text-zinc-500">
                        <span>差距</span>
                        <span
                          className={`tabular-nums ${
                            !hasOptimal
                              ? 'text-zinc-500'
                              : gap < 0.01
                                ? 'text-emerald-400'
                                : gap < 5
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                          }`}
                        >
                          {hasOptimal ? `${gap.toFixed(2)}%` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">
                      {activeAlgo === 'aco' ? '蚁群' : '步骤'}
                    </div>
                    {activeAlgo === 'aco' ? (
                      <div className="mt-1 space-y-1 font-mono text-[10px] text-zinc-500">
                        <div className="flex justify-between">
                          <span>蚂蚁数</span>
                          <span className="text-zinc-300">{ants} 只</span>
                        </div>
                        <div className="flex justify-between">
                          <span>历史最优</span>
                          <span className="tabular-nums text-zinc-300">
                            {step.bestLength !== undefined ? step.bestLength.toFixed(2) : '—'}
                          </span>
                        </div>
                        <p className="pt-1 leading-relaxed text-zinc-600">{step.note}</p>
                      </div>
                    ) : (
                      <p className="mt-1 font-mono text-[10px] leading-relaxed text-zinc-500">
                        {step.note}
                      </p>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">
                      最终回路
                    </div>
                    {(() => {
                      const tour =
                        activeAlgo === 'aco'
                          ? step.best && step.best.length
                            ? step.best
                            : null
                          : solver.done && solver.result && solver.result.length
                            ? solver.result
                            : null;
                      // 大实例不展开完整路径（上千个编号会把面板刷满），只显示规模 + 前几个节点预览
                      if (tour && tour.length > 60) {
                        return (
                          <p className="mt-1 font-mono text-[10px] leading-relaxed text-zinc-400">
                            {tour.length} 个节点 · {`${tour.slice(0, 8).join(' → ')} → …`}（完整路径见地图）
                          </p>
                        );
                      }
                      return (
                        <p className="mt-1 break-all font-mono text-[10px] leading-relaxed text-zinc-400">
                          {tour ? `${tour.join(' → ')} → ${tour[0]}` : '—'}
                        </p>
                      );
                    })()}
                  </div>
                </div>
                </div>

                <div className="border-t border-white/[0.06] px-4 py-2.5">
                  <LiveControls
                    running={solver.running}
                    done={solver.done}
                    elapsed={solver.elapsed}
                    computeMs={solver.computeMs}
                    stepCount={solver.stepCount}
                    total={solver.stepCount}
                    speed={speed}
                    onSpeed={setSpeed}
                    onStart={solver.start}
                    onPause={solver.pause}
                    onReset={solver.reset}
                    onStep={solver.stepOnce}
                  />
                </div>
              </InstrumentPanel>
            </div>
          </div>

          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field
                label="点数 (POINTS)"
                value={count}
                min={5}
                max={1024}
                step={1}
                onChange={setCount}
                format={(v) =>
                  v <= 10
                    ? `(${v - 1})! / 2 可精确求解`
                    : `(${v - 1})! / 2 ≈ 10^${factorialLog10(v - 1).toFixed(0)} 条回路，精确解不可行`
                }
              />
              <Field
                label="聚散度 (SPREAD)"
                value={Math.round(spread * 100)}
                min={0}
                max={100}
                step={5}
                onChange={(v) => setSpread(v / 100)}
                format={(v) => (v < 40 ? '聚成簇' : v > 75 ? '散开' : '混合')}
              />
              <button
                onClick={() => setSeed((s) => s + 1)}
                className="w-full border border-zinc-200 bg-zinc-50 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:border-blue-500/50 hover:bg-white hover:text-blue-600"
              >
                重新生成 (RESHUFFLE)
              </button>
            </Section>

            <Section title="算法 (ALGORITHM)">
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    ['nn', '最近邻'],
                    ['2opt', '2-opt'],
                    ['aco', '蚁群'],
                    ['brute', canBrute ? '暴力' : '暴力 ✕'],
                  ] as [AlgoKey, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setAlgo(key)}
                    className={`rounded-md border px-2 py-1.5 text-[11px] font-bold transition-colors ${
                      activeAlgo === key
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-500 hover:border-blue-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {!canBrute && (
                <p className="font-mono text-[10px] text-zinc-400">暴力最优仅支持 ≤10 点</p>
              )}
            </Section>

            {activeAlgo === 'aco' && (
              <Section title="蚁群参数 (ACO)">
                <Field label="蚂蚁数 (ANTS)" value={ants} min={3} max={20} step={1} onChange={setAnts} />
                <Field
                  label="挥发率 (RHO)"
                  value={Math.round(rho * 100)}
                  min={10}
                  max={90}
                  step={5}
                  onChange={(v) => setRho(v / 100)}
                  format={(v) => `${v}%`}
                />
              </Section>
            )}

            <Section title="数据 (DATA)">
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">点数</span>
                  <span className="text-zinc-800">{points.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">步数</span>
                  <span className="tabular-nums text-zinc-800">{solver.stepCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">计算耗时</span>
                  <span className="tabular-nums text-zinc-800">{solver.computeMs.toFixed(2)} ms</span>
                </div>
              </div>
            </Section>
          </ControlPanel>
        </div>
      </div>
    </main>
  );
}
