'use client';

import { useCallback, useMemo, useState } from 'react';
import Navigation from '../../components/Navigation';
import InstrumentPanel from '../components/InstrumentPanel';
import ControlPanel, { Field, Section } from '../components/ControlPanel';
import SegmentedControl from '../components/SegmentedControl';
import CodeRunner from '../components/CodeRunner';
import LiveControls from '../components/LiveControls';
import { useLiveSolver } from '../lib/useLiveSolver';
import { mulberry32 } from '../lib/generate';
import { CLASS_META, type TestCase } from '../lib/types';

/** 群元素：o = 单位元，n = 模 p 乘法群的整数，p = 椭圆曲线上的仿射点 */
type El = { t: 'o' } | { t: 'n'; v: number } | { t: 'p'; x: number; y: number };

/** 对外暴露的元素形式：乘法群是整数，椭圆曲线是 [x, y] */
type ElArg = number | [number, number];

interface Ctx {
  kind: 'modp' | 'ec';
  p: number;
  /** 椭圆曲线的 a、b（乘法群不用） */
  a: number;
  b: number;
}

interface DlpInput {
  kind: 'modp' | 'ec';
  p: number;
  a: number;
  b: number;
  G: ElArg;
  H: ElArg;
  /** G 的阶 */
  order: number;
  /** 私钥明文：仅供可视化画「读者视角」的幽灵标记，算法逻辑绝不使用 */
  x?: number;
}

/** 指数轨道数据：算法不消费，只喂给指数标尺与侧栏标注 */
interface StepViz {
  /** 暴力：当前线性指数 k */
  k?: number;
  /** BSGS baby：刚写入表的 j */
  babyJ?: number;
  /** BSGS giant：大步编号 i */
  giantI?: number;
  /** 巨步/野袋鼠的「幽灵指数」：借读者视角的 x 算出的真实位置 */
  ghostExp?: number;
  /** BSGS：命中的 baby 表下标 j */
  hitJ?: number;
  /** 袋鼠：轮次（从 1 计） */
  round?: number;
  /** 袋鼠：各驯服袋鼠的已知指数位置 start+dist */
  tameExps?: number[];
  /** 袋鼠：野袋鼠累计跳距 */
  wildDist?: number;
  /** 袋鼠：踩到第几只驯服袋鼠（0 起） */
  hitTame?: number;
}

interface DlpStep {
  current: El;
  trail: El[];
  tried: number;
  note: string;
  phase: 'brute' | 'baby' | 'giant' | 'kangaroo';
  table?: El[];
  /** 袋鼠算法：一群驯服袋鼠的位置 */
  tames?: El[];
  viz?: StepViz;
}

const TITLE = '离散对数';
const CLS = 'NP' as const;

const mod = (v: number, p: number) => ((v % p) + p) % p;
const round2 = (v: number) => Math.round(v * 100) / 100;

function modInv(v: number, p: number): number {
  let [r0, r1] = [mod(v, p), p];
  let [s0, s1] = [1, 0];
  while (r1 !== 0) {
    const q = Math.floor(r0 / r1);
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  return mod(s0, p);
}

const toEl = (kind: 'modp' | 'ec', v: ElArg): El =>
  kind === 'modp'
    ? { t: 'n', v: v as number }
    : { t: 'p', x: (v as [number, number])[0], y: (v as [number, number])[1] };

const fromEl = (E: El): ElArg => {
  if (E.t === 'n') return E.v;
  if (E.t === 'p') return [E.x, E.y];
  return 0;
};

const ctxOf = (input: DlpInput): Ctx => ({
  kind: input.kind,
  p: input.p,
  a: input.a,
  b: input.b,
});

/** 单位元：乘法群是 1，椭圆曲线是无穷远点 O */
const one = (kind: 'modp' | 'ec'): El => (kind === 'modp' ? { t: 'n', v: 1 } : { t: 'o' });

const isId = (E: El) => E.t === 'o' || (E.t === 'n' && E.v === 1);

/** 群运算：乘法群做模乘，椭圆曲线做点加 */
function combine(A: El, B: El, c: Ctx): El {
  if (A.t === 'o') return B;
  if (B.t === 'o') return A;

  if (A.t === 'n' && B.t === 'n') {
    return { t: 'n', v: mod(A.v * B.v, c.p) };
  }

  if (A.t !== 'p' || B.t !== 'p') return A;

  const { p, a } = c;
  if (A.x === B.x && mod(A.y + B.y, p) === 0) return { t: 'o' };

  let lambda: number;
  if (A.x === B.x && A.y === B.y) {
    if (A.y === 0) return { t: 'o' };
    lambda = mod((3 * A.x * A.x + a) * modInv(2 * A.y, p), p);
  } else {
    lambda = mod((B.y - A.y) * modInv(B.x - A.x, p), p);
  }

  const x = mod(lambda * lambda - A.x - B.x, p);
  const y = mod(lambda * (A.x - x) - A.y, p);
  return { t: 'p', x, y };
}

/** 群元素的 k 次幂 / k 倍点（倍加） */
function power(k: number, A: El, c: Ctx): El {
  let result: El = one(c.kind);
  let base = A;
  let e = k;
  while (e > 0) {
    if (e & 1) result = combine(result, base, c);
    base = combine(base, base, c);
    e >>= 1;
  }
  return result;
}

const elEq = (A: El, B: El): boolean => {
  if (A.t !== B.t) return false;
  if (A.t === 'o') return true;
  if (A.t === 'n') return A.v === (B as { v: number }).v;
  return A.x === (B as { x: number }).x && A.y === (B as { y: number }).y;
};

const elKey = (A: El): string => {
  if (A.t === 'o') return 'O';
  if (A.t === 'n') return `n${A.v}`;
  return `p${A.x},${A.y}`;
};

const elText = (A: El): string => {
  if (A.t === 'o') return 'O（单位元）';
  if (A.t === 'n') return String(A.v);
  return `(${A.x}, ${A.y})`;
};

const powMod = (base: number, exp: number, p: number): number => {
  let r = 1;
  let b = mod(base, p);
  let e = exp;
  while (e > 0) {
    if (e & 1) r = mod(r * b, p);
    b = mod(b * b, p);
    e >>= 1;
  }
  return r;
};

function primeFactors(n: number): number[] {
  const out: number[] = [];
  let v = n;
  for (let d = 2; d * d <= v; d++) {
    if (v % d === 0) {
      out.push(d);
      while (v % d === 0) v /= d;
    }
  }
  if (v > 1) out.push(v);
  return out;
}

/* ---------------- 乘法群 F_p* ---------------- */

function isPrimitiveRoot(g: number, p: number): boolean {
  const n = p - 1;
  return primeFactors(n).every((q) => powMod(g, n / q, p) !== 1);
}

function buildModp(p: number, seed: number) {
  const rnd = mulberry32(seed);
  for (let t = 0; t < 200; t++) {
    const g = 2 + Math.floor(rnd() * (p - 2));
    if (isPrimitiveRoot(g, p)) return { g, order: p - 1, n: p - 1 };
  }
  for (let g = 2; g < p; g++) {
    if (isPrimitiveRoot(g, p)) return { g, order: p - 1, n: p - 1 };
  }
  return { g: 2, order: 1, n: p - 1 };
}

/* ---------------- 椭圆曲线 E(F_p) ---------------- */

const legendre = (v: number, p: number) => powMod(v, (p - 1) / 2, p);

function allPoints(p: number, a: number, b: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let x = 0; x < p; x++) {
    const rhs = mod(x * x * x + a * x + b, p);
    if (rhs === 0) {
      out.push({ x, y: 0 });
      continue;
    }
    if (legendre(rhs, p) !== 1) continue;

    let found = false;
    if (p % 4 === 3) {
      const root = powMod(rhs, (p + 1) / 4, p);
      if (mod(root * root, p) === rhs) {
        out.push({ x, y: root });
        out.push({ x, y: mod(-root, p) });
        found = true;
      }
    }
    if (!found) {
      for (let y = 0; y < p; y++) {
        if (mod(y * y, p) === rhs) {
          out.push({ x, y });
          out.push({ x, y: mod(-y, p) });
          break;
        }
      }
    }
  }
  return out;
}

function pointOrder(G: { x: number; y: number }, a: number, p: number, n: number): number {
  const ctx: Ctx = { kind: 'ec', p, a, b: 0 };
  const el: El = { t: 'p', x: G.x, y: G.y };
  let order = n;
  for (const f of primeFactors(n)) {
    while (order % f === 0 && power(order / f, el, ctx).t === 'o') order /= f;
  }
  return order;
}

function buildEc(p: number, seed: number) {
  const rnd = mulberry32(seed);
  type Curve = { a: number; b: number; G: { x: number; y: number }; n: number; order: number };
  let best: Curve | null = null;

  for (let attempt = 0; attempt < 400; attempt++) {
    const a = Math.floor(rnd() * p);
    const b = Math.floor(rnd() * p);
    if (mod(4 * a * a * a + 27 * b * b, p) === 0) continue;

    const pts = allPoints(p, a, b);
    if (pts.length < 20) continue;
    const n = pts.length + 1;

    let local: Curve | null = null;
    for (let t = 0; t < 8; t++) {
      const G = pts[Math.floor(rnd() * pts.length)];
      const order = pointOrder(G, a, p, n);
      if (!local || order > local.order) local = { a, b, G, n, order };
    }

    if (local && (!best || local.order > best.order)) best = local;
    if (local && local.order >= n * 0.8) return local;
  }

  if (best) return best;

  const a = 2;
  const b = 3;
  const pts = allPoints(p, a, b);
  const G = pts[0];
  const n = pts.length + 1;
  return { a, b, G, n, order: pointOrder(G, a, p, n) };
}

/* ---------------- 题目实例 ---------------- */

const PRIMES = [19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 101, 211, 503, 1013, 2017, 4099, 6011];

interface Instance {
  ctx: Ctx;
  G: El;
  order: number;
  n: number;
  /** 乘法群的生成元数值（椭圆曲线为 null） */
  g: number | null;
}

function makeInstance(kind: 'modp' | 'ec', p: number, seed: number): Instance {
  if (kind === 'modp') {
    const { g, order, n } = buildModp(p, seed);
    return { ctx: { kind: 'modp', p, a: 0, b: 0 }, G: { t: 'n', v: g }, order, n, g };
  }
  const c = buildEc(p, seed);
  return {
    ctx: { kind: 'ec', p, a: c.a, b: c.b },
    G: { t: 'p', x: c.G.x, y: c.G.y },
    order: c.order,
    n: c.n,
    g: null,
  };
}

/** 参考解：暴力线性搜索 */
function bruteLog(input: DlpInput): number {
  const ctx = ctxOf(input);
  const G = toEl(input.kind, input.G);
  const H = toEl(input.kind, input.H);
  let R = G;
  for (let i = 1; i <= input.order; i++) {
    if (elEq(R, H)) return i;
    R = combine(R, G, ctx);
  }
  return -1;
}

function makeCase(name: string, kind: 'modp' | 'ec', p: number, seed: number, x: number) {
  const inst = makeInstance(kind, p, seed);
  const H = power(x, inst.G, inst.ctx);
  const input: DlpInput = {
    kind,
    p,
    a: inst.ctx.a,
    b: inst.ctx.b,
    G: fromEl(inst.G),
    H: fromEl(H),
    order: inst.order,
  };

  return {
    name,
    input,
    expected: bruteLog(input),
    validate: (out: unknown) => {
      if (!Number.isInteger(out)) return false;
      const value = out as number;
      if (value < 1) return false;
      return elEq(power(value, inst.G, inst.ctx), H);
    },
  } as TestCase<DlpInput, number>;
}

const CASES: TestCase<DlpInput, number>[] = [
  makeCase('乘法群 p=19 · x=7', 'modp', 19, 1, 7),
  makeCase('乘法群 p=23 · x=6', 'modp', 23, 2, 6),
  makeCase('椭圆曲线 p=23 · x=5', 'ec', 23, 3, 5),
];

/* ---------------- 两种算法 ---------------- */

function* bruteGen(input: DlpInput): Generator<DlpStep, number, void> {
  const ctx = ctxOf(input);
  const G = toEl(input.kind, input.G);
  const H = toEl(input.kind, input.H);
  const mulWord = input.kind === 'modp' ? '乘' : '加';

  let R = G;
  const trail: El[] = [];

  yield {
    current: R,
    trail: [],
    tried: 1,
    phase: 'brute',
    viz: { k: 1 },
    note: `从生成元开始，每次再${mulWord}一次，逐个比对目标`,
  };

  for (let i = 1; i <= input.order; i++) {
    if (elEq(R, H)) {
      yield {
        current: R,
        trail: [...trail],
        tried: i,
        phase: 'brute',
        viz: { k: i },
        note: `第 ${i} 步命中目标，x = ${i}`,
      };
      return i;
    }
    trail.push(R);
    if (trail.length > 40) trail.shift();
    R = combine(R, G, ctx);
    yield {
      current: R,
      trail: [...trail],
      tried: i + 1,
      phase: 'brute',
      viz: { k: i + 1 },
      note: `第 ${i + 1} 个元素 = ${elText(R)}`,
    };
  }

  return -1;
}

/** BSGS：m = ceil(sqrt(order))，先存 g^j，再从 h 往回落 (g^m)^-1 */
function* bsgsGen(input: DlpInput): Generator<DlpStep, number, void> {
  const ctx = ctxOf(input);
  const G = toEl(input.kind, input.G);
  const H = toEl(input.kind, input.H);
  const order = input.order;
  const truth = input.x; // 读者视角的答案，仅用于画幽灵标记

  const m = Math.ceil(Math.sqrt(order));
  const table: El[] = [];
  const index = new Map<string, number>();

  let R: El = one(input.kind);
  for (let j = 0; j < m; j++) {
    if (!isId(R)) table.push(R);
    index.set(elKey(R), j);
    yield {
      current: R,
      trail: [],
      tried: j + 1,
      phase: 'baby',
      table: [...table],
      viz: { babyJ: j, ghostExp: truth },
      note: `baby 表：g^${j} = ${elText(R)} 存入哈希表（${j + 1}/${m} 项）`,
    };
    R = combine(R, G, ctx);
  }

  // 巨步方向：h · (g^-m)^i
  const mG = power(m, G, ctx);
  const inv: El =
    mG.t === 'o'
      ? mG
      : mG.t === 'n'
        ? { t: 'n', v: modInv(mG.v, ctx.p) }
        : { t: 'p', x: mG.x, y: mod(-mG.y, ctx.p) };

  let gamma: El = H;

  for (let i = 0; i < m; i++) {
    const j = index.get(elKey(gamma));
    if (j !== undefined) {
      const raw = i * m + j;
      const k = ((raw % order) + order) % order || order;
      yield {
        current: gamma,
        trail: [],
        tried: m + i + 1,
        phase: 'giant',
        table: [...table],
        viz: { giantI: i, hitJ: j, ghostExp: truth },
        note: `巨步 ${i} 落进 baby 区：h·g^−${i * m} = g^${j} → x = ${i}×${m} + ${j} = ${k}`,
      };
      return k;
    }

    yield {
      current: gamma,
      trail: [],
      tried: m + i + 1,
      phase: 'giant',
      table: [...table],
      viz: { giantI: i, ghostExp: truth },
      note: `巨步 ${i}：g^${i * m}·h⁻¹ 侧的元素 ${elText(gamma)}，不在 baby 表里`,
    };
    gamma = combine(gamma, inv, ctx);
  }

  return -1;
}

/** 并行袋鼠：8 只驯服袋鼠均匀铺开，野袋鼠从 H 出发，踩到同一格即相遇 */
function* kangarooGen(input: DlpInput): Generator<DlpStep, number, void> {
  const ctx = ctxOf(input);
  const G = toEl(input.kind, input.G);
  const H = toEl(input.kind, input.H);
  const n = input.order;

  // 跳跃集 {1,2,4,…,128}，步长按元素哈希取，保证两只袋鼠踩到同一格后走同样的路
  const JUMPS = [1, 2, 4, 8, 16, 32, 64, 128];
  const jumpPowers = JUMPS.map((j) => power(j, G, ctx));
  const jumpIdx = (E: El, salt: number) => {
    const base = E.t === 'n' ? E.v : E.t === 'p' ? E.x * 31 + E.y : 0;
    return ((Math.imul(base, 2654435761) >>> 0) + salt) % JUMPS.length;
  };

  const HERD = 8;
  const ROUNDS = 8;
  const maxSteps = Math.ceil(6 * Math.sqrt(n)) + 8;
  let tried = 0;

  for (let round = 0; round < ROUNDS; round++) {
    const tames = Array.from({ length: HERD }, (_, j) => {
      const start = Math.floor((j * n) / HERD);
      return { pos: power(start, G, ctx), dist: 0, start };
    });
    let wild = H;
    let wildDist = 0;

    yield {
      current: wild,
      tames: tames.map((t) => t.pos),
      trail: [],
      tried: 0,
      phase: 'kangaroo',
      viz: { round: round + 1, tameExps: tames.map((t) => t.start), wildDist: 0, ghostExp: input.x },
      note: `第 ${round + 1} 轮：${HERD} 只驯服袋鼠铺开，野袋鼠从 H 起跳`,
    };

    for (let step = 0; step < maxSteps; step++) {
      tried++;
      const hit = tames.findIndex((t) => elEq(t.pos, wild));
      if (hit >= 0) {
        const t = tames[hit];
        const x = (((t.start + t.dist - wildDist) % n) + n) % n || n;
        yield {
          current: wild,
          tames: tames.map((item) => item.pos),
          trail: [],
          tried,
          phase: 'kangaroo',
          viz: {
            round: round + 1,
            tameExps: tames.map((item) => item.start + item.dist),
            wildDist,
            hitTame: hit,
            ghostExp: input.x,
          },
          note: `野袋鼠踩到第 ${hit + 1} 只的足迹 → x = ${t.start} + ${t.dist} − ${wildDist} = ${x}`,
        };
        return x;
      }

      for (const t of tames) {
        const j = jumpIdx(t.pos, round);
        t.pos = combine(t.pos, jumpPowers[j], ctx);
        t.dist += JUMPS[j];
      }
      const jw = jumpIdx(wild, round);
      wild = combine(wild, jumpPowers[jw], ctx);
      wildDist += JUMPS[jw];

      yield {
        current: wild,
        tames: tames.map((t) => t.pos),
        trail: [],
        tried,
        phase: 'kangaroo',
        viz: {
          round: round + 1,
          tameExps: tames.map((t) => t.start + t.dist),
          wildDist,
          ghostExp: input.x,
        },
        note: `第 ${round + 1} 轮 · 第 ${step + 1} 跳：野袋鼠跳 ${JUMPS[jw]} 步（累计 ${wildDist}）`,
      };
    }
  }

  return -1;
}

const TEMPLATE = `function solve(input) {
  const { kind, p, a, G, H, order } = input;
  // kind === 'modp'：G、H 是整数，求 x 使 G^x ≡ H (mod p)
  // kind === 'ec'  ：G、H 是 [x, y]，求 x 使 x·G = H

  // TODO
  return -1;
}`;

const SOLUTION = `function solve(input) {
  const { kind, p, a, G, H, order } = input;
  const mod = (v) => ((v % p) + p) % p;

  // ---- 群运算 ----
  const inv = (v) => {
    let [r0, r1] = [mod(v), p];
    let [s0, s1] = [1, 0];
    while (r1) {
      const q = Math.floor(r0 / r1);
      [r0, r1] = [r1, r0 - q * r1];
      [s0, s1] = [s1, s0 - q * s1];
    }
    return mod(s0);
  };

  const key = (E) => (E === null ? 'O' : kind === 'modp' ? 'n' + E : 'p' + E.x + ',' + E.y);

  const mul = (A, B) => {
    if (A === null) return B;
    if (B === null) return A;
    if (kind === 'modp') return mod(A * B);
    if (A.x === B.x && mod(A.y + B.y) === 0) return null;
    const lam =
      A.x === B.x && A.y === B.y
        ? mod((3 * A.x * A.x + a) * inv(2 * A.y))
        : mod((B.y - A.y) * inv(B.x - A.x));
    const x = mod(lam * lam - A.x - B.x);
    return { x, y: mod(lam * (A.x - x) - A.y) };
  };

  const pow = (k, A) => {
    let r = kind === 'modp' ? 1 : null;
    let base = A;
    while (k > 0) {
      if (k & 1) r = mul(r, base);
      base = mul(base, base);
      k >>= 1;
    }
    return r;
  };

  const P = kind === 'modp' ? G : { x: G[0], y: G[1] };
  const Q = kind === 'modp' ? H : { x: H[0], y: H[1] };

  // ---- Baby-step Giant-step ----
  const m = Math.ceil(Math.sqrt(order));
  const table = new Map();
  let R = kind === 'modp' ? 1 : null;
  for (let j = 0; j < m; j++) {
    table.set(key(R), j);
    R = mul(R, P);
  }

  const mG = pow(m, P);
  const step =
    kind === 'modp' ? inv(mG) : mG === null ? null : { x: mG.x, y: mod(-mG.y) };

  let gamma = Q;
  for (let i = 0; i < m; i++) {
    const j = table.get(key(gamma));
    if (j !== undefined) {
      const raw = i * m + j;
      return (((raw % order) + order) % order) || order;
    }
    gamma = mul(gamma, step);
  }
  return -1;
}`;

export default function DlpPage() {
  const [kind, setKind] = useState<'modp' | 'ec'>('modp');
  const [primeIdx, setPrimeIdx] = useState(4);
  const [seed, setSeed] = useState(3);
  const [algo, setAlgo] = useState<'brute' | 'bsgs' | 'kangaroo'>('brute');
  const [speed, setSpeed] = useState(1);
  const [secret, setSecret] = useState(9);

  const p = PRIMES[primeIdx];
  const inst = useMemo(() => makeInstance(kind, p, seed), [kind, p, seed]);

  const x = Math.max(2, Math.min(secret, inst.order - 1));
  const H = useMemo(() => power(x, inst.G, inst.ctx), [x, inst]);

  const input = useMemo<DlpInput>(
    () => ({
      kind,
      p,
      a: inst.ctx.a,
      b: inst.ctx.b,
      G: fromEl(inst.G),
      H: fromEl(H),
      order: inst.order,
      // 教学用：把私钥透传给可视化（幽灵标记），求解器逻辑不读它
      x: kind === 'modp' ? x : undefined,
    }),
    [kind, p, inst, H, x],
  );

  const factory = useCallback(
    () =>
      algo === 'brute'
        ? bruteGen(input)
        : algo === 'bsgs'
          ? bsgsGen(input)
          : kangarooGen(input),
    [algo, input],
  );
  const solver = useLiveSolver<DlpStep, number>(factory, [algo, input], { stepsPerFrame: speed });

  const step: DlpStep =
    solver.current ?? {
      current: inst.G,
      trail: [],
      tried: 0,
      phase: 'brute',
      note: '尚未开始，点「开始求解」',
    };
  const result = solver.result;
  const done = solver.done;

  const ecPoints = useMemo(() => {
    if (kind !== 'ec') return [];
    const all = allPoints(p, inst.ctx.a, inst.ctx.b);
    // 大素数时曲线点数以千计，全量画会拖垮渲染：等距抽样最多 600 个点
    if (all.length <= 600) return all;
    const stride = Math.ceil(all.length / 600);
    return all.filter((_, i) => i % stride === 0);
  }, [kind, p, inst]);

  const view = useMemo(() => {
    const W = 820;
    const Hh = 420;
    const pad = 34;
    const span = Math.max(1, p - 1);
    return {
      W,
      H: Hh,
      pad,
      // 坐标统一保留两位小数：Node 与浏览器的 Math.cos/sin 末位可能不同，
      // 直接输出浮点会让 SSR 与 hydration 的属性对不上
      sx: (v: number) => round2(pad + (v / span) * (W - 2 * pad)),
      sy: (v: number) => round2(Hh - pad - (v / span) * (Hh - 2 * pad)),
      ring: (v: number) => {
        const angle = ((v - 1) / Math.max(1, p - 1)) * Math.PI * 2 - Math.PI / 2;
        return {
          x: round2(W / 2 + 300 * Math.cos(angle)),
          y: round2(Hh / 2 + 150 * Math.sin(angle)),
        };
      },
      /** 指数标尺（底部条）：把指数 k ∈ [0, order] 映射到条带 x 坐标 */
      expX: (k: number) => round2(pad + (k / Math.max(1, inst.order)) * (W - 2 * pad)),
    };
  }, [p, inst.order]);

  const { sx, sy } = view;
  const orderN = inst.order;
  const mBaby = Math.ceil(Math.sqrt(orderN));

  /** 指数 → 环上元素位置（仅乘法群，用于幽灵标记） */
  const ringPosOfExp = useCallback(
    (k: number) => {
      if (inst.G.t !== 'n') return null;
      const v = powMod(inst.G.v, ((k % orderN) + orderN) % orderN, p);
      return view.ring(v);
    },
    [inst.G, orderN, p, view],
  );

  const posOf = useCallback(
    (E: El): { x: number; y: number } | null => {
      if (E.t === 'n') return view.ring(E.v);
      if (E.t === 'p') return { x: sx(E.x), y: sy(E.y) };
      return null;
    },
    [view, sx, sy],
  );

  const curPos = posOf(step.current);
  const gPoint = inst.G.t === 'p' ? inst.G : null;
  const hPoint = H.t === 'p' ? H : null;

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
                label={kind === 'modp' ? 'F_p*' : 'E(F_p)'}
                meta={
                  kind === 'modp'
                    ? `(Z/${p}Z)* · 生成元 ${inst.g}`
                    : `y² = x³ + ${inst.ctx.a}x + ${inst.ctx.b}  mod ${p}`
                }
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    {kind === 'modp' ? `${p - 1} 个元素` : `${ecPoints.length + 1} 个点`} / 阶 {inst.order}
                  </span>
                }
              >
                <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
                  <div className="flex min-h-0 flex-1 items-center justify-center p-3">
                    <svg
                      viewBox={`0 0 ${view.W} ${view.H}`}
                      className="h-full max-h-[420px] w-full"
                      role="img"
                      aria-label="离散对数求解过程"
                    >
                      {kind === 'modp' ? (
                        <g>
                          <circle
                            cx={view.W / 2}
                            cy={view.H / 2}
                            r={300}
                            fill="none"
                            stroke="#ffffff"
                            strokeOpacity={0.06}
                          />
                          <circle
                            cx={view.W / 2}
                            cy={view.H / 2}
                            r={150}
                            fill="none"
                            stroke="#ffffff"
                            strokeOpacity={0.06}
                          />
                          <text
                            x={view.W / 2}
                            y={view.H / 2 - 4}
                            textAnchor="middle"
                            fontSize="15"
                            fontFamily="monospace"
                            fill="#52525b"
                          >
                            (Z/{p}Z)*
                          </text>
                          <text
                            x={view.W / 2}
                            y={view.H / 2 + 16}
                            textAnchor="middle"
                            fontSize="10"
                            fontFamily="monospace"
                            fill="#3f3f46"
                          >
                            阶 {inst.order}
                          </text>
                          {Array.from({ length: p - 1 }, (_, i) => {
                            const v = i + 1;
                            const pos = view.ring(v);
                            const isG = inst.G.t === 'n' && inst.G.v === v;
                            const isH = H.t === 'n' && H.v === v;
                            const isCur = step.current.t === 'n' && step.current.v === v;
                            return (
                              <g key={v}>
                                <circle
                                  cx={pos.x}
                                  cy={pos.y}
                                  r={isG || isH ? 7 : isCur ? 6 : 3.2}
                                  fill={isCur ? '#fbbf24' : isG ? '#34d399' : isH ? '#fb7185' : '#52525b'}
                                  opacity={isG || isH || isCur ? 1 : 0.7}
                                />
                                {(p <= 41 || v % 2 === 1) && (
                                  <text
                                    x={pos.x + 10}
                                    y={pos.y + 3}
                                    fontSize="8"
                                    fontFamily="monospace"
                                    fill={isG ? '#6ee7b7' : isH ? '#fda4af' : '#71717a'}
                                  >
                                    {v}
                                  </text>
                                )}
                              </g>
                            );
                          })}
                        </g>
                      ) : (
                        <g>
                          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                            <g key={t}>
                              <line
                                x1={view.pad + t * (view.W - 2 * view.pad)}
                                y1={view.pad}
                                x2={view.pad + t * (view.W - 2 * view.pad)}
                                y2={view.H - view.pad}
                                stroke="#ffffff"
                                strokeOpacity={0.04}
                              />
                              <line
                                x1={view.pad}
                                y1={view.pad + t * (view.H - 2 * view.pad)}
                                x2={view.W - view.pad}
                                y2={view.pad + t * (view.H - 2 * view.pad)}
                                stroke="#ffffff"
                                strokeOpacity={0.04}
                              />
                            </g>
                          ))}
                          {ecPoints.map((pt, i) => (
                            <circle key={i} cx={sx(pt.x)} cy={sy(pt.y)} r={2.8} fill="#71717a" opacity={0.8} />
                          ))}
                        </g>
                      )}

                      {/* 走过的轨迹（乘法群） */}
                      {step.trail.map((E, i) => {
                        const pos = posOf(E);
                        if (!pos) return null;
                        return (
                          <circle
                            key={`t-${i}`}
                            cx={pos.x}
                            cy={pos.y}
                            r={3}
                            fill="#3b82f6"
                            opacity={0.2 + (0.5 * (i + 1)) / step.trail.length}
                          />
                        );
                      })}

                      {/* baby 表 */}
                      {step.table?.map((E, i) => {
                        const pos = posOf(E);
                        if (!pos) return null;
                        return (
                          <rect
                            key={`b-${i}`}
                            x={pos.x - 2.5}
                            y={pos.y - 2.5}
                            width={5}
                            height={5}
                            fill="#a78bfa"
                            opacity={0.85}
                          />
                        );
                      })}

                      {/* 袋鼠算法：驯服袋鼠的当前位置 */}
                      {step.tames?.map((E, i) => {
                        const pos = posOf(E);
                        if (!pos) return null;
                        return (
                          <circle
                            key={`k-${i}`}
                            cx={pos.x}
                            cy={pos.y}
                            r={4.5}
                            fill="none"
                            stroke="#34d399"
                            strokeWidth={1.3}
                            opacity={0.85}
                          />
                        );
                      })}

                      {/* 椭圆曲线上的 G / H 标记 */}
                      {gPoint && (
                        <g>
                          <circle
                            cx={sx(gPoint.x)}
                            cy={sy(gPoint.y)}
                            r={9}
                            fill="none"
                            stroke="#34d399"
                            strokeWidth={1.6}
                          />
                          <text
                            x={sx(gPoint.x) + 12}
                            y={sy(gPoint.y) - 10}
                            fontSize="11"
                            fontFamily="monospace"
                            fill="#6ee7b7"
                          >
                            G
                          </text>
                        </g>
                      )}
                      {hPoint && (
                        <g>
                          <circle
                            cx={sx(hPoint.x)}
                            cy={sy(hPoint.y)}
                            r={9}
                            fill="none"
                            stroke="#fb7185"
                            strokeWidth={1.6}
                          />
                          <text
                            x={sx(hPoint.x) + 12}
                            y={sy(hPoint.y) - 10}
                            fontSize="11"
                            fontFamily="monospace"
                            fill="#fda4af"
                          >
                            H
                          </text>
                        </g>
                      )}

                      {/* ===== 指数标尺：把「算法在指数空间的位置」画成底部条带 ===== */}
                      {kind === 'modp' && step.viz && (
                        <g>
                          {/* 条带底 */}
                          <rect x={view.pad} y={view.H - 20} width={view.W - 2 * view.pad} height={8} rx={4} fill="#ffffff" opacity={0.07} />
                          {/* BSGS：baby 区覆盖带（0..m） */}
                          {(step.phase === 'baby' || step.phase === 'giant') && (
                            <rect
                              x={view.pad}
                              y={view.H - 20}
                              width={(Number(view.expX(mBaby)) - Number(view.pad)) * 1}
                              height={8}
                              rx={4}
                              fill="#a78bfa"
                              opacity={0.16}
                            />
                          )}
                          {/* BSGS baby：已入表的 [0..j] */}
                          {step.phase === 'baby' && step.viz.babyJ !== undefined && (
                            <rect x={view.pad} y={view.H - 20} width={Number(view.expX(step.viz.babyJ)) - Number(view.pad)} height={8} rx={4} fill="#a78bfa" opacity={0.5} />
                          )}
                          {/* BSGS giant：巨步 i 的幽灵落点 = x − i·m（读者视角） */}
                          {step.phase === 'giant' && step.viz.ghostExp !== undefined && step.viz.giantI !== undefined && (() => {
                            const gx = ((step.viz.ghostExp - step.viz.giantI * mBaby) % orderN + orderN) % orderN;
                            const pos = ringPosOfExp(gx);
                            return (
                              <g>
                                {/* 指数标尺上的幽灵位置 */}
                                <line x1={view.expX(gx)} x2={view.expX(gx)} y1={view.H - 26} y2={view.H - 8} stroke="#a78bfa" strokeWidth={2} opacity={0.9} />
                                {/* 环上的幽灵元素（紫色空心圈）：与当前琥珀点重合即命中 */}
                                {pos && (
                                  <circle cx={pos.x} cy={pos.y} r={9} fill="none" stroke="#a78bfa" strokeWidth={1.6} strokeDasharray="3 3" opacity={0.95} />
                                )}
                                <text x={Number(view.expX(gx))} y={view.H - 30} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#a78bfa">
                                  {gx}
                                </text>
                              </g>
                            );
                          })()}
                          {/* 暴力：线性推进的实心进度 */}
                          {step.phase === 'brute' && step.viz.k !== undefined && (
                            <>
                              <rect x={view.pad} y={view.H - 20} width={Number(view.expX(step.viz.k)) - Number(view.pad)} height={8} rx={4} fill="#3b82f6" opacity={0.45} />
                              <line x1={view.expX(step.viz.k)} x2={view.expX(step.viz.k)} y1={view.H - 26} y2={view.H - 8} stroke="#fbbf24" strokeWidth={2} />
                            </>
                          )}
                          {/* 答案刻度（读者视角，算法看不见）：始终显示 */}
                          {input.x !== undefined && (() => {
                            const px = view.expX(input.x);
                            return (
                              <g>
                                <line x1={px} x2={px} y1={view.H - 24} y2={view.H - 4} stroke="#fb7185" strokeWidth={1.2} strokeDasharray="2 3" opacity={0.9} />
                                <text x={px} y={view.H - 34} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#fb7185">
                                  x={input.x}
                                </text>
                              </g>
                            );
                          })()}
                          {/* 袋鼠：驯服袋鼠（绿三角）与野袋鼠幽灵（琥珀）在指数轴的位置 */}
                          {step.phase === 'kangaroo' && step.viz.tameExps && (
                            <g>
                              {step.viz.tameExps.map((e, i) => (
                                <g key={`te-${i}`}>
                                  <path
                                    d={`M${Number(view.expX(e)) - 4},${view.H - 8} L${Number(view.expX(e)) + 4},${view.H - 8} L${Number(view.expX(e))},${view.H - 16} Z`}
                                    fill="#34d399"
                                    opacity={step.viz?.hitTame === i ? 1 : 0.75}
                                  />
                                  {step.viz?.hitTame === i && (
                                    <circle cx={view.expX(e)} cy={view.H - 12} r={5} fill="none" stroke="#fbbf24" strokeWidth={1.5} />
                                  )}
                                </g>
                              ))}
                              {/* 野袋鼠的幽灵位置：x − wildDist（读者视角） */}
                              {step.viz.ghostExp !== undefined && step.viz.wildDist !== undefined && (() => {
                                const wx = ((step.viz.ghostExp - step.viz.wildDist) % orderN + orderN) % orderN;
                                return (
                                  <g>
                                    <line x1={view.expX(wx)} x2={view.expX(wx)} y1={view.H - 16} y2={view.H - 6} stroke="#fbbf24" strokeWidth={2} />
                                    <text x={Number(view.expX(wx))} y={view.H - 19} textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#fbbf24">
                                      野{wx}
                                    </text>
                                  </g>
                                );
                              })()}
                            </g>
                          )}
                        </g>
                      )}

                      {/* 当前元素 */}
                      {curPos && (
                        <g>
                          <circle
                            cx={curPos.x}
                            cy={curPos.y}
                            r={10}
                            fill="none"
                            stroke="#fbbf24"
                            strokeWidth={1}
                            opacity={0.6}
                            className="pulse-soft"
                          />
                          <circle cx={curPos.x} cy={curPos.y} r={4.5} fill="#fbbf24" />
                        </g>
                      )}
                    </svg>
                  </div>

                  <div className="flex shrink-0 flex-col justify-center gap-4 border-t border-white/[0.06] p-4 sm:w-[240px] sm:border-l sm:border-t-0">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">
                        {kind === 'modp' ? '目标 H = g^x' : '目标 H = xG'}
                      </div>
                      <p className="mt-1 break-all font-mono text-sm leading-relaxed text-rose-300">
                        {elText(H)}
                      </p>
                      <div className="mt-1 break-all font-mono text-[10px] text-zinc-500">
                        G = {elText(inst.G)}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">
                          {algo === 'kangaroo' ? '野袋鼠' : '当前元素'}
                        </span>
                        <span className="font-mono text-[9px] tabular-nums text-zinc-500">
                          第 {step.tried} 次
                        </span>
                      </div>
                      <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-amber-300">
                        {elText(step.current)}
                      </p>
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all duration-300"
                          style={{
                            width: `${Math.min(100, (step.tried / Math.max(1, inst.order)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">
                        result
                      </div>
                      <p className="mt-1 font-mono text-[11px] leading-relaxed">
                        {!done ? (
                          <span className="text-zinc-600">求解中…</span>
                        ) : result && result > 0 ? (
                          <span className="text-emerald-400">x = {result}</span>
                        ) : (
                          <span className="text-rose-400">未找到</span>
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
            <Section title="群 (GROUP)">
              <SegmentedControl
                value={kind}
                onChange={(v) => setKind(v as 'modp' | 'ec')}
                options={[
                  { value: 'modp', label: '乘法群' },
                  { value: 'ec', label: '椭圆曲线' },
                ]}
              />
              <p className="font-mono text-[10px] leading-relaxed text-zinc-500">
                {kind === 'modp'
                  ? '(Z/pZ)*：g^x ≡ h (mod p)，经典 DLP'
                  : 'E(F_p)：Q = xG，ECC 的安全性基础（ECDLP）'}
              </p>
            </Section>

            <Section title="实例 (INSTANCE)">
              <Field
                label="素数 (PRIME)"
                value={primeIdx}
                min={0}
                max={PRIMES.length - 1}
                step={1}
                onChange={setPrimeIdx}
                format={(v) => {
                  const prime = PRIMES[Math.round(v)];
                  const approxOrder = prime - 1;
                  return `p = ${prime} · 群阶 ${approxOrder} · 暴力 ${approxOrder.toLocaleString()} 步`;
                }}
              />
              <Field
                label="私钥 (SECRET x)"
                value={x}
                min={2}
                max={Math.max(2, inst.order - 1)}
                step={1}
                onChange={setSecret}
                format={(v) => `H = ${kind === 'modp' ? `g^${v}` : `${v}G`}`}
              />
              <button
                onClick={() => setSeed((s) => s + 1)}
                className="w-full border border-zinc-200 bg-zinc-50 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:border-blue-500/50 hover:bg-white hover:text-blue-600"
              >
                {kind === 'modp' ? '换一个生成元' : '换一条曲线'} (RESHUFFLE)
              </button>
            </Section>

            <Section title="算法 (ALGORITHM)">
              <SegmentedControl
                value={algo}
                onChange={(v) => setAlgo(v as 'brute' | 'bsgs' | 'kangaroo')}
                options={[
                  { value: 'brute', label: '暴力' },
                  { value: 'bsgs', label: 'BSGS' },
                  { value: 'kangaroo', label: '袋鼠' },
                ]}
              />
              <p className="font-mono text-[10px] leading-relaxed text-zinc-500">
                {algo === 'brute'
                  ? '暴力：逐个元素比对，O(n) 步'
                  : algo === 'bsgs'
                    ? 'BSGS：存 √n 张表再回跳，O(√n) 时间 / O(√n) 内存'
                    : '袋鼠：O(√n) 时间、O(1) 内存，靠两只袋鼠踩到同一格'}
              </p>
            </Section>

            <Section title="数据 (DATA)">
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">群阶</span>
                  <span className="tabular-nums text-zinc-800">{inst.n}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">G 的阶</span>
                  <span className="tabular-nums text-zinc-800">{inst.order}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">√阶</span>
                  <span className="tabular-nums text-zinc-800">{Math.ceil(Math.sqrt(inst.order))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">{algo === 'kangaroo' ? '驯服 / 野' : '模式'}</span>
                  <span className="tabular-nums text-zinc-800">
                    {algo === 'kangaroo' ? '8 / 1' : algo === 'bsgs' ? '表 √n' : '线性'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">计算耗时</span>
                  <span className="tabular-nums text-zinc-800">{solver.computeMs.toFixed(2)} ms</span>
                </div>
              </div>
            </Section>

            <Section title="说明 (NOTE)" defaultOpen={false}>
              <p className="font-mono text-[10px] leading-relaxed text-zinc-500">
                乘法群有 index calculus 这类亚指数算法，p 要 2048 位以上；
                椭圆曲线目前只有 O(√n) 的通用算法（BSGS / Pollard&apos;s rho），
                256 位就够——这就是 ECC 密钥更短的原因。
              </p>
            </Section>
          </ControlPanel>
        </div>
      </div>
    </main>
  );
}
