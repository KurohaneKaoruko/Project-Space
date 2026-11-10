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

interface SPEdge {
  u: number;
  v: number;
  w: number;
}

interface SPInput {
  n: number;
  edges: SPEdge[];
  source: number;
}

interface SPStep {
  dist: (number | null)[];
  settled: boolean[];
  u: number;
  v: number | null;
  improved: boolean;
  settledCount: number;
  note: string;
}

const TITLE = '最短路径';
const CLS = 'P' as const;

/* ---------------- 算法 ---------------- */

function buildAdj(n: number, edges: SPEdge[]) {
  const adj: { to: number; w: number; idx: number }[][] = Array.from({ length: n }, () => []);
  edges.forEach((e, idx) => {
    adj[e.u].push({ to: e.v, w: e.w, idx });
    adj[e.v].push({ to: e.u, w: e.w, idx });
  });
  return adj;
}

function dijkstraRef(input: SPInput): (number | null)[] {
  const { n, source } = input;
  const adj = buildAdj(input.n, input.edges);
  const dist: (number | null)[] = Array(n).fill(null);
  dist[source] = 0;
  const settled = new Array(n).fill(false);
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) {
      if (!settled[i] && dist[i] !== null && (u === -1 || (dist[i] as number) < (dist[u] as number))) u = i;
    }
    if (u === -1) break;
    settled[u] = true;
    for (const { to, w } of adj[u]) {
      if (dist[to] === null || (dist[u] as number) + w < dist[to]) dist[to] = (dist[u] as number) + w;
    }
  }
  return dist;
}

function validate(output: unknown, input: SPInput): boolean {
  if (!Array.isArray(output) || output.length !== input.n) return false;
  const ref = dijkstraRef(input);
  return output.every((v, i) => (v === null && ref[i] === null) || v === ref[i]);
}

function makeCase(name: string, input: SPInput): TestCase<SPInput, (number | null)[]> {
  const ref = dijkstraRef(input);
  return { name, input, expected: ref, validate: (out) => validate(out, input) };
}

const CASES: TestCase<SPInput, (number | null)[]>[] = [
  makeCase('链式', {
    n: 4,
    edges: [
      { u: 0, v: 1, w: 1 },
      { u: 1, v: 2, w: 2 },
      { u: 2, v: 3, w: 3 },
      { u: 0, v: 3, w: 7 },
    ],
    source: 0,
  }),
  makeCase('绕路更短', {
    n: 4,
    edges: [
      { u: 0, v: 1, w: 10 },
      { u: 0, v: 2, w: 2 },
      { u: 2, v: 1, w: 3 },
      { u: 1, v: 3, w: 1 },
    ],
    source: 0,
  }),
  makeCase('五点加权', {
    n: 5,
    edges: [
      { u: 0, v: 1, w: 4 },
      { u: 0, v: 2, w: 1 },
      { u: 2, v: 1, w: 2 },
      { u: 1, v: 3, w: 5 },
      { u: 2, v: 3, w: 8 },
      { u: 3, v: 4, w: 3 },
    ],
    source: 0,
  }),
];

/** Dijkstra 主循环：每次「确定一个点」+「松弛它的边」都产出一帧 */
function* dijkstraGen(input: SPInput): Generator<SPStep, (number | null)[], void> {
  const { n, source } = input;
  const adj = buildAdj(n, input.edges);
  const dist: (number | null)[] = Array(n).fill(null);
  dist[source] = 0;
  const settled = new Array(n).fill(false);
  let settledCount = 0;

  yield {
    dist: [...dist],
    settled: [...settled],
    u: source,
    v: null,
    improved: true,
    settledCount: 0,
    note: `源点 ${source} 距离置 0，其余为 ∞`,
  };

  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) {
      if (!settled[i] && dist[i] !== null && (u === -1 || (dist[i] as number) < (dist[u] as number))) u = i;
    }
    if (u === -1) break;

    settled[u] = true;
    settledCount++;
    yield {
      dist: [...dist],
      settled: [...settled],
      u,
      v: null,
      improved: true,
      settledCount,
      note: `确定 ${u}：未定点中距离最小（${dist[u]}），其距离即为最终最短距离`,
    };

    for (const { to, w, idx } of adj[u]) {
      if (settled[to]) continue;
      const cand = (dist[u] as number) + w;
      const improved = dist[to] === null || cand < dist[to];
      if (improved) dist[to] = cand;
      yield {
        dist: [...dist],
        settled: [...settled],
        u,
        v: to,
        improved,
        settledCount,
        note: improved
          ? `松弛边 ${u}–${to}（w=${w}）：${dist[to]} 更短，更新距离`
          : `松弛边 ${u}–${to}（w=${w}）：距离 ${dist[to]} 已更短，不更新`,
      };
      void idx;
    }
  }

  return dist;
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

function randomInstance(n: number, density: number, seed: number): SPInput {
  let s = seed;
  for (let t = 0; t < 80; t++) {
    const pairs = randomGraph(n, density, s);
    if (pairs.length >= n - 1 && connected(n, pairs)) {
      const rnd = mulberry32(s * 11 + 5);
      return {
        n,
        edges: pairs.map(([u, v]) => ({ u, v, w: 1 + Math.floor(rnd() * 20) })),
        source: 0,
      };
    }
    s += 89;
  }
  const rnd = mulberry32(s);
  const edges: SPEdge[] = [];
  for (let i = 0; i + 1 < n; i++) edges.push({ u: i, v: i + 1, w: 1 + Math.floor(rnd() * 20) });
  return { n, edges, source: 0 };
}

const TEMPLATE = `function solve(input) {
  const { n, edges, source } = input;
  // edges 是 {u, v, w} 数组（无向、权重非负）

  // TODO: 返回长度 n 的数组，第 i 项为 source 到 i 的最短距离，不可达为 null
  return [];
}`;

const SOLUTION = `function solve(input) {
  const { n, edges, source } = input;
  const adj = Array.from({ length: n }, () => []);
  for (const { u, v, w } of edges) { adj[u].push([v, w]); adj[v].push([u, w]); }

  const dist = Array(n).fill(null);
  dist[source] = 0;
  const settled = new Array(n).fill(false);

  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) {
      if (!settled[i] && dist[i] !== null && (u === -1 || dist[i] < dist[u])) u = i;
    }
    if (u === -1) break;
    settled[u] = true;
    for (const [v, w] of adj[u]) {
      if (dist[v] === null || dist[u] + w < dist[v]) dist[v] = dist[u] + w;
    }
  }
  return dist;
}`;

export default function ShortestPathPage() {
  const [n, setN] = useState(8);
  const [density, setDensity] = useState(0.35);
  const [seed, setSeed] = useState(6);
  const [speed, setSpeed] = useState(1);

  const input = useMemo(() => randomInstance(n, density, seed), [n, density, seed]);

  const factory = useCallback(() => dijkstraGen(input), [input]);
  const solver = useLiveSolver<SPStep, (number | null)[]>(factory, [input], {
    stepsPerFrame: speed,
  });

  const step: SPStep =
    solver.current ??
    {
      dist: Array(input.n).fill(null),
      settled: new Array(input.n).fill(false),
      u: -1,
      v: null,
      improved: true,
      settledCount: 0,
      note: '尚未开始，点「开始求解」',
    };
  const done = solver.done;
  const result = solver.result;

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

  const activeEdgeIdx = step.v !== null ? input.edges.findIndex((e) => (e.u === step.u && e.v === step.v) || (e.u === step.v && e.v === step.u)) : -1;

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
                label="DIJKSTRA"
                meta={`${input.n} nodes / ${input.edges.length} edges / source ${input.source}`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    已确定 {step.settledCount}/{input.n}
                  </span>
                }
              >
                <div className="flex flex-1 items-center justify-center p-4">
                  <svg
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                    className="h-full max-h-[420px] w-full min-h-[180px]"
                    role="img"
                    aria-label="Dijkstra 最短路径求解过程"
                  >
                    {input.edges.map((e, i) => {
                      const isActive = i === activeEdgeIdx && !done;
                      const mx = (layout.pos[e.u].x + layout.pos[e.v].x) / 2;
                      const my = (layout.pos[e.u].y + layout.pos[e.v].y) / 2;
                      return (
                        <g key={i}>
                          <line
                            x1={layout.pos[e.u].x}
                            y1={layout.pos[e.u].y}
                            x2={layout.pos[e.v].x}
                            y2={layout.pos[e.v].y}
                            stroke={isActive && step.improved ? '#3b82f6' : '#3f3f46'}
                            strokeWidth={isActive ? 2.4 : 1.4}
                            opacity={isActive ? 0.95 : 0.5}
                            style={{ transition: 'stroke 200ms ease' }}
                          />
                          {isActive && (
                            <line
                              x1={layout.pos[e.u].x}
                              y1={layout.pos[e.u].y}
                              x2={layout.pos[e.v].x}
                              y2={layout.pos[e.v].y}
                              stroke={step.improved ? '#fbbf24' : '#f43f5e'}
                              strokeWidth={4}
                              opacity={0.4}
                              className="pulse-soft"
                            />
                          )}
                          <text x={mx} y={my - 4} textAnchor="middle" fontSize={9} fontFamily="monospace" fill="#71717a">
                            {e.w}
                          </text>
                        </g>
                      );
                    })}
                    {Array.from({ length: input.n }, (_, node) => {
                      const { x, y } = layout.pos[node];
                      const isSettled = step.settled[node];
                      const isCurrent = node === step.u && step.v === null && !done;
                      const d = step.dist[node];
                      return (
                        <g key={node}>
                          {isCurrent && (
                            <circle cx={x} cy={y} r={19} fill="none" stroke="#fbbf24" strokeWidth={1.2} opacity={0.6} className="pulse-soft" />
                          )}
                          <circle
                            cx={x}
                            cy={y}
                            r={13}
                            fill={isSettled ? '#3b82f6' : '#111318'}
                            stroke={node === input.source ? '#93c5fd' : '#52525b'}
                            strokeWidth={node === input.source ? 2.2 : 1.6}
                            style={{ transition: 'fill 260ms ease' }}
                          />
                          <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontFamily="monospace" fill={isSettled ? '#fff' : '#d4d4d8'}>
                            {node}
                          </text>
                          <text x={x} y={y + 28} textAnchor="middle" fontSize={10} fontFamily="monospace" fill={isSettled ? '#93c5fd' : '#a1a1aa'}>
                            {d === null ? '∞' : d}
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
                    距离 = [{(result ?? []).map((d) => (d === null ? '∞' : d)).join(', ')}]
                  </span>
                )}
              </p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">{step.note}</p>
            </div>
          </div>

          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field label="节点数 (NODES)" value={n} min={5} max={12} step={1} onChange={setN} />
              <Field
                label="边密度 (DENSITY)"
                value={density}
                min={0.25}
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
                  <span className="text-zinc-400">边数</span>
                  <span className="tabular-nums text-zinc-800">{input.edges.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">源点</span>
                  <span className="tabular-nums text-zinc-800">{input.source}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">已确定</span>
                  <span className="tabular-nums text-zinc-800">{step.settledCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">策略</span>
                  <span className="text-zinc-800">贪心 + 松弛</span>
                </div>
              </div>
            </Section>
          </ControlPanel>
        </div>
      </div>
    </main>
  );
}
