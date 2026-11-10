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

interface LPInput {
  n: number;
  edges: [number, number][];
  weights: number[];
  source: number;
}

interface LPStep {
  path: number[];
  bestPath: number[];
  bestLen: number;
  curLen: number;
  backtracks: number;
  note: string;
}

const TITLE = '最长路径';
const CLS = 'NPH' as const;

/* ---------------- 算法 ---------------- */

function buildAdj(n: number, edges: [number, number][], weights: number[]) {
  const adj: { to: number; w: number }[][] = Array.from({ length: n }, () => []);
  edges.forEach(([u, v], i) => {
    adj[u].push({ to: v, w: weights[i] });
    adj[v].push({ to: u, w: weights[i] });
  });
  return adj;
}

function pathLen(input: LPInput, path: number[]): number {
  const w = new Map<string, number>();
  input.edges.forEach(([u, v], i) => {
    w.set(`${u}-${v}`, input.weights[i]);
    w.set(`${v}-${u}`, input.weights[i]);
  });
  let s = 0;
  for (let i = 0; i + 1 < path.length; i++) s += w.get(`${path[i]}-${path[i + 1]}`) ?? 0;
  return s;
}

/** 参考解：DFS 穷举全部简单路径（判题用例都是小规模） */
function longestPathRef(input: LPInput): number[] {
  const adj = buildAdj(input.n, input.edges, input.weights);
  const used = new Array(input.n).fill(false);
  const path: number[] = [input.source];
  used[input.source] = true;
  let bestPath: number[] = [input.source];
  let bestLen = 0;

  const dfs = (len: number) => {
    if (len > bestLen) {
      bestLen = len;
      bestPath = [...path];
    }
    for (const { to, w } of adj[path[path.length - 1]]) {
      if (used[to]) continue;
      used[to] = true;
      path.push(to);
      dfs(len + w);
      path.pop();
      used[to] = false;
    }
  };
  dfs(0);
  return bestPath;
}

function validate(output: unknown, input: LPInput): boolean {
  if (!Array.isArray(output) || output.length === 0 || output[0] !== input.source) return false;
  const path = output as number[];
  const seen = new Set<number>();
  const adj = buildAdj(input.n, input.edges, input.weights);
  const has = (u: number, v: number) => adj[u].some((e) => e.to === v);
  for (let i = 0; i < path.length; i++) {
    const v = path[i];
    if (!Number.isInteger(v) || v < 0 || v >= input.n || seen.has(v)) return false;
    if (i > 0 && !has(path[i - 1], v)) return false;
    seen.add(v);
  }
  return pathLen(input, path) === pathLen(input, longestPathRef(input));
}

function makeCase(name: string, input: LPInput): TestCase<LPInput, number[]> {
  const ref = longestPathRef(input);
  return { name, input, expected: ref, validate: (out) => validate(out, input) };
}

const CASES: TestCase<LPInput, number[]>[] = [
  makeCase('三点直线', {
    n: 3,
    edges: [
      [0, 1],
      [1, 2],
    ],
    weights: [1, 2],
    source: 0,
  }),
  makeCase('绕远更长', {
    n: 4,
    edges: [
      [0, 1],
      [1, 3],
      [0, 2],
      [2, 3],
    ],
    weights: [9, 1, 1, 2],
    source: 0,
  }),
  makeCase('五点分叉', {
    n: 5,
    edges: [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 4],
      [3, 4],
    ],
    weights: [2, 3, 4, 1, 5],
    source: 0,
  }),
];

/** DFS 穷举生成器：每步前进/回溯都产出一帧 */
function* lpGen(input: LPInput): Generator<LPStep, number[], void> {
  const adj = buildAdj(input.n, input.edges, input.weights);
  const used = new Array(input.n).fill(false);
  const path: number[] = [input.source];
  used[input.source] = true;
  let bestPath: number[] = [input.source];
  let bestLen = 0;
  let backtracks = 0;
  let budget = 1000000000;

  const snap = (curLen: number, note: string): LPStep => ({
    path: [...path],
    bestPath: [...bestPath],
    bestLen,
    curLen,
    backtracks,
    note,
  });

  yield snap(0, `从源点 ${input.source} 出发，DFS 穷举全部简单路径（不许重复经过点）`);

  const dfs = function* (len: number): Generator<LPStep, void, void> {
    if (budget-- <= 0) return;
    if (len > bestLen) {
      bestLen = len;
      bestPath = [...path];
      yield snap(len, `路径长 ${len}，刷新最优（${bestPath.join('→')}）`);
    }
    const u = path[path.length - 1];
    for (const { to, w } of adj[u]) {
      if (used[to]) continue;
      used[to] = true;
      path.push(to);
      yield snap(len + w, `${u} → ${to}（w=${w}），路径长 ${len + w}`);
      yield* dfs(len + w);
      path.pop();
      used[to] = false;
      backtracks++;
      yield snap(len, `${to} 已无路可走，退回 ${u}（第 ${backtracks} 次回溯）`);
      if (budget <= 0) return;
    }
  };

  yield* dfs(0);
  return bestPath;
}

/* ---------------- 实例生成 ---------------- */

function connected(n: number, pairs: [number, number][]): boolean {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (const [u, v] of pairs) parent[find(u)] = find(v);
  const root = find(0);
  for (let i = 1; i < n; i++) if (find(i) !== root) return false;
  return true;
}

function randomInstance(n: number, density: number, seed: number): LPInput {
  let s = seed;
  for (let t = 0; t < 80; t++) {
    const pairs = randomGraph(n, density, s);
    if (pairs.length >= n - 1 && connected(n, pairs)) {
      const rnd = mulberry32(s * 13 + 7);
      return { n, edges: pairs, weights: pairs.map(() => 1 + Math.floor(rnd() * 9)), source: 0 };
    }
    s += 97;
  }
  const rnd = mulberry32(s);
  const edges: [number, number][] = [];
  for (let i = 0; i + 1 < n; i++) edges.push([i, i + 1]);
  return { n, edges, weights: edges.map(() => 1 + Math.floor(rnd() * 9)), source: 0 };
}

const TEMPLATE = `function solve(input) {
  const { n, edges, weights, source } = input;

  // TODO: 返回从 source 出发的不重复点路径，
  // 使边权之和最大（简单路径：每个点至多经过一次）
  return [source];
}`;

const SOLUTION = `function solve(input) {
  const { n, edges, weights, source } = input;
  const adj = Array.from({ length: n }, () => []);
  edges.forEach(([u, v], i) => { adj[u].push([v, weights[i]]); adj[v].push([u, weights[i]]); });
  const used = new Array(n).fill(false);
  const path = [source];
  used[source] = true;
  let best = [source], bestLen = 0;

  const dfs = (len) => {
    if (len > bestLen) { bestLen = len; best = [...path]; }
    for (const [to, w] of adj[path[path.length - 1]]) {
      if (used[to]) continue;
      used[to] = true; path.push(to);
      dfs(len + w);
      path.pop(); used[to] = false;
    }
  };
  dfs(0);
  return best;
}`;

export default function LongestPathPage() {
  const [n, setN] = useState(8);
  const [density, setDensity] = useState(0.3);
  const [seed, setSeed] = useState(6);
  const [speed, setSpeed] = useState(8);

  const input = useMemo(() => randomInstance(n, density, seed), [n, density, seed]);

  const factory = useCallback(() => lpGen(input), [input]);
  const solver = useLiveSolver<LPStep, number[]>(factory, [input], {
    stepsPerFrame: speed,
  });

  const step: LPStep =
    solver.current ??
    {
      path: [input.source],
      bestPath: [input.source],
      bestLen: 0,
      curLen: 0,
      backtracks: 0,
      note: '尚未开始，点「开始求解」',
    };
  const result = solver.result;
  const done = solver.done;

  const layout = useMemo(() => {
    const W = 820;
    const H = 380;
    const rx = 300;
    const ry = 128;
    return {
      width: W,
      height: H,
      pos: Array.from({ length: input.n }, (_, i) => {
        const angle = (i / input.n) * Math.PI * 2 - Math.PI / 2;
        return { x: W / 2 + rx * Math.cos(angle), y: H / 2 + ry * Math.sin(angle) };
      }),
    };
  }, [input.n]);

  const edgeKey = (u: number, v: number) => `${Math.min(u, v)}-${Math.max(u, v)}`;
  const pairsOf = (p: number[]) => {
    const s = new Set<string>();
    for (let i = 0; i + 1 < p.length; i++) s.add(edgeKey(p[i], p[i + 1]));
    return s;
  };
  const curSet = pairsOf(step.path);
  const bestSet = pairsOf(done && result ? result : step.bestPath);
  const curIdx = step.path.length - 1;

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
                label="DFS EXHAUSTIVE"
                meta={`${input.n} nodes / ${input.edges.length} edges / source ${input.source}`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    当前 {step.curLen} · 最优 {Math.max(step.bestLen, done && result ? pathLen(input, result) : 0)} · 回溯 {step.backtracks}
                  </span>
                }
              >
                <div className="flex flex-1 items-center justify-center p-4">
                  <svg
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                    className="h-full max-h-[420px] w-full min-h-[180px]"
                    role="img"
                    aria-label="最长路径 DFS 穷举过程"
                  >
                    {input.edges.map(([u, v], i) => {
                      const key = edgeKey(u, v);
                      const onCur = curSet.has(key);
                      const onBest = bestSet.has(key);
                      const isHead = onCur && curIdx > 0 && edgeKey(step.path[curIdx - 1], step.path[curIdx]) === key && !done;
                      const mx = (layout.pos[u].x + layout.pos[v].x) / 2;
                      const my = (layout.pos[u].y + layout.pos[v].y) / 2;
                      return (
                        <g key={i}>
                          <line
                            x1={layout.pos[u].x}
                            y1={layout.pos[u].y}
                            x2={layout.pos[v].x}
                            y2={layout.pos[v].y}
                            stroke={onCur ? '#fbbf24' : onBest ? '#3b82f6' : '#3f3f46'}
                            strokeWidth={onCur || onBest ? 2.2 : 1.3}
                            opacity={onCur || onBest ? 0.9 : 0.4}
                            style={{ transition: 'stroke 200ms ease' }}
                          />
                          {isHead && (
                            <line
                              x1={layout.pos[u].x}
                              y1={layout.pos[u].y}
                              x2={layout.pos[v].x}
                              y2={layout.pos[v].y}
                              stroke="#fbbf24"
                              strokeWidth={4.5}
                              opacity={0.4}
                              className="pulse-soft"
                            />
                          )}
                          <text x={mx} y={my - 4} textAnchor="middle" fontSize={9} fontFamily="monospace" fill={onCur ? '#fcd34d' : '#71717a'}>
                            {input.weights[i]}
                          </text>
                        </g>
                      );
                    })}
                    {Array.from({ length: input.n }, (_, node) => {
                      const { x, y } = layout.pos[node];
                      const onCur = step.path.includes(node);
                      const onBest = (done && result ? result : step.bestPath).includes(node);
                      const isHead = onCur && node === step.path[step.path.length - 1] && !done;
                      return (
                        <g key={node}>
                          {isHead && <circle cx={x} cy={y} r={19} fill="none" stroke="#fbbf24" strokeWidth={1.2} opacity={0.7} className="pulse-soft" />}
                          <circle
                            cx={x}
                            cy={y}
                            r={13}
                            fill={onCur ? '#fbbf24' : onBest ? '#3b82f6' : '#111318'}
                            stroke={node === input.source ? '#fcd34d' : '#52525b'}
                            strokeWidth={node === input.source ? 2.2 : 1.6}
                            opacity={onCur || onBest ? 1 : 0.85}
                            style={{ transition: 'fill 200ms ease' }}
                          />
                          <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontFamily="monospace" fill={onCur || onBest ? '#fff' : '#a1a1aa'}>
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
                    最长路径长 {pathLen(input, result ?? [])}：（{(result ?? []).join('→')}）
                  </span>
                )}
              </p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">{step.note}</p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">
                对照最短路径页（P，Dijkstra 多项式解）：同一张图，最短是 P、最长是 NP 困难——差之毫厘，复杂度谬以千里
              </p>
            </div>
          </div>

          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field label="节点数 (NODES)" value={n} min={5} max={40} step={1} onChange={setN} />
              <Field
                label="边密度 (DENSITY)"
                value={density}
                min={0.15}
                max={0.6}
                step={0.05}
                onChange={setDensity}
                format={(v) => `期望边数 ≈ ${Math.round((v * n * (n - 1)) / 2)}`}
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
                  <span className="text-zinc-400">路径长</span>
                  <span className="tabular-nums text-zinc-800">{step.curLen}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">已走点数</span>
                  <span className="tabular-nums text-zinc-800">{step.path.length}/{input.n}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">回溯</span>
                  <span className="tabular-nums text-zinc-800">{step.backtracks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">穷举上界</span>
                  <span className="text-zinc-800">~(n−1)! 条路径</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">策略</span>
                  <span className="text-zinc-800">DFS 穷举 + 回溯</span>
                </div>
              </div>
            </Section>
          </ControlPanel>
        </div>
      </div>
    </main>
  );
}
