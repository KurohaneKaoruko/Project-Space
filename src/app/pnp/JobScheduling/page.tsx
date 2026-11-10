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

interface JSInput {
  jobs: number[];
  machines: number;
}

interface JSAsgn {
  machine: number;
  start: number;
  end: number;
}

interface JSStep {
  /** 贪心的当前分配（每台机器的任务列表） */
  assign: number[][];
  jobIdx: number;
  machine: number;
  makespan: number;
  loads: number[];
  note: string;
}

const TITLE = '作业调度';
const CLS = 'NPH' as const;

const JOB_COLORS = ['#3b82f6', '#10b981', '#f43f5e', '#a855f7', '#f59e0b', '#06b6d4', '#84cc16', '#ec4899', '#6366f1', '#14b8a6'];

/* ---------------- 算法 ---------------- */

function makespanOf(assign: number[][], jobs: number[]): number {
  return Math.max(0, ...assign.map((list) => list.reduce((s, ji) => s + jobs[ji], 0)));
}

/** 参考解 A：LPT 贪心（降序放置到当前最闲机器） */
function lptAssign(input: JSInput): number[][] {
  const { jobs, machines } = input;
  const assign: number[][] = Array.from({ length: machines }, () => []);
  const loads = new Array(machines).fill(0);
  const order = jobs.map((j, i) => ({ j, i })).sort((a, b) => b.j - a.j);
  for (const { j, i } of order) {
    let m = 0;
    for (let k = 1; k < machines; k++) if (loads[k] < loads[m]) m = k;
    assign[m].push(i);
    loads[m] += j;
  }
  return assign;
}

/** 参考解 B：分支定界精确最优（作业数 ≤ 12 时实用） */
function optimalAssign(input: JSInput): number[][] {
  const { jobs, machines } = input;
  const n = jobs.length;
  if (n > 20) return lptAssign(input); // 超过分支定界实用规模，退化为贪心近似
  const assign: number[][] = Array.from({ length: machines }, () => []);
  const loads = new Array(machines).fill(0);
  let bestMakespan = Infinity;
  let bestAssign: number[][] = Array.from({ length: machines }, () => []);

  // 作业降序排列（对称性剪枝：同长度作业只放编号不降的机器）
  const order = jobs.map((j, i) => ({ j, i })).sort((a, b) => b.j - a.j);

  const write = (k: number): void => {
    if (k === n) {
      const ms = Math.max(...loads);
      if (ms < bestMakespan) {
        bestMakespan = ms;
        bestAssign = assign.map((col) => [...col]);
      }
      return;
    }
    const { j, i } = order[k];
    const seen = new Set<number>();
    for (let m = 0; m < machines; m++) {
      // 对称剪枝：同一负载水平只试第一台
      if (seen.has(loads[m])) continue;
      seen.add(loads[m]);
      // 剪枝：当前机器放进去后不会超过已知最优
      if (loads[m] + j >= bestMakespan) continue;
      assign[m].push(i);
      loads[m] += j;
      write(k + 1);
      loads[m] -= j;
      assign[m].pop();
    }
  };
  write(0);
  return bestAssign;
}

/** 判题：输出 = 每台机器的作业索引数组 */
function validate(output: unknown, input: JSInput): boolean {
  if (!Array.isArray(output) || output.length !== input.machines) return false;
  const seen = new Set<number>();
  const loads: number[] = [];
  for (const list of output as number[][]) {
    if (!Array.isArray(list)) return false;
    let load = 0;
    for (const ji of list) {
      if (!Number.isInteger(ji) || ji < 0 || ji >= input.jobs.length || seen.has(ji)) return false;
      seen.add(ji);
      load += input.jobs[ji];
    }
    loads.push(load);
  }
  if (seen.size !== input.jobs.length) return false;
  const ref = optimalAssign(input);
  return Math.max(...loads) <= makespanOf(ref, input.jobs);
}

function makeCase(name: string, input: JSInput): TestCase<JSInput, number[][]> {
  const ref = optimalAssign(input);
  return { name, input, expected: ref, validate: (out) => validate(out, input) };
}

const CASES: TestCase<JSInput, number[][]>[] = [
  makeCase('经典陷阱', { jobs: [5, 4, 3, 3, 2, 2], machines: 3 }),
  makeCase('贪心失误', { jobs: [7, 7, 6, 5, 3, 3, 2], machines: 3 }),
  makeCase('机器多于作业', { jobs: [4, 3, 2], machines: 4 }),
];

/** LPT 贪心生成器：每个「放置一个作业」产出一帧 */
function* lptGen(input: JSInput): Generator<JSStep, number[][], void> {
  const { jobs, machines } = input;
  const assign: number[][] = Array.from({ length: machines }, () => []);
  const loads = new Array(machines).fill(0);
  const order = jobs.map((j, i) => ({ j, i })).sort((a, b) => b.j - a.j);

  yield {
    assign: assign.map((c) => [...c]),
    jobIdx: -1,
    machine: -1,
    makespan: 0,
    loads: [...loads],
    note: `LPT 贪心：作业按长度降序 [${order.map((o) => jobs[o.i]).join(', ')}]，逐个放到当前最闲的机器`,
  };

  for (const { j, i } of order) {
    let m = 0;
    for (let k = 1; k < machines; k++) if (loads[k] < loads[m]) m = k;
    assign[m].push(i);
    loads[m] += j;
    yield {
      assign: assign.map((c) => [...c]),
      jobIdx: i,
      machine: m,
      makespan: Math.max(...loads),
      loads: [...loads],
      note: `作业 ${i}（长 ${j}）→ 机器 ${m}（负载 ${loads[m]}）；当前 makespan ${Math.max(...loads)}`,
    };
  }

  return assign;
}

/* ---------------- 实例生成 ---------------- */

function randomInstance(jobCount: number, machineCount: number, seed: number): JSInput {
  const rnd = mulberry32(seed * 17 + 5);
  const jobs = Array.from({ length: jobCount }, () => 2 + Math.floor(rnd() * 9));
  return { jobs, machines: Math.min(machineCount, jobCount) };
}

/* 甘特图布局 */
const GANTT = { left: 56, top: 14, rowH: 44, unitW: 13 };

const TEMPLATE = `function solve(input) {
  const { jobs, machines } = input;

  // TODO: 返回长度 machines 的数组，第 m 项是分给机器 m 的作业索引列表
  // 目标：最小化最大机器负载（makespan）
  return Array.from({ length: machines }, () => []);
}`;

const SOLUTION = `function solve(input) {
  const { jobs, machines } = input;
  // 分支定界精确解（小规模）
  const n = jobs.length;
  const order = jobs.map((j, i) => ({ j, i })).sort((a, b) => b.j - a.j);
  const assign = Array.from({ length: machines }, () => []);
  const loads = new Array(machines).fill(0);
  let bestMs = Infinity, best = Array.from({ length: machines }, () => []);

  const write = (k) => {
    if (k === n) {
      const ms = Math.max(...loads);
      if (ms < bestMs) { bestMs = ms; best = assign.map(c => [...c]); }
      return;
    }
    const { j, i } = order[k];
    const seen = new Set();
    for (let m = 0; m < machines; m++) {
      if (seen.has(loads[m])) continue;
      seen.add(loads[m]);
      if (loads[m] + j >= bestMs) continue;
      assign[m].push(i); loads[m] += j;
      write(k + 1);
      loads[m] -= j; assign[m].pop();
    }
  };
  write(0);
  return best;
}`;

export default function JobSchedulingPage() {
  const [jobCount, setJobCount] = useState(9);
  const [machineCount, setMachineCount] = useState(3);
  const [seed, setSeed] = useState(4);
  const [speed, setSpeed] = useState(2);

  const input = useMemo(() => randomInstance(jobCount, machineCount, seed), [jobCount, machineCount, seed]);

  const factory = useCallback(() => lptGen(input), [input]);
  const solver = useLiveSolver<JSStep, number[][]>(factory, [input], {
    stepsPerFrame: speed,
  });

  const step: JSStep =
    solver.current ??
    {
      assign: Array.from({ length: input.machines }, () => []),
      jobIdx: -1,
      machine: -1,
      makespan: 0,
      loads: new Array(input.machines).fill(0),
      note: '尚未开始，点「开始求解」',
    };
  const result = solver.result;
  const done = solver.done;

  /* 精确最优（对照） */
  const optimal = useMemo(() => optimalAssign(input), [input]);
  const optimalMs = makespanOf(optimal, input.jobs);
  const finalAssign = done && result ? result : step.assign;
  const lptMs = makespanOf(finalAssign, input.jobs);

  /* 当前正在放置的作业（高亮） */
  const activeJob = !done && step.jobIdx >= 0 ? step.jobIdx : -1;

  const maxTime = Math.max(lptMs, optimalMs, 10);
  const W = GANTT.left + maxTime * GANTT.unitW + 40;
  const H = GANTT.top + input.machines * GANTT.rowH + 46;

  /* 分配 → 甘特块（按机器内顺序排列） */
  const bars = useMemo(() => {
    const out: { machine: number; job: number; start: number; end: number }[] = [];
    finalAssign.forEach((list, m) => {
      let t = 0;
      for (const ji of list) {
        out.push({ machine: m, job: ji, start: t, end: t + input.jobs[ji] });
        t += input.jobs[ji];
      }
    });
    return out;
  }, [finalAssign, input.jobs]);

  const jobDone = useMemo(() => {
    // 已放置的作业集合（贪心过程中逐步增多）
    const s = new Set<number>();
    finalAssign.forEach((list) => list.forEach((ji) => s.add(ji)));
    return s;
  }, [finalAssign]);

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
                label="LPT GREEDY"
                meta={`${input.jobs.length} jobs / ${input.machines} machines / LPT makespan ${lptMs} vs OPT ${optimalMs}`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    已放置 {jobDone.size}/{input.jobs.length}
                  </span>
                }
              >
                <div className="flex flex-1 items-center justify-center overflow-auto p-4">
                  <svg
                    viewBox={`0 0 ${W} ${H}`}
                    className="h-full max-h-[440px] min-h-[220px] w-full"
                    role="img"
                    aria-label="LPT 贪心作业调度甘特图"
                  >
                    {/* 时间刻度 */}
                    {Array.from({ length: Math.floor(maxTime / 2) + 1 }, (_, k) => k * 2).map((t) => (
                      <g key={`tick${t}`}>
                        <line
                          x1={GANTT.left + t * GANTT.unitW}
                          y1={GANTT.top - 4}
                          x2={GANTT.left + t * GANTT.unitW}
                          y2={GANTT.top + input.machines * GANTT.rowH + 6}
                          stroke="#52525b"
                          strokeWidth={0.7}
                          opacity={0.35}
                        />
                        <text x={GANTT.left + t * GANTT.unitW} y={H - 8} textAnchor="middle" fontSize={9} fontFamily="monospace" fill="#71717a">
                          {t}
                        </text>
                      </g>
                    ))}
                    {/* 机器行 */}
                    {Array.from({ length: input.machines }, (_, m) => {
                      const y = GANTT.top + m * GANTT.rowH;
                      const load = step.loads[m] ?? 0;
                      return (
                        <g key={`row${m}`}>
                          <rect
                            x={GANTT.left}
                            y={y}
                            width={maxTime * GANTT.unitW}
                            height={GANTT.rowH - 10}
                            fill="rgba(255,255,255,0.03)"
                            stroke="#3f3f46"
                            strokeWidth={1}
                          />
                          <text x={GANTT.left - 8} y={y + (GANTT.rowH - 10) / 2 + 4} textAnchor="end" fontSize={11} fontFamily="monospace" fill="#a1a1aa">
                            M{m}
                          </text>
                          <text x={GANTT.left + maxTime * GANTT.unitW + 6} y={y + (GANTT.rowH - 10) / 2 + 4} fontSize={10} fontFamily="monospace" fill={load === lptMs && lptMs > 0 ? '#fbbf24' : '#a1a1aa'}>
                            {load}
                          </text>
                        </g>
                      );
                    })}
                    {/* 作业块 */}
                    {bars.map(({ machine, job, start, end }) => {
                      const y = GANTT.top + machine * GANTT.rowH;
                      const isActive = job === activeJob && !done;
                      const color = JOB_COLORS[job % JOB_COLORS.length];
                      return (
                        <g key={`${machine}-${job}`}>
                          <rect
                            x={GANTT.left + start * GANTT.unitW}
                            y={y + 3}
                            width={(end - start) * GANTT.unitW - 2}
                            height={GANTT.rowH - 16}
                            rx={3}
                            fill={color}
                            fillOpacity={isActive ? 1 : 0.72}
                            stroke={isActive ? '#fbbf24' : 'rgba(255,255,255,0.25)'}
                            strokeWidth={isActive ? 2 : 1}
                            style={{ transition: 'fill-opacity 200ms ease' }}
                          />
                          <text
                            x={GANTT.left + ((start + end) / 2) * GANTT.unitW - 1}
                            y={y + (GANTT.rowH - 16) / 2 + 9}
                            textAnchor="middle"
                            fontSize={10}
                            fontFamily="monospace"
                            fontWeight={700}
                            fill="#fff"
                          >
                            {job}·{input.jobs[job]}
                          </text>
                        </g>
                      );
                    })}
                    {/* makespan 参考线（贪心） */}
                    {lptMs > 0 && (
                      <g>
                        <line
                          x1={GANTT.left + lptMs * GANTT.unitW}
                          y1={GANTT.top - 6}
                          x2={GANTT.left + lptMs * GANTT.unitW}
                          y2={GANTT.top + input.machines * GANTT.rowH + 4}
                          stroke="#fbbf24"
                          strokeWidth={1.4}
                          strokeDasharray="5 4"
                        />
                        <text x={GANTT.left + lptMs * GANTT.unitW} y={GANTT.top - 9} textAnchor="middle" fontSize={9} fontFamily="monospace" fill="#fbbf24">
                          LPT {lptMs}
                        </text>
                      </g>
                    )}
                    {/* 最优参考线 */}
                    {optimalMs > 0 && optimalMs !== lptMs && (
                      <g>
                        <line
                          x1={GANTT.left + optimalMs * GANTT.unitW}
                          y1={GANTT.top - 6}
                          x2={GANTT.left + optimalMs * GANTT.unitW}
                          y2={GANTT.top + input.machines * GANTT.rowH + 4}
                          stroke="#10b981"
                          strokeWidth={1.4}
                          strokeDasharray="5 4"
                        />
                        <text x={GANTT.left + optimalMs * GANTT.unitW} y={GANTT.top - 9} textAnchor="middle" fontSize={9} fontFamily="monospace" fill="#6ee7b7">
                          OPT {optimalMs}
                        </text>
                      </g>
                    )}
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
                  <span className={lptMs === optimalMs ? 'text-emerald-700' : 'text-amber-600'}>
                    LPT makespan {lptMs} · 枚举最优 {optimalMs}
                    {lptMs === optimalMs ? '（贪心已最优）' : `（贪心多花 ${lptMs - optimalMs}，比率 ${(lptMs / optimalMs).toFixed(2)}×）`}
                  </span>
                )}
              </p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">{step.note}</p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">
                作业长度 [{input.jobs.join(', ')}] · LPT 保证 ≤ (4/3 − 1/(3m))·OPT，P||Cmax 一般情形是 NP 困难
              </p>
            </div>
          </div>

          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field label="作业数 (JOBS)" value={jobCount} min={4} max={20} step={1} onChange={setJobCount} />
              <Field label="机器数 (MACHINES)" value={machineCount} min={2} max={6} step={1} onChange={setMachineCount} />
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
                  <span className="text-zinc-400">总工时</span>
                  <span className="tabular-nums text-zinc-800">{input.jobs.reduce((s, j) => s + j, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">下界 ⌈总工时/m⌉</span>
                  <span className="tabular-nums text-zinc-800">{Math.ceil(input.jobs.reduce((s, j) => s + j, 0) / input.machines)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">LPT makespan</span>
                  <span className="tabular-nums text-zinc-800">{lptMs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">枚举最优</span>
                  <span className="tabular-nums text-zinc-800">{optimalMs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">LPT 复杂度</span>
                  <span className="text-zinc-800">O(n log n)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">精确复杂度</span>
                  <span className="text-zinc-800">m^n·NP 困难</span>
                </div>
              </div>
            </Section>
          </ControlPanel>
        </div>
      </div>
    </main>
  );
}
