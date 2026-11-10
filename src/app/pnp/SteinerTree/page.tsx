'use client';

import { useCallback, useMemo, useState } from 'react';
import Navigation from '../../components/Navigation';
import InstrumentPanel from '../components/InstrumentPanel';
import ControlPanel, { Field, Section } from '../components/ControlPanel';
import CodeRunner from '../components/CodeRunner';
import LiveControls from '../components/LiveControls';
import { useLiveSolver } from '../lib/useLiveSolver';
import { randomGraph, mulberry32 } from '../lib/generate';
import { CLASS_META, type TestCase } from '../lib/types';

interface STInput {
  n: number;
  edges: [number, number][];
  weights: number[];
  terminals: number[];
}

interface STStep {
  /** 当前已完成的最优树（点集合） */
  treeNodes: number[];
  treeEdges: [number, number][];
  /** 当前处理的子集（终端索引位掩码）与汇合点 */
  subset: number[];
  hub: number | null;
  bestCost: number;
  phase: 'init' | 'subset' | 'merge' | 'done';
  note: string;
}

const TITLE = '斯坦纳树';
const CLS = 'NPH' as const;

/* ---------------- 算法 ---------------- */

function floydWarshall(input: STInput) {
  const { n, edges, weights } = input;
  const INF = Infinity;
  const dist: number[][] = Array.from({ length: n }, () => new Array(n).fill(INF));
  const next: number[][] = Array.from({ length: n }, () => new Array(n).fill(-1));
  for (let i = 0; i < n; i++) {
    dist[i][i] = 0;
    next[i][i] = i;
  }
  edges.forEach(([u, v], idx) => {
    const w = weights[idx];
    if (w < dist[u][v]) {
      dist[u][v] = w;
      dist[v][u] = w;
      next[u][v] = v;
      next[v][u] = u;
    }
  });
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (dist[i][k] + dist[k][j] < dist[i][j]) {
          dist[i][j] = dist[i][k] + dist[k][j];
          next[i][j] = next[i][k];
        }
      }
    }
  }
  return { dist, next };
}

function tracePath(next: number[][], u: number, v: number): number[] {
  if (next[u][v] === -1) return [];
  const path = [u];
  let cur = u;
  while (cur !== v) {
    cur = next[cur][v];
    path.push(cur);
  }
  return path;
}

/** 树代价：按点集重建边（用最短路路径拼接） */
function treeCost(input: STInput, dist: number[][], nodes: number[]): number {
  // 树 = 按加入顺序的最短路拼接；这里用 Prim 式近似重建
  if (nodes.length === 0) return 0;
  const inTree = new Set<number>([nodes[0]]);
  let cost = 0;
  for (let k = 1; k < nodes.length; k++) {
    let bd = Infinity;
    let bn = -1;
    for (const t of inTree) {
      if (dist[t][nodes[k]] < bd) {
        bd = dist[t][nodes[k]];
        bn = t;
      }
    }
    cost += bd;
    inTree.add(nodes[k]);
    void bn;
  }
  return cost;
}

/** 参考解：Dreyfus–Wagner 子集 DP（终端数 ≤ 8 时精确） */
function steinerRef(input: STInput): { cost: number; nodes: number[] } {
  const { n, terminals } = input;
  const { dist, next } = floydWarshall(input);
  const t = terminals.length;
  const FULL = (1 << t) - 1;
  // dp[mask][v] = 把 mask 中终端连到 v 的最小代价
  const dp: number[][] = Array.from({ length: 1 << t }, () => new Array(n).fill(Infinity));
  for (let v = 0; v < n; v++) {
    dp[0][v] = 0;
  }
  for (let s = 0; s < t; s++) {
    for (let v = 0; v < n; v++) dp[1 << s][v] = dist[terminals[s]][v];
  }
  for (let mask = 1; mask <= FULL; mask++) {
    for (let v = 0; v < n; v++) {
      // 子集拆分
      for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
        const other = mask ^ sub;
        if (dp[sub][v] + dp[other][v] < dp[mask][v]) dp[mask][v] = dp[sub][v] + dp[other][v];
      }
      // 点扩展
      for (let u = 0; u < n; u++) {
        if (dp[mask][u] + dist[u][v] < dp[mask][v]) dp[mask][v] = dp[mask][u] + dist[u][v];
      }
    }
  }
  // 找最优汇合点
  let bestV = 0;
  for (let v = 1; v < n; v++) {
    if (dp[FULL][v] < dp[FULL][bestV]) bestV = v;
  }
  const cost = dp[FULL][bestV];

  // 回溯重建树节点集合
  const nodes = new Set<number>();
  const rebuild = (mask: number, v: number) => {
    nodes.add(v);
    if (mask === 0) return;
    if ((mask & (mask - 1)) === 0) {
      // 单终端：加路径
      const s = Math.log2(mask) | 0;
      const path = tracePath(next, terminals[s], v);
      path.forEach((p) => nodes.add(p));
      return;
    }
    // 找子集拆分或扩展前驱
    let found = false;
    for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
      const other = mask ^ sub;
      if (Math.abs(dp[sub][v] + dp[other][v] - dp[mask][v]) < 1e-9) {
        rebuild(sub, v);
        rebuild(other, v);
        found = true;
        break;
      }
    }
    if (!found) {
      for (let u = 0; u < n; u++) {
        if (u !== v && Math.abs(dp[mask][u] + dist[u][v] - dp[mask][v]) < 1e-9) {
          rebuild(mask, u);
          nodes.add(v);
          return;
        }
      }
    }
  };
  rebuild(FULL, bestV);
  return { cost, nodes: [...nodes] };
}

function validate(output: unknown, input: STInput): boolean {
  if (typeof output !== 'number') return false;
  const ref = steinerRef(input);
  // 允许 1e-6 误差（浮点路径求和）
  return Math.abs(output - ref.cost) < 1e-6;
}

function makeCase(name: string, input: STInput): TestCase<STInput, number> {
  const ref = steinerRef(input);
  return { name, input, expected: ref.cost, validate: (out) => validate(out, input) };
}

const CASES: TestCase<STInput, number>[] = [
  makeCase('三角+中心', {
    n: 4,
    edges: [
      [0, 1],
      [1, 2],
      [0, 2],
      [0, 3],
      [1, 3],
      [2, 3],
    ],
    weights: [4, 4, 4, 2, 2, 2],
    terminals: [0, 1, 2],
  }),
  makeCase('链式终端', {
    n: 5,
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [0, 2],
    ],
    weights: [3, 1, 3, 2, 5],
    terminals: [0, 2, 4],
  }),
  makeCase('必经中转', {
    n: 5,
    edges: [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 3],
      [3, 4],
    ],
    weights: [2, 2, 2, 2, 1],
    terminals: [0, 1, 2],
  }),
];

/** 生成器：逐步演示子集 DP（简化为按 mask 从小到大 + 汇合点扫描的帧序列） */
function* steinerGen(input: STInput): Generator<STStep, number, void> {
  const { n, terminals } = input;
  const { dist, next } = floydWarshall(input);
  const t = terminals.length;
  const FULL = (1 << t) - 1;

  const treeOf = (nodes: number[]): [number, number][] => {
    // 按最短路重建边序列
    const out: [number, number][] = [];
    const arr = [...nodes];
    const inTree = new Set<number>([arr[0]]);
    for (let k = 1; k < arr.length; k++) {
      let bd = Infinity;
      let bn = -1;
      for (const s of inTree) {
        if (dist[s][arr[k]] < bd) {
          bd = dist[s][arr[k]];
          bn = s;
        }
      }
      const path = tracePath(next, bn, arr[k]);
      for (let p = 0; p + 1 < path.length; p++) out.push([path[p], path[p + 1]]);
      inTree.add(arr[k]);
    }
    return out;
  };

  yield {
    treeNodes: [terminals[0]],
    treeEdges: [],
    subset: [],
    hub: null,
    bestCost: Infinity,
    phase: 'init',
    note: `终端 [${terminals.join(', ')}]：Dreyfus–Wagner 子集 DP，2^${t}−1 个子集`,
  };

  const dp: number[][] = Array.from({ length: 1 << t }, () => new Array(n).fill(Infinity));
  for (let v = 0; v < n; v++) dp[0][v] = 0;
  for (let s = 0; s < t; s++) {
    for (let v = 0; v < n; v++) dp[1 << s][v] = dist[terminals[s]][v];
  }

  let lastTreeNodes: number[] = [terminals[0]];
  let lastTreeEdges: [number, number][] = [];
  let bestCost = Infinity;

  for (let mask = 1; mask <= FULL; mask++) {
    const subset: number[] = [];
    for (let s = 0; s < t; s++) if (mask & (1 << s)) subset.push(terminals[s]);

    for (let v = 0; v < n; v++) {
      for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
        const other = mask ^ sub;
        if (dp[sub][v] + dp[other][v] < dp[mask][v]) dp[mask][v] = dp[sub][v] + dp[other][v];
      }
      for (let u = 0; u < n; u++) {
        if (dp[mask][u] + dist[u][v] < dp[mask][v]) dp[mask][v] = dp[mask][u] + dist[u][v];
      }
    }

    // 找该子集的汇合点（帧演示用）
    let hub = 0;
    for (let v = 1; v < n; v++) if (dp[mask][v] < dp[mask][hub]) hub = v;

    if (mask === FULL) {
      bestCost = dp[FULL][hub];
      const ref = steinerRef(input);
      lastTreeNodes = ref.nodes;
      lastTreeEdges = treeOf(ref.nodes);
      yield {
        treeNodes: lastTreeNodes,
        treeEdges: lastTreeEdges,
        subset,
        hub,
        bestCost,
        phase: 'done',
        note: `全部终端连通：最优斯坦纳树代价 ${bestCost.toFixed(0)}，${ref.nodes.length} 个节点`,
      };
    } else {
      yield {
        treeNodes: lastTreeNodes,
        treeEdges: lastTreeEdges,
        subset,
        hub,
        bestCost: dp[mask][hub],
        phase: 'subset',
        note: `子集 {${subset.join(',')}}：连到点 ${hub} 最省（代价 ${dp[mask][hub].toFixed(0)}）`,
      };
    }
  }

  return bestCost;
}

/* ---------------- 实例生成 ---------------- */

function randomInstance(n: number, density: number, tCount: number, seed: number): STInput {
  const rnd = mulberry32(seed * 13 + 1);
  const edges = randomGraph(n, density, seed);
  // 保证连通：补一条链
  for (let i = 1; i < n; i++) {
    if (!edges.some(([u, v]) => (u === i - 1 && v === i) || (u === i && v === i - 1))) {
      edges.push([i - 1, i]);
    }
  }
  const weights = edges.map(() => 1 + Math.floor(rnd() * 9));
  // 取前 tCount 个分散的终端
  const terminals: number[] = [0];
  let guard = 0;
  while (terminals.length < Math.min(tCount, n) && guard++ < 200) {
    const c = Math.floor(rnd() * n);
    if (!terminals.includes(c)) terminals.push(c);
  }
  return { n, edges, weights, terminals: terminals.sort((a, b) => a - b) };
}

const TEMPLATE = `function solve(input) {
  const { n, edges, weights, terminals } = input;
  // edges[i] 的边权是 weights[i]

  // TODO: 返回连通所有终端的最小代价
  //（允许借用非终端的中转点）
  return 0;
}`;

const SOLUTION = `function solve(input) {
  const { n, edges, weights, terminals } = input;
  // Floyd 全源最短路
  const dist = Array.from({ length: n }, () => new Array(n).fill(Infinity));
  for (let i = 0; i < n; i++) dist[i][i] = 0;
  edges.forEach(([u, v], i) => { dist[u][v] = Math.min(dist[u][v], weights[i]); dist[v][u] = Math.min(dist[v][u], weights[i]); });
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++)
    if (dist[i][k] + dist[k][j] < dist[i][j]) dist[i][j] = dist[i][k] + dist[k][j];

  // Dreyfus–Wagner 子集 DP
  const t = terminals.length, FULL = (1 << t) - 1;
  const dp = Array.from({ length: 1 << t }, () => new Array(n).fill(Infinity));
  for (let v = 0; v < n; v++) dp[0][v] = 0;
  for (let s = 0; s < t; s++) for (let v = 0; v < n; v++) dp[1 << s][v] = dist[terminals[s]][v];
  for (let mask = 1; mask <= FULL; mask++) for (let v = 0; v < n; v++) {
    for (let sub = (mask-1) & mask; sub > 0; sub = (sub-1) & mask)
      dp[mask][v] = Math.min(dp[mask][v], dp[sub][v] + dp[mask ^ sub][v]);
    for (let u = 0; u < n; u++)
      dp[mask][v] = Math.min(dp[mask][v], dp[mask][u] + dist[u][v]);
  }
  return Math.min(...dp[FULL]);
}`;

export default function SteinerTreePage() {
  const [n, setN] = useState(9);
  const [density, setDensity] = useState(0.35);
  const [tCount, setTCount] = useState(4);
  const [seed, setSeed] = useState(5);
  const [speed, setSpeed] = useState(2);

  const input = useMemo(() => randomInstance(n, density, tCount, seed), [n, density, tCount, seed]);

  const factory = useCallback(() => steinerGen(input), [input]);
  const solver = useLiveSolver<STStep, number>(factory, [input], {
    stepsPerFrame: speed,
  });

  const step: STStep =
    solver.current ??
    {
      treeNodes: [],
      treeEdges: [],
      subset: [],
      hub: null,
      bestCost: Infinity,
      phase: 'init',
      note: '尚未开始，点「开始求解」',
    };
  const result = solver.result;
  const done = solver.done;

  const { dist } = useMemo(() => floydWarshall(input), [input]);

  /* 环形布局 */
  const layout = useMemo(() => {
    const W = 820;
    const H = 400;
    const rx = 290;
    const ry = 130;
    return {
      width: W,
      height: H,
      pos: Array.from({ length: input.n }, (_, i) => {
        const angle = (i / input.n) * Math.PI * 2 - Math.PI / 2;
        return { x: W / 2 + rx * Math.cos(angle), y: H / 2 + ry * Math.sin(angle) };
      }),
    };
  }, [input.n]);

  const treeEdgeSet = new Set(step.treeEdges.map(([u, v]) => `${Math.min(u, v)}-${Math.max(u, v)}`));
  const treeNodeSet = new Set(step.treeNodes);
  const terminalSet = new Set(input.terminals);
  const fullCost = useMemo(() => steinerRef(input).cost, [input]);

  const edgeWeight = (u: number, v: number): number => {
    const idx = input.edges.findIndex(([a, b]) => (a === u && b === v) || (a === v && b === u));
    return idx >= 0 ? input.weights[idx] : dist[u][v];
  };

  return (
    <main className="min-h-screen bg-zinc-50">
      <Navigation
        title={TITLE}
        header={
          <>
            <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${CLASS_META[CLS].chip}`}>
              {CLASS_META[CLS].label}
            </span>
            <span className="font-mono text-sm font-bold tracking-wide text-zinc-900">{TITLE}</span>
          </>
        }
        actions={<CodeRunner template={TEMPLATE} solution={SOLUTION} cases={CASES} />}
      />

      <div className="flex min-h-screen flex-col px-4 pb-6 pt-16 sm:px-6 lg:px-8 lg:pb-6">
        <div className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col gap-4 lg:min-h-0 lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
            <div className="flex min-h-0 flex-1 flex-col">
              <InstrumentPanel
                label="DREYFUS–WAGNER"
                meta={`${input.n} nodes / ${input.edges.length} edges / ${input.terminals.length} terminals`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    {step.phase === 'done' ? '完成' : `子集 ${step.subset.length}/${input.terminals.length}`}
                  </span>
                }
              >
                <div className="flex flex-1 items-center justify-center p-4">
                  <svg
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                    className="h-full max-h-[420px] w-full min-h-[180px]"
                    role="img"
                    aria-label="斯坦纳树子集 DP 构造过程"
                  >
                    {/* 全部边（灰） */}
                    {input.edges.map(([u, v], i) => {
                      const inTree = treeEdgeSet.has(`${Math.min(u, v)}-${Math.max(u, v)}`);
                      const mx = (layout.pos[u].x + layout.pos[v].x) / 2;
                      const my = (layout.pos[u].y + layout.pos[v].y) / 2;
                      return (
                        <g key={i}>
                          <line
                            x1={layout.pos[u].x}
                            y1={layout.pos[u].y}
                            x2={layout.pos[v].x}
                            y2={layout.pos[v].y}
                            stroke={inTree ? '#10b981' : '#3f3f46'}
                            strokeWidth={inTree ? 2.6 : 1.3}
                            opacity={inTree ? 0.9 : 0.4}
                            style={{ transition: 'stroke 220ms ease' }}
                          />
                          <text x={mx} y={my - 3} textAnchor="middle" fontSize={9} fontFamily="monospace" fill={inTree ? '#6ee7b7' : '#71717a'}>
                            {input.weights[i]}
                          </text>
                        </g>
                      );
                    })}
                    {/* 树扩展时借用最短路的路径高亮 */}
                    {step.treeEdges.map(([u, v], i) => {
                      const path = tracePath(nextOf(input), u, v);
                      if (path.length <= 2) return null;
                      return path.slice(0, -1).map((p, k) => {
                        const q = path[k + 1];
                        return (
                          <line
                            key={`tp${i}_${k}`}
                            x1={layout.pos[p].x}
                            y1={layout.pos[p].y}
                            x2={layout.pos[q].x}
                            y2={layout.pos[q].y}
                            stroke="#10b981"
                            strokeWidth={1.6}
                            opacity={0.5}
                            strokeDasharray="4 3"
                          />
                        );
                      });
                    })}
                    {/* 节点 */}
                    {Array.from({ length: input.n }, (_, node) => {
                      const { x, y } = layout.pos[node];
                      const isTerminal = terminalSet.has(node);
                      const inTree = treeNodeSet.has(node);
                      const isHub = node === step.hub && !done;
                      return (
                        <g key={node}>
                          {isHub && <circle cx={x} cy={y} r={18} fill="none" stroke="#fbbf24" strokeWidth={1.2} opacity={0.7} className="pulse-soft" />}
                          <rect
                            x={x - (isTerminal ? 13 : 11)}
                            y={y - (isTerminal ? 13 : 11)}
                            width={isTerminal ? 26 : 22}
                            height={isTerminal ? 26 : 22}
                            rx={isTerminal ? 3 : 11}
                            fill={inTree ? (isTerminal ? '#10b981' : '#34d399') : '#111318'}
                            stroke={isTerminal ? '#6ee7b7' : '#52525b'}
                            strokeWidth={isTerminal ? 2 : 1.4}
                            style={{ transition: 'fill 220ms ease' }}
                          />
                          <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontFamily="monospace" fill={inTree ? '#fff' : '#a1a1aa'}>
                            {node}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
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

            <div className="shrink-0 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-400">结果</div>
              <p className="mt-1 font-mono text-[13px]">
                {!done ? (
                  <span className="text-zinc-400">—</span>
                ) : (
                  <span className="text-emerald-700">
                    最优斯坦纳树代价 {result?.toFixed(0)}（终端 {input.terminals.join(', ')}；树节点{' '}
                    {[...treeNodeSet].sort((a, b) => a - b).join(', ')}）
                  </span>
                )}
              </p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">{step.note}</p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">
                对照 MST（只许用终端）：{mstTerminalOnly(input).toFixed(0)} · 斯坦纳树 ≤ MST，借用中转点可以更省
              </p>
            </div>
          </div>

          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field label="节点数 (NODES)" value={n} min={5} max={40} step={1} onChange={setN} />
              <Field label="终端数 (TERMINALS)" value={tCount} min={2} max={10} step={1} onChange={setTCount} />
              <Field
                label="边密度 (DENSITY)"
                value={density}
                min={0.2}
                max={0.6}
                step={0.05}
                onChange={setDensity}
              />
              <button
                onClick={() => setSeed((s) => s + 1)}
                className="w-full border border-zinc-200 bg-zinc-50 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:border-blue-500/50 hover:bg-white hover:text-blue-600"
              >
                重新生成 (RESHUFFLE)
              </button>
            </Section>

            <Section title="数据 (DATA)">
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">终端</span>
                  <span className="tabular-nums text-zinc-800">{input.terminals.join(',')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">子集数</span>
                  <span className="tabular-nums text-zinc-800">{2 ** input.terminals.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">树节点</span>
                  <span className="tabular-nums text-zinc-800">{treeNodeSet.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">精确复杂度</span>
                  <span className="text-zinc-800">O(3^t·n + 2^t·n²)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">一般图精确解</span>
                  <span className="text-zinc-800">NP 困难</span>
                </div>
              </div>
            </Section>
          </ControlPanel>
        </div>
      </div>
    </main>
  );
}

/** next 指针表（渲染最短路虚线用） */
function nextOf(input: STInput): number[][] {
  return floydWarshall(input).next;
}

/** 只连终端的 MST 代价（对照用） */
function mstTerminalOnly(input: STInput): number {
  const { dist } = floydWarshall(input);
  const ts = input.terminals;
  const inTree = new Set<number>([ts[0]]);
  let cost = 0;
  while (inTree.size < ts.length) {
    let bd = Infinity;
    let bn = -1;
    for (const u of inTree) {
      for (const v of ts) {
        if (!inTree.has(v) && dist[u][v] < bd) {
          bd = dist[u][v];
          bn = v;
        }
      }
    }
    cost += bd;
    inTree.add(bn);
  }
  return cost;
}
