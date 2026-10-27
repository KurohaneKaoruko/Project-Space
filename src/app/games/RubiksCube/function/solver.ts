/**
 * 魔方求解器 —— 分层还原（Layer by Layer）
 *
 * 七个阶段，每阶段用不同的搜索策略，全部保证「确定性」：
 *   1. 底面十字      BFS 全状态表（190080 种状态，最优解）
 *   2. 底角归位      短序列穷举（≤4 步，保证覆盖全部情形）
 *   3. 中层棱块      标准插入算法 + U 对齐穷举
 *   4. 顶面十字      宏动作 BFS（8 种棱朝向状态）
 *   5. 顶面定向      宏动作 BFS（27 种角朝向状态）
 *   6. 顶层角块      宏动作 BFS（24 种角置换状态）
 *   7. 顶层棱块      宏动作 BFS（24 种棱置换状态）
 *
 * 后四个阶段把「标准公式」当作宏动作，在很小的状态空间里做 BFS，
 * 因此不依赖人工枚举 OLL/PLL 的 57 + 21 种情况，也不会陷入死循环。
 */

import {
  applyMove,
  applyMoves,
  FACE_LIST,
  FACE_NORMAL,
  faceOfVec,
  findPiece,
  invertMove,
  invertMoves,
  isCubieSolved,
  isSolved,
  MOVE_LIST,
  mulVec,
  parseMove,
  simplifyMoves,
  sameVec,
  stickerFace,
  type Cubie,
  type Face,
  type Mat3,
  type Move,
  type Vec3,
} from './cubeEngine';

const BOTTOM: Face = 'D';
const TOP: Face = 'U';

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------

interface EdgeSlot {
  coord: Vec3;
  f1: Face;
  f2: Face;
}

/** 12 个棱位。f1 / f2 为该位置两个贴纸所在的面，顺序固定用于朝向编码 */
const EDGE_SLOTS: EdgeSlot[] = [
  { coord: [1, -1, 0], f1: 'U', f2: 'R' }, // 0 UR
  { coord: [0, -1, 1], f1: 'U', f2: 'F' }, // 1 UF
  { coord: [-1, -1, 0], f1: 'U', f2: 'L' }, // 2 UL
  { coord: [0, -1, -1], f1: 'U', f2: 'B' }, // 3 UB
  { coord: [1, 1, 0], f1: 'D', f2: 'R' }, // 4 DR
  { coord: [0, 1, 1], f1: 'D', f2: 'F' }, // 5 DF
  { coord: [-1, 1, 0], f1: 'D', f2: 'L' }, // 6 DL
  { coord: [0, 1, -1], f1: 'D', f2: 'B' }, // 7 DB
  { coord: [1, 0, 1], f1: 'F', f2: 'R' }, // 8 FR
  { coord: [-1, 0, 1], f1: 'F', f2: 'L' }, // 9 FL
  { coord: [-1, 0, -1], f1: 'B', f2: 'L' }, // 10 BL
  { coord: [1, 0, -1], f1: 'B', f2: 'R' }, // 11 BR
];

function cubieAt(cubies: Cubie[], pos: Vec3): Cubie {
  const found = cubies.find((c) => sameVec(c.pos, pos));
  if (!found) throw new Error('no cubie at position');
  return found;
}

function edgeSlotIndex(pos: Vec3): number {
  const idx = EDGE_SLOTS.findIndex((s) => sameVec(s.coord, pos));
  if (idx < 0) throw new Error('not an edge slot');
  return idx;
}

/** 棱块朝向编码：0 表示底面颜色贴在 f1 面（U/D 面），1 表示贴在 f2 面 */
function edgeCodeOf(cubie: Cubie): number {
  const posIdx = edgeSlotIndex(cubie.pos);
  const localFace = FACE_LIST.find((f) => cubie.colors[f] === BOTTOM);
  if (!localFace) throw new Error('not a bottom edge');
  const worldFace = faceOfVec(mulVec(cubie.rot, FACE_NORMAL[localFace]));
  return posIdx * 2 + (worldFace === EDGE_SLOTS[posIdx].f1 ? 0 : 1);
}

const FACE_MAP: Record<Face, Record<Face, Face>> = (() => {
  const map = {} as Record<Face, Record<Face, Face>>;
  for (const face of FACE_LIST) {
    const inner = {} as Record<Face, Face>;
    for (const target of FACE_LIST) {
      // 该面顺时针 90° 时，贴在 target 面上的贴纸会转到哪一面
      const rotated = mulVec(turnMatrixOf(face, 1), FACE_NORMAL[target]);
      inner[target] = faceOfVec(rotated);
    }
    map[face] = inner;
  }
  return map;
})();

function turnMatrixOf(face: Face, turns: number): Mat3 {
  const base: Record<Face, Mat3> = {
    U: [0, 0, -1, 0, 1, 0, 1, 0, 0],
    D: [0, 0, 1, 0, 1, 0, -1, 0, 0],
    R: [1, 0, 0, 0, 0, -1, 0, 1, 0],
    L: [1, 0, 0, 0, 0, 1, 0, -1, 0],
    F: [0, -1, 0, 1, 0, 0, 0, 0, 1],
    B: [0, 1, 0, -1, 0, 0, 0, 0, 1],
  };
  let out: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const t = ((turns % 4) + 4) % 4;
  for (let i = 0; i < t; i += 1) {
    const a = out;
    const b = base[face];
    out = [
      a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
      a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
      a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
      a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
      a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
      a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
      a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
      a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
      a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
    ];
  }
  return out;
}

// ---------------------------------------------------------------------------
// 阶段 1：底面十字（全状态 BFS 查表）
// ---------------------------------------------------------------------------

const CROSS_PIECES: Face[][] = [
  ['D', 'F'],
  ['D', 'R'],
  ['D', 'B'],
  ['D', 'L'],
];

const CROSS_STATE_SIZE = 24 ** 4;

interface CrossTable {
  dist: Uint8Array;
  edgeMove: Uint8Array;
  ms: number;
}

let crossTableCache: CrossTable | null = null;

function buildCrossTable(): CrossTable {
  const started = Date.now();
  const edgeMove = new Uint8Array(24 * 18);
  for (let pos = 0; pos < 12; pos += 1) {
    for (let ori = 0; ori < 2; ori += 1) {
      for (let m = 0; m < 18; m += 1) {
        const face = MOVE_LIST[m][0] as Face;
        const { turns } = parseMove(MOVE_LIST[m]);
        let nextPos = pos;
        let nextOri = ori;
        const slot = EDGE_SLOTS[pos];
        if (isOnFace(slot.coord, face)) {
          const rotated = mulVec(turnMatrixOf(face, turns), slot.coord);
          nextPos = edgeSlotIndex(rotated);
          let sticker = ori === 0 ? slot.f1 : slot.f2;
          for (let k = 0; k < turns; k += 1) sticker = FACE_MAP[face][sticker];
          nextOri = sticker === EDGE_SLOTS[nextPos].f1 ? 0 : 1;
        }
        edgeMove[(pos * 2 + ori) * 18 + m] = nextPos * 2 + nextOri;
      }
    }
  }

  const dist = new Uint8Array(CROSS_STATE_SIZE).fill(255);
  const queue = new Int32Array(200000);
  const start = [5, 4, 7, 6].map((pos) => pos * 2); // 各自归位且朝向正确
  const startIdx = start[0] * 13824 + start[1] * 576 + start[2] * 24 + start[3];
  dist[startIdx] = 0;
  let head = 0;
  let tail = 1;
  queue[0] = startIdx;

  while (head < tail) {
    const idx = queue[head];
    head += 1;
    const d = dist[idx] + 1;
    const e0 = (idx / 13824) | 0;
    const r0 = idx - e0 * 13824;
    const e1 = (r0 / 576) | 0;
    const r1 = r0 - e1 * 576;
    const e2 = (r1 / 24) | 0;
    const e3 = r1 - e2 * 24;
    for (let m = 0; m < 18; m += 1) {
      const n0 = edgeMove[e0 * 18 + m];
      const n1 = edgeMove[e1 * 18 + m];
      const n2 = edgeMove[e2 * 18 + m];
      const n3 = edgeMove[e3 * 18 + m];
      const nIdx = n0 * 13824 + n1 * 576 + n2 * 24 + n3;
      if (dist[nIdx] === 255) {
        dist[nIdx] = d;
        queue[tail] = nIdx;
        tail += 1;
      }
    }
  }

  const table: CrossTable = { dist, edgeMove, ms: Date.now() - started };
  crossTableCache = table;
  return table;
}

function isOnFace(pos: Vec3, face: Face): boolean {
  const n = FACE_NORMAL[face];
  return pos[0] * n[0] + pos[1] * n[1] + pos[2] * n[2] === 1;
}

/** 预热十字查找表，返回构建耗时（毫秒） */
export function warmUpSolver(): number {
  if (crossTableCache) return crossTableCache.ms;
  return buildCrossTable().ms;
}

export function getCrossTableSize(): number {
  return crossTableCache ? crossTableCache.dist.length : 0;
}

export function solveCross(cubies: Cubie[]): Move[] | null {
  const table = crossTableCache ?? buildCrossTable();
  const codes = CROSS_PIECES.map((colors) => edgeCodeOf(findPiece(cubies, colors)));
  let idx = codes[0] * 13824 + codes[1] * 576 + codes[2] * 24 + codes[3];
  if (table.dist[idx] === 255) return null;
  const moves: Move[] = [];
  let guard = 0;
  while (table.dist[idx] > 0) {
    guard += 1;
    if (guard > 30) return null;
    let advanced = false;
    for (let m = 0; m < 18; m += 1) {
      const n0 = table.edgeMove[codes[0] * 18 + m];
      const n1 = table.edgeMove[codes[1] * 18 + m];
      const n2 = table.edgeMove[codes[2] * 18 + m];
      const n3 = table.edgeMove[codes[3] * 18 + m];
      const nIdx = n0 * 13824 + n1 * 576 + n2 * 24 + n3;
      if (table.dist[nIdx] === table.dist[idx] - 1) {
        moves.push(MOVE_LIST[m]);
        codes[0] = n0;
        codes[1] = n1;
        codes[2] = n2;
        codes[3] = n3;
        idx = nIdx;
        advanced = true;
        break;
      }
    }
    if (!advanced) return null;
  }
  return moves;
}

// ---------------------------------------------------------------------------
// 阶段 2：底角归位（短序列穷举）
// ---------------------------------------------------------------------------

interface CornerSlot {
  colors: Face[];
  home: Vec3;
  a: Face;
  b: Face;
}

const BOTTOM_CORNERS: CornerSlot[] = [
  { colors: ['D', 'F', 'R'], home: [1, 1, 1], a: 'R', b: 'F' },
  { colors: ['D', 'F', 'L'], home: [-1, 1, 1], a: 'L', b: 'F' },
  { colors: ['D', 'B', 'L'], home: [-1, 1, -1], a: 'L', b: 'B' },
  { colors: ['D', 'B', 'R'], home: [1, 1, -1], a: 'R', b: 'B' },
];

/** 某面与某面组合出的三层转动字母表 */
function alphabetFor(...faces: Face[]): Move[] {
  return faces.flatMap((f) => [f, `${f}'`, `${f}2`] as Move[]);
}

interface ShortSeq {
  moves: Move[];
}

/** 生成不超过 maxLen 步、且不出现相邻同面的序列（按长度升序） */
const shortSeqCache = new Map<string, ShortSeq[]>();

function shortSequences(alphabet: Move[], maxLen: number): ShortSeq[] {
  const cacheKey = `${alphabet.join(',')}|${maxLen}`;
  const cached = shortSeqCache.get(cacheKey);
  if (cached) return cached;
  const result: ShortSeq[] = [{ moves: [] }];
  let frontier: Move[][] = [[]];
  for (let len = 1; len <= maxLen; len += 1) {
    const next: Move[][] = [];
    for (const prefix of frontier) {
      const lastFace = prefix.length ? (prefix[prefix.length - 1][0] as Face) : null;
      for (const move of alphabet) {
        if (lastFace && move[0] === lastFace) continue;
        const seq = [...prefix, move];
        next.push(seq);
        result.push({ moves: seq });
      }
    }
    frontier = next;
  }
  shortSeqCache.set(cacheKey, result);
  return result;
}

function pieceSolvedAfter(cubies: Cubie[], colors: Face[], seq: Move[]): boolean {
  const after = applyMoves(cubies, seq);
  return isCubieSolved(findPiece(after, colors));
}

/** 目标块 + 所有已完成的块都必须保持归位 */
function seqAchieves(cubies: Cubie[], targets: Face[][], seq: Move[]): boolean {
  const after = applyMoves(cubies, seq);
  return targets.every((colors) => isCubieSolved(findPiece(after, colors)));
}

/** 底角插入的 6 条基本公式（两个相邻面 × 三种朝向），外加 4 种 U 对齐 */
function cornerInsertions(a: Face, b: Face): Move[][] {
  const sides: [Move, Move][] = [
    [a, `${a}'`],
    [`${a}'`, a],
    [b, `${b}'`],
    [`${b}'`, b],
  ];
  const patterns: Move[][] = [];
  for (const [outward, back] of sides) {
    for (const u of ['U', "U'", 'U2'] as Move[]) patterns.push([outward, u, back]);
  }
  return U_ALIGNS.flatMap((align) => patterns.map((p) => align.concat(p)));
}

/** 单个块的完整状态签名：位置 + 每张贴纸朝向 */
function pieceSignature(cube: Cubie[], colors: Face[]): string {
  const p = findPiece(cube, colors);
  const faces = FACE_LIST.map((f) => (p.colors[f] ? stickerFace(p, p.colors[f]!) : '-')).join('');
  return `${p.pos.join(',')}|${faces}`;
}

/**
 * 针对单个块的 BFS。
 * 状态空间只有「位置 × 朝向」几十种，因此可以让搜索自由组合多条公式，
 * 而不是靠人工枚举「这个朝向该用哪条公式」。
 */
function pieceBfs(
  start: Cubie[],
  colors: Face[],
  macros: Move[][],
  mustKeep: Face[][],
  maxDepth: number,
): Move[] | null {
  const goal = (cube: Cubie[]) => isCubieSolved(findPiece(cube, colors));
  const keeps = (cube: Cubie[]) => mustKeep.every((t) => isCubieSolved(findPiece(cube, t)));
  if (goal(start)) return [];
  const visited = new Set<string>([pieceSignature(start, colors)]);
  let frontier: { cube: Cubie[]; path: Move[] }[] = [{ cube: start, path: [] }];
  for (let depth = 0; depth < maxDepth; depth += 1) {
    const next: { cube: Cubie[]; path: Move[] }[] = [];
    for (const node of frontier) {
      for (const macro of macros) {
        const cube = applyMoves(node.cube, macro);
        if (!keeps(cube)) continue;
        const key = pieceSignature(cube, colors);
        if (visited.has(key)) continue;
        visited.add(key);
        const path = node.path.concat(macro);
        if (goal(cube)) return path;
        next.push({ cube, path });
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return null;
}

/** 把某个槽位里的块「挑」到顶层的候选序列 */
function extractOptions(a: Face, b: Face): Move[][] {
  return [
    [a, 'U', `${a}'`],
    [`${a}'`, "U'", a],
    [b, 'U', `${b}'`],
    [`${b}'`, "U'", b],
  ];
}

function solveBottomCorners(cubies: Cubie[]): Move[] | null {
  let cur = cubies;
  const out: Move[] = [];
  const mustKeep: Face[][] = CROSS_PIECES.map((p) => [...p]);
  const extractionMacros = BOTTOM_CORNERS.flatMap((s) => extractOptions(s.a, s.b));

  for (const slot of BOTTOM_CORNERS) {
    const macros = cornerInsertions(slot.a, slot.b).concat(extractionMacros, U_ALIGNS.slice(1));
    const path = pieceBfs(cur, slot.colors, macros, mustKeep, 5);
    if (!path) return null;
    cur = applyMoves(cur, path);
    out.push(...path);
    mustKeep.push(slot.colors);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 阶段 3：中层棱块（标准插入公式 + 对齐穷举）
// ---------------------------------------------------------------------------

interface MiddleSlot {
  colors: Face[];
  home: Vec3;
  a: Face;
  b: Face;
}

const MIDDLE_SLOTS: MiddleSlot[] = [
  { colors: ['F', 'R'], home: [1, 0, 1], a: 'R', b: 'F' },
  { colors: ['F', 'L'], home: [-1, 0, 1], a: 'L', b: 'F' },
  { colors: ['B', 'L'], home: [-1, 0, -1], a: 'L', b: 'B' },
  { colors: ['B', 'R'], home: [1, 0, -1], a: 'R', b: 'B' },
];

/**
 * 中层插入公式。
 * 同一槽位有「左插入 / 右插入」两种手性，而槽位本身又分左右两侧，
 * 因此这里同时给出 4 种模式（互为镜像），由搜索挑选真正生效的那一条。
 */
function middleInsertions(a: Face, b: Face): Move[][] {
  const patterns: Move[][] = [
    ['U', a, "U'", `${a}'`, "U'", `${b}'`, 'U', b],
    ["U'", `${b}'`, 'U', b, 'U', a, "U'", `${a}'`],
    ["U'", `${a}'`, 'U', a, 'U', b, "U'", `${b}'`],
    ['U', b, "U'", `${b}'`, "U'", `${a}'`, 'U', a],
  ];
  return U_ALIGNS.flatMap((align) => patterns.map((p) => align.concat(p)));
}

function solveMiddleEdges(cubies: Cubie[]): Move[] | null {
  let cur = cubies;
  const out: Move[] = [];
  const mustKeep: Face[][] = [
    ...CROSS_PIECES.map((p) => [...p]),
    ...BOTTOM_CORNERS.map((s) => [...s.colors]),
  ];
  const extractionMacros = MIDDLE_SLOTS.flatMap((s) => middleInsertions(s.a, s.b).slice(0, 4));

  for (const slot of MIDDLE_SLOTS) {
    const macros = middleInsertions(slot.a, slot.b).concat(extractionMacros, U_ALIGNS.slice(1));
    const path = pieceBfs(cur, slot.colors, macros, mustKeep, 4);
    if (!path) return null;
    cur = applyMoves(cur, path);
    out.push(...path);
    mustKeep.push(slot.colors);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 阶段 4~7：顶层（宏动作 BFS）
// ---------------------------------------------------------------------------

const TOP_EDGES: Face[][] = [
  ['U', 'F'],
  ['U', 'R'],
  ['U', 'B'],
  ['U', 'L'],
];

const TOP_CORNERS: Face[][] = [
  ['U', 'F', 'R'],
  ['U', 'F', 'L'],
  ['U', 'B', 'L'],
  ['U', 'B', 'R'],
];

const TOP_EDGE_HOME: Vec3[] = [
  [0, -1, 1],
  [1, -1, 0],
  [0, -1, -1],
  [-1, -1, 0],
];

const TOP_CORNER_HOME: Vec3[] = [
  [1, -1, 1],
  [-1, -1, 1],
  [-1, -1, -1],
  [1, -1, -1],
];

/** 标准公式，作为宏动作使用 */
const UA_ALG = "R U' R U R U R U' R' U' R2";
const A_ALG = "R' F R' B2 R F' R' B2 R2";

const ALGS = {
  ollEdge: ["F R U R' U' F'", "F U R U' R' F'"],
  sune: ["R U R' U R U2 R'", "R U2 R' U' R U' R'"],
  // 逆公式一律由程序生成，避免手写错误
  cornerCycle: [A_ALG, invertMoves(parseAlg(A_ALG)).join(' ')],
  edgeCycle: [UA_ALG, invertMoves(parseAlg(UA_ALG)).join(' ')],
  edgeDouble: ['R2 U2 R U2 R2 U2 R2 U2 R U2 R2'],
};

function parseAlg(alg: string): Move[] {
  return alg.trim().split(/\s+/) as Move[];
}

const U_ALIGNS: Move[][] = [[], ['U'], ['U2'], ["U'"]];

/** 对齐矩阵：把公式整体绕 U 轴旋转 k 个 90°，即 U^k · alg · U^-k */
function conjugates(alg: Move[]): Move[][] {
  return U_ALIGNS.map((align) => align.concat(alg, invertMoves(align)));
}

/** 只做前置对齐（用于会改变朝向、不关心其它块的场合） */
function withAligns(algs: string[]): Move[][] {
  const base = algs.map(parseAlg);
  return U_ALIGNS.flatMap((align) => base.map((alg) => align.concat(alg)));
}

/** 共轭版本：旋转后的同一公式，保证不破坏已完成的其它层 */
function withConjugates(algs: string[]): Move[][] {
  return algs.flatMap((alg) => conjugates(parseAlg(alg)));
}

function macroBfs(
  start: Cubie[],
  macros: Move[][],
  keyOf: (cube: Cubie[]) => string,
  goal: (cube: Cubie[]) => boolean,
  maxDepth: number,
): Move[] | null {
  if (goal(start)) return [];
  const visited = new Set<string>([keyOf(start)]);
  let frontier: { cube: Cubie[]; path: Move[] }[] = [{ cube: start, path: [] }];
  for (let depth = 0; depth < maxDepth; depth += 1) {
    const next: { cube: Cubie[]; path: Move[] }[] = [];
    for (const node of frontier) {
      for (const macro of macros) {
        const cube = applyMoves(node.cube, macro);
        const key = keyOf(cube);
        if (visited.has(key)) continue;
        visited.add(key);
        const path = node.path.concat(macro);
        if (goal(cube)) return path;
        next.push({ cube, path });
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return null;
}

function topEdgeOrientedKey(cube: Cubie[]): string {
  return TOP_EDGES.map((colors) => stickerFace(findPiece(cube, colors), TOP)).join('');
}

function topEdgeOriented(cube: Cubie[]): boolean {
  return TOP_EDGES.every((colors) => stickerFace(findPiece(cube, colors), TOP) === TOP);
}

function topCornerOrientedKey(cube: Cubie[]): string {
  return TOP_CORNERS.map((colors) => stickerFace(findPiece(cube, colors), TOP)).join('');
}

function topCornerOriented(cube: Cubie[]): boolean {
  return TOP_CORNERS.every((colors) => stickerFace(findPiece(cube, colors), TOP) === TOP);
}

function cornerPermKey(cube: Cubie[]): string {
  return TOP_CORNER_HOME.map((pos) => cubieAt(cube, pos).key).join('|');
}

function cornerPermDone(cube: Cubie[]): boolean {
  return TOP_CORNERS.every((colors, i) => sameVec(findPiece(cube, colors).pos, TOP_CORNER_HOME[i]));
}

function edgePermKey(cube: Cubie[]): string {
  return TOP_EDGE_HOME.map((pos) => cubieAt(cube, pos).key).join('|');
}

function edgePermDone(cube: Cubie[]): boolean {
  return TOP_EDGES.every((colors, i) => sameVec(findPiece(cube, colors).pos, TOP_EDGE_HOME[i]));
}

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------

/** 七个还原阶段的元信息，UI 与求解器共用一份 */
export const PHASE_META = [
  { key: 'cross', name: '底面十字', hint: '把 4 个底面棱块归位，形成十字' },
  { key: 'bottom-corners', name: '底角归位', hint: '完成整个底层' },
  { key: 'middle-edges', name: '中层棱块', hint: '插入 4 个中层棱块，前两层完成' },
  { key: 'oll-edges', name: '顶面十字', hint: '让顶层 4 个棱块的顶色朝上' },
  { key: 'oll-corners', name: '顶面定向', hint: '让顶层 4 个角块的顶色朝上' },
  { key: 'pll-corners', name: '顶层角块', hint: '把 4 个顶角转到正确位置' },
  { key: 'pll-edges', name: '顶层棱块', hint: '调整顶层棱块，完成还原' },
  { key: 'align', name: '整体对齐', hint: '最后转动顶层对齐' },
] as const;

export interface SolvePhase {
  key: string;
  name: string;
  hint: string;
  moves: Move[];
}

export interface SolveResult {
  ok: boolean;
  phases: SolvePhase[];
  moves: Move[];
  failedAt?: string;
}

function phaseOf(key: string, moves: Move[] | null): SolvePhase {
  const meta = PHASE_META.find((m) => m.key === key);
  return { key, name: meta?.name ?? key, hint: meta?.hint ?? '', moves: moves ?? [] };
}

export function solveCube(cubies: Cubie[]): SolveResult {
  const phases: SolvePhase[] = [];
  let cur = cubies;

  const cross = solveCross(cur);
  if (!cross) return { ok: false, phases, moves: [], failedAt: 'cross' };
  phases.push(phaseOf('cross', cross));
  cur = applyMoves(cur, cross);

  const corners = solveBottomCorners(cur);
  if (!corners) return { ok: false, phases, moves: flatten(phases), failedAt: 'bottom-corners' };
  phases.push(phaseOf('bottom-corners', corners));
  cur = applyMoves(cur, corners);

  const middle = solveMiddleEdges(cur);
  if (!middle) return { ok: false, phases, moves: flatten(phases), failedAt: 'middle-edges' };
  phases.push(phaseOf('middle-edges', middle));
  cur = applyMoves(cur, middle);

  const ollEdge = macroBfs(cur, withAligns(ALGS.ollEdge), topEdgeOrientedKey, topEdgeOriented, 5);
  if (!ollEdge) return { ok: false, phases, moves: flatten(phases), failedAt: 'oll-edges' };
  phases.push(phaseOf('oll-edges', ollEdge));
  cur = applyMoves(cur, ollEdge);

  const ollCorner = macroBfs(
    cur,
    withAligns(ALGS.sune),
    topCornerOrientedKey,
    topCornerOriented,
    6,
  );
  if (!ollCorner) return { ok: false, phases, moves: flatten(phases), failedAt: 'oll-corners' };
  phases.push(phaseOf('oll-corners', ollCorner));
  cur = applyMoves(cur, ollCorner);

  const pllCorner = macroBfs(
    cur,
    withAligns(ALGS.cornerCycle).concat(U_ALIGNS.slice(1)),
    cornerPermKey,
    cornerPermDone,
    5,
  );
  if (!pllCorner) return { ok: false, phases, moves: flatten(phases), failedAt: 'pll-corners' };
  phases.push(phaseOf('pll-corners', pllCorner));
  cur = applyMoves(cur, pllCorner);

  const pllEdge = macroBfs(
    cur,
    withConjugates(ALGS.edgeCycle.concat(ALGS.edgeDouble)),
    edgePermKey,
    edgePermDone,
    5,
  );
  if (!pllEdge) return { ok: false, phases, moves: flatten(phases), failedAt: 'pll-edges' };
  phases.push(phaseOf('pll-edges', pllEdge));
  cur = applyMoves(cur, pllEdge);

  // 收尾：整体对齐
  if (!isSolved(cur)) {
    for (const align of [['U'], ['U2'], ["U'"]] as Move[][]) {
      if (isSolved(applyMoves(cur, align))) {
        phases.push(phaseOf('align', align));
        cur = applyMoves(cur, align);
        break;
      }
    }
  }

  if (!isSolved(cur)) return { ok: false, phases, moves: flatten(phases), failedAt: 'final' };

  // 跨阶段合并可抵消的步骤，减少动画时长
  const merged = simplifyAcrossPhases(phases);
  return { ok: true, phases: merged, moves: flatten(merged) };
}

function flatten(phases: SolvePhase[]): Move[] {
  return phases.flatMap((p) => p.moves);
}

function simplifyAcrossPhases(phases: SolvePhase[]): SolvePhase[] {
  // 只在本阶段内消除冗余（同面连续转动），保持阶段边界清晰，便于逐步演示
  return phases
    .map((phase) => ({ ...phase, moves: simplifyMoves(phase.moves) }))
    .filter((phase) => phase.moves.length > 0);
}

export { invertMove, ALGS as SOLVER_ALGS };
