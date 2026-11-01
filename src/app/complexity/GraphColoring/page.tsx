'use client';

import { useCallback, useMemo, useState } from 'react';
import Navigation from '../../components/Navigation';
import InstrumentPanel from '../components/InstrumentPanel';
import SegmentedControl from '../components/SegmentedControl';
import ControlPanel, { Field, Section } from '../components/ControlPanel';
import { randomGraph } from '../lib/generate';
import CodeRunner from '../components/CodeRunner';
import LiveControls from '../components/LiveControls';
import { useLiveSolver } from '../lib/useLiveSolver';
import { CLASS_META, type TestCase } from '../lib/types';

interface ColorInput {
  n: number;
  edges: [number, number][];
  k: number;
}

interface ColorStep {
  colors: (number | null)[];
  active: number | null;
  note: string;
  backtracks: number;
}

const PALETTE = ['#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#f43f5e', '#06b6d4'];

function isProperColoring(output: unknown, input: ColorInput): boolean {
  if (!Array.isArray(output) || output.length !== input.n) return false;
  if (output.some((c) => !Number.isInteger(c) || c < 0 || c >= input.k)) return false;
  return input.edges.every(([u, v]) => output[u] !== output[v]);
}

function referenceSolve(input: ColorInput): number[] | null {
  const { n, edges, k } = input;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) {
    adj[u].push(v);
    adj[v].push(u);
  }
  const colors = new Array<number | null>(n).fill(null);
  const ok = (node: number, color: number) => adj[node].every((v) => colors[v] !== color);

  // 规模放大后回溯可能爆炸，给一个访问上限
  let budget = 200000;
  const dfs = (node: number): boolean => {
    if (node === n) return true;
    if (--budget <= 0) return false;
    for (let c = 0; c < k; c++) {
      if (!ok(node, c)) continue;
      colors[node] = c;
      if (dfs(node + 1)) return true;
      colors[node] = null;
    }
    return false;
  };

  return dfs(0) ? (colors as number[]) : null;
}

function makeCase(name: string, input: ColorInput): TestCase<ColorInput, number[] | null> {
  const reference = referenceSolve(input);
  return {
    name,
    input,
    expected: reference,
    validate: (out) => (reference === null ? out === null : isProperColoring(out, input)),
  };
}

const C5: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 0],
];

const CASES: TestCase<ColorInput, number[] | null>[] = [
  makeCase('5 环 · k=3', { n: 5, edges: C5, k: 3 }),
  makeCase('5 环 · k=2', { n: 5, edges: C5, k: 2 }),
  makeCase('K4 · k=3', {
    n: 4,
    edges: [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
    ],
    k: 3,
  }),
  makeCase('8 节点 · k=3', {
    n: 8,
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 0],
      [0, 4],
      [2, 6],
    ],
    k: 3,
  }),
];

const MAX_STEPS = 500;

function* backtrackGen(input: ColorInput): Generator<ColorStep, number[] | null, void> {
  const { n, edges, k } = input;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) {
    adj[u].push(v);
    adj[v].push(u);
  }

  const colors = new Array<number | null>(n).fill(null);
  let backtracks = 0;
  let budget = 200000;

  const ok = (node: number, color: number) => adj[node].every((v) => colors[v] !== color);

  function* dfs(node: number): Generator<ColorStep, number[] | null, void> {
    if (node === n) return colors as number[];
    if (--budget <= 0) {
      yield { colors: [...colors], active: node, note: '搜索步数超限，已中止', backtracks };
      return null;
    }
    for (let c = 0; c < k; c++) {
      if (!ok(node, c)) {
        yield { colors: [...colors], active: node, note: `节点 ${node} 试色 ${c} 与邻居冲突`, backtracks };
        continue;
      }
      colors[node] = c;
      yield { colors: [...colors], active: node, note: `节点 ${node} 取色 ${c}`, backtracks };
      const found = yield* dfs(node + 1);
      if (found) return found;
      colors[node] = null;
      backtracks++;
      yield { colors: [...colors], active: node, note: `节点 ${node} 后续无解，撤销颜色`, backtracks };
    }
    return null;
  }

  const result = yield* dfs(0);
  yield {
    colors: [...colors],
    active: null,
    note: result ? '找到合法着色' : '所有分支都失败 → 无解',
    backtracks,
  };
  return result;
}

function* greedyGen(input: ColorInput): Generator<ColorStep, number[] | null, void> {
  const { n, edges, k } = input;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) {
    adj[u].push(v);
    adj[v].push(u);
  }

  const colors = new Array<number | null>(n).fill(null);

  for (let node = 0; node < n; node++) {
    const used = new Set(adj[node].map((v) => colors[v]).filter((c) => c !== null));
    let chosen = -1;
    for (let c = 0; c < k; c++) {
      if (!used.has(c)) {
        chosen = c;
        break;
      }
    }
    if (chosen === -1) {
      yield {
        colors: [...colors],
        active: node,
        note: `节点 ${node} 没有可用颜色（邻居已占用 ${k} 种）→ 贪心失败`,
        backtracks: 0,
      };
      return null;
    }
    colors[node] = chosen;
    yield { colors: [...colors], active: node, note: `节点 ${node} 取色 ${chosen}`, backtracks: 0 };
  }

  yield { colors: [...colors], active: null, note: '贪心着色完成', backtracks: 0 };
  return colors as number[];
}

const TEMPLATE = `function solve(input) {
  const { n, edges, k } = input;
  const adj = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) {
    adj[u].push(v);
    adj[v].push(u);
  }

  // TODO: 返回长度为 n 的颜色数组（取值 0..k-1），无解返回 null
  return null;
}`;

const SOLUTION = `function solve(input) {
  const { n, edges, k } = input;
  const adj = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) {
    adj[u].push(v);
    adj[v].push(u);
  }

  const colors = new Array(n).fill(null);
  const ok = (node, color) => adj[node].every((v) => colors[v] !== color);

  function dfs(node) {
    if (node === n) return true;
    for (let c = 0; c < k; c++) {
      if (!ok(node, c)) continue;
      colors[node] = c;
      if (dfs(node + 1)) return true;
      colors[node] = null;
    }
    return false;
  }

  return dfs(0) ? colors : null;
}`;

export default function GraphColoringPage() {
  const [algo, setAlgo] = useState<'backtrack' | 'greedy'>('backtrack');
  const [n, setN] = useState(7);
  const [density, setDensity] = useState(0.4);
  const [k, setK] = useState(3);
  const [seed, setSeed] = useState(2);

  const input = useMemo<ColorInput>(
    () => ({ n, edges: randomGraph(n, density, seed), k }),
    [n, density, k, seed],
  );
  const [speed, setSpeed] = useState(1);
  const factory = useCallback(
    () => (algo === 'backtrack' ? backtrackGen(input) : greedyGen(input)),
    [algo, input],
  );
  const solver = useLiveSolver<ColorStep, number[] | null>(factory, [algo, input], {
    stepsPerFrame: speed,
  });

  const step: ColorStep =
    solver.current ?? {
      colors: new Array(input.n).fill(null),
      active: null,
      note: '尚未开始，点「开始求解」',
      backtracks: 0,
    };
  const result = solver.result;

  // 椭圆布局；节点多时缩小半径
  const nodeR = input.n <= 10 ? 23 : input.n <= 16 ? 17 : 12;
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

  const usedCount = PALETTE.map((_, c) => step.colors.filter((v) => v === c).length);

  return (
    <main className="min-h-screen bg-zinc-50">
      <Navigation
        title="图着色"
        header={
          <>
            <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${CLASS_META['NPC'].chip}`}>
              {CLASS_META['NPC'].label}
            </span>
            <span className="font-mono text-sm font-bold tracking-wide text-zinc-900">图着色</span>
          </>
        }
        actions={<CodeRunner template={TEMPLATE} solution={SOLUTION} cases={CASES} />}
      />

      <div className="flex min-h-screen flex-col px-4 pb-6 pt-16 sm:px-6 lg:px-8 lg:pb-6">
        <div className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col gap-4 lg:min-h-0 lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">


          <InstrumentPanel
            label="GRAPH"
            meta={`${input.n} nodes / ${input.edges.length} edges / k = ${input.k}`}
            className="flex flex-col"
            bodyClassName="flex flex-1 flex-col"
            actions={
              <span className="font-mono text-[10px] text-zinc-500">回溯 {step.backtracks}</span>
            }
          >
            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:flex-row">
              {/* 调色盘 */}
              <div className="flex shrink-0 flex-row gap-2 sm:w-[132px] sm:flex-col">
                {Array.from({ length: input.k }, (_, c) => (
                  <div
                    key={c}
                    className="flex flex-1 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2 sm:flex-none"
                  >
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-sm"
                      style={{ background: PALETTE[c % PALETTE.length] }}
                    />
                    <span className="font-mono text-[11px] text-zinc-400">{c}</span>
                    <span className="ml-auto font-mono text-[10px] tabular-nums text-zinc-600">
                      {usedCount[c] || '·'}
                    </span>
                  </div>
                ))}
              </div>

              {/* 画布 */}
              <div className="flex flex-1 items-center justify-center">
                <svg
                  viewBox={`0 0 ${layout.width} ${layout.height}`}
                  className="h-full max-h-[420px] w-full min-h-[180px]"
                  role="img"
                  aria-label="图着色过程"
                >
                  {input.edges.map(([u, v], i) => (
                    <line
                      key={i}
                      x1={layout.pos[u].x}
                      y1={layout.pos[u].y}
                      x2={layout.pos[v].x}
                      y2={layout.pos[v].y}
                      stroke="#3f3f46"
                      strokeWidth={1.4}
                    />
                  ))}
                  {Array.from({ length: input.n }, (_, node) => {
                    const color = step.colors[node];
                    const { x, y } = layout.pos[node];
                    const active = step.active === node;
                    return (
                      <g key={node}>
                        {active && (
                          <circle
                            cx={x}
                            cy={y}
                            r={nodeR + 7}
                            fill="none"
                            stroke="#fbbf24"
                            strokeWidth={1}
                            opacity={0.6}
                            className="pulse-soft"
                          />
                        )}
                        <circle
                          cx={x}
                          cy={y}
                          r={nodeR}
                          fill={color === null ? '#111318' : PALETTE[color % PALETTE.length]}
                          stroke={color === null ? '#3f3f46' : 'rgba(255,255,255,0.25)'}
                          strokeWidth={1.6}
                          style={{ transition: 'fill 260ms ease, stroke 260ms ease' }}
                        />
                        <text
                          x={x}
                          y={y + nodeR * 0.2}
                          textAnchor="middle"
                          fontSize={Math.max(8, Math.round(nodeR * 0.6))}
                          fontFamily="monospace"
                          fill={color === null ? '#71717a' : '#ffffff'}
                          style={{ transition: 'fill 260ms ease' }}
                        >
                          {node}
                        </text>
                      </g>
                    );
                  })}
                </svg>
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

          <div className="shrink-0">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-400">
                结果
              </div>
              <p className="mt-2 font-mono text-sm">
                {!solver.done ? (
                  <span className="text-zinc-400">—</span>
                ) : result ? (
                  <span className="text-emerald-700">[{result.join(', ')}]</span>
                ) : (
                  <span className="text-rose-700">无解（null）</span>
                )}
              </p>
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-zinc-500">{step.note}</p>
            </div>

          </div>
        </div>
          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field label="节点数 (NODES)" value={n} min={4} max={24} step={1} onChange={setN} />
              <Field
                label="边密度 (DENSITY)"
                value={Math.round(density * 100)}
                min={10}
                max={90}
                step={5}
                onChange={(v) => setDensity(v / 100)}
                format={(v) => `${v}%`}
              />
              <Field label="颜色数 (K)" value={k} min={2} max={6} step={1} onChange={setK} />
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
                onChange={(v) => setAlgo(v as 'backtrack' | 'greedy')}
                options={[
                  { value: 'backtrack', label: '回溯' },
                  { value: 'greedy', label: '贪心' },
                ]}
              />
            </Section>
            <Section title="数据 (DATA)">
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between"><span className="text-zinc-400">节点 / 边</span><span className="text-zinc-800">{input.n} / {input.edges.length}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">已着色</span><span className="text-zinc-800">{step.colors.filter((c) => c !== null).length} / {input.n}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">回溯</span><span className="tabular-nums text-zinc-800">{step.backtracks}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">步数</span><span className="tabular-nums text-zinc-800">{solver.stepCount}</span></div>
              </div>
            </Section>

          </ControlPanel>
        </div>
      </div>
    </main>
  );
}
