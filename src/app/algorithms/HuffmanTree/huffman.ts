/**
 * 哈夫曼编码：频率统计 → 小根堆建树 → 前缀码分配 → 二叉树布局。
 */
export interface HNode {
  id: number;
  freq: number;
  ch: string | null; // 叶子字符
  left: HNode | null;
  right: HNode | null;
  depth: number;
  x: number; // 布局列
  code: string;
}

export interface HuffmanEntry {
  ch: string;
  freq: number;
  code: string;
  bits: number;
}

export interface HuffmanResult {
  root: HNode | null;
  table: HuffmanEntry[];
  totalChars: number;
  uniqueChars: number;
  bitsHuffman: number;
  bitsFixed: number;
  fixedBitsPerChar: number; // 定长编码每字符位数
}

export function buildHuffman(text: string): HuffmanResult {
  if (text.length === 0) {
    return { root: null, table: [], totalChars: 0, uniqueChars: 0, bitsHuffman: 0, bitsFixed: 0, fixedBitsPerChar: 0 };
  }

  const freqs = new Map<string, number>();
  for (const ch of text) freqs.set(ch, (freqs.get(ch) ?? 0) + 1);

  let id = 0;
  const leaves = new Map<string, HNode>();
  const heap: HNode[] = [];
  for (const [ch, f] of freqs) {
    const node: HNode = { id: id++, freq: f, ch, left: null, right: null, depth: 0, x: 0, code: '' };
    leaves.set(ch, node);
    heap.push(node);
  }
  heap.sort((a, b) => a.freq - b.freq || (a.ch ?? '').localeCompare(b.ch ?? ''));

  // 小根堆两两合并（数组 + 每次取最小，n 小无需真堆）
  while (heap.length > 1) {
    const a = heap.shift()!;
    const b = heap.shift()!;
    const parent: HNode = {
      id: id++,
      freq: a.freq + b.freq,
      ch: null,
      left: a,
      right: b,
      depth: 0,
      x: 0,
      code: '',
    };
    // 插入保持有序
    let lo = 0;
    let hi = heap.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (heap[mid].freq < parent.freq) lo = mid + 1;
      else hi = mid;
    }
    heap.splice(lo, 0, parent);
  }
  const root = heap[0] ?? null;

  // BFS 分配 code + depth
  const table: HuffmanEntry[] = [];
  if (root) {
    root.code = '';
    const queue: HNode[] = [root];
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (node.left) {
        node.left.code = `${node.code}0`;
        queue.push(node.left);
      }
      if (node.right) {
        node.right.code = `${node.code}1`;
        queue.push(node.right);
      }
      if (node.ch !== null) {
        table.push({ ch: node.ch, freq: node.freq, code: node.code, bits: node.freq * node.code.length });
      }
    }
    table.sort((a, b) => b.freq - a.freq || a.ch.localeCompare(b.ch));
  }

  const totalChars = text.length;
  const uniqueChars = freqs.size;
  // 单字符特例：码树只有根（叶），code 为空串；约定给 '0'，每字符 1 bit
  if (uniqueChars === 1 && table.length === 1 && table[0].code === '') {
    table[0].code = '0';
    table[0].bits = table[0].freq;
  }
  const bitsHuffman = table.reduce((s, e) => s + e.bits, 0);
  // 定长编码：⌈log2(unique)⌉ 位
  const fixedBitsPerChar = Math.max(1, Math.ceil(Math.log2(Math.max(2, uniqueChars))));
  const bitsFixed = totalChars * fixedBitsPerChar;

  return { root, table, totalChars, uniqueChars, bitsHuffman, bitsFixed, fixedBitsPerChar };
}

/**
 * 树布局：中序遍历分配叶子列，父节点居中；返回节点 + 边列表（含坐标），供 SVG 渲染。
 */
export interface LayoutNode {
  node: HNode;
  x: number;
  y: number;
}

export interface LayoutEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  bit: '0' | '1';
}

export function layoutTree(root: HNode | null, colGap = 34, rowGap = 74): { nodes: LayoutNode[]; edges: LayoutEdge[]; width: number; height: number } {
  if (!root) return { nodes: [], edges: [], width: 0, height: 0 };
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  let col = 0;
  let maxDepth = 0;
  // 阶段一：后序布局——叶子按中序分配列号，父节点取子节点中点
  const assign = (n: HNode, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    if (!n.left && !n.right) {
      n.x = col++;
      return n.x;
    }
    let cx: number;
    if (n.left && n.right) {
      const lx = assign(n.left, depth + 1);
      const rx = assign(n.right, depth + 1);
      cx = (lx + rx) / 2;
    } else {
      cx = assign((n.left ?? n.right)!, depth + 1);
    }
    n.x = cx;
    return cx;
  };
  assign(root, 0);
  // 阶段二：收集节点与边坐标
  const collect = (n: HNode, depth: number) => {
    nodes.push({ node: n, x: n.x * colGap, y: depth * rowGap });
    if (n.left) {
      edges.push({ x1: n.x * colGap, y1: depth * rowGap, x2: n.left.x * colGap, y2: (depth + 1) * rowGap, bit: '0' });
      collect(n.left, depth + 1);
    }
    if (n.right) {
      edges.push({ x1: n.x * colGap, y1: depth * rowGap, x2: n.right.x * colGap, y2: (depth + 1) * rowGap, bit: '1' });
      collect(n.right, depth + 1);
    }
  };
  collect(root, 0);
  return {
    nodes,
    edges,
    width: Math.max(1, (col - 1) * colGap),
    height: maxDepth * rowGap,
  };
}

/** 编码整段文本为 0/1 串 */
export function encodeText(text: string, table: HuffmanEntry[]): string {
  const map = new Map(table.map((e) => [e.ch, e.code]));
  let out = '';
  for (const ch of text) out += map.get(ch) ?? '';
  return out;
}
