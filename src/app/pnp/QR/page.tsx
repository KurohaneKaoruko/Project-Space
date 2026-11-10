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

interface QRInput {
  /** 合数模数（两个素数之积） */
  n: number;
  x: number;
}

interface QRStep {
  y: number;
  sq: number;
  hit: boolean;
  scanned: number;
  note: string;
}

const TITLE = '二次剩余';
const CLS = 'NP' as const;

/** 可选的半素数模数（两素数之积，规模适合演示） */
const SEMIPRIMES = [15, 21, 33, 35, 51, 77, 91, 143] as const;

/* ---------------- 算法 ---------------- */

/** 参考解：暴力枚举所有 y² mod n，返回全部见证（y 使得 y² ≡ x） */
function bruteWitnesses(input: QRInput): number[] {
  const { n, x } = input;
  const out: number[] = [];
  for (let y = 1; y < n; y++) {
    if ((y * y) % n === x) out.push(y);
  }
  return out;
}

function factorize(n: number): [number, number] {
  for (let p = 2; p * p <= n; p++) {
    if (n % p === 0) return [p, n / p];
  }
  return [n, 1];
}

function modpow(base: number, exp: number, mod: number): number {
  let r = 1;
  let b = base % mod;
  let e = exp;
  while (e > 0) {
    if (e & 1) r = (r * b) % mod;
    b = (b * b) % mod;
    e >>= 1;
  }
  return r;
}

function isQRmodPrime(x: number, p: number): boolean {
  const x0 = ((x % p) + p) % p;
  if (x0 === 0) return true;
  return modpow(x0, (p - 1) / 2, p) === 1;
}

function validate(output: unknown, input: QRInput): boolean {
  if (!Array.isArray(output)) return false;
  const ref = bruteWitnesses(input);
  const seen = new Set<number>();
  for (const y of output as number[]) {
    if (!Number.isInteger(y) || y <= 0 || y >= input.n || seen.has(y)) return false;
    if ((y * y) % input.n !== input.x) return false;
    seen.add(y);
  }
  return seen.size === ref.length;
}

function makeCase(name: string, input: QRInput): TestCase<QRInput, number[]> {
  const ref = bruteWitnesses(input);
  return { name, input, expected: ref, validate: (out) => validate(out, input) };
}

const CASES: TestCase<QRInput, number[]>[] = [
  makeCase('经典剩余', { n: 15, x: 4 }), // 2² ≡ 4
  makeCase('雅可比+1 非剩余', { n: 15, x: 2 }), // 勒让德各为 -1，雅可比 +1，但仍非剩余
  makeCase('雅可比+1 非剩余 II', { n: 21, x: 5 }),
];

/** 逐个枚举 y，平方后比对 x；每个 y 产出一帧 */
function* qrGen(input: QRInput): Generator<QRStep, number[], void> {
  const { n, x } = input;
  const witnesses: number[] = [];

  yield {
    y: 0,
    sq: 0,
    hit: false,
    scanned: 0,
    note: `建立平方表：计算所有 y² mod ${n}，看哪些 y 的平方恰好等于 ${x}`,
  };

  for (let y = 1; y < n; y++) {
    const sq = (y * y) % n;
    const hit = sq === x;
    if (hit) witnesses.push(y);
    yield {
      y,
      sq,
      hit,
      scanned: y,
      note: hit
        ? `y=${y}：${y}² mod ${n} = ${sq} ≡ ${x}，命中！记为见证`
        : `y=${y}：${y}² mod ${n} = ${sq} ≠ ${x}`,
    };
  }

  return witnesses;
}

function randomInstance(nIndex: number, seed: number): QRInput {
  const n = SEMIPRIMES[Math.min(nIndex, SEMIPRIMES.length - 1)];
  const rnd = mulberry32(seed);
  let x = 2 + Math.floor(rnd() * (n - 3));
  let guard = 0;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  while ((gcd(x, n) !== 1 || x === 1) && guard++ < 200) {
    x = 2 + Math.floor(rnd() * (n - 3));
  }
  return { n, x };
}

const TEMPLATE = `function solve(input) {
  const { n, x } = input;

  // TODO: 返回所有满足 y² ≡ x (mod n) 的 y（无解返回 []）
  return [];
}`;

const SOLUTION = `function solve(input) {
  const { n, x } = input;
  const out = [];
  for (let y = 1; y < n; y++) {
    if ((y * y) % n === x) out.push(y);
  }
  return out;
}`;

export default function QuadraticResiduosityPage() {
  const [nIndex, setNIndex] = useState(0);
  const [seed, setSeed] = useState(12);
  const [speed, setSpeed] = useState(16);

  const input = useMemo(() => randomInstance(nIndex, seed), [nIndex, seed]);

  const factory = useCallback(() => qrGen(input), [input]);
  const solver = useLiveSolver<QRStep, number[]>(factory, [input], {
    stepsPerFrame: speed,
  });

  const step: QRStep =
    solver.current ?? { y: 0, sq: 0, hit: false, scanned: 0, note: '尚未开始，点「开始求解」' };
  const result = solver.result;
  const done = solver.done;

  /* 预计算完整 QR 集（用于渲染底色）与欧拉判据摘要 */
  const qrSet = useMemo(() => {
    const s = new Set<number>();
    for (let y = 1; y < input.n; y++) s.add((y * y) % input.n);
    return s;
  }, [input.n]);

  const [p, q] = useMemo(() => factorize(input.n), [input.n]);
  const euler = useMemo(() => {
    const rp = isQRmodPrime(input.x, p);
    const rq = isQRmodPrime(input.x, q);
    return { rp, rq };
  }, [input.x, p, q]);

  const witnessSet = new Set(result ?? []);

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
                label="SQUARES TABLE"
                meta={`n = ${input.n} = ${p}·${q} / x = ${input.x}`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    扫描 {Math.min(step.scanned, input.n - 1)}/{input.n - 1}
                  </span>
                }
              >
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
                  <div className="flex flex-wrap content-center justify-center gap-[3px]">
                    {Array.from({ length: input.n }, (_, r) => r).map((r) => {
                      const isQR = qrSet.has(r);
                      const isTarget = r === input.x;
                      const isCurrent = step.scanned > 0 && r === step.sq;
                      return (
                        <div
                          key={r}
                          className={`flex items-center justify-center rounded-[2px] font-mono tabular-nums transition-colors duration-100 ${
                            isCurrent ? 'ring-1 ring-amber-300' : ''
                          }`}
                          style={{
                            width: 26,
                            height: 26,
                            fontSize: 10,
                            background: isTarget
                              ? 'rgba(251,191,36,0.25)'
                              : isQR
                                ? 'rgba(59,130,246,0.55)'
                                : 'rgba(255,255,255,0.05)',
                            color: isTarget ? '#fcd34d' : isQR ? '#dbeafe' : '#71717a',
                            outline: isTarget ? '1px solid rgba(251,191,36,0.7)' : undefined,
                          }}
                        >
                          {r}
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
                ) : result && result.length > 0 ? (
                  <span className="text-emerald-700">
                    {input.x} 是二次剩余：见证 [{result.join(', ')}]（各自的平方 mod {input.n} 都等于 {input.x}）
                  </span>
                ) : (
                  <span className="text-rose-700">{input.x} 不是二次剩余（平方表中无命中）</span>
                )}
              </p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">{step.note}</p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">
                因数分解法（需要知道 {p}·{q}）：x≡{((input.x % p) + p) % p} mod {p} →{' '}
                {euler.rp ? 'QR' : '非QR'}；x≡{((input.x % q) + q) % q} mod {q} →{' '}
                {euler.rq ? 'QR' : '非QR'}；两者皆是 ⟺ mod {input.n} 是二次剩余
              </p>
            </div>
          </div>

          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field
                label="模数 (MODULUS)"
                value={nIndex}
                min={0}
                max={SEMIPRIMES.length - 1}
                step={1}
                onChange={setNIndex}
                format={(v) => `n = ${SEMIPRIMES[Math.min(v, SEMIPRIMES.length - 1)]}`}
              />
              <button
                onClick={() => setSeed((s) => s + 1)}
                className="w-full border border-zinc-200 bg-zinc-50 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:border-blue-500/50 hover:bg-white hover:text-blue-600"
              >
                换一个 x (RESHUFFLE)
              </button>
            </Section>

            <Section title="数据 (DATA)">
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">n</span>
                  <span className="text-zinc-800">{input.n} = {p}·{q}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">x</span>
                  <span className="tabular-nums text-zinc-800">{input.x}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">QR 值个数</span>
                  <span className="tabular-nums text-zinc-800">{qrSet.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">已扫描</span>
                  <span className="tabular-nums text-zinc-800">{Math.min(step.scanned, input.n - 1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">暴力复杂度</span>
                  <span className="text-zinc-800">O(n)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">分解法复杂度</span>
                  <span className="text-zinc-800">O(log² n)·需分解</span>
                </div>
              </div>
            </Section>
          </ControlPanel>
        </div>
      </div>
    </main>
  );
}
