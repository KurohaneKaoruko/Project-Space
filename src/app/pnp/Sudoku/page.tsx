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

type Grid = number[]; // 81 格，0 = 空

interface SudokuInput {
  grid: Grid;
  /** 题面挖空数量 */
  blanks: number;
}

interface SudokuStep {
  grid: Grid;
  pos: number;
  value: number;
  placing: boolean;
  backtracks: number;
  note: string;
}

const TITLE = '数独';
const CLS = 'NPC' as const;

const ROW = (i: number) => Math.floor(i / 9);
const COL = (i: number) => i % 9;
const BOX = (i: number) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);

function peersOf(i: number): number[] {
  const set = new Set<number>();
  for (let k = 0; k < 9; k++) {
    set.add(ROW(i) * 9 + k);
    set.add(k * 9 + COL(i));
  }
  const br = Math.floor(ROW(i) / 3) * 3;
  const bc = Math.floor(COL(i) / 3) * 3;
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) set.add(r * 9 + c);
  }
  set.delete(i);
  return [...set];
}
const PEERS = Array.from({ length: 81 }, (_, i) => peersOf(i));

/** 判题：完整填盘且满足行/列/宫约束，并与题面不冲突 */
function validate(output: unknown, input: SudokuInput): boolean {
  if (!Array.isArray(output) || output.length !== 81) return false;
  const g = output as number[];
  for (let i = 0; i < 81; i++) {
    if (!Number.isInteger(g[i]) || g[i] < 1 || g[i] > 9) return false;
    if (input.grid[i] !== 0 && input.grid[i] !== g[i]) return false;
  }
  for (let i = 0; i < 81; i++) {
    for (const p of PEERS[i]) {
      if (g[p] === g[i]) return false;
    }
  }
  return true;
}

/** 回溯求参考解（小规模够用） */
function solveGrid(grid: Grid): Grid | null {
  const g = [...grid];
  const write = (backtracksRef: { n: number }): Grid | null => {
    // MRV：挑候选最少的空格
    let best = -1;
    let bestCand: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (g[i] !== 0) continue;
      const used = new Set(PEERS[i].map((p) => g[p]).filter((v) => v !== 0));
      const cand = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((v) => !used.has(v));
      if (cand.length === 0) return null;
      if (best === -1 || cand.length < bestCand.length) {
        best = i;
        bestCand = cand;
        if (cand.length === 1) break;
      }
    }
    if (best === -1) return g;
    for (const v of bestCand) {
      g[best] = v;
      const r = write(backtracksRef);
      if (r) return r;
      g[best] = 0;
      backtracksRef.n++;
    }
    return null;
  };
  const ref = { n: 0 };
  return write(ref);
}

function makeCase(name: string, grid: Grid): TestCase<SudokuInput, Grid> {
  const blanks = grid.filter((v) => v === 0).length;
  const input = { grid, blanks };
  const ref = solveGrid(grid);
  return {
    name,
    input,
    expected: ref ?? [],
    validate: (out) => ref !== null && validate(out, input),
  };
}

/* 题面库：第一个是手工经典题，其余由 digPattern 生成 */
const CLASSIC: Grid = [
  5, 3, 0, 0, 7, 0, 0, 0, 0,
  6, 0, 0, 1, 9, 5, 0, 0, 0,
  0, 9, 8, 0, 0, 0, 0, 6, 0,
  8, 0, 0, 0, 6, 0, 0, 0, 3,
  4, 0, 0, 8, 0, 3, 0, 0, 1,
  7, 0, 0, 0, 2, 0, 0, 0, 6,
  0, 6, 0, 0, 0, 0, 2, 8, 0,
  0, 0, 0, 4, 1, 9, 0, 0, 5,
  0, 0, 0, 0, 8, 0, 0, 7, 9,
];

/** 从完整解按模式挖空；rate 控制每个对称对的挖空概率 */
function digPattern(seed: number, rate = 0.55): Grid {
  const rnd = mulberry32(seed);
  // 生成完整解
  const base = Array.from({ length: 81 }, (_, i) => ((i * 3 + Math.floor(i / 9)) % 9) + 1);
  // 行内循环移位 + 行/列带交换，做出合法变体
  const shift = 1 + Math.floor(rnd() * 3);
  const g: Grid = Array.from({ length: 81 }, (_, i) => {
    const r = ROW(i);
    const c = COL(i);
    const cc = (c + shift * r) % 9;
    const band = Math.floor(r / 3);
    const rr = band * 3 + ((r + band) % 3);
    return base[rr * 9 + cc];
  });
  // 对称挖空：挖 (i, 80-i)
  const order = Array.from({ length: 41 }, (_, i) => i);
  for (const i of order) {
    const j = 80 - i;
    if (rnd() < rate) {
      g[i] = 0;
      if (j !== i) g[j] = 0;
    }
  }
  return g;
}

const CASES: TestCase<SudokuInput, Grid>[] = [
  makeCase('经典题面', CLASSIC),
  makeCase('轻挖空', digPattern(1).map((v, i) => (i % 9 === Math.floor(i / 9) ? v : v))),
  makeCase('对角挖空', digPattern(7)),
];

/** 回溯（MRV + 候选约束），每步放数/回退产出一帧 */
function* sudokuGen(input: SudokuInput): Generator<SudokuStep, Grid | null, void> {
  const g = [...input.grid];
  let backtracks = 0;
  let budget = 1000000000;

  const candidates = (i: number): number[] => {
    const used = new Set(PEERS[i].map((p) => g[p]).filter((v) => v !== 0));
    return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((v) => !used.has(v));
  };

  const write = function* (): Generator<SudokuStep, Grid | null, void> {
    if (budget-- <= 0) return null;

    // MRV：挑候选最少的空格
    let best = -1;
    let bestCand: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (g[i] !== 0) continue;
      const cand = candidates(i);
      if (cand.length === 0) {
        yield {
          grid: [...g],
          pos: i,
          value: 0,
          placing: false,
          backtracks,
          note: `格子 (${ROW(i)},${COL(i)}) 无候选值，冲突，回溯`,
        };
        return null;
      }
      if (best === -1 || cand.length < bestCand.length) {
        best = i;
        bestCand = cand;
        if (cand.length === 1) break;
      }
    }

    if (best === -1) {
      yield {
        grid: [...g],
        pos: -1,
        value: 0,
        placing: true,
        backtracks,
        note: `全部 81 格填满，得到合法解（回溯 ${backtracks} 次）`,
      };
      return g;
    }

    for (const v of bestCand) {
      g[best] = v;
      yield {
        grid: [...g],
        pos: best,
        value: v,
        placing: true,
        backtracks,
        note: `(${ROW(best)},${COL(best)}) 试 ${v}（候选 ${bestCand.length} 个：${bestCand.join(',')}）`,
      };
      const sub = yield* write();
      if (sub) return sub;
      g[best] = 0;
      backtracks++;
      yield {
        grid: [...g],
        pos: best,
        value: 0,
        placing: false,
        backtracks,
        note: `(${ROW(best)},${COL(best)}) 的 ${v} 行不通，擦掉回溯（第 ${backtracks} 次）`,
      };
    }
    return null;
  };

  return yield* write();
}

const TEMPLATE = `function solve(input) {
  const { grid } = input; // 81 长度数组，0 = 空

  // TODO: 返回填满的 81 长度数组
  return grid.slice();
}`;

const SOLUTION = `function solve(input) {
  const grid = input.grid.slice();
  const ROW = i => Math.floor(i / 9), COL = i => i % 9;
  const BOX = i => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);

  const ok = (i, v) => {
    for (let k = 0; k < 81; k++) {
      if (k !== i && grid[k] === v && (ROW(k) === ROW(i) || COL(k) === COL(i) || BOX(k) === BOX(i))) return false;
    }
    return true;
  };

  const write = () => {
    const i = grid.indexOf(0);
    if (i === -1) return true;
    for (let v = 1; v <= 9; v++) {
      if (!ok(i, v)) continue;
      grid[i] = v;
      if (write()) return true;
      grid[i] = 0;
    }
    return false;
  };
  write();
  return grid;
}`;

/* 棋盘配色 */
const GIVEN_FILL = 'rgba(255,255,255,0.08)';
const GIVEN_INK = '#e4e4e7';
const TRY_INK = '#93c5fd';
const BAD_INK = '#fb7185';

export default function SudokuPage() {
  const [difficulty, setDifficulty] = useState(0.55);
  const [seed, setSeed] = useState(4);
  const [speed, setSpeed] = useState(60);

  const input = useMemo<SudokuInput>(() => {
    const g = digPattern(seed, difficulty);
    const blanks = g.filter((v) => v === 0).length;
    return { grid: g, blanks };
  }, [seed, difficulty]);

  const factory = useCallback(() => sudokuGen(input), [input]);
  const solver = useLiveSolver<SudokuStep, Grid | null>(factory, [input], {
    stepsPerFrame: speed,
  });

  const emptyStep: SudokuStep = {
    grid: input.grid,
    pos: -1,
    value: 0,
    placing: true,
    backtracks: 0,
    note: '尚未开始，点「开始求解」',
  };
  const step = solver.current ?? emptyStep;
  const done = solver.done;
  const solved = done && solver.result !== null;

  const givens = new Set(input.grid.map((v, i) => (v !== 0 ? i : -1)).filter((i) => i >= 0));
  const conflicts = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < 81; i++) {
      if (step.grid[i] === 0) continue;
      for (const p of PEERS[i]) {
        if (step.grid[p] === step.grid[i]) {
          set.add(i);
          set.add(p);
        }
      }
    }
    return set;
  }, [step.grid]);

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
                meta={`${81 - input.blanks} givens / ${input.blanks} blanks`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    回溯 {step.backtracks} · {solved ? '已解出' : done ? '无解' : '求解中'}
                  </span>
                }
              >
                <div className="flex flex-1 items-center justify-center p-4">
                  <div
                    className="grid gap-[2px] rounded-md bg-white/[0.06] p-[3px]"
                    style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))', width: 'min(462px, 100%)' }}
                    role="img"
                    aria-label="数独回溯求解过程"
                  >
                    {step.grid.map((v, i) => {
                      const isGiven = givens.has(i);
                      const isCurrent = i === step.pos;
                      const bad = conflicts.has(i) && !isGiven;
                      const thickRight = COL(i) === 2 || COL(i) === 5;
                      const thickBottom = ROW(i) === 2 || ROW(i) === 5;
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-center rounded-[2px] font-mono tabular-nums transition-colors duration-150"
                          style={{
                            aspectRatio: '1 / 1',
                            fontSize: 'clamp(11px, 2.2vw, 20px)',
                            background: isGiven ? GIVEN_FILL : bad ? 'rgba(244,63,94,0.16)' : 'rgba(255,255,255,0.02)',
                            color: bad ? BAD_INK : isCurrent ? TRY_INK : isGiven ? GIVEN_INK : TRY_INK,
                            boxShadow: isCurrent
                              ? 'inset 0 0 0 1.5px #fbbf24'
                              : thickRight
                                ? 'inset -2px 0 0 rgba(255,255,255,0.18)'
                                : thickBottom
                                  ? 'inset 0 -2px 0 rgba(255,255,255,0.18)'
                                  : undefined,
                            fontWeight: isGiven ? 700 : 400,
                          }}
                        >
                          {v !== 0 ? v : ''}
                        </div>
                      );
                    })}
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

            <div className="shrink-0 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-400">结果</div>
              <p className="mt-1 font-mono text-[13px]">
                {!done ? (
                  <span className="text-zinc-400">—</span>
                ) : solved ? (
                  <span className="text-emerald-700">解出（回溯 {step.backtracks} 次，共 {solver.stepCount} 步）</span>
                ) : (
                  <span className="text-rose-700">无解或超出搜索预算</span>
                )}
              </p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">{step.note}</p>
            </div>
          </div>

          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field
                label="挖空比例 (BLANKS)"
                value={difficulty}
                min={0.3}
                max={0.7}
                step={0.05}
                onChange={setDifficulty}
                format={(v) => `对称挖空约 ${Math.round(v * 81)} 格`}
              />
              <button
                onClick={() => setSeed((s) => s + 1)}
                className="w-full border border-zinc-200 bg-zinc-50 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:border-blue-500/50 hover:bg-white hover:text-blue-600"
              >
                换一题 (NEW PUZZLE)
              </button>
            </Section>

            <Section title="数据 (DATA)">
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">给定数字</span>
                  <span className="tabular-nums text-zinc-800">{81 - input.blanks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">空格</span>
                  <span className="tabular-nums text-zinc-800">{input.blanks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">已填</span>
                  <span className="tabular-nums text-zinc-800">{step.grid.filter((v) => v !== 0).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">回溯</span>
                  <span className="tabular-nums text-zinc-800">{step.backtracks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">策略</span>
                  <span className="text-zinc-800">MRV + 回溯</span>
                </div>
              </div>
            </Section>
          </ControlPanel>
        </div>
      </div>
    </main>
  );
}
