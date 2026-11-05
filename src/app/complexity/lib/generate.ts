/** 参数化实例生成：所有随机都走同一个种子，改参数即可重新采样 */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rnd: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 随机 DAG：先随机排列定拓扑序，再只在「前→后」方向上加边，保证无环 */
export function randomDag(n: number, density: number, seed: number) {
  const rnd = mulberry32(seed);
  const order = shuffle(
    Array.from({ length: n }, (_, i) => i),
    rnd,
  );
  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (rnd() < density) edges.push([order[i], order[j]]);
    }
  }
  return { n, edges };
}

export interface Cnf {
  nVars: number;
  clauses: number[][];
}

/** 随机 CNF：每个子句取 width 个互不相同的变量，符号随机 */
export function randomCnf(nVars: number, nClauses: number, width: number, seed: number): Cnf {
  const rnd = mulberry32(seed);
  const clauses: number[][] = [];
  for (let c = 0; c < nClauses; c++) {
    const picked = shuffle(
      Array.from({ length: nVars }, (_, i) => i + 1),
      rnd,
    ).slice(0, Math.min(width, nVars));
    clauses.push(picked.map((v) => (rnd() < 0.5 ? -v : v)));
  }
  return { nVars, clauses };
}

/** 随机无向图 */
export function randomGraph(n: number, density: number, seed: number): [number, number][] {
  const rnd = mulberry32(seed);
  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (rnd() < density) edges.push([i, j]);
    }
  }
  return edges;
}

/**
 * 随机点集：spread ∈ [0,1]，0 = 聚成几簇，1 = 均匀散布整个画布。
 * 坐标范围固定 0..120（相对值），渲染端按数据域 0..120 投影。
 */
export function randomPoints(n: number, spread: number, seed: number): [number, number][] {
  const rnd = mulberry32(seed);
  const points: [number, number][] = [];
  const clusters = spread < 0.5 ? 3 : 1;
  const centers = Array.from({ length: clusters }, () => [30 + rnd() * 60, 30 + rnd() * 60]);
  for (let i = 0; i < n; i++) {
    const [cx, cy] = centers[i % clusters];
    // spread=0：半径 6 的紧密簇；spread=1：完全均匀铺满 0..120
    if (spread > 0.92) {
      points.push([rnd() * 120, rnd() * 120]);
    } else {
      const r = 6 + spread * 50;
      // 越界用镜像反射（136 → 104）而非 clamp：截断会把所有越界点堆在边界上，
      // n=1024 时约 15% 的点坐标完全相同，视觉上变成一条实线
      const reflect = (v: number) => (v < 0 ? -v : v > 120 ? 240 - v : v);
      points.push([
        reflect(cx + (rnd() - 0.5) * 2 * r),
        reflect(cy + (rnd() - 0.5) * 2 * r),
      ]);
    }
  }
  return points;
}

const isPrime = (n: number): boolean => {
  if (n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let d = 3; d * d <= n; d += 2) if (n % d === 0) return false;
  return true;
};

/** 随机合数，保证有 digits 位 */
export function randomComposite(digits: number, seed: number): number {
  const rnd = mulberry32(seed);
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  let n = Math.floor(min + rnd() * (max - min));
  let guard = 0;
  while (isPrime(n) && guard++ < 10000) n += 1;
  return Math.min(n, max);
}

