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

interface Edge {
  u: number;
  v: number;
  w: number;
}

interface MSTInput {
  n: number;
  edges: Edge[];
}

interface MSTStep {
  edgeIdx: number;
  accepted: boolean;
  chosen: number[];
  rejected: number[];
  totalW: number;
  note: string;
}

const TITLE = '最小生成树';
const CLS = 'P' as const;

/* ---------------- 算法 ---------------- */

function kruskal(input: MSTInput): { indices: number[]; total: number } {
  const { n, edges } = input;
  const order = edges.map((_, i) => i).sort((x, y) => edges[x].w - edges[y].w || x - y);
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const indices: number[] = [];
  let total = 0;
  for (const idx of order) {
    const { u, v, w } = edges[idx];
    const ru = find(u);
    const rv = find(v);
    if (ru === rv) continue;
    parent[ru] = rv;
    indices.push(idx);
    total += w;
    if (indices.length === n - 1) break;
  }
  return { indices, total };
}

function isSpanningTree(output: unknown, input: MSTInput): output is number[] {
  if (!Array.isArray(output) || output.length !== input.n - 1) return false;
  const seen = new Set<number>();
  for (const idx of output) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= input.edges.length || seen.has(idx)) return false;
    seen.add(idx);
  }
  // 连通性：并查集合并 n-1 条边后全在同一点积
  const parent = Array.from({ length: input.n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (const idx of output) {
    const { u, v } = input.edges[idx];
    parent[find(u)] = find(v);
  }
  const root = find(0);
  for (let i = 1; i < input.n; i++) if (find(i) !== root) return false;
  return true;
}

function makeCase(name: string, input: MSTInput): TestCase<MSTInput, number[]> {
  const ref = kruskal(input);
  return {
    name,
    input,
    expected: ref.indices,
    validate: (out) => isSpanningTree(out, input) && out.reduce((s, i) => s + input.edges[i].w, 0) === ref.total,
  };
}

const CASES: TestCase<MSTInput, number[]>[] = [
  makeCase('三角形', {
    n: 3,
    edges: [
      { u: 0, v: 1, w: 4 },
      { u: 1, v: 2, w: 2 },
      { u: 0, v: 2, w: 3 },
    ],
  }),
  makeCase('四点加权', {
    n: 4,
    edges: [
      { u: 0, v: 1, w: 1 },
      { u: 0, v: 2, w: 4 },
      { u: 1, v: 2, w: 2 },
      { u: 1, v: 3, w: 6 },
      { u: 2, v: 3, w: 3 },
    ],
  }),
  makeCase('稠密图', {
    n: 5,
    edges: [
      { u: 0, v: 1, w: 9 },
      { u: 0, v: 2, w: 8 },
      { u: 1, v: 2, w: 15 },
      { u: 1, v: 3, w: 10 },
      { u: 2, v: 3, w: 11 },
      { u: 3, v: 4, w: 7 },
      { u: 2, v: 4, w: 6 },
    ],
  }),
];

/** 逐边判定，每条边产出一帧 */
function* kruskalGen(input: MSTInput): Generator<MSTStep, number[], void> {
  const { n, edges } = input;
  const order = edges.map((_, i) => i).sort((x, y) => edges[x].w - edges[y].w || x - y);
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const chosen: number[] = [];
  const rejected: number[] = [];
  let total = 0;

  yield {
    edgeIdx: -1,
    accepted: true,
    chosen: [],
    rejected: [],
    totalW: 0,
    note: `${edges.length} 条边按边权从小到大排序，准备逐条判定`,
  };

  for (const idx of order) {
    const { u, v, w } = edges[idx];
    const ru = find(u);
    const rv = find(v);
    const ok = ru !== rv;
    if (ok) {
      parent[ru] = rv;
      chosen.push(idx);
      total += w;
    } else {
      rejected.push(idx);
    }
    yield {
      edgeIdx: idx,
      accepted: ok,
      chosen: [...chosen],
      rejected: [...rejected],
      totalW: total,
      note: ok
        ? `边 ${u}–${v}（w=${w}）：两端尚未连通，采纳并合并集合`
        : `边 ${u}–${v}（w=${w}）：两端已连通，采纳会成环，跳过`,
    };
    if (chosen.length === n - 1) break;
  }

  return chosen;
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

function randomInstance(n: number, density: number, seed: number): MSTInput {
  let s = seed;
  for (let t = 0; t < 80; t++) {
    const pairs = randomGraph(n, density, s);
    if (pairs.length >= n - 1 && connected(n, pairs)) {
      const rnd = mulberry32(s * 7 + 13);
      return {
        n,
        edges: pairs.map(([u, v]) => ({ u, v, w: 1 + Math.floor(rnd() * 99) })),
      };
    }
    s += 97;
  }
  // 保底：链式图必连通
  const rnd = mulberry32(s);
  const edges: Edge[] = [];
  for (let i = 0; i + 1 < n; i++) edges.push({ u: i, v: i + 1, w: 1 + Math.floor(rnd() * 99) });
  return { n, edges };
}

const TEMPLATE = `function solve(input) {
  const { n, edges } = input;
  // edges 是 {u, v, w} 数组

  // TODO: 返回构成最小生成树的边下标数组
  return [];
}`;

const SOLUTION = `function solve(input) {
  const { n, edges } = input;
  const order = edges.map((_, i) => i).sort((a, b) => edges[a].w - edges[b].w);

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  };

  const picked = [];
  for (const idx of order) {
    const { u, v } = edges[idx];
    const ru = find(u), rv = find(v);
    if (ru === rv) continue;
    parent[ru] = rv;
    picked.push(idx);
    if (picked.length === n - 1) break;
  }
  return picked;
}`;

export default function MSTPage() {
  const [n, setN] = useState(8);
  const [density, setDensity] = useState(0.35);
  const [seed, setSeed] = useState(5);
  const [speed, setSpeed] = useState(1);

  const input = useMemo(() => randomInstance(n, density, seed), [n, density, seed]);

  const factory = useCallback(() => kruskalGen(input), [input]);
  const solver = useLiveSolver<MSTStep, number[]>(factory, [input], {
    stepsPerFrame: speed,
  });

  const step: MSTStep =
    solver.current ?? {
      edgeIdx: -1,
      accepted: true,
      chosen: [],
      rejected: [],
      totalW: 0,
      note: '尚未开始，点「开始求解」',
    };
  const result = solver.result;
  const done = solver.done;
  const chosenSet = new Set(step.chosen);
  const rejectedSet = new Set(step.rejected);

  // 环形布局
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
  }, [input]);

  const ref = useMemo(() => kruskal(input), [input]);

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
                label="KRUSKAL"
                meta={`${input.n} nodes / ${input.edges.length} edges`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    已选 {step.chosen.length}/{input.n - 1} · 权重 {step.totalW}
                  </span>
                }
              >
                <div className="flex flex-1 items-center justify-center p-4">
                  <svg
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                    className="h-full max-h-[420px] w-full min-h-[180px]"
                    role="img"
                    aria-label="Kruskal 构造最小生成树过程"
                  >
                    {input.edges.map((e, i) => {
                      const isChosen = chosenSet.has(i);
                      const isCurrent = i === step.edgeIdx && !done;
                      const isRejected = rejectedSet.has(i);
                      const mx = (layout.pos[e.u].x + layout.pos[e.v].x) / 2;
                      const my = (layout.pos[e.u].y + layout.pos[e.v].y) / 2;
                      return (
                        <g key={i}>
                          <line
                            x1={layout.pos[e.u].x}
                            y1={layout.pos[e.u].y}
                            x2={layout.pos[e.v].x}
                            y2={layout.pos[e.v].y}
                            stroke={
                              isChosen ? '#3b82f6' : isCurrent && !step.accepted ? '#f43f5e' : '#3f3f46'
                            }
                            strokeWidth={isChosen ? 2.4 : 1.4}
                            strokeDasharray={isRejected || (isCurrent && !step.accepted) ? '5 4' : undefined}
                            opacity={isChosen ? 0.95 : isCurrent ? 1 : 0.55}
                            style={{ transition: 'stroke 200ms ease, stroke-width 200ms ease' }}
                          />
                          {isCurrent && (
                            <line
                              x1={layout.pos[e.u].x}
                              y1={layout.pos[e.u].y}
                              x2={layout.pos[e.v].x}
                              y2={layout.pos[e.v].y}
                              stroke="#fbbf24"
                              strokeWidth={4}
                              opacity={0.45}
                              className="pulse-soft"
                            />
                          )}
                          <text
                            x={mx}
                            y={my - 4}
                            textAnchor="middle"
                            fontSize={10}
                            fontFamily="monospace"
                            fill={isChosen ? '#93c5fd' : '#71717a'}
                          >
                            {e.w}
                          </text>
                        </g>
                      );
                    })}
                    {Array.from({ length: input.n }, (_, node) => {
                      const { x, y } = layout.pos[node];
                      return (
                        <g key={node}>
                          <circle
                            cx={x}
                            cy={y}
                            r={13}
                            fill="#111318"
                            stroke="#52525b"
                            strokeWidth={1.6}
                            style={{ transition: 'stroke 260ms ease' }}
                          />
                          <text
                            x={x}
                            y={y + 4}
                            textAnchor="middle"
                            fontSize={11}
                            fontFamily="monospace"
                            fill="#d4d4d8"
                          >
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
                    MST 总权重 {step.totalW}（{input.n - 1} 条边：{result?.map((i) => input.edges[i].w).join(' + ')}）
                  </span>
                )}
              </p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">{step.note}</p>
            </div>
          </div>

          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field
                label="节点数 (NODES)"
                value={n}
                min={4}
                max={12}
                step={1}
                onChange={setN}
              />
              <Field
                label="边密度 (DENSITY)"
                value={density}
                min={0.2}
                max={0.7}
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
                  <span className="text-zinc-400">边数</span>
                  <span className="tabular-nums text-zinc-800">{input.edges.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">需选边数</span>
                  <span className="tabular-nums text-zinc-800">{input.n - 1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">已采纳</span>
                  <span className="tabular-nums text-zinc-800">{step.chosen.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">成环跳过</span>
                  <span className="tabular-nums text-zinc-800">{step.rejected.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">参考最优</span>
                  <span className="tabular-nums text-zinc-800">{ref.total}</span>
                </div>
              </div>
            </Section>
          </ControlPanel>
        </div>
      </div>
    </main>
  );
}
