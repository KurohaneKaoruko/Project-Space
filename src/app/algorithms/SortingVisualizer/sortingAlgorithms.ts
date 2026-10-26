// 排序算法可视化：所有算法编译为统一的操作流（SortOp），由页面按速度回放。
// 这样回放器无需理解各算法内部结构，只负责应用操作并维护高亮状态。

export type FocusKind = 'pivot' | 'key' | 'min';

export type SortOp =
  | { t: 'compare'; i: number; j: number }        // 比较 a[i] 与 a[j]
  | { t: 'swap'; i: number; j: number }           // 交换两元素
  | { t: 'write'; i: number; value: number }      // 覆写单个槽位（移位/归并/写回）
  | { t: 'read'; i: number }                      // 读取元素（计数/桶/基数的分发阶段）
  | { t: 'mark'; i: number }                      // 标记该位置已就绪（最终位置）
  | { t: 'markRange'; lo: number; hi: number }    // 标记一段区间已就绪
  | { t: 'focus'; i: number; kind: FocusKind }    // 高亮枢轴/关键值/当前最小
  | { t: 'range'; lo: number; hi: number }        // 激活工作区间（lo=-1 表示清除）
  | { t: 'phase'; label: string };                // 阶段说明文字

export interface SortStats {
  comparisons: number;
  swaps: number;
  writes: number;
  reads: number;
}

export interface SortAlgorithmMeta {
  id: string;
  name: string;
  en: string;
  group: string;
  best: string;
  avg: string;
  worst: string;
  space: string;
  stable: boolean;
  idea: string;
  build: (a: number[]) => SortOp[];
}

// ---------- 操作辅助 ----------

function makeCtx(a: number[]) {
  const ops: SortOp[] = [];
  const cmp = (i: number, j: number) => {
    ops.push({ t: 'compare', i, j });
    return a[i] - a[j];
  };
  const swap = (i: number, j: number) => {
    [a[i], a[j]] = [a[j], a[i]];
    ops.push({ t: 'swap', i, j });
  };
  const write = (i: number, value: number) => {
    a[i] = value;
    ops.push({ t: 'write', i, value });
  };
  return { ops, cmp, swap, write };
}

function finalize(ops: SortOp[], n: number): SortOp[] {
  ops.push({ t: 'markRange', lo: 0, hi: n - 1 });
  ops.push({ t: 'phase', label: '排序完成' });
  return ops;
}

// ---------- 比较类排序 ----------

function buildBubble(a: number[]): SortOp[] {
  const { ops, cmp, swap } = makeCtx(a);
  const n = a.length;
  ops.push({ t: 'phase', label: '冒泡：相邻比较，大者右移' });
  for (let end = n - 1; end > 0; end--) {
    let swapped = false;
    for (let i = 0; i < end; i++) {
      if (cmp(i, i + 1) > 0) {
        swap(i, i + 1);
        swapped = true;
      }
    }
    ops.push({ t: 'mark', i: end });
    if (!swapped) {
      ops.push({ t: 'markRange', lo: 0, hi: end - 1 });
      return finalize(ops, n);
    }
  }
  return finalize(ops, n);
}

function buildCocktail(a: number[]): SortOp[] {
  const { ops, cmp, swap } = makeCtx(a);
  const n = a.length;
  let lo = 0;
  let hi = n - 1;
  ops.push({ t: 'phase', label: '鸡尾酒：双向冒泡' });
  while (lo < hi) {
    let swapped = false;
    for (let i = lo; i < hi; i++) {
      if (cmp(i, i + 1) > 0) {
        swap(i, i + 1);
        swapped = true;
      }
    }
    ops.push({ t: 'mark', i: hi });
    hi--;
    for (let i = hi; i > lo; i--) {
      if (cmp(i - 1, i) > 0) {
        swap(i - 1, i);
        swapped = true;
      }
    }
    ops.push({ t: 'mark', i: lo });
    lo++;
    if (!swapped) break;
  }
  return finalize(ops, n);
}

function buildGnome(a: number[]): SortOp[] {
  const { ops, cmp, swap } = makeCtx(a);
  const n = a.length;
  ops.push({ t: 'phase', label: '侏儒：逆序则回退一步' });
  let i = 0;
  while (i < n) {
    if (i === 0) {
      i++;
      continue;
    }
    if (cmp(i - 1, i) <= 0) {
      i++;
    } else {
      swap(i - 1, i);
      i--;
    }
  }
  return finalize(ops, n);
}

function buildComb(a: number[]): SortOp[] {
  const { ops, cmp, swap } = makeCtx(a);
  const n = a.length;
  let gap = n;
  const shrink = 1.3;
  let sorted = false;
  while (!sorted) {
    gap = Math.floor(gap / shrink);
    if (gap <= 1) {
      gap = 1;
      sorted = true;
    }
    ops.push({ t: 'phase', label: `梳排序：间隔 gap = ${gap}` });
    for (let i = 0; i + gap < n; i++) {
      if (cmp(i, i + gap) > 0) {
        swap(i, i + gap);
        sorted = false;
      }
    }
  }
  return finalize(ops, n);
}

function buildInsertion(a: number[]): SortOp[] {
  const { ops, write } = makeCtx(a);
  const n = a.length;
  ops.push({ t: 'phase', label: '插入：将 key 插入有序前缀' });
  for (let i = 1; i < n; i++) {
    const key = a[i];
    let gap = i;
    ops.push({ t: 'range', lo: 0, hi: i });
    ops.push({ t: 'focus', i, kind: 'key' });
    while (gap > 0) {
      ops.push({ t: 'compare', i: gap - 1, j: gap });
      if (a[gap - 1] <= key) break;
      write(gap, a[gap - 1]);
      gap--;
    }
    write(gap, key);
  }
  ops.push({ t: 'range', lo: -1, hi: -1 });
  return finalize(ops, n);
}

function buildShell(a: number[]): SortOp[] {
  const { ops, write } = makeCtx(a);
  const n = a.length;
  for (let gap = Math.floor(n / 2); gap > 0; gap = Math.floor(gap / 2)) {
    ops.push({ t: 'phase', label: `希尔：增量 gap = ${gap}` });
    for (let i = gap; i < n; i++) {
      const key = a[i];
      let g = i;
      ops.push({ t: 'focus', i, kind: 'key' });
      while (g >= gap) {
        ops.push({ t: 'compare', i: g - gap, j: g });
        if (a[g - gap] <= key) break;
        write(g, a[g - gap]);
        g -= gap;
      }
      write(g, key);
    }
  }
  return finalize(ops, n);
}

function buildSelection(a: number[]): SortOp[] {
  const { ops, cmp, swap } = makeCtx(a);
  const n = a.length;
  ops.push({ t: 'phase', label: '选择：每轮选出最小值放到队首' });
  for (let i = 0; i < n - 1; i++) {
    ops.push({ t: 'range', lo: i, hi: n - 1 });
    let min = i;
    ops.push({ t: 'focus', i: min, kind: 'min' });
    for (let j = i + 1; j < n; j++) {
      if (cmp(j, min) < 0) {
        min = j;
        ops.push({ t: 'focus', i: min, kind: 'min' });
      }
    }
    if (min !== i) swap(i, min);
    ops.push({ t: 'mark', i });
  }
  ops.push({ t: 'range', lo: -1, hi: -1 });
  return finalize(ops, n);
}

function buildQuick(a: number[]): SortOp[] {
  const { ops, swap } = makeCtx(a);
  const n = a.length;

  const partition = (lo: number, hi: number) => {
    ops.push({ t: 'focus', i: hi, kind: 'pivot' });
    const pivot = a[hi];
    let i = lo;
    for (let j = lo; j < hi; j++) {
      ops.push({ t: 'compare', i: j, j: hi });
      if (a[j] < pivot) {
        if (i !== j) swap(i, j);
        i++;
      }
    }
    if (i !== hi) swap(i, hi);
    return i;
  };

  ops.push({ t: 'phase', label: '快速：Lomuto 分区，尾元素为枢轴' });
  const stack: Array<[number, number]> = [[0, n - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop()!;
    if (lo > hi) continue;
    ops.push({ t: 'range', lo, hi });
    if (lo === hi) {
      ops.push({ t: 'mark', i: lo });
      continue;
    }
    const p = partition(lo, hi);
    ops.push({ t: 'mark', i: p });
    stack.push([lo, p - 1]);
    stack.push([p + 1, hi]);
  }
  ops.push({ t: 'range', lo: -1, hi: -1 });
  return finalize(ops, n);
}

function buildMerge(a: number[]): SortOp[] {
  const { ops, write } = makeCtx(a);
  const n = a.length;

  const mergeRange = (lo: number, mid: number, hi: number) => {
    ops.push({ t: 'range', lo, hi });
    const tmp: number[] = [];
    let i = lo;
    let j = mid + 1;
    while (i <= mid && j <= hi) {
      ops.push({ t: 'compare', i, j });
      tmp.push(a[i] <= a[j] ? a[i++] : a[j++]);
    }
    while (i <= mid) tmp.push(a[i++]);
    while (j <= hi) tmp.push(a[j++]);
    for (let k = 0; k < tmp.length; k++) write(lo + k, tmp[k]);
  };

  const sortRange = (lo: number, hi: number) => {
    if (lo >= hi) return;
    const mid = (lo + hi) >> 1;
    sortRange(lo, mid);
    sortRange(mid + 1, hi);
    mergeRange(lo, mid, hi);
  };

  ops.push({ t: 'phase', label: '归并：分治后自底向上合并' });
  sortRange(0, n - 1);
  ops.push({ t: 'range', lo: -1, hi: -1 });
  return finalize(ops, n);
}

function buildHeap(a: number[]): SortOp[] {
  const { ops, cmp, swap } = makeCtx(a);
  const n = a.length;

  const siftDown = (root: number, size: number) => {
    for (;;) {
      let largest = root;
      const l = 2 * root + 1;
      const r = 2 * root + 2;
      if (l < size) {
        ops.push({ t: 'compare', i: l, j: largest });
        if (a[l] > a[largest]) largest = l;
      }
      if (r < size) {
        ops.push({ t: 'compare', i: r, j: largest });
        if (a[r] > a[largest]) largest = r;
      }
      if (largest === root) break;
      swap(root, largest);
      root = largest;
    }
  };

  ops.push({ t: 'phase', label: '堆排序：建最大堆' });
  for (let i = (n >> 1) - 1; i >= 0; i--) siftDown(i, n);
  ops.push({ t: 'phase', label: '堆排序：逐个取出堆顶放到队尾' });
  for (let end = n - 1; end > 0; end--) {
    swap(0, end);
    ops.push({ t: 'mark', i: end });
    siftDown(0, end);
  }
  return finalize(ops, n);
}

// ---------- 分布类排序（非比较） ----------

function buildCounting(a: number[]): SortOp[] {
  const { ops, write } = makeCtx(a);
  const n = a.length;
  let min = a[0];
  let max = a[0];
  for (let i = 1; i < n; i++) {
    if (a[i] < min) min = a[i];
    if (a[i] > max) max = a[i];
  }
  const size = max - min + 1;
  const count = new Array<number>(size).fill(0);

  ops.push({ t: 'phase', label: `计数：统计频次（值域 ${min}–${max}）` });
  for (let i = 0; i < n; i++) {
    ops.push({ t: 'read', i });
    count[a[i] - min]++;
  }

  ops.push({ t: 'phase', label: '计数：前缀求和得到各值终止位置' });
  for (let k = 1; k < size; k++) count[k] += count[k - 1];

  ops.push({ t: 'phase', label: '计数：逆序遍历保证稳定性，写回输出' });
  const out = a.slice();
  for (let i = n - 1; i >= 0; i--) out[--count[a[i] - min]] = a[i];
  for (let i = 0; i < n; i++) write(i, out[i]);

  return finalize(ops, n);
}

function buildBucket(a: number[]): SortOp[] {
  const { ops, write } = makeCtx(a);
  const n = a.length;
  let min = a[0];
  let max = a[0];
  for (let i = 1; i < n; i++) {
    if (a[i] < min) min = a[i];
    if (a[i] > max) max = a[i];
  }
  const k = Math.max(2, Math.min(24, Math.round(n / 8)));
  const span = max - min + 1;
  const bucketOf = (v: number) => Math.min(k - 1, Math.floor(((v - min) / span) * k));

  const buckets: number[][] = Array.from({ length: k }, () => []);
  const origins: number[][] = Array.from({ length: k }, () => []);

  ops.push({ t: 'phase', label: `桶：按值域均分到 ${k} 个桶` });
  for (let i = 0; i < n; i++) {
    ops.push({ t: 'read', i });
    const b = bucketOf(a[i]);
    buckets[b].push(a[i]);
    origins[b].push(i);
  }

  ops.push({ t: 'phase', label: '桶：桶内插入排序' });
  for (let b = 0; b < k; b++) {
    const vals = buckets[b];
    const idxs = origins[b];
    for (let i = 1; i < vals.length; i++) {
      const key = vals[i];
      const keyOrigin = idxs[i];
      let g = i - 1;
      while (g >= 0) {
        // 高亮这两个元素在原数组中的槽位
        ops.push({ t: 'compare', i: idxs[g], j: keyOrigin });
        if (vals[g] <= key) break;
        vals[g + 1] = vals[g];
        idxs[g + 1] = idxs[g];
        g--;
      }
      vals[g + 1] = key;
      idxs[g + 1] = keyOrigin;
    }
  }

  ops.push({ t: 'phase', label: '桶：依序写回原数组' });
  let pos = 0;
  for (let b = 0; b < k; b++) {
    for (const v of buckets[b]) write(pos++, v);
  }

  return finalize(ops, n);
}

function buildRadix(a: number[]): SortOp[] {
  const { ops, write } = makeCtx(a);
  const n = a.length;
  let max = a[0];
  for (let i = 1; i < n; i++) if (a[i] > max) max = a[i];

  const digitName = (exp: number) => (exp === 1 ? '个位' : exp === 10 ? '十位' : '百位');

  ops.push({ t: 'phase', label: '基数：LSD 低位优先（基 10）' });
  for (let exp = 1; Math.floor(max / exp) > 0; exp *= 10) {
    const buckets: number[][] = Array.from({ length: 10 }, () => []);
    ops.push({ t: 'phase', label: `基数：按${digitName(exp)}分发` });
    for (let i = 0; i < n; i++) {
      ops.push({ t: 'read', i });
      buckets[Math.floor(a[i] / exp) % 10].push(a[i]);
    }
    ops.push({ t: 'phase', label: `基数：按${digitName(exp)}依序收集` });
    let pos = 0;
    for (const b of buckets) {
      for (const v of b) write(pos++, v);
    }
  }

  return finalize(ops, n);
}

// ---------- 元数据与导出 ----------

export const SORT_ALGORITHMS: SortAlgorithmMeta[] = [
  {
    id: 'bubble',
    name: '冒泡排序',
    en: 'Bubble Sort',
    group: '交换排序',
    best: 'O(n)',
    avg: 'O(n²)',
    worst: 'O(n²)',
    space: 'O(1)',
    stable: true,
    idea: '反复扫描相邻元素，逆序则交换；每轮把未排序部分的最大值“冒泡”到末端。',
    build: buildBubble,
  },
  {
    id: 'cocktail',
    name: '鸡尾酒排序',
    en: 'Cocktail Shaker Sort',
    group: '交换排序',
    best: 'O(n)',
    avg: 'O(n²)',
    worst: 'O(n²)',
    space: 'O(1)',
    stable: true,
    idea: '冒泡排序的双向版本：先正向把最大值推到尾部，再反向把最小值推到头部。',
    build: buildCocktail,
  },
  {
    id: 'gnome',
    name: '侏儒排序',
    en: 'Gnome Sort',
    group: '交换排序',
    best: 'O(n)',
    avg: 'O(n²)',
    worst: 'O(n²)',
    space: 'O(1)',
    stable: true,
    idea: '像园丁摆花盆：当前元素比前一个小就交换并回退一格，否则前进一格。',
    build: buildGnome,
  },
  {
    id: 'comb',
    name: '梳排序',
    en: 'Comb Sort',
    group: '交换排序',
    best: 'O(n log n)',
    avg: 'O(n² / 2^p)',
    worst: 'O(n²)',
    space: 'O(1)',
    stable: false,
    idea: '冒泡的改进：用按 1.3 递减的大间隔先快速消除“乌龟”（小值沉底慢的问题），最后 gap=1 退化为冒泡。',
    build: buildComb,
  },
  {
    id: 'insertion',
    name: '插入排序',
    en: 'Insertion Sort',
    group: '插入排序',
    best: 'O(n)',
    avg: 'O(n²)',
    worst: 'O(n²)',
    space: 'O(1)',
    stable: true,
    idea: '像整理扑克牌：逐个取出元素，在已排序前缀中从右向左移位腾出位置插入。',
    build: buildInsertion,
  },
  {
    id: 'shell',
    name: '希尔排序',
    en: 'Shell Sort',
    group: '插入排序',
    best: 'O(n log n)',
    avg: '约 O(n^1.3)，随增量序列变化',
    worst: 'O(n²)（取决于增量）',
    space: 'O(1)',
    stable: false,
    idea: '插入排序的推广：先按较大间隔做跨距插入使数组“基本有序”，间隔逐轮减半直到 1。',
    build: buildShell,
  },
  {
    id: 'selection',
    name: '选择排序',
    en: 'Selection Sort',
    group: '选择排序',
    best: 'O(n²)',
    avg: 'O(n²)',
    worst: 'O(n²)',
    space: 'O(1)',
    stable: false,
    idea: '每轮从未排序区间选出最小值，与区间开头交换；交换次数最少（至多 n-1 次）。',
    build: buildSelection,
  },
  {
    id: 'quick',
    name: '快速排序',
    en: 'Quick Sort',
    group: '交换排序',
    best: 'O(n log n)',
    avg: 'O(n log n)',
    worst: 'O(n²)（枢轴选得差时）',
    space: 'O(log n)',
    stable: false,
    idea: '选一个枢轴把数组分成“小于/大于”两半（Lomuto 分区），递归处理两侧。实践中最快的通用排序之一。',
    build: buildQuick,
  },
  {
    id: 'merge',
    name: '归并排序',
    en: 'Merge Sort',
    group: '归并排序',
    best: 'O(n log n)',
    avg: 'O(n log n)',
    worst: 'O(n log n)',
    space: 'O(n)',
    stable: true,
    idea: '分治：递归二分到单元素，再把两个有序子数组按序合并；性能稳定但需要额外空间。',
    build: buildMerge,
  },
  {
    id: 'heap',
    name: '堆排序',
    en: 'Heap Sort',
    group: '选择排序',
    best: 'O(n log n)',
    avg: 'O(n log n)',
    worst: 'O(n log n)',
    space: 'O(1)',
    stable: false,
    idea: '原地建最大堆后反复取堆顶换到末尾并下沉修复；最坏情况也保持 O(n log n)。',
    build: buildHeap,
  },
  {
    id: 'counting',
    name: '计数排序',
    en: 'Counting Sort',
    group: '分布排序',
    best: 'O(n + k)',
    avg: 'O(n + k)',
    worst: 'O(n + k)',
    space: 'O(k)',
    stable: true,
    idea: '不做任何比较：统计每个值出现次数，前缀求和得到位置后按稳定性写回。适合小整数域。',
    build: buildCounting,
  },
  {
    id: 'bucket',
    name: '桶排序',
    en: 'Bucket Sort',
    group: '分布排序',
    best: 'O(n + k)',
    avg: 'O(n + k)（均匀分布时）',
    worst: 'O(n²)（全部落入一桶）',
    space: 'O(n + k)',
    stable: true,
    idea: '把值域均分成 k 个桶按范围分发，桶内再插入排序，最后依桶序拼接。数据越均匀越快。',
    build: buildBucket,
  },
  {
    id: 'radix',
    name: '基数排序',
    en: 'Radix Sort (LSD)',
    group: '分布排序',
    best: 'O(d·(n + k))',
    avg: 'O(d·(n + k))',
    worst: 'O(d·(n + k))',
    space: 'O(n + k)',
    stable: true,
    idea: '从最低位到最高位逐位做一次稳定“分发-收集”，d 轮之后自然有序，全程无比较。',
    build: buildRadix,
  },
];

export function getSortAlgorithm(id: string): SortAlgorithmMeta {
  return SORT_ALGORITHMS.find((m) => m.id === id) ?? SORT_ALGORITHMS[0];
}

// ---------- 回放器（纯逻辑状态机） ----------

export type Highlight =
  | { kind: 'compare' | 'swap'; i: number; j: number }
  | { kind: 'write'; i: number }
  | { kind: 'read'; i: number }
  | null;

export interface SortPlayerState {
  initial: number[];
  arr: number[];
  ops: SortOp[];
  cursor: number;
  sorted: boolean[];
  highlight: Highlight;
  focus: { i: number; kind: FocusKind } | null;
  range: [number, number] | null;
  phase: string;
  stats: SortStats;
  finished: boolean;
}

export function createPlayer(data: number[], algoId: string): SortPlayerState {
  const meta = getSortAlgorithm(algoId);
  const ops = meta.build(data.slice());
  return {
    initial: data.slice(),
    arr: data.slice(),
    ops,
    cursor: 0,
    sorted: new Array(data.length).fill(false),
    highlight: null,
    focus: null,
    range: null,
    phase: '就绪',
    stats: { comparisons: 0, swaps: 0, writes: 0, reads: 0 },
    finished: ops.length === 0,
  };
}

function applyOp(s: SortPlayerState, op: SortOp): void {
  switch (op.t) {
    case 'compare':
      s.highlight = { kind: 'compare', i: op.i, j: op.j };
      s.stats.comparisons++;
      break;
    case 'swap':
      [s.arr[op.i], s.arr[op.j]] = [s.arr[op.j], s.arr[op.i]];
      s.highlight = { kind: 'swap', i: op.i, j: op.j };
      s.stats.swaps++;
      break;
    case 'write':
      s.arr[op.i] = op.value;
      s.highlight = { kind: 'write', i: op.i };
      s.stats.writes++;
      break;
    case 'read':
      s.highlight = { kind: 'read', i: op.i };
      s.stats.reads++;
      break;
    case 'mark':
      s.sorted[op.i] = true;
      s.highlight = null;
      s.focus = null;
      break;
    case 'markRange':
      for (let i = op.lo; i <= op.hi; i++) s.sorted[i] = true;
      s.highlight = null;
      s.focus = null;
      break;
    case 'focus':
      s.focus = { i: op.i, kind: op.kind };
      s.highlight = null;
      break;
    case 'range':
      s.range = op.lo < 0 ? null : [op.lo, op.hi];
      s.highlight = null;
      break;
    case 'phase':
      s.phase = op.label;
      s.highlight = null;
      break;
  }
}

export function stepPlayer(s: SortPlayerState, count = 1): void {
  const end = Math.min(s.ops.length, s.cursor + Math.max(0, Math.floor(count)));
  while (s.cursor < end) {
    applyOp(s, s.ops[s.cursor]);
    s.cursor++;
  }
  if (s.cursor >= s.ops.length) s.finished = true;
}

export function resetPlayer(s: SortPlayerState): void {
  s.arr = s.initial.slice();
  s.cursor = 0;
  s.sorted = new Array(s.arr.length).fill(false);
  s.highlight = null;
  s.focus = null;
  s.range = null;
  s.phase = '就绪';
  s.stats = { comparisons: 0, swaps: 0, writes: 0, reads: 0 };
  s.finished = s.ops.length === 0;
}

// ---------- 数据分布 ----------

export type Distribution = 'random' | 'nearlySorted' | 'reversed' | 'fewUnique';

export const DISTRIBUTIONS: Array<{ id: Distribution; label: string }> = [
  { id: 'random', label: '随机' },
  { id: 'nearlySorted', label: '近乎有序' },
  { id: 'reversed', label: '逆序' },
  { id: 'fewUnique', label: '少量重复' },
];

export function generateData(distribution: Distribution, n: number): number[] {
  const maxV = 100;
  const minV = 5;
  switch (distribution) {
    case 'reversed': {
      const arr: number[] = [];
      for (let i = 0; i < n; i++) {
        arr.push(Math.round(maxV - ((maxV - minV) * i) / Math.max(1, n - 1)));
      }
      return arr;
    }
    case 'nearlySorted': {
      const arr: number[] = [];
      for (let i = 0; i < n; i++) {
        arr.push(Math.round(minV + ((maxV - minV) * i) / Math.max(1, n - 1)));
      }
      const swaps = Math.max(2, Math.round(n / 12));
      for (let s = 0; s < swaps; s++) {
        const i = Math.floor(Math.random() * n);
        const j = Math.min(n - 1, i + 1 + Math.floor(Math.random() * 3));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
    case 'fewUnique': {
      const levels = [12, 30, 50, 68, 86, 100];
      return Array.from({ length: n }, () => levels[Math.floor(Math.random() * levels.length)]);
    }
    case 'random':
    default:
      return Array.from({ length: n }, () => minV + Math.floor(Math.random() * (maxV - minV + 1)));
  }
}
