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

interface GIInput {
  n: number;
  edgesA: [number, number][];
  edgesB: [number, number][];
  /** A 是否真的同构于 B（生成时已知的答案） */
  isomorphic: boolean;
}

interface GIStep {
  map: number[]; // map[i] = A 的 i 映射到 B 的哪个点,-1 未定
  assigned: boolean[];
  u: number;
  v: number;
  accepting: boolean;
  backtracks: number;
  note: string;
}

const TITLE = '图同构';
const CLS = 'NP' as const;

const PALETTE = ['#3b82f6', '#10b981', '#f43f5e', '#a855f7', '#f59e0b', '#06b6d4', '#84cc16', '#ec4899', '#6366f1'];

/* ---------------- 算法 ---------------- */

function degreeSeq(n: number, edges: [number, number][]): number[] {
  const d = new Array(n).fill(0);
  for (const [u, v] of edges) {
    d[u]++;
    d[v]++;
  }
  return d;
}

function adjMatrix(n: number, edges: [number, number][]) {
  const m: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false));
  for (const [u, v] of edges) {
    m[u][v] = true;
    m[v][u] = true;
  }
  return m;
}

/** 参考解：度序列剪枝 + 回溯找保边双射；不同构返回 null */
function findIso(input: GIInput): number[] | null {
  const { n, edgesA, edgesB, isomorphic } = input;
  if (!isomorphic) return null;
  const ma = adjMatrix(n, edgesA);
  const mb = adjMatrix(n, edgesB);
  const used = new Array(n).fill(false);
  const map = new Array(n).fill(-1);

  const write = (i: number): boolean => {
    if (i === n) return true;
    for (let v = 0; v < n; v++) {
      if (used[v]) continue;
      // 与已映射邻域一致性
      let ok = true;
      for (let u = 0; u < i; u++) {
        if (ma[i][u] !== mb[v][map[u]]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      map[i] = v;
      used[v] = true;
      if (write(i + 1)) return true;
      map[i] = -1;
      used[v] = false;
    }
    return false;
  };
  return write(0) ? [...map] : null;
}

function validate(output: unknown, input: GIInput): boolean {
  if (input.isomorphic) {
    if (!Array.isArray(output) || output.length !== input.n) return false;
    const map = output as number[];
    const seen = new Set<number>();
    for (const v of map) {
      if (!Number.isInteger(v) || v < 0 || v >= input.n || seen.has(v)) return false;
      seen.add(v);
    }
    const mb = adjMatrix(input.n, input.edgesB);
    return input.edgesA.every(([u, v]) => mb[map[u]][map[v]]);
  }
  return output === null || (Array.isArray(output) && output.length === 0);
}

function makeCase(name: string, input: GIInput): TestCase<GIInput, number[] | null> {
  const ref = findIso(input);
  return {
    name,
    input,
    expected: ref,
    validate: (out) => (input.isomorphic ? validate(out, input) : out === null || (Array.isArray(out) && out.length === 0)),
  };
}

/** 构造用例：B = A 置换（同构），或随机不同构图 */
function permuteGraph(n: number, edges: [number, number][], seed: number): { edges: [number, number][]; perm: number[] } {
  const rnd = mulberry32(seed);
  const perm = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const edges2 = edges.map(([u, v]) => [perm[u], perm[v]] as [number, number]);
  return { edges: edges2, perm };
}

const CASES: TestCase<GIInput, number[] | null>[] = [
  makeCase('路径图置换', (() => {
    const edges: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ];
    const { edges: e2 } = permuteGraph(5, edges, 11);
    return { n: 5, edgesA: edges, edgesB: e2, isomorphic: true };
  })()),
  makeCase('同构环+弦', (() => {
    const edges: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 0],
      [0, 2],
    ];
    const { edges: e2 } = permuteGraph(5, edges, 21);
    return { n: 5, edgesA: edges, edgesB: e2, isomorphic: true };
  })()),
  makeCase('不同构', {
    n: 5,
    edgesA: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
    edgesB: [
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ],
    isomorphic: false,
  }),
];

/** 回溯：逐点分配 + 邻域一致性检查，每步产出一帧 */
function* isoGen(input: GIInput): Generator<GIStep, number[] | null, void> {
  const { n, edgesA, isomorphic } = input;
  if (!isomorphic) {
    yield {
      map: new Array(n).fill(-1),
      assigned: new Array(n).fill(false),
      u: -1,
      v: -1,
      accepting: false,
      backtracks: 0,
      note: '生成时已保证不同构（度序列不同），快速失败',
    };
    return null;
  }
  const ma = adjMatrix(input.n, edgesA);
  const mb = adjMatrix(input.n, input.edgesB);
  const map = new Array(n).fill(-1);
  const used = new Array(n).fill(false);
  let backtracks = 0;
  let budget = 1000000000;

  const write = function* (i: number): Generator<GIStep, number[] | null, void> {
    if (budget-- <= 0) return null;
    if (i === n) {
      yield {
        map: [...map],
        assigned: used.map((v) => !v).map((_, k) => true),
        u: -1,
        v: -1,
        accepting: true,
        backtracks,
        note: `全部 ${n} 个点映射完成，所有边保持相邻，找到同构映射`,
      };
      return [...map];
    }
    for (let v = 0; v < n; v++) {
      if (used[v]) continue;
      let ok = true;
      for (let u = 0; u < i; u++) {
        if (ma[i][u] !== mb[v][map[u]]) {
          ok = false;
          break;
        }
      }
      yield {
        map: map.map((m, k) => (k === i ? v : m)),
        assigned: [...used],
        u: i,
        v,
        accepting: false,
        backtracks,
        note: ok
          ? `A.${i} → B.${v}：与已映射邻居全部一致，接受继续`
          : `A.${i} → B.${v}：邻接关系冲突，跳过`,
      };
      if (!ok) continue;
      map[i] = v;
      used[v] = true;
      const sub = yield* write(i + 1);
      if (sub) return sub;
      map[i] = -1;
      used[v] = false;
      backtracks++;
      yield {
        map: [...map],
        assigned: [...used],
        u: i,
        v: -1,
        accepting: false,
        backtracks,
        note: `A.${i} 的所有候选都失败，撤销回溯（第 ${backtracks} 次）`,
      };
    }
    return null;
  };

  return yield* write(0);
}

/* ---------------- 实例生成 ---------------- */

function randomInstance(n: number, density: number, seed: number): GIInput {
  const rnd = mulberry32(seed);
  const edgesA = randomGraph(n, density, seed);
  if (rnd() < 0.55) {
    // 同构:B 是 A 的置换
    const { edges: edgesB } = permuteGraph(n, edgesA, seed * 3 + 1);
    return { n, edgesA, edgesB, isomorphic: true };
  }
  // 不同构:重新采样一张图（几乎必然不同构，仍以度序列复核）
  const edgesB = randomGraph(n, density, seed + 7777);
  const da = degreeSeq(n, edgesA).sort().join(',');
  const db = degreeSeq(n, edgesB).sort().join(',');
  return { n, edgesA, edgesB, isomorphic: da === db };
}

const TEMPLATE = `function solve(input) {
  const { n, edgesA, edgesB } = input;

  // TODO: 返回长度 n 的映射数组 map[i] = A 的 i 对应 B 的哪个点；
  // 不同构返回 null
  return null;
}`;

const SOLUTION = `function solve(input) {
  const { n, edgesA, edgesB } = input;
  const ma = Array.from({ length: n }, () => new Array(n).fill(false));
  const mb = Array.from({ length: n }, () => new Array(n).fill(false));
  for (const [u, v] of edgesA) { ma[u][v] = ma[v][u] = true; }
  for (const [u, v] of edgesB) { mb[u][v] = mb[v][u] = true; }

  const map = new Array(n).fill(-1);
  const used = new Array(n).fill(false);

  const write = (i) => {
    if (i === n) return true;
    for (let v = 0; v < n; v++) {
      if (used[v]) continue;
      let ok = true;
      for (let u = 0; u < i; u++) {
        if (ma[i][u] !== mb[v][map[u]]) { ok = false; break; }
      }
      if (!ok) continue;
      map[i] = v; used[v] = true;
      if (write(i + 1)) return true;
      map[i] = -1; used[v] = false;
    }
    return false;
  };
  return write(0) ? map : null;
}`;

function ringLayout(n: number, cx: number, cy: number, rx: number, ry: number) {
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });
}

export default function GraphIsomorphismPage() {
  const [n, setN] = useState(6);
  const [density, setDensity] = useState(0.45);
  const [seed, setSeed] = useState(3);
  const [speed, setSpeed] = useState(1);

  const input = useMemo(() => randomInstance(n, density, seed), [n, density, seed]);

  const factory = useCallback(() => isoGen(input), [input]);
  const solver = useLiveSolver<GIStep, number[] | null>(factory, [input], {
    stepsPerFrame: speed,
  });

  const step: GIStep =
    solver.current ??
    {
      map: new Array(input.n).fill(-1),
      assigned: new Array(input.n).fill(false),
      u: -1,
      v: -1,
      accepting: false,
      backtracks: 0,
      note: '尚未开始，点「开始求解」',
    };
  const result = solver.result;
  const done = solver.done;

  const colorOf = (side: 'A' | 'B', i: number): string | null => {
    if (side === 'A') {
      const m = step.map[i];
      return m >= 0 ? PALETTE[i % PALETTE.length] : null;
    }
    const k = step.map.indexOf(i);
    return k >= 0 ? PALETTE[k % PALETTE.length] : null;
  };

  const layoutA = useMemo(() => ringLayout(input.n, 190, 200, 130, 120), [input.n]);
  const layoutB = useMemo(() => ringLayout(input.n, 570, 200, 130, 120), [input.n]);

  const mappedCount = step.map.filter((m) => m >= 0).length;

  const renderGraph = (
    edges: [number, number][],
    layout: { x: number; y: number }[],
    side: 'A' | 'B',
    cx: number,
  ) => (
    <svg viewBox="0 0 380 400" className="h-full w-full" role="img" aria-label={`图 ${side}`}>
      {edges.map(([u, v], i) => {
        const cu = colorOf(side, u);
        const cv = colorOf(side, v);
        const active = cu !== null && cu === cv;
        return (
          <line
            key={i}
            x1={layout[u].x}
            y1={layout[u].y}
            x2={layout[v].x}
            y2={layout[v].y}
            stroke={active ? cu as string : '#3f3f46'}
            strokeWidth={active ? 2 : 1.3}
            opacity={active ? 0.8 : 0.45}
            style={{ transition: 'stroke 200ms ease' }}
          />
        );
      })}
      {Array.from({ length: input.n }, (_, i) => {
        const c = colorOf(side, i);
        const { x, y } = layout[i];
        const current = side === 'A' ? i === step.u && !done : step.map[step.u] === i && !done;
        return (
          <g key={i}>
            {current && <circle cx={x} cy={y} r={17} fill="none" stroke="#fbbf24" strokeWidth={1.2} opacity={0.7} className="pulse-soft" />}
            <circle
              cx={x}
              cy={y}
              r={12}
              fill={c ?? '#111318'}
              stroke={c ? 'rgba(255,255,255,0.3)' : '#52525b'}
              strokeWidth={1.6}
              style={{ transition: 'fill 220ms ease' }}
            />
            <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontFamily="monospace" fill={c ? '#fff' : '#a1a1aa'}>
              {side}
              {i}
            </text>
          </g>
        );
      })}
      <text x={cx} y={28} textAnchor="middle" fontSize={13} fontFamily="monospace" fill="#71717a">
        G{side}
      </text>
    </svg>
  );

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
                label="BACKTRACK"
                meta={`${input.n} nodes / GA ${input.edgesA.length} edges / GB ${input.edgesB.length} edges`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    已映射 {mappedCount}/{input.n} · 回溯 {step.backtracks}
                  </span>
                }
              >
                <div className="flex flex-1 items-stretch justify-center gap-1 p-4">
                  {renderGraph(input.edgesA, layoutA, 'A', 190)}
                  {renderGraph(input.edgesB, layoutB, 'B', 570)}
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
                ) : result ? (
                  <span className="text-emerald-700">
                    同构：{result.map((m, i) => `A${i}→B${m}`).join(' ')}
                  </span>
                ) : (
                  <span className="text-rose-700">不同构（搜索耗尽或度序列不同）</span>
                )}
              </p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">{step.note}</p>
            </div>
          </div>

          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field label="节点数 (NODES)" value={n} min={4} max={40} step={1} onChange={setN} />
              <Field label="边密度 (DENSITY)" value={density} min={0.2} max={0.7} step={0.05} onChange={setDensity} />
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
                  <span className="text-zinc-400">GA 边数</span>
                  <span className="tabular-nums text-zinc-800">{input.edgesA.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">GB 边数</span>
                  <span className="tabular-nums text-zinc-800">{input.edgesB.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">已映射</span>
                  <span className="tabular-nums text-zinc-800">{mappedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">回溯</span>
                  <span className="tabular-nums text-zinc-800">{step.backtracks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">策略</span>
                  <span className="text-zinc-800">邻域一致性剪枝</span>
                </div>
              </div>
            </Section>
          </ControlPanel>
        </div>
      </div>
    </main>
  );
}
