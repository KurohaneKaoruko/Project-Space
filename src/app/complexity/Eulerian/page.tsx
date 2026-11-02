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

interface EulerInput {
  n: number;
  edges: [number, number][];
}

interface EulerStep {
  /** 每条边是否已被走过 */
  used: boolean[];
  /** Hierholzer 的当前栈（正在走的迹） */
  stack: number[];
  /** 已归位的顶点（逆序） */
  circuit: number[];
  active: number | null;
  note: string;
}

const TITLE = '欧拉回路';
const CLS = 'P' as const;

const edgeKey = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;

function buildAdj(input: EulerInput) {
  const adj: { to: number; id: number }[][] = Array.from({ length: input.n }, () => []);
  input.edges.forEach(([u, v], id) => {
    adj[u].push({ to: v, id });
    adj[v].push({ to: u, id });
  });
  return adj;
}

/** 参考解：Hierholzer */
function eulerTour(input: EulerInput): number[] | null {
  const { n, edges } = input;
  const adj = buildAdj(input);

  for (let i = 0; i < n; i++) if (adj[i].length % 2 === 1) return null;

  const seen = new Array(n).fill(false);
  const start = edges.length ? edges[0][0] : 0;
  const queue = [start];
  seen[start] = true;
  while (queue.length) {
    const u = queue.shift() as number;
    for (const e of adj[u]) {
      if (!seen[e.to]) {
        seen[e.to] = true;
        queue.push(e.to);
      }
    }
  }
  for (let i = 0; i < n; i++) if (adj[i].length > 0 && !seen[i]) return null;

  const used = new Array(edges.length).fill(false);
  const stack = [start];
  const circuit: number[] = [];
  while (stack.length) {
    const u = stack[stack.length - 1];
    const next = adj[u].find((e) => !used[e.id]);
    if (next) {
      used[next.id] = true;
      stack.push(next.to);
    } else {
      circuit.push(stack.pop() as number);
    }
  }
  return circuit.reverse();
}

/** 校验：长度对、首尾相接、每条边恰好用一次 */
function isEuler(output: unknown, input: EulerInput): boolean {
  if (!Array.isArray(output)) return false;
  const tour = output as number[];
  if (tour.length !== input.edges.length + 1) return false;
  if (tour[0] !== tour[tour.length - 1]) return false;

  const remaining = new Set(input.edges.map((_, i) => i));
  for (let i = 0; i + 1 < tour.length; i++) {
    const a = tour[i];
    const b = tour[i + 1];
    let found = -1;
    for (const id of remaining) {
      const [u, v] = input.edges[id];
      if ((u === a && v === b) || (u === b && v === a)) {
        found = id;
        break;
      }
    }
    if (found === -1) return false;
    remaining.delete(found);
  }
  return remaining.size === 0;
}

function makeCase(name: string, input: EulerInput): TestCase<EulerInput, number[] | null> {
  const ref = eulerTour(input);
  return {
    name,
    input,
    expected: ref,
    validate: (out) => (ref === null ? out === null : isEuler(out, input)),
  };
}

const CASES: TestCase<EulerInput, number[] | null>[] = [
  makeCase('三角形', {
    n: 3,
    edges: [
      [0, 1],
      [1, 2],
      [0, 2],
    ],
  }),
  makeCase('蝴蝶结', {
    n: 5,
    edges: [
      [0, 1],
      [1, 2],
      [0, 2],
      [2, 3],
      [3, 4],
      [2, 4],
    ],
  }),
  makeCase('奇度点（无解）', {
    n: 4,
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
  }),
];

/** 每个顶点度数都是偶数：从一个环开始，再叠加若干个「三边都未出现」的三角形 */
function eulerianGraph(n: number, extra: number, seed: number): EulerInput {
  const rnd = mulberry32(seed);
  const edges: [number, number][] = [];
  const seen = new Set<string>();

  const add = (a: number, b: number) => {
    if (a === b) return false;
    const key = edgeKey(a, b);
    if (seen.has(key)) return false;
    seen.add(key);
    edges.push([Math.min(a, b), Math.max(a, b)]);
    return true;
  };

  for (let i = 0; i < n; i++) add(i, (i + 1) % n);

  let added = 0;
  let guard = 0;
  while (added < extra && guard++ < 600) {
    const a = Math.floor(rnd() * n);
    const b = Math.floor(rnd() * n);
    const c = Math.floor(rnd() * n);
    if (a === b || b === c || a === c) continue;
    if (seen.has(edgeKey(a, b)) || seen.has(edgeKey(b, c)) || seen.has(edgeKey(a, c))) continue;
    add(a, b);
    add(b, c);
    add(a, c);
    added++;
  }

  return { n, edges };
}

/** Hierholzer：走一条边一帧，退栈一帧 */
function* eulerGen(input: EulerInput): Generator<EulerStep, number[] | null, void> {
  const { n, edges } = input;
  const adj = buildAdj(input);
  const used = new Array(edges.length).fill(false);
  const stack: number[] = [];
  const circuit: number[] = [];

  const odd: number[] = [];
  for (let i = 0; i < n; i++) if (adj[i].length % 2 === 1) odd.push(i);
  if (odd.length > 0) {
    yield {
      used: [...used],
      stack: [],
      circuit: [],
      active: null,
      note: `奇度点 ${odd.join(', ')} → 不存在欧拉回路`,
    };
    return null;
  }

  const seen = new Array(n).fill(false);
  const start = edges.length ? edges[0][0] : 0;
  const queue = [start];
  seen[start] = true;
  while (queue.length) {
    const u = queue.shift() as number;
    for (const e of adj[u]) {
      if (!seen[e.to]) {
        seen[e.to] = true;
        queue.push(e.to);
      }
    }
  }
  for (let i = 0; i < n; i++) {
    if (adj[i].length > 0 && !seen[i]) {
      yield {
        used: [...used],
        stack: [],
        circuit: [],
        active: null,
        note: `图不连通（${i} 与 ${start} 无通路）→ 不存在欧拉回路`,
      };
      return null;
    }
  }

  stack.push(start);
  yield { used: [...used], stack: [...stack], circuit: [], active: start, note: `从 ${start} 出发，栈里只有起点` };

  while (stack.length > 0) {
    const u = stack[stack.length - 1];
    const next = adj[u].find((e) => !used[e.id]);
    if (next) {
      used[next.id] = true;
      stack.push(next.to);
      yield {
        used: [...used],
        stack: [...stack],
        circuit: [...circuit],
        active: next.to,
        note: `走边 ${u}–${next.to}，已用 ${used.filter(Boolean).length}/${edges.length} 条`,
      };
    } else {
      const dead = stack.pop() as number;
      circuit.push(dead);
      yield {
        used: [...used],
        stack: [...stack],
        circuit: [...circuit],
        active: stack.length ? stack[stack.length - 1] : null,
        note: `${dead} 已无未用边，退栈并写入回路`,
      };
    }
  }

  return [...circuit].reverse();
}

const TEMPLATE = `function solve(input) {
  const { n, edges } = input;

  // TODO: 返回欧拉回路的顶点序列（首尾相同，每条边恰好用一次），不存在返回 null
  return null;
}`;

const SOLUTION = `function solve(input) {
  const { n, edges } = input;
  const adj = Array.from({ length: n }, () => []);
  edges.forEach(([u, v], id) => {
    adj[u].push({ to: v, id });
    adj[v].push({ to: u, id });
  });

  for (let i = 0; i < n; i++) if (adj[i].length % 2 === 1) return null;

  const used = new Array(edges.length).fill(false);
  const stack = [edges.length ? edges[0][0] : 0];
  const circuit = [];

  while (stack.length) {
    const u = stack[stack.length - 1];
    const next = adj[u].find((e) => !used[e.id]);
    if (next) {
      used[next.id] = true;
      stack.push(next.to);
    } else {
      circuit.push(stack.pop());
    }
  }
  return circuit.reverse();
}`;

export default function EulerianPage() {
  const [n, setN] = useState(7);
  const [extra, setExtra] = useState(3);
  const [seed, setSeed] = useState(1);
  const [speed, setSpeed] = useState(1);

  const input = useMemo<EulerInput>(() => eulerianGraph(n, extra, seed), [n, extra, seed]);
  const factory = useCallback(() => eulerGen(input), [input]);
  const solver = useLiveSolver<EulerStep, number[] | null>(factory, [input], { stepsPerFrame: speed });

  const step: EulerStep =
    solver.current ?? {
      used: new Array(input.edges.length).fill(false),
      stack: [],
      circuit: [],
      active: null,
      note: '尚未开始，点「开始求解」',
    };
  const result = solver.result;
  const done = solver.done;

  const layout = useMemo(() => {
    const W = 820;
    const H = 380;
    const nodeR = input.n <= 8 ? 23 : input.n <= 12 ? 18 : 14;
    return {
      width: W,
      height: H,
      nodeR,
      pos: Array.from({ length: input.n }, (_, i) => {
        const angle = (i / input.n) * Math.PI * 2 - Math.PI / 2;
        return { x: W / 2 + 300 * Math.cos(angle), y: H / 2 + 130 * Math.sin(angle) };
      }),
    };
  }, [input]);

  // 当前栈上的边（正在走的迹）
  const trailEdges = new Set<string>();
  for (let i = 0; i + 1 < step.stack.length; i++) {
    trailEdges.add(edgeKey(step.stack[i], step.stack[i + 1]));
  }
  const usedCount = step.used.filter(Boolean).length;

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
                label="EULERIAN"
                meta={`${input.n} nodes / ${input.edges.length} edges`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    已用 {usedCount}/{input.edges.length}
                  </span>
                }
              >
                <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
                  <div className="flex min-h-0 flex-1 items-center justify-center p-3">
                  <svg
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                    className="h-full max-h-[420px] w-full"
                    role="img"
                    aria-label="欧拉回路构造过程"
                  >
                    {input.edges.map(([u, v], id) => {
                      const onTrail = trailEdges.has(edgeKey(u, v));
                      const used = step.used[id];
                      return (
                        <line
                          key={id}
                          x1={layout.pos[u].x}
                          y1={layout.pos[u].y}
                          x2={layout.pos[v].x}
                          y2={layout.pos[v].y}
                          stroke={onTrail ? '#fbbf24' : used ? '#3b82f6' : '#3f3f46'}
                          strokeWidth={onTrail ? 3.4 : used ? 2.4 : 1.2}
                          style={{ transition: 'stroke 180ms, stroke-width 180ms' }}
                        />
                      );
                    })}

                    {Array.from({ length: input.n }, (_, node) => {
                      const { x, y } = layout.pos[node];
                      const inStack = step.stack.includes(node);
                      const settled = step.circuit.includes(node);
                      const active = step.active === node;
                      return (
                        <g key={node}>
                          {active && (
                            <circle
                              cx={x}
                              cy={y}
                              r={layout.nodeR + 7}
                              fill="none"
                              stroke="#fbbf24"
                              strokeWidth={1}
                              opacity={0.65}
                              className="pulse-soft"
                            />
                          )}
                          <circle
                            cx={x}
                            cy={y}
                            r={layout.nodeR}
                            fill={settled ? 'rgba(16,185,129,0.85)' : inStack ? 'rgba(59,130,246,0.85)' : '#111318'}
                            stroke={settled ? '#6ee7b7' : inStack ? '#93c5fd' : '#3f3f46'}
                            strokeWidth={1.6}
                            style={{ transition: 'fill 180ms, stroke 180ms' }}
                          />
                          <text
                            x={x}
                            y={y + layout.nodeR * 0.2}
                            textAnchor="middle"
                            fontSize={Math.max(9, Math.round(layout.nodeR * 0.6))}
                            fontFamily="monospace"
                            fill={settled || inStack ? '#ffffff' : '#a1a1aa'}
                          >
                            {node}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  </div>

                  <div className="flex shrink-0 flex-col justify-center gap-4 border-t border-white/[0.06] p-4 sm:w-[230px] sm:border-l sm:border-t-0">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">当前迹</div>
                      <p className="mt-1 break-all font-mono text-sm leading-relaxed text-zinc-100">
                        {step.stack.length ? step.stack.join(' → ') : '—'}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">已用边</span>
                        <span className="font-mono text-[9px] tabular-nums text-zinc-500">
                          {usedCount}/{input.edges.length}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${(usedCount / Math.max(1, input.edges.length)) * 100}%` }}
                        />
                      </div>
                      <div className="mt-2 flex justify-between font-mono text-[10px] text-zinc-500">
                        <span>栈深 <b className="text-zinc-300">{step.stack.length}</b></span>
                        <span>回路 <b className="text-zinc-300">{step.circuit.length}</b></span>
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">result</div>
                      <p className="mt-1 font-mono text-[11px] leading-relaxed">
                        {!done ? (
                          <span className="text-zinc-600">求解中…</span>
                        ) : result ? (
                          <span className="text-emerald-400">{result.length} 个顶点</span>
                        ) : (
                          <span className="text-rose-400">无欧拉回路</span>
                        )}
                      </p>
                      <p className="mt-1 font-mono text-[10px] leading-relaxed text-zinc-500">{step.note}</p>
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
              <Field label="节点数 (NODES)" value={n} min={4} max={12} step={1} onChange={setN} />
              <Field
                label="附加三角 (TRIANGLES)"
                value={extra}
                min={0}
                max={6}
                step={1}
                onChange={setExtra}
                format={(v) => (v === 0 ? '仅一个环' : `+${v * 3} 条边`)}
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
                  <span className="text-zinc-400">节点 / 边</span>
                  <span className="text-zinc-800">
                    {input.n} / {input.edges.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">已用边</span>
                  <span className="tabular-nums text-zinc-800">
                    {usedCount} / {input.edges.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">栈深</span>
                  <span className="tabular-nums text-zinc-800">{step.stack.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">回路步数</span>
                  <span className="tabular-nums text-zinc-800">{step.circuit.length}</span>
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
