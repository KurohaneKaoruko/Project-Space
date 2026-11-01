'use client';

import { useCallback, useMemo, useState } from 'react';
import Navigation from '../../components/Navigation';
import InstrumentPanel from '../components/InstrumentPanel';
import ControlPanel, { Field, Section } from '../components/ControlPanel';
import CodeRunner from '../components/CodeRunner';
import LiveControls from '../components/LiveControls';
import { useLiveSolver } from '../lib/useLiveSolver';
import { mulberry32 } from '../lib/generate';
import { CLASS_META, type TestCase } from '../lib/types';

interface FlowInput {
  n: number;
  edges: [number, number, number][];
  s: number;
  t: number;
}

interface FlowStep {
  /** 残余容量矩阵 */
  residual: number[][];
  path: number[];
  bottleneck: number;
  total: number;
  note: string;
}

const TITLE = '最大流';
const CLS = 'P' as const;

/** 参考解：Edmonds–Karp */
function maxFlow(input: FlowInput): number {
  const { n, edges, s, t } = input;
  const residual = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const [u, v, c] of edges) residual[u][v] += c;

  let total = 0;
  for (;;) {
    const parent = new Array(n).fill(-1);
    parent[s] = s;
    const queue = [s];
    while (queue.length) {
      const u = queue.shift() as number;
      for (let v = 0; v < n; v++) {
        if (parent[v] === -1 && residual[u][v] > 0) {
          parent[v] = u;
          queue.push(v);
        }
      }
    }
    if (parent[t] === -1) break;

    let bottleneck = Infinity;
    for (let v = t; v !== s; v = parent[v]) bottleneck = Math.min(bottleneck, residual[parent[v]][v]);
    for (let v = t; v !== s; v = parent[v]) {
      const u = parent[v];
      residual[u][v] -= bottleneck;
      residual[v][u] += bottleneck;
    }
    total += bottleneck;
  }
  return total;
}

function makeCase(name: string, input: FlowInput): TestCase<FlowInput, number> {
  const ref = maxFlow(input);
  return { name, input, expected: ref, validate: (out) => out === ref };
}

const CASES: TestCase<FlowInput, number>[] = [
  makeCase('经典 4 点', {
    n: 4,
    edges: [
      [0, 1, 3],
      [0, 2, 2],
      [1, 2, 1],
      [1, 3, 2],
      [2, 3, 3],
    ],
    s: 0,
    t: 3,
  }),
  makeCase('十字网络', {
    n: 5,
    edges: [
      [0, 1, 4],
      [0, 2, 4],
      [1, 3, 3],
      [2, 3, 5],
      [3, 4, 6],
    ],
    s: 0,
    t: 4,
  }),
  makeCase('单边瓶颈', {
    n: 3,
    edges: [
      [0, 1, 5],
      [1, 2, 2],
    ],
    s: 0,
    t: 2,
  }),
];

/** Edmonds–Karp：每次增广产出一帧 */
function* ekGen(input: FlowInput): Generator<FlowStep, number, void> {
  const { n, edges, s, t } = input;
  const residual = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const [u, v, c] of edges) residual[u][v] += c;

  const snap = () => residual.map((row) => [...row]);
  let total = 0;

  yield { residual: snap(), path: [], bottleneck: 0, total, note: '初始残余网络 = 各边容量' };

  for (;;) {
    const parent = new Array(n).fill(-1);
    parent[s] = s;
    const queue = [s];
    while (queue.length) {
      const u = queue.shift() as number;
      for (let v = 0; v < n; v++) {
        if (parent[v] === -1 && residual[u][v] > 0) {
          parent[v] = u;
          queue.push(v);
        }
      }
    }

    if (parent[t] === -1) {
      yield { residual: snap(), path: [], bottleneck: 0, total, note: '残余网络里找不到增广路径 → 达到最大流' };
      break;
    }

    const path: number[] = [];
    let bottleneck = Infinity;
    for (let v = t; v !== s; v = parent[v]) {
      path.unshift(v);
      bottleneck = Math.min(bottleneck, residual[parent[v]][v]);
    }
    path.unshift(s);

    for (let i = 0; i < path.length - 1; i++) {
      const u = path[i];
      const v = path[i + 1];
      residual[u][v] -= bottleneck;
      residual[v][u] += bottleneck;
    }
    total += bottleneck;

    yield {
      residual: snap(),
      path,
      bottleneck,
      total,
      note: `增广 ${path.join(' → ')}，瓶颈 ${bottleneck}，累计流量 ${total}`,
    };
  }

  return total;
}

function randomFlow(n: number, seed: number): FlowInput {
  const rnd = mulberry32(seed);
  const edges: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (rnd() < 0.45) edges.push([i, j, 1 + Math.floor(rnd() * 6)]);
    }
  }
  // 保证至少有一条从源到汇的通路
  if (!edges.some(([u, v]) => u === 0 || v === n - 1)) {
    edges.push([0, n - 1, 1 + Math.floor(rnd() * 5)]);
  }
  return { n, edges, s: 0, t: n - 1 };
}

const TEMPLATE = `function solve(input) {
  const { n, edges, s, t } = input;

  // TODO: 返回从 s 到 t 的最大流（数字）
  return 0;
}`;

const SOLUTION = `function solve(input) {
  const { n, edges, s, t } = input;
  const cap = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const [u, v, c] of edges) cap[u][v] += c;

  let total = 0;
  for (;;) {
    const parent = new Array(n).fill(-1);
    parent[s] = s;
    const queue = [s];
    while (queue.length) {
      const u = queue.shift();
      for (let v = 0; v < n; v++) {
        if (parent[v] === -1 && cap[u][v] > 0) { parent[v] = u; queue.push(v); }
      }
    }
    if (parent[t] === -1) break;

    let f = Infinity;
    for (let v = t; v !== s; v = parent[v]) f = Math.min(f, cap[parent[v]][v]);
    for (let v = t; v !== s; v = parent[v]) {
      const u = parent[v];
      cap[u][v] -= f;
      cap[v][u] += f;
    }
    total += f;
  }
  return total;
}`;

export default function MaxFlowPage() {
  const [n, setN] = useState(6);
  const [seed, setSeed] = useState(2);
  const [speed, setSpeed] = useState(1);

  const input = useMemo(() => randomFlow(n, seed), [n, seed]);
  const factory = useCallback(() => ekGen(input), [input]);
  const solver = useLiveSolver<FlowStep, number>(factory, [input], { stepsPerFrame: speed });

  // 未开始时残余网络 = 容量，流量显示为 0
  const initialResidual = useMemo(() => {
    const r = Array.from({ length: input.n }, () => new Array(input.n).fill(0));
    for (const [u, v, c] of input.edges) r[u][v] += c;
    return r;
  }, [input]);

  const step: FlowStep =
    solver.current ?? {
      residual: initialResidual,
      path: [],
      bottleneck: 0,
      total: 0,
      note: '尚未开始，点「开始求解」',
    };

  const layout = useMemo(() => {
    const W = 820;
    const H = 380;
    return {
      width: W,
      height: H,
      pos: Array.from({ length: input.n }, (_, i) => {
        const angle = (i / input.n) * Math.PI * 2 - Math.PI / 2;
        return { x: W / 2 + 290 * Math.cos(angle), y: H / 2 + 126 * Math.sin(angle) };
      }),
    };
  }, [input]);

  // 原始边（去重后）的当前流量
  const edgeInfo = useMemo(() => {
    const seen = new Map<string, { u: number; v: number; cap: number }>();
    for (const [u, v, c] of input.edges) {
      const key = `${u}-${v}`;
      const prev = seen.get(key);
      if (prev) prev.cap += c;
      else seen.set(key, { u, v, cap: c });
    }
    return [...seen.values()];
  }, [input]);

  const pathEdges = new Set<string>();
  for (let i = 0; i < step.path.length - 1; i++) {
    pathEdges.add(`${step.path[i]}-${step.path[i + 1]}`);
  }

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
                label="NETWORK"
                meta={`${input.n} nodes / ${edgeInfo.length} edges · s=${input.s} t=${input.t}`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">流量 {step.total}</span>
                }
              >
                <div className="flex min-h-0 flex-1 items-center justify-center p-3">
                  <svg
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                    className="h-full max-h-[420px] w-full"
                    role="img"
                    aria-label="最大流增广过程"
                  >
                    <defs>
                      <marker id="flow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                        <path d="M0,0 L7,3 L0,6 Z" fill="currentColor" />
                      </marker>
                    </defs>

                    {edgeInfo.map(({ u, v, cap }) => {
                      const flow = cap - step.residual[u][v];
                      const onPath = pathEdges.has(`${u}-${v}`);
                      const mid = {
                        x: (layout.pos[u].x + layout.pos[v].x) / 2,
                        y: (layout.pos[u].y + layout.pos[v].y) / 2,
                      };
                      return (
                        <g key={`${u}-${v}`}>
                          <line
                            x1={layout.pos[u].x}
                            y1={layout.pos[u].y}
                            x2={layout.pos[v].x}
                            y2={layout.pos[v].y}
                            color={onPath ? '#fbbf24' : flow > 0 ? '#60a5fa' : '#3f3f46'}
                            stroke="currentColor"
                            strokeWidth={onPath ? 3 : flow > 0 ? 2.2 : 1.2}
                            markerEnd="url(#flow-arrow)"
                            style={{ transition: 'color 200ms' }}
                          />
                          <text
                            x={mid.x}
                            y={mid.y - 5}
                            textAnchor="middle"
                            fontSize="11"
                            fontFamily="monospace"
                            fill={flow > 0 ? '#93c5fd' : '#71717a'}
                          >
                            {flow}/{cap}
                          </text>
                        </g>
                      );
                    })}

                    {Array.from({ length: input.n }, (_, node) => {
                      const { x, y } = layout.pos[node];
                      const isS = node === input.s;
                      const isT = node === input.t;
                      const onPath = step.path.includes(node);
                      return (
                        <g key={node}>
                          <circle
                            cx={x}
                            cy={y}
                            r={22}
                            fill={isS ? 'rgba(16,185,129,0.25)' : isT ? 'rgba(244,63,94,0.25)' : '#111318'}
                            stroke={onPath ? '#fbbf24' : isS ? '#10b981' : isT ? '#f43f5e' : '#3f3f46'}
                            strokeWidth={onPath ? 2.4 : 1.6}
                            style={{ transition: 'stroke 200ms' }}
                          />
                          <text
                            x={x}
                            y={y + 4}
                            textAnchor="middle"
                            fontSize="12"
                            fontFamily="monospace"
                            fill={isS ? '#6ee7b7' : isT ? '#fda4af' : '#d4d4d8'}
                          >
                            {isS ? 's' : isT ? 't' : node}
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
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-400">
                    当前流量
                  </div>
                  <p className="mt-1 font-mono text-lg font-black tabular-nums text-zinc-900">
                    {step.total}
                  </p>
                </div>
                <p className="ml-auto font-mono text-[11px]">
                  {!solver.done ? (
                    <span className="text-zinc-400">—</span>
                  ) : (
                    <span className="text-emerald-700">最大流 = {solver.result}</span>
                  )}
                </p>
              </div>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">{step.note}</p>
            </div>
          </div>

          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field label="节点数 (NODES)" value={n} min={3} max={8} step={1} onChange={setN} />
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
                  <span className="text-zinc-400">节点 / 边</span>
                  <span className="text-zinc-800">{input.n} / {edgeInfo.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">源 / 汇</span>
                  <span className="text-zinc-800">{input.s} / {input.t}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">增广次数</span>
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
