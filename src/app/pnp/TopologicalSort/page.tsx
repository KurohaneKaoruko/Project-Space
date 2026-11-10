'use client';

import { useCallback, useMemo, useState } from 'react';
import Navigation from '../../components/Navigation';
import InstrumentPanel from '../components/InstrumentPanel';
import SegmentedControl from '../components/SegmentedControl';
import ControlPanel, { Field, Section } from '../components/ControlPanel';
import { randomDag } from '../lib/generate';
import CodeRunner from '../components/CodeRunner';
import LiveControls from '../components/LiveControls';
import { useLiveSolver } from '../lib/useLiveSolver';
import { CLASS_META, type TestCase } from '../lib/types';

interface TopoInput {
  n: number;
  edges: [number, number][];
}

interface TopoStep {
  /** 0 未处理 / 1 待处理 / 2 已确定 */
  state: number[];
  order: number[];
  active: number | null;
  note: string;
  inDegree?: number[];
}

function isTopoOrder(order: unknown, input: TopoInput): boolean {
  if (!Array.isArray(order) || order.length !== input.n) return false;
  const pos = new Array(input.n).fill(-1);
  for (let i = 0; i < order.length; i++) {
    const node = order[i];
    if (!Number.isInteger(node) || node < 0 || node >= input.n) return false;
    if (pos[node] !== -1) return false;
    pos[node] = i;
  }
  return input.edges.every(([u, v]) => pos[u] < pos[v]);
}

const CASES: TestCase<TopoInput, number[]>[] = [
  {
    name: '经典 DAG',
    input: {
      n: 6,
      edges: [
        [5, 2],
        [5, 0],
        [4, 0],
        [4, 1],
        [2, 3],
        [3, 1],
      ],
    },
    expected: [4, 5, 2, 3, 1, 0],
    validate: isTopoOrder,
  },
  {
    name: '链状',
    input: { n: 4, edges: [[0, 1], [1, 2], [2, 3]] },
    expected: [0, 1, 2, 3],
    validate: isTopoOrder,
  },
  {
    name: '菱形',
    input: {
      n: 5,
      edges: [
        [0, 1],
        [0, 2],
        [1, 3],
        [2, 3],
        [3, 4],
      ],
    },
    expected: [0, 1, 2, 3, 4],
    validate: isTopoOrder,
  },
  {
    name: '多起点',
    input: {
      n: 6,
      edges: [
        [0, 3],
        [1, 3],
        [2, 4],
        [3, 5],
        [4, 5],
      ],
    },
    expected: [0, 1, 2, 3, 4, 5],
    validate: isTopoOrder,
  },
];

function buildGraph(input: TopoInput) {
  const adj: number[][] = Array.from({ length: input.n }, () => []);
  const indeg = new Array(input.n).fill(0);
  for (const [u, v] of input.edges) {
    adj[u].push(v);
    indeg[v]++;
  }
  return { adj, indeg };
}

function* kahnGen(input: TopoInput): Generator<TopoStep, number[], void> {
  const { adj, indeg } = buildGraph(input);
  const state = new Array(input.n).fill(0);
  const order: number[] = [];
  const queue: number[] = [];

  for (let i = 0; i < input.n; i++) {
    if (indeg[i] === 0) {
      queue.push(i);
      state[i] = 1;
    }
  }
  yield {
    state: [...state],
    order: [],
    active: null,
    note: `入度为 0 的节点入队：[${queue.join(', ')}]`,
    inDegree: [...indeg],
  };

  while (queue.length > 0) {
    const u = queue.shift() as number;
    order.push(u);
    state[u] = 2;
    yield {
      state: [...state],
      order: [...order],
      active: u,
      note: `取出 ${u}，追加到拓扑序末尾`,
      inDegree: [...indeg],
    };

    for (const v of adj[u]) {
      indeg[v]--;
      if (indeg[v] === 0) {
        queue.push(v);
        state[v] = 1;
      }
    }
    yield {
      state: [...state],
      order: [...order],
      active: u,
      note: `松弛 ${u} 的所有出边，更新后继入度`,
      inDegree: [...indeg],
    };
  }

  return order;
}

function* dfsGen(input: TopoInput): Generator<TopoStep, number[], void> {
  const { adj } = buildGraph(input);
  const state = new Array(input.n).fill(0);
  const order: number[] = [];

  function* visit(u: number): Generator<TopoStep, void, void> {
    state[u] = 1;
    yield { state: [...state], order: [...order], active: u, note: `访问 ${u}，继续深入` };
    for (const v of adj[u]) {
      if (state[v] === 0) yield* visit(v);
    }
    state[u] = 2;
    order.unshift(u);
    yield { state: [...state], order: [...order], active: u, note: `${u} 的后继处理完，插入序首` };
  }

  for (let i = 0; i < input.n; i++) {
    if (state[i] === 0) yield* visit(i);
  }

  return order;
}

function computeLevels(input: TopoInput): number[] {
  const { adj, indeg } = buildGraph(input);
  const level = new Array(input.n).fill(0);
  const deg = [...indeg];
  const queue: number[] = [];
  for (let i = 0; i < input.n; i++) if (deg[i] === 0) queue.push(i);

  while (queue.length) {
    const u = queue.shift() as number;
    for (const v of adj[u]) {
      level[v] = Math.max(level[v], level[u] + 1);
      if (--deg[v] === 0) queue.push(v);
    }
  }
  return level;
}

const TEMPLATE = `function solve(input) {
  const { n, edges } = input;
  const indeg = new Array(n).fill(0);
  const adj = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) {
    adj[u].push(v);
    indeg[v]++;
  }

  // TODO: 用 Kahn 算法返回一个拓扑序
  return [];
}`;

const SOLUTION = `function solve(input) {
  const { n, edges } = input;
  const indeg = new Array(n).fill(0);
  const adj = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) {
    adj[u].push(v);
    indeg[v]++;
  }

  const queue = [];
  for (let i = 0; i < n; i++) if (indeg[i] === 0) queue.push(i);

  const order = [];
  while (queue.length) {
    const u = queue.shift();
    order.push(u);
    for (const v of adj[u]) {
      if (--indeg[v] === 0) queue.push(v);
    }
  }
  return order;
}`;

const NODE_STYLE = [
  { fill: '#111318', stroke: '#3f3f46', text: '#a1a1aa' },
  { fill: 'rgba(245,158,11,0.12)', stroke: '#f59e0b', text: '#fbbf24' },
  { fill: 'rgba(59,130,246,0.16)', stroke: '#3b82f6', text: '#93c5fd' },
];

export default function TopologicalSortPage() {
  const [algo, setAlgo] = useState<'kahn' | 'dfs'>('kahn');
  const [n, setN] = useState(6);
  const [density, setDensity] = useState(0.35);
  const [seed, setSeed] = useState(7);

  const input = useMemo(() => randomDag(n, density, seed), [n, density, seed]);
  const [speed, setSpeed] = useState(1);
  const factory = useCallback(() => (algo === 'kahn' ? kahnGen(input) : dfsGen(input)), [algo, input]);
  const solver = useLiveSolver<TopoStep, number[]>(factory, [algo, input], { stepsPerFrame: speed });

  const step: TopoStep =
    solver.current ?? {
      state: new Array(input.n).fill(0),
      order: [],
      active: null,
      note: '尚未开始，点「开始求解」',
    };
  const order = solver.result ?? step.order;

  // 节点越多，半径越小、画布越高
  const nodeR = input.n <= 10 ? 26 : input.n <= 16 ? 20 : input.n <= 32 ? 14 : 9;
  const layout = useMemo(() => {
    const W = 1000;
    const PAD_X = 90;
    const PAD_Y = 40;
    const levels = computeLevels(input);
    const byLevel = new Map<number, number[]>();
    for (let i = 0; i < input.n; i++) {
      const list = byLevel.get(levels[i]) ?? [];
      list.push(i);
      byLevel.set(levels[i], list);
    }
    const maxLevel = Math.max(0, ...levels);
    const busiest = Math.max(1, ...[...byLevel.values()].map((nodes) => nodes.length));
    const H = Math.max(300, busiest * (2 * nodeR + 10) + PAD_Y * 2);
    const stepX = maxLevel > 0 ? (W - PAD_X * 2) / maxLevel : 0;
    const pos: { x: number; y: number }[] = new Array(input.n);
    byLevel.forEach((nodes, level) => {
      const gap = nodes.length > 1 ? Math.min(92, (H - PAD_Y * 2) / (nodes.length - 1)) : 0;
      nodes.forEach((node, i) => {
        pos[node] = {
          x: maxLevel > 0 ? PAD_X + level * stepX : W / 2,
          y: H / 2 + (i - (nodes.length - 1) / 2) * gap,
        };
      });
    });
    return { pos, width: W, height: H };
  }, [input, nodeR]);

  return (
    <main className="min-h-screen bg-zinc-50">
      <Navigation
        title="拓扑排序"
        header={
          <>
            <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${CLASS_META['P'].chip}`}>
              {CLASS_META['P'].label}
            </span>
            <span className="font-mono text-sm font-bold tracking-wide text-zinc-900">拓扑排序</span>
          </>
        }
        actions={<CodeRunner template={TEMPLATE} solution={SOLUTION} cases={CASES} />}
      />

      <div className="flex min-h-screen flex-col px-4 pb-6 pt-16 sm:px-6 lg:px-8 lg:pb-6">
        <div className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col gap-4 lg:min-h-0 lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">


          {/* 画布 */}
          <InstrumentPanel
            label="DAG"
            className="flex min-h-0 flex-1 flex-col"
            bodyClassName="flex min-h-0 flex-1 flex-col"
            meta={`${input.n} nodes / ${input.edges.length} edges`}
            actions={
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500">
                  <i className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  待处理
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500">
                  <i className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  已确定
                </span>
                <span className="font-mono text-[10px] text-zinc-600">
                  {algo === 'kahn' ? 'KAHN' : 'DFS'}
                </span>
              </div>
            }
          >
            <div className="flex min-h-0 flex-1 items-center overflow-x-auto px-4 py-4">
              <svg
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                className="h-full max-h-[320px] w-full"
                role="img"
                aria-label="DAG 拓扑排序过程"
              >
                <defs>
                  <marker id="topo-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                    <path d="M0,0 L7,3 L0,6 Z" fill="currentColor" />
                  </marker>
                  <filter id="topo-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {input.edges.map(([u, v], i) => {
                  const active = step.active === u;
                  return (
                    <line
                      key={i}
                      x1={layout.pos[u].x}
                      y1={layout.pos[u].y}
                      x2={layout.pos[v].x}
                      y2={layout.pos[v].y}
                      color={active ? '#60a5fa' : '#52525b'}
                      stroke="currentColor"
                      strokeWidth={active ? 1.8 : 1.2}
                      markerEnd="url(#topo-arrow)"
                      style={{ transition: 'color 240ms ease' }}
                    />
                  );
                })}

                {Array.from({ length: input.n }, (_, node) => {
                  const state = step.state[node];
                  const style = NODE_STYLE[state];
                  const { x, y } = layout.pos[node];
                  const active = step.active === node;
                  return (
                    <g key={node}>
                      {active && (
                        <circle
                          cx={x}
                          cy={y}
                          r={nodeR + 8}
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth={1}
                          opacity={0.55}
                          className="pulse-soft"
                        />
                      )}
                      <circle
                        cx={x}
                        cy={y}
                        r={nodeR}
                        fill={style.fill}
                        stroke={style.stroke}
                        strokeWidth={active ? 2.4 : 1.6}
                        style={{ transition: 'fill 240ms ease, stroke 240ms ease' }}
                      />
                      <text
                        x={x}
                        y={y + nodeR * 0.22}
                        textAnchor="middle"
                        fontSize={Math.max(9, Math.round(nodeR * 0.58))}
                        fontFamily="monospace"
                        fill={style.text}
                        style={{ transition: 'fill 240ms ease' }}
                      >
                        {node}
                      </text>
                      {step.inDegree && (
                        <g>
                          <rect
                            x={x + nodeR - 5}
                            y={y - nodeR - 15}
                            width={20}
                            height={15}
                            rx={3}
                            fill="#0b0d12"
                            stroke={step.inDegree[node] === 0 ? '#f59e0b' : '#27272a'}
                            strokeWidth={1}
                          />
                          <text
                            x={x + nodeR + 5}
                            y={y - nodeR - 4}
                            textAnchor="middle"
                            fontSize="9"
                            fontFamily="monospace"
                            fill={step.inDegree[node] === 0 ? '#fbbf24' : '#71717a'}
                          >
                            {step.inDegree[node]}
                          </text>
                        </g>
                      )}
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

          {/* 输出流水线 + 执行日志 */}
          <div className="shrink-0">
            <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-400">
                拓扑序
              </h2>
              <span className="font-mono text-[11px] text-zinc-500">{step.note}</span>
              <span className="ml-auto font-mono text-[10px] text-zinc-400">
                {order.length} / {input.n}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {Array.from({ length: input.n }, (_, i) => {
                const node = step.order[i];
                const filled = node !== undefined;
                return (
                  <div key={i} className="flex items-center gap-2">
                    {i > 0 && (
                      <span className={`font-mono text-[11px] ${filled ? 'text-blue-400' : 'text-zinc-200'}`}>
                        →
                      </span>
                    )}
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-lg border font-mono text-base transition-all duration-300 ${
                        filled
                          ? 'scale-100 border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-600/25'
                          : 'scale-95 border-dashed border-zinc-200 bg-zinc-50 text-zinc-300'
                      }`}
                    >
                      {filled ? node : '·'}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-3 font-mono text-[11px] text-zinc-400">
              最终结果 <span className="text-blue-700">{order.join(' → ')}</span>
            </p>
            </section>

          </div>
        </div>
          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field label="节点数 (NODES)" value={n} min={3} max={60} step={1} onChange={setN} />
              <Field
                label="边密度 (DENSITY)"
                value={Math.round(density * 100)}
                min={5}
                max={95}
                step={5}
                onChange={(v) => setDensity(v / 100)}
                format={(v) => `${v}%`}
              />
              <button
                onClick={() => setSeed((s) => s + 1)}
                className="w-full border border-zinc-200 bg-zinc-50 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:border-blue-500/50 hover:bg-white hover:text-blue-600"
              >
                重新生成 (RESHUFFLE)
              </button>
            </Section>

            <Section title="算法 (ALGORITHM)">
              <SegmentedControl
                value={algo}
                onChange={(v) => setAlgo(v as 'kahn' | 'dfs')}
                options={[
                  { value: 'kahn', label: 'Kahn' },
                  { value: 'dfs', label: 'DFS 逆后序' },
                ]}
              />
            </Section>

            <Section title="数据 (DATA)">
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between"><span className="text-zinc-400">节点 / 边</span><span className="text-zinc-800">{input.n} / {input.edges.length}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">已确定</span><span className="text-zinc-800">{order.length} / {input.n}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">步数</span><span className="tabular-nums text-zinc-800">{solver.stepCount}</span></div>
              </div>
            </Section>

          </ControlPanel>
        </div>
      </div>
    </main>
  );
}
