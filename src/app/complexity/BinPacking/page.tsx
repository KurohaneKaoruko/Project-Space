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

interface BinInput {
  items: number[];
  capacity: number;
}

interface BinStep {
  bins: number[][];
  active: number | null;
  note: string;
}

const TITLE = '装箱';
const CLS = 'NPH' as const;

/** log10(Bell(n)) 的 Dobinski 近似：log10(B(n)) ≈ (n·ln n - n)/ln(10)（n≥6 时够用） */
function bellLog10(n: number): number {
  if (n < 6) return 0;
  return (n * Math.log(n) - n) / Math.LN10;
}

/** 校验：每个物品都有箱子，且每个箱子不超容量 */
function validate(output: unknown, input: BinInput): boolean {
  if (!Array.isArray(output) || output.length !== input.items.length) return false;
  const loads = new Map<number, number>();
  for (let i = 0; i < output.length; i++) {
    const b = output[i];
    if (!Number.isInteger(b) || b < 0) return false;
    loads.set(b, (loads.get(b) ?? 0) + input.items[i]);
  }
  return [...loads.values()].every((sum) => sum <= input.capacity);
}

/** 参考解：First-Fit Decreasing */
function ffd(input: BinInput): number[] {
  const order = [...input.items.keys()].sort((a, b) => input.items[b] - input.items[a]);
  const loads: number[] = [];
  const assign = new Array(input.items.length).fill(-1);

  for (const idx of order) {
    const size = input.items[idx];
    let placed = -1;
    for (let b = 0; b < loads.length; b++) {
      if (loads[b] + size <= input.capacity) {
        placed = b;
        break;
      }
    }
    if (placed === -1) {
      loads.push(0);
      placed = loads.length - 1;
    }
    loads[placed] += size;
    assign[idx] = placed;
  }
  return assign;
}

function makeCase(name: string, input: BinInput): TestCase<BinInput, number[]> {
  return { name, input, expected: ffd(input), validate: (out) => validate(out, input) };
}

const CASES: TestCase<BinInput, number[]>[] = [
  makeCase('经典样例', { items: [7, 5, 6, 4, 2, 3, 8], capacity: 10 }),
  makeCase('两箱刚好', { items: [5, 5, 5, 5], capacity: 10 }),
  makeCase('需要新箱', { items: [9, 8, 6, 4, 3], capacity: 10 }),
];

/** First-Fit Decreasing：每放一个物品产出一帧 */
function* ffdGen(input: BinInput): Generator<BinStep, number[], void> {
  const { items, capacity } = input;
  const order = [...items.keys()].sort((a, b) => items[b] - items[a]);
  const bins: number[][] = [];
  const loads: number[] = [];
  const assign = new Array(items.length).fill(-1);

  yield { bins: [], active: null, note: `按体积从大到小排序：[${order.map((i) => items[i]).join(', ')}]` };

  for (const idx of order) {
    const size = items[idx];
    let placed = -1;
    for (let b = 0; b < loads.length; b++) {
      if (loads[b] + size <= capacity) {
        placed = b;
        break;
      }
    }
    const opened = placed === -1;
    if (opened) {
      loads.push(0);
      bins.push([]);
      placed = loads.length - 1;
    }
    loads[placed] += size;
    bins[placed].push(idx);
    assign[idx] = placed;

    yield {
      bins: bins.map((b) => [...b]),
      active: placed,
      note: opened
        ? `物品 ${idx}（${size}）装不进任何已有箱子 → 新开第 ${placed + 1} 个箱子`
        : `物品 ${idx}（${size}）放进第 ${placed + 1} 个箱子（${loads[placed]}/${capacity}）`,
    };
  }

  yield {
    bins: bins.map((b) => [...b]),
    active: null,
    note: `装箱完成：共用 ${bins.length} 个箱子`,
  };

  return assign;
}

function randomBins(count: number, capacity: number, seed: number): BinInput {
  const rnd = mulberry32(seed);
  const items = Array.from({ length: count }, () => 1 + Math.floor(rnd() * (capacity * 0.6)));
  return { items, capacity };
}

const TEMPLATE = `function solve(input) {
  const { items, capacity } = input;

  // TODO: 返回每个物品所属的箱子编号（从 0 开始），每个箱子内物品体积之和不能超过 capacity
  return items.map((_, i) => i);
}`;

const SOLUTION = `function solve(input) {
  const { items, capacity } = input;
  const order = [...items.keys()].sort((a, b) => items[b] - items[a]);
  const loads = [];
  const assign = new Array(items.length).fill(-1);

  for (const idx of order) {
    const size = items[idx];
    let placed = -1;
    for (let b = 0; b < loads.length; b++) {
      if (loads[b] + size <= capacity) { placed = b; break; }
    }
    if (placed === -1) { loads.push(0); placed = loads.length - 1; }
    loads[placed] += size;
    assign[idx] = placed;
  }
  return assign;
}`;

export default function BinPackingPage() {
  const [count, setCount] = useState(9);
  const [capacity, setCapacity] = useState(10);
  const [seed, setSeed] = useState(4);
  const [speed, setSpeed] = useState(1);

  const input = useMemo(() => randomBins(count, capacity, seed), [count, capacity, seed]);
  const factory = useCallback(() => ffdGen(input), [input]);
  const solver = useLiveSolver<BinStep, number[]>(factory, [input], { stepsPerFrame: speed });

  const step: BinStep = solver.current ?? { bins: [], active: null, note: '尚未开始，点「开始求解」' };
  const done = solver.done;

  const binCount = step.bins.length;

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
                label="BINS"
                meta={`${input.items.length} items / capacity ${input.capacity}`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={<span className="font-mono text-[10px] text-zinc-500">已用 {binCount} 个箱子</span>}
              >
                <div className="flex min-h-0 flex-1 items-end justify-center gap-3 overflow-x-auto p-6">
                  {step.bins.length === 0 && (
                    <span className="self-center font-mono text-xs text-zinc-600">
                      还没有装箱，点「开始求解」
                    </span>
                  )}
                  {step.bins.map((bin, b) => {
                    const load = bin.reduce((s, i) => s + input.items[i], 0);
                    const active = step.active === b;
                    return (
                      <div
                        key={b}
                        className={`flex shrink-0 flex-col items-center gap-2 ${step.bins.length > 14 ? 'w-9' : 'w-16'}`}
                      >
                        <div
                          className={`flex w-full flex-col-reverse overflow-hidden rounded-b-md border ${
                            active ? 'border-amber-400/70' : 'border-white/[0.12]'
                          }`}
                          style={{ height: 220 }}
                        >
                          {bin.map((itemIdx) => {
                            const size = input.items[itemIdx];
                            const h = Math.max(4, (size / input.capacity) * 220);
                            return (
                              <div
                                key={itemIdx}
                                className={`flex items-center justify-center border-t border-[#080a0f] bg-blue-500/70 font-mono text-white transition-all duration-200 ${step.bins.length > 14 ? 'text-[7px]' : 'text-[10px]'}`}
                                style={{ height: h }}
                                title={`物品 ${itemIdx}：${size}`}
                              >
                                {size}
                              </div>
                            );
                          })}
                        </div>
                        <span className={`font-mono text-[10px] ${active ? 'text-amber-300' : 'text-zinc-500'}`}>
                          {load}/{input.capacity}
                        </span>
                      </div>
                    );
                  })}
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
                  <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-400">结果</div>
                  <p className="mt-1 font-mono text-[13px]">
                    {!done ? (
                      <span className="text-zinc-400">—</span>
                    ) : (
                      <span className="text-emerald-700">
                        {binCount} 个箱子装下全部 {input.items.length} 件物品
                      </span>
                    )}
                  </p>
                </div>
                <p className="ml-auto font-mono text-[11px] text-zinc-500">{step.note}</p>
              </div>
            </div>
          </div>

          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field
                label="物品数 (ITEMS)"
                value={count}
                min={5}
                max={60}
                step={1}
                onChange={setCount}
                format={(v) => `精确最优需枚举划分 · Bell(${v}) ≈ 10^${bellLog10(v).toFixed(1)}`}
              />
              <Field label="箱子容量 (CAPACITY)" value={capacity} min={8} max={30} step={1} onChange={setCapacity} />
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
                  <span className="text-zinc-400">物品</span>
                  <span className="break-all text-right text-zinc-800">[{input.items.join(', ')}]</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">总体积</span>
                  <span className="tabular-nums text-zinc-800">
                    {input.items.reduce((a, b) => a + b, 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">已用箱子</span>
                  <span className="tabular-nums text-zinc-800">{binCount}</span>
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
