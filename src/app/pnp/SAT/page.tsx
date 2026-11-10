'use client';

import { useCallback, useMemo, useState } from 'react';
import Navigation from '../../components/Navigation';
import InstrumentPanel from '../components/InstrumentPanel';
import SegmentedControl from '../components/SegmentedControl';
import ControlPanel, { Field, Section } from '../components/ControlPanel';
import { randomCnf } from '../lib/generate';
import CodeRunner from '../components/CodeRunner';
import LiveControls from '../components/LiveControls';
import { useLiveSolver } from '../lib/useLiveSolver';
import { CLASS_META, type TestCase } from '../lib/types';

interface SatInput {
  nVars: number;
  clauses: number[][];
}

type Value = 0 | 1 | null;

interface SatStep {
  assign: Value[];
  note: string;
  decisions: number;
  backtracks: number;
  checked?: number;
  total?: number;
}

const litLabel = (lit: number) => `${lit > 0 ? '' : '¬'}x${Math.abs(lit)}`;

function literalValue(lit: number, assign: Value[]): boolean | null {
  const value = assign[Math.abs(lit) - 1];
  if (value === null) return null;
  return value === (lit > 0 ? 1 : 0);
}

function satisfies(assign: unknown, input: SatInput): boolean {
  if (!Array.isArray(assign) || assign.length !== input.nVars) return false;
  return input.clauses.every((clause) =>
    clause.some((lit) => assign[Math.abs(lit) - 1] === (lit > 0)),
  );
}

function bruteSolve(input: SatInput): boolean[] | null {
  const { nVars, clauses } = input;
  for (let mask = 0; mask < 1 << nVars; mask++) {
    const assign = Array.from({ length: nVars }, (_, i) => Boolean(mask & (1 << i)));
    if (clauses.every((clause) => clause.some((lit) => assign[Math.abs(lit) - 1] === lit > 0))) {
      return assign;
    }
  }
  return null;
}

function makeCase(name: string, input: SatInput): TestCase<SatInput, boolean[] | null> {
  const reference = bruteSolve(input);
  return {
    name,
    input,
    expected: reference,
    validate: (out) => (reference === null ? out === null : satisfies(out, input)),
  };
}

const CASES: TestCase<SatInput, boolean[] | null>[] = [
  makeCase('4 变量 · SAT', {
    nVars: 4,
    clauses: [
      [1, 2, -3],
      [-1, 3, 4],
      [2, -4],
      [-2, 3],
    ],
  }),
  makeCase('3 变量 · UNSAT', {
    nVars: 3,
    clauses: [
      [1, 2, 3],
      [1, 2, -3],
      [1, -2, 3],
      [1, -2, -3],
      [-1, 2, 3],
      [-1, 2, -3],
      [-1, -2, 3],
      [-1, -2, -3],
    ],
  }),
  makeCase('5 变量 · SAT', {
    nVars: 5,
    clauses: [
      [1, -2, 3],
      [-1, 2, -3],
      [4, -5],
      [-4, 5, 1],
      [2, 3, -4],
    ],
  }),
];

const MAX_STEPS = 400;

function* bruteGen(input: SatInput): Generator<SatStep, Value[] | null, void> {
  const { nVars, clauses } = input;
  const total = 1 << nVars;

  for (let mask = 0; mask < total; mask++) {
    const assign: Value[] = Array.from({ length: nVars }, (_, i) => ((mask >> i) & 1) as 0 | 1);
    const ok = clauses.every((clause) =>
      clause.some((lit) => assign[Math.abs(lit) - 1] === (lit > 0 ? 1 : 0)),
    );
    yield {
      assign,
      note: `检查 ${assign.map((v) => (v ? 'T' : 'F')).join('')}：${ok ? '满足' : '不满足'}`,
      decisions: mask + 1,
      backtracks: 0,
      checked: mask + 1,
      total,
    };
    if (ok) return assign;
  }

  yield {
    assign: new Array(nVars).fill(null),
    note: '全部赋值都不满足 → 该公式不可满足',
    decisions: total,
    backtracks: 0,
    checked: total,
    total,
  };
  return null;
}

function* dpllGen(input: SatInput): Generator<SatStep, Value[] | null, void> {
  const { nVars, clauses } = input;
  let decisions = 0;
  let backtracks = 0;

  function* search(inputAssign: Value[]): Generator<SatStep, Value[] | null, void> {
    const assign = [...inputAssign];

    for (;;) {
      let progressed = false;
      for (const clause of clauses) {
        const values = clause.map((lit) => literalValue(lit, assign));
        if (values.some((v) => v === true)) continue;
        const undef = clause.filter((_, i) => values[i] === null);
        if (undef.length === 0) {
          yield { assign: [...assign], note: '子句全假 → 冲突，回溯', decisions, backtracks };
          return null;
        }
        if (undef.length === 1) {
          const lit = undef[0];
          assign[Math.abs(lit) - 1] = lit > 0 ? 1 : 0;
          yield {
            assign: [...assign],
            note: `单元传播 ${litLabel(lit)} = ${lit > 0 ? 'T' : 'F'}`,
            decisions,
            backtracks,
          };
          progressed = true;
        }
      }
      if (!progressed) break;
    }

    const next = assign.findIndex((v) => v === null);
    if (next === -1) {
      yield { assign: [...assign], note: '全部满足', decisions, backtracks };
      return assign;
    }

    for (const value of [1, 0] as const) {
      decisions++;
      const branch = [...assign];
      branch[next] = value;
      yield {
        assign: [...branch],
        note: `决策 ${litLabel((next + 1) * (value === 1 ? 1 : -1))} = ${value === 1 ? 'T' : 'F'}`,
        decisions,
        backtracks,
      };
      const found = yield* search(branch);
      if (found) return found;
      backtracks++;
      yield { assign: [...branch], note: `撤销 x${next + 1}`, decisions, backtracks };
    }
    return null;
  }

  return yield* search(new Array(nVars).fill(null));
}

const TEMPLATE = `function solve(input) {
  const { nVars, clauses } = input;
  // clauses 里每个子句是一组文字：正数=变量为真，负数=取反，变量从 1 开始编号
  // 返回 boolean[]（第 i 项对应 x(i+1)），无解返回 null

  // TODO
  return null;
}`;

const SOLUTION = `function solve(input) {
  const { nVars, clauses } = input;

  function search(assign) {
    const a = assign.slice();

    for (;;) {
      let progressed = false;
      for (const clause of clauses) {
        const values = clause.map((lit) => {
          const v = a[Math.abs(lit) - 1];
          return v === null ? null : v === (lit > 0);
        });
        if (values.some((v) => v === true)) continue;
        const undef = clause.filter((_, i) => values[i] === null);
        if (undef.length === 0) return null;
        if (undef.length === 1) {
          const lit = undef[0];
          a[Math.abs(lit) - 1] = lit > 0;
          progressed = true;
        }
      }
      if (!progressed) break;
    }

    const next = a.findIndex((v) => v === null);
    if (next === -1) return a;

    for (const value of [true, false]) {
      const branch = a.slice();
      branch[next] = value;
      const found = search(branch);
      if (found) return found;
    }
    return null;
  }

  const result = search(new Array(nVars).fill(null));
  return result ? result.map(Boolean) : null;
}`;

export default function SatPage() {
  const [algo, setAlgo] = useState<'brute' | 'dpll'>('dpll');
  const [nVars, setNVars] = useState(4);
  const [nClauses, setNClauses] = useState(5);
  const [width, setWidth] = useState(3);
  const [seed, setSeed] = useState(5);

  const input = useMemo<SatInput>(
    () => randomCnf(nVars, nClauses, width, seed),
    [nVars, nClauses, width, seed],
  );

  const [speed, setSpeed] = useState(1);
  const factory = useCallback(() => (algo === 'brute' ? bruteGen(input) : dpllGen(input)), [algo, input]);
  const solver = useLiveSolver<SatStep, Value[] | null>(factory, [algo, input], {
    stepsPerFrame: speed,
  });

  const step: SatStep =
    solver.current ?? {
      assign: new Array(input.nVars).fill(null),
      note: '尚未开始，点「开始求解」',
      decisions: 0,
      backtracks: 0,
    };
  const result = solver.result;


  const clauseStates = input.clauses.map((clause) => {
    const values = clause.map((lit) => literalValue(lit, step.assign));
    if (values.some((v) => v === true)) return 'sat' as const;
    if (values.every((v) => v === false)) return 'conflict' as const;
    return 'open' as const;
  });

  // 整个搜索空间：每个赋值对应一格，颜色 = 满足的子句比例
  // 变量多时空间指数爆炸：全量 2^n 会卡死渲染，超过 512 格就等距抽样 512 格展示
  const total = 1 << input.nVars;
  const MAX_CELLS = 512;
  const cellStride = total > MAX_CELLS ? Math.ceil(total / MAX_CELLS) : 1;
  const sampledCount = Math.ceil(total / cellStride);
  const cells = useMemo(
    () =>
      Array.from({ length: sampledCount }, (_, si) => {
        const mask = si * cellStride;
        const assign = Array.from({ length: input.nVars }, (_, i) => Boolean(mask & (1 << i)));
        const sat = input.clauses.filter((clause) =>
          clause.some((lit) => assign[Math.abs(lit) - 1] === lit > 0),
        ).length;
        return { mask, sat, ok: sat === input.clauses.length };
      }),
    [input, sampledCount, cellStride],
  );

  const currentMask = step.assign.every((v) => v !== null)
    ? step.assign.reduce<number>((acc, v, i) => acc + ((v ? 1 : 0) << i), 0)
    : -1;

  const satCount = clauseStates.filter((s) => s === 'sat').length;
  const cols = sampledCount <= 8 ? sampledCount : sampledCount <= 32 ? 8 : 16;

  return (
    <main className="min-h-screen bg-zinc-50">
      <Navigation
        title="3-SAT"
        header={
          <>
            <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${CLASS_META['NPC'].chip}`}>
              {CLASS_META['NPC'].label}
            </span>
            <span className="font-mono text-sm font-bold tracking-wide text-zinc-900">3-SAT</span>
          </>
        }
        actions={<CodeRunner template={TEMPLATE} solution={SOLUTION} cases={CASES} />}
      />

      <div className="flex min-h-screen flex-col px-4 pb-6 pt-16 sm:px-6 lg:px-8 lg:pb-6">
        <div className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col gap-4 lg:min-h-0 lg:flex-row">
          {/* 主区 */}
          <div className="flex min-w-0 flex-1 flex-col gap-3">

            <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
              {/* 公式 */}
              <InstrumentPanel
                label="FORMULA"
                meta={`${input.nVars} vars / ${input.clauses.length} clauses`}
                className="flex min-h-0 flex-col"
                bodyClassName="flex flex-1 flex-col"
              >
                <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.06] px-4 py-2.5">
                  <span className="mr-1 font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-600">
                    assign
                  </span>
                  {step.assign.map((value, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors duration-200 ${
                        value === null
                          ? 'bg-white/[0.04] text-zinc-500'
                          : value === 1
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-rose-500/15 text-rose-300'
                      }`}
                    >
                      x{i + 1}
                      <b>{value === null ? '·' : value === 1 ? 'T' : 'F'}</b>
                    </span>
                  ))}
                  <span className="ml-auto font-mono text-[10px] text-zinc-500">
                    {satCount}/{input.clauses.length} 满足
                  </span>
                </div>

                <div className="flex flex-1 flex-col justify-center divide-y divide-white/[0.04]">
                  {input.clauses.map((clause, ci) => {
                    const state = clauseStates[ci];
                    return (
                      <div
                        key={ci}
                        className={`flex items-center gap-1.5 px-4 py-2.5 transition-colors duration-200 ${
                          state === 'sat'
                            ? 'bg-emerald-500/[0.05]'
                            : state === 'conflict'
                              ? 'bg-rose-500/[0.06]'
                              : ''
                        }`}
                      >
                        <span className="w-5 shrink-0 font-mono text-[9px] text-zinc-600">
                          {ci + 1}
                        </span>
                        {clause.map((lit, li) => {
                          const value = literalValue(lit, step.assign);
                          return (
                            <span
                              key={li}
                              className={`rounded px-1.5 py-0.5 font-mono text-[11.5px] transition-all duration-200 ${
                                value === true
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : value === false
                                    ? 'text-zinc-600 line-through'
                                    : 'bg-white/[0.05] text-zinc-400'
                              }`}
                            >
                              {litLabel(lit)}
                            </span>
                          );
                        })}
                        <span
                          className={`ml-auto font-mono text-[9px] tracking-wider ${
                            state === 'sat'
                              ? 'text-emerald-500'
                              : state === 'conflict'
                                ? 'text-rose-500'
                                : 'text-zinc-700'
                          }`}
                        >
                          {state === 'sat' ? '✓' : state === 'conflict' ? '✕' : '·'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </InstrumentPanel>

              {/* 搜索空间 + 日志 */}
              <div className="flex min-h-0 flex-col gap-3">
                <InstrumentPanel label="SEARCH SPACE" meta={`2^${input.nVars} = ${total.toLocaleString()}${cellStride > 1 ? ` · 抽样 ${sampledCount} 格` : ''}`}>
                  <div className="p-3">
                    <div
                      className="grid gap-1"
                      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                    >
                      {cells.map((cell) => {
                        const ratio = cell.sat / input.clauses.length;
                        const isCurrent = cell.mask === currentMask;
                        return (
                          <div
                            key={cell.mask}
                            title={`${cell.mask.toString(2).padStart(input.nVars, '0')} · 满足 ${cell.sat}/${input.clauses.length}`}
                            className={`aspect-square rounded-[3px] transition-all duration-200 ${
                              isCurrent
                                ? 'ring-2 ring-white/70 ring-offset-1 ring-offset-[#080a0f]'
                                : ''
                            }`}
                            style={{
                              background: cell.ok
                                ? '#10b981'
                                : cell.sat === 0
                                  ? 'rgba(255,255,255,0.06)'
                                  : `rgba(59,130,246,${0.16 + ratio * 0.62})`,
                            }}
                          />
                        );
                      })}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] text-zinc-500">
                      <span className="flex items-center gap-1">
                        <i className="h-2 w-2 rounded-[2px] bg-emerald-500" />
                        满足
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="h-2 w-2 rounded-[2px] bg-blue-500/60" />
                        部分
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="h-2 w-2 rounded-[2px] bg-white/10" />
                        全假
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-t border-white/[0.06]">
                    {[
                      { label: '决策', value: step.decisions },
                      { label: '回溯', value: step.backtracks },
                      { label: '已查', value: step.total ? `${step.checked} / ${step.total.toLocaleString()}` : '—' },
                    ].map((s) => (
                      <div key={s.label} className="px-3 py-1.5">
                        <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-600">
                          {s.label}
                        </div>
                        <div className="font-mono text-sm tabular-nums text-zinc-200">{s.value}</div>
                      </div>
                    ))}
                  </div>
                </InstrumentPanel>

              </div>
            </div>

            {/* 播放条 + 结果 */}
            <div className="shrink-0 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-[260px] flex-1">
                  <LiveControls
                  tone="light"
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
                <p className="font-mono text-[11px]">
                  {result ? (
                    <span className="text-emerald-700">
                      SAT · {result.map((v, i) => `x${i + 1}=${v ? 'T' : 'F'}`).join(' ')}
                    </span>
                  ) : (
                    <span className="text-rose-700">UNSAT</span>
                  )}
                </p>
              </div>
              <p className="mt-1.5 font-mono text-[10px] text-zinc-400">{step.note}</p>
            </div>
          </div>

          {/* 控制面板 */}
          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field
                label="变量数 (VARS)"
                value={nVars}
                min={3}
                max={32}
                step={1}
                onChange={setNVars}
                format={(v) => `2^${v} = ${(2 ** v).toLocaleString()} 种赋值`}
              />
              <Field
                label="子句数 (CLAUSES)"
                value={nClauses}
                min={3}
                max={90}
                step={1}
                onChange={setNClauses}
              />
              <Field
                label="子句宽度 (WIDTH)"
                value={width}
                min={2}
                max={3}
                step={1}
                onChange={setWidth}
                format={(v) => `${v}-SAT`}
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
                onChange={(v) => setAlgo(v as 'brute' | 'dpll')}
                options={[
                  { value: 'brute', label: '暴力枚举' },
                  { value: 'dpll', label: 'DPLL' },
                ]}
              />
            </Section>

            <Section title="数据 (DATA)">
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-400">变量 / 子句</span>
                  <span className="text-zinc-800">
                    {input.nVars} / {input.clauses.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">搜索空间</span>
                  <span className="tabular-nums text-zinc-800">{total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">满足子句</span>
                  <span className="text-zinc-800">
                    {satCount}/{input.clauses.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">步数</span>
                  <span className="tabular-nums text-zinc-800">{solver.stepCount}</span>
                </div>
              </div>
            </Section>

          </ControlPanel>
        </div>
      </div>
    </main>
  );
}
