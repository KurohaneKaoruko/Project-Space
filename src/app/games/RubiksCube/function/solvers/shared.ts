/**
 * 多求解器共享基础设施
 *
 * - 24 态棱/角转移表（pos×ori 整数编码，供轻量多块 BFS 使用）
 * - EO（棱朝向）掩码与 EOLine 最优定向表
 * - 块构建 BFS（整数打包状态）、宏动作 BFS
 * - 常用公式库与 U 对齐/共轭工具
 *
 * 棱/角朝向编码：ori = 该块「0 号贴纸」（home 槽位 faces[0] 对应色）
 * 当前贴在所在槽位 faces 的第几个面。solved ⟺ 在 home 槽位且 ori = 0。
 */

import {
  applyMoves,
  createSolvedCube,
  FACE_NORMAL,
  FACE_LIST,
  faceOfVec,
  findPiece,
  invertMoves,
  isCubieSolved,
  MOVE_LIST,
  mulVec,
  parseMove,
  stickerFace,
  type Cubie,
  type Face,
  type Mat3,
  type Move,
  type Vec3,
} from '../cubeEngine';
import type { SolvePhase } from '../solver';

// ---------------------------------------------------------------------------
// 槽位定义
// ---------------------------------------------------------------------------

export interface SlotDef {
  coord: Vec3;
  faces: Face[];
}

export const EDGE_SLOTS: SlotDef[] = [
  { coord: [0, -1, 1], faces: ['U', 'F'] }, // 0 UF
  { coord: [1, -1, 0], faces: ['U', 'R'] }, // 1 UR
  { coord: [0, -1, -1], faces: ['U', 'B'] }, // 2 UB
  { coord: [-1, -1, 0], faces: ['U', 'L'] }, // 3 UL
  { coord: [1, 1, 0], faces: ['D', 'R'] }, // 4 DR
  { coord: [0, 1, 1], faces: ['D', 'F'] }, // 5 DF
  { coord: [-1, 1, 0], faces: ['D', 'L'] }, // 6 DL
  { coord: [0, 1, -1], faces: ['D', 'B'] }, // 7 DB
  { coord: [1, 0, 1], faces: ['F', 'R'] }, // 8 FR
  { coord: [-1, 0, 1], faces: ['F', 'L'] }, // 9 FL
  { coord: [-1, 0, -1], faces: ['B', 'L'] }, // 10 BL
  { coord: [1, 0, -1], faces: ['B', 'R'] }, // 11 BR
];

export const CORNER_SLOTS: SlotDef[] = [
  { coord: [1, -1, 1], faces: ['U', 'F', 'R'] }, // 0 UFR
  { coord: [1, -1, -1], faces: ['U', 'R', 'B'] }, // 1 URB
  { coord: [-1, -1, -1], faces: ['U', 'B', 'L'] }, // 2 UBL
  { coord: [-1, -1, 1], faces: ['U', 'L', 'F'] }, // 3 ULF
  { coord: [1, 1, 1], faces: ['D', 'F', 'R'] }, // 4 DFR
  { coord: [1, 1, -1], faces: ['D', 'R', 'B'] }, // 5 DRB
  { coord: [-1, 1, -1], faces: ['D', 'B', 'L'] }, // 6 DBL
  { coord: [-1, 1, 1], faces: ['D', 'L', 'F'] }, // 7 DLF
];

function slotIndexOf(slots: SlotDef[], pos: Vec3): number {
  const idx = slots.findIndex((s) => s.coord[0] === pos[0] && s.coord[1] === pos[1] && s.coord[2] === pos[2]);
  if (idx < 0) throw new Error('position is not a slot');
  return idx;
}

// ---------------------------------------------------------------------------
// 转动矩阵（与 solver.ts 同款实现）
// ---------------------------------------------------------------------------

const BASE_TURN: Record<Face, Mat3> = {
  U: [0, 0, -1, 0, 1, 0, 1, 0, 0],
  D: [0, 0, 1, 0, 1, 0, -1, 0, 0],
  R: [1, 0, 0, 0, 0, -1, 0, 1, 0],
  L: [1, 0, 0, 0, 0, 1, 0, -1, 0],
  F: [0, -1, 0, 1, 0, 0, 0, 0, 1],
  B: [0, 1, 0, -1, 0, 0, 0, 0, 1],
};

function turnMatrixOf(face: Face, turns: number): Mat3 {
  let out: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const t = ((turns % 4) + 4) % 4;
  for (let i = 0; i < t; i += 1) {
    const a = out;
    const b = BASE_TURN[face];
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

/** face 顺转 90° 时，贴在 target 面的贴纸移到哪一面 */
export const FACE_MAP: Record<Face, Record<Face, Face>> = (() => {
  const map = {} as Record<Face, Record<Face, Face>>;
  for (const face of FACE_LIST) {
    const inner = {} as Record<Face, Face>;
    for (const target of FACE_LIST) {
      inner[target] = faceOfVec(mulVec(turnMatrixOf(face, 1), FACE_NORMAL[target]));
    }
    map[face] = inner;
  }
  return map;
})();

function isOnFace(coord: Vec3, face: Face): boolean {
  const n = FACE_NORMAL[face];
  return coord[0] * n[0] + coord[1] * n[1] + coord[2] * n[2] === 1;
}

// ---------------------------------------------------------------------------
// 24 态转移表：state = slotIdx * ORI_N + ori
//   棱：ori ∈ {0,1}，角：ori ∈ {0,1,2}
//   ori = 「home faces[0] 那张贴纸」当前贴在 slot.faces 的下标
// ---------------------------------------------------------------------------

export interface PieceMoveTable {
  /** state(24) × move(18) → next state */
  table: Uint8Array;
  oriCount: (slot: number) => number;
}

function buildPieceTable(slots: SlotDef[]): Uint8Array {
  const oriN = slots === EDGE_SLOTS ? 2 : 3;
  const table = new Uint8Array(24 * 18);
  for (let slot = 0; slot < slots.length; slot += 1) {
    for (let ori = 0; ori < oriN; ori += 1) {
      for (let m = 0; m < 18; m += 1) {
        const move = MOVE_LIST[m];
        const face = move[0] as Face;
        const turns = parseMove(move).turns;
        const s = slots[slot];
        let nextSlot = slot;
        let nextOri = ori;
        if (isOnFace(s.coord, face)) {
          const rotated = mulVec(turnMatrixOf(face, turns), s.coord);
          nextSlot = slotIndexOf(slots, rotated);
          // 当前 0 号贴纸贴在 s.faces[ori]，转动 turns 个 90° 后去到新槽位的哪个面
          let movedFace = s.faces[ori];
          for (let k = 0; k < turns; k += 1) movedFace = FACE_MAP[face][movedFace];
          nextOri = slots[nextSlot].faces.indexOf(movedFace);
        }
        table[(slot * oriN + ori) * 18 + m] = nextSlot * oriN + nextOri;
      }
    }
  }
  return table;
}

let edgeTableCache: Uint8Array | null = null;
let cornerTableCache: Uint8Array | null = null;

export function getEdgeMoveTable(): Uint8Array {
  if (!edgeTableCache) edgeTableCache = buildPieceTable(EDGE_SLOTS);
  return edgeTableCache;
}

export function getCornerMoveTable(): Uint8Array {
  if (!cornerTableCache) cornerTableCache = buildPieceTable(CORNER_SLOTS);
  return cornerTableCache;
}

// ---------------------------------------------------------------------------
// 从 cubies 提取轻量块状态 / 由状态定位块
// ---------------------------------------------------------------------------

/** 棱块（按颜色对）在 24 态下的编码 */
export function edgeStateOf(cubies: Cubie[], colors: [Face, Face]): number {
  const cubie = findPiece(cubies, colors);
  const slot = slotIndexOf(EDGE_SLOTS, cubie.pos);
  // 参考贴纸 = home 槽位 faces[0] 对应的颜色（与转移表的 ori 定义一致）
  const refColor = EDGE_SLOTS[edgeHomeSlot(colors)].faces[0];
  const face = stickerFace(cubie, refColor);
  return slot * 2 + EDGE_SLOTS[slot].faces.indexOf(face);
}

/** 角块（按颜色三元组）在 24 态（slot*3+ori）下的编码 */
export function cornerStateOf(cubies: Cubie[], colors: Face[]): number {
  const cubie = findPiece(cubies, colors);
  const slot = slotIndexOf(CORNER_SLOTS, cubie.pos);
  const refColor = CORNER_SLOTS[cornerHomeSlot(colors)].faces[0];
  const face = stickerFace(cubie, refColor);
  return slot * 3 + CORNER_SLOTS[slot].faces.indexOf(face);
}

/** 由颜色集合查 home 槽位（棱） */
export function edgeHomeSlot(colors: [Face, Face]): number {
  return slotIndexOf(EDGE_SLOTS, colorsToCoord(colors));
}

/** 由颜色集合查 home 槽位（角） */
export function cornerHomeSlot(colors: Face[]): number {
  return slotIndexOf(CORNER_SLOTS, colorsToCoord(colors));
}

/** 归位时槽位 faces 集合 = 颜色集合 → 用颜色反查坐标 */
function colorsToCoord(colors: Face[]): Vec3 {
  const coord: [number, number, number] = [0, 0, 0];
  for (const c of colors) {
    const n = FACE_NORMAL[c];
    coord[0] += n[0]!;
    coord[1] += n[1]!;
    coord[2] += n[2]!;
  }
  return coord;
}

// ---------------------------------------------------------------------------
// EO（棱朝向）：约定「good 边」= 可只用 <U,D,L,R,F2,B2> 归位的边。
// 采用与上面统一的 ori 编码：edgeState 的 ori 定义恰好等价于 EO 逆置。
// 直接用 BFS 从已解状态生成每个位置的 good/bad 集合验证过（测试覆盖）。
// ---------------------------------------------------------------------------

/** EO 掩码（12 bit，bit i = 第 i 个槽位上的边是否 bad） */
export function eoMaskOf(cubies: Cubie[]): number {
  let mask = 0;
  for (let slot = 0; slot < 12; slot += 1) {
    const s = EDGE_SLOTS[slot];
    const cubie = cubies.find((c) => c.pos[0] === s.coord[0] && c.pos[1] === s.coord[1] && c.pos[2] === s.coord[2]);
    if (!cubie) continue;
    if (!edgeIsGood(cubie, slot)) mask |= 1 << slot;
  }
  return mask;
}

/**
 * 判定某槽位上的棱是否 good。
 * 规则（标准 EO 定义）：
 *  - 有 U/D 色：good ⟺ U/D 色贴 U/D 面；若在 E 层则 good ⟺ U/D 色贴 F/B 面
 *  - 无 U/D 色（F/B 色棱）：good ⟺ F/B 色贴 F/B 面；若在 U/D 层则 good ⟺ F/B 色贴 U/D 面
 */
function edgeIsGood(cubie: Cubie, slot: number): boolean {
  const hasUD = cubie.colors.U !== null || cubie.colors.D !== null;
  const faces = EDGE_SLOTS[slot].faces;
  const inUDLayer = faces.includes('U') || faces.includes('D');
  const onUD = (f: Face) => f === 'U' || f === 'D';
  const onFB = (f: Face) => f === 'F' || f === 'B';
  if (hasUD) {
    const udFace = stickerFace(cubie, cubie.colors.U ?? 'D');
    if (inUDLayer) return onUD(udFace);
    return onFB(udFace);
  }
  const fbFace = stickerFace(cubie, cubie.colors.F ?? cubie.colors.B ?? 'F');
  if (inUDLayer) return onUD(fbFace);
  return onFB(fbFace);
}

// ---------------------------------------------------------------------------
// EOLine：EO 全 good + DF/DB 两棱归位。距离表 4096 × 24 × 24（2^12 掩码空间，可达半数）
// 状态打包：idx = eo * 576 + fd * 24 + db（fd/db 为 24 态编码）
// ---------------------------------------------------------------------------

interface EoLineTable {
  dist: Uint8Array;
  ms: number;
}

let eoLineCache: EoLineTable | null = null;

const EO_LINE_SIZE = 4096 * 576;

export function getEoLineDist(): Uint8Array {
  if (eoLineCache) return eoLineCache.dist;
  const started = Date.now();
  const edge = getEdgeMoveTable();
  const dist = new Uint8Array(EO_LINE_SIZE).fill(255);
  const queue = new Int32Array(EO_LINE_SIZE);
  // 逆转动索引
  const invIdx = MOVE_LIST.map((m) => MOVE_LIST.indexOf(invertMoves([m])[0]));
  const goalFd = 5 * 2; // DF 棱归位：slot 5, ori 0
  const goalDb = 7 * 2; // DB 棱归位：slot 7, ori 0
  const start = goalFd * 24 + goalDb; // eo=0
  dist[start] = 0;
  let head = 0;
  let tail = 1;
  queue[0] = start;
  while (head < tail) {
    const cur = queue[head];
    head += 1;
    const d = dist[cur];
    if (d >= 20) continue;
    const eo = (cur / 576) | 0;
    const fd = ((cur % 576) / 24) | 0;
    const db = cur % 24;
    for (let m = 0; m < 18; m += 1) {
      const im = invIdx[m];
      // 用逆转动从目标态反向扩展
      const nEo = eoFlip(eo, im);
      const nFd = edge[fd * 18 + im];
      const nDb = edge[db * 18 + im];
      const nIdx = nEo * 576 + nFd * 24 + nDb;
      if (dist[nIdx] === 255) {
        dist[nIdx] = d + 1;
        queue[tail] = nIdx;
        tail += 1;
      }
    }
  }
  const ms = Date.now() - started;
  eoLineCache = { dist, ms };
  return dist;
}

/** EO 转移（导出供测试）：掩码按槽位索引，转动会置换槽位并可能翻转朝向。 */

/** 每个转动 m 的槽位置换：perm[m][oldSlot] = newSlot */
const EO_PERM: number[][] = (() => {
  const edge = getEdgeMoveTable();
  const perms: number[][] = [];
  for (let m = 0; m < 18; m += 1) {
    const perm = new Array<number>(12);
    for (let slot = 0; slot < 12; slot += 1) {
      // state = slot*2 + 0（ori=0 的位置分量）
      perm[slot] = edge[slot * 2 * 18 + m] >> 1;
    }
    perms.push(perm);
  }
  return perms;
})();

/**
 * 单槽翻转查询表占位（历史遗留，实际翻转逻辑内联在 eoFlip 中）
 */
const EO_FLIP_TABLE: Uint8Array = (() => {
  const t = new Uint8Array(18 * 64);
  return t;
})();

void EO_FLIP_TABLE;

export function eoFlip(mask: number, moveIdx: number): number {
  const perm = EO_PERM[moveIdx];
  // 对每个旧槽位：good/bad 状态经过转动后在新槽位上的值
  // 规则：edgeState 的 ori=0 分量语义 = home faces[0] 色贴在 slot.faces 的第几个 —— 与 EO 无关
  // EO 变换：bad(s') = bad(s) XOR flipOnMove(s, m)，其中 s' = perm(m, s)
  let out = 0;
  for (let s = 0; s < 12; s += 1) {
    if (mask & (1 << s)) {
      out |= 1 << perm[s];
    }
  }
  // F/B quarter 在该面 4 条边处翻转 EO
  const face = MOVE_LIST[moveIdx][0] as Face;
  const turns = parseMove(MOVE_LIST[moveIdx]).turns;
  if ((face === 'F' || face === 'B') && turns % 2 === 1) {
    const slotsOnFace = face === 'F' ? [0, 5, 8, 9] : [2, 7, 10, 11];
    for (const s of slotsOnFace) {
      // 转动后这些边跑到 perm[s]，翻转其 EO
      out ^= 1 << perm[s];
    }
    // 修正：上面 out 的 bit 来自旧 s 的 bad 值；翻转应作用于新槽位
    // out ^= 1 << perm[s] 即对新槽位取反 ✔
  }
  return out;
}

export interface EoLineTableInfo {
  ready: boolean;
  ms: number;
}

export function eoLineTableInfo(): EoLineTableInfo {
  return { ready: eoLineCache !== null, ms: eoLineCache?.ms ?? 0 };
}

/** 预热 EOLine 距离表（ZZ/Roux/Petrus 共用），返回构建耗时（毫秒） */
export function warmUpEoLine(): number {
  const t0 = performance.now();
  getEoLineDist();
  return performance.now() - t0;
}

/** 从当前状态沿距离表贪心下降，返回 EOLine 解法 */
export function solveEoLine(cubies: Cubie[]): Move[] | null {
  const dist = getEoLineDist();
  const edge = getEdgeMoveTable();
  const fdColors: [Face, Face] = ['D', 'F'];
  const dbColors: [Face, Face] = ['D', 'B'];
  const fd = edgeStateOf(cubies, fdColors);
  const db = edgeStateOf(cubies, dbColors);
  const eo = eoMaskOf(cubies);
  let idx = eo * 576 + fd * 24 + db;
  if (dist[idx] === 255) return null;
  const out: Move[] = [];
  let guard = 0;
  while (dist[idx] > 0) {
    guard += 1;
    if (guard > 24) return null;
    let advanced = false;
    const eo = (idx / 576) | 0;
    const fd = ((idx % 576) / 24) | 0;
    const db = idx % 24;
    for (let m = 0; m < 18; m += 1) {
      const nEo = eoFlip(eo, m);
      const nFd = edge[fd * 18 + m];
      const nDb = edge[db * 18 + m];
      const nIdx = nEo * 576 + nFd * 24 + nDb;
      if (dist[nIdx] === dist[idx] - 1) {
        out.push(MOVE_LIST[m]);
        idx = nIdx;
        advanced = true;
        break;
      }
    }
    if (!advanced) return null;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 公式库
// ---------------------------------------------------------------------------

export function parseAlg(alg: string): Move[] {
  return alg.trim().split(/\s+/) as Move[];
}

export function invertAlg(alg: Move[]): Move[] {
  return invertMoves(alg);
}

export const U_ALIGNS: Move[][] = [[], ['U'], ['U2'], ["U'"]];

/** U^k · alg · U^-k：把公式整体绕 U 轴旋转 */
export function conjugates(alg: Move[]): Move[][] {
  return U_ALIGNS.map((align) => align.concat(alg, invertMoves(align)));
}

/** 只做前置 U 对齐 */
export function withAligns(algs: Move[][]): Move[][] {
  const out: Move[][] = [];
  for (const alg of algs) {
    for (const align of U_ALIGNS) out.push(align.concat(alg));
  }
  return out;
}

export const ALGS = {
  ollEdge: [parseAlg("F R U R' U' F'"), parseAlg("F U R U' R' F'")],
  sune: [parseAlg("R U R' U R U2 R'"), parseAlg("R U2 R' U' R U' R'")],
  aPerm: parseAlg("R' F R' B2 R F' R' B2 R2"),
  uPerm: parseAlg("R U' R U R U R U' R' U' R2"),
  hPerm: parseAlg('R2 U2 R U2 R2 U2 R2 U2 R U2 R2'),
  tPerm: parseAlg("R U R' U' R' F R2 U' R' U' R U R' F'"),
  yPerm: parseAlg("F R U' R' U' R U R' F' R U R' U' R' F R F'"),
};

// ---------------------------------------------------------------------------
// 逐块插入框架：按计划依次把每块插归位，宏族构造上「净保持」已完成块
// ---------------------------------------------------------------------------

function invertOf(m: Move): Move {
  return invertMoves([m])[0];
}

/**
 * 生成某槽位（两个侧面 a/b）的插入宏族（前置 U 对齐全展开）：
 *  - corner:  角插入三步触发 × 12 及其逆
 *  - midEdge: 中层棱 8 步插入 × 2 及其逆
 *  - bottomEdge: 底层棱提取/插入触发（含 L2/R2 类直落与 F/B 触发）
 */
export function makeSlotMacros(
  a: Face,
  b: Face,
  kinds: { corner?: boolean; midEdge?: boolean; bottomEdge?: boolean },
): Move[][] {
  const ai = invertOf(a);
  const bi = invertOf(b);
  const base: Move[][] = [];

  if (kinds.corner) {
    for (const s of [a, ai, b, bi]) {
      for (const u of ['U', 'U2', "U'"] as Move[]) {
        base.push([s, u, invertOf(s)]);
      }
    }
    const triggers = base.slice();
    for (const t of triggers) base.push(invertMoves(t));
  }

  if (kinds.midEdge) {
    const algs: Move[][] = [
      ['U', a, "U'", ai, "U'", bi, 'U', b],
      ["U'", bi, 'U', b, 'U', a, "U'", ai],
    ];
    for (const alg of algs.slice()) base.push(alg, invertMoves(alg));
  }

  if (kinds.bottomEdge) {
    // 底层棱：直落（半圈）+ 相邻面触发提取
    base.push([`${a}2` as Move], [`${b}2` as Move]);
    base.push([a, 'U', ai], [ai, "U'", a], [b, 'U', bi], [bi, "U'", b]);
  }

  base.push(['U'], ["U'"], ['U2']);

  // 前置 U 对齐全展开（去重）
  const seen = new Set<string>();
  const out: Move[][] = [];
  for (const alg of base) {
    for (const align of U_ALIGNS) {
      const full = [...align, ...alg];
      const key = full.join(' ');
      if (!seen.has(key)) {
        seen.add(key);
        out.push(full);
      }
    }
  }
  return out;
}

/**
 * 生成 F2L 槽位（两个侧面 a/b）的插入/提取/对齐宏族（前置 U 对齐全展开）。
 * 宏的「净效果」保持十字与已完成槽位（与 CFOP/Petrus 共用）。
 */
export function f2lMacros(a: Face, b: Face): Move[][] {
  return makeSlotMacros(a, b, { corner: true, midEdge: true });
}

/**
 * 宏保持性过滤：在「已解魔方」上逐个施加宏，丢弃任何会破坏 keeps 中
 * 任一块的宏。过滤后的宏族可安全用于 prune 策略（每步宏都保持 keeps）。
 */
export function filterPreserving(macros: Move[][], keeps: PieceSpec[]): Move[][] {
  return macros.filter((macro) => {
    const after = applyMoves(createSolvedCube(), macro);
    return keeps.every((p) => isPieceSolved(after, p.colors));
  });
}

export interface InsertPlan {
  piece: PieceSpec;
  macros?: Move[][];
  /** 单转搜索用的转动集（与 macros 二选一，单转版完备性更好） */
  moves?: Move[];
  maxDepth?: number;
}

/** EO 安全转动（保持全部棱定向；F/B 仅允许半圈） */
export const EO_SAFE_MOVES: Move[] = [
  'U', "U'", 'U2', 'D', "D'", 'D2',
  'L', "L'", 'L2', 'R', "R'", 'R2',
  'F2', 'B2',
];

/** 全部 18 个单转 */
export const ALL_MOVES: Move[] = [
  'U', "U'", 'U2', 'D', "D'", 'D2',
  'L', "L'", 'L2', 'R', "R'", 'R2',
  'F', "F'", 'F2', 'B', "B'", 'B2',
];

/** 逐块插入：keeps（含已完成块）用 final 校验 */
export function insertPieceSequence(
  start: Cubie[],
  plan: InsertPlan[],
  initialKeeps: PieceSpec[],
): { ok: boolean; moves: Move[]; failedAt?: string } {
  let cur = start;
  const done = [...initialKeeps];
  const moves: Move[] = [];
  for (const step of plan) {
    let path: Move[] | null;
    if (step.moves) {
      // 单转版：1 target + N keeps（≤5 块打包），完备搜索
      path = blockBfs(cur, [step.piece], done, step.moves, step.maxDepth ?? 6, {
        keepPolicy: 'final',
        nodeLimit: 2_000_000,
      });
    } else {
      path = blockMacroBfs(cur, [step.piece], done, step.macros ?? [], step.maxDepth ?? 3, {
        keepPolicy: 'final',
      });
    }
    if (!path) return { ok: false, moves, failedAt: step.piece.colors.join('') };
    cur = applyMoves(cur, path);
    moves.push(...path);
    done.push(step.piece);
  }
  return { ok: true, moves };
}

export interface PieceSpec {
  colors: Face[];
  kind: 'edge' | 'corner';
}

/**
 * 通用 F2L 引擎：对一组槽位做「贪心插入 + 踢出重排」，保证所有槽位完成。
 *  - keeps 始终保护 initialKeeps（十字 / 已成块）与完整已解槽位
 *  - 部分完成的槽不整体保护，但单件插入时用 localKeeps 保护本槽已解件，
 *    挡路时踢出重排（与真人 CFOP 的「拆开重插」一致）
 */
export function f2lEngine(
  start: Cubie[],
  slots: { corner: Face[]; edge: [Face, Face] }[],
  initialKeeps: PieceSpec[],
  debugTag = '',
  opts: { eoSafe?: boolean } = {},
): { ok: boolean; moves: Move[]; failedAt?: string } {
  const eoSafe = opts.eoSafe ?? false;
  const moves: Move[] = [];
  let cur = start;
  const solvedSlots = new Set<number>();
  let guard = 0;
  let solvedCount = 0;
  let stallRounds = 0;

  const slotSide = (corner: Face[]): [Face, Face] => [corner[1], corner[2]];
  const inv = (f: Face): Face => (f.length === 1 ? (`${f}'` as Face) : (f.slice(0, 1) as Face));
  // eoSafe 模式：剔除含 F/B 四分之一转的宏（保持棱定向；F2/B2 允许）
  const eoFilter = (list: Move[][]): Move[][] =>
    eoSafe
      ? list.filter((macro) => !macro.some((mv) => mv === 'F' || mv === "F'" || mv === 'B' || mv === "B'"))
      : list;
  const slotMacros = (a: Face, b: Face) =>
    eoFilter(makeSlotMacros(a, b, { corner: true, midEdge: true, bottomEdge: true }));
  const pairMacros = (a: Face, b: Face) => eoFilter(f2lMacros(a, b));

  while (solvedSlots.size < slots.length && guard < 80) {
    guard += 1;
    let progressed = false;

    // 登记完整已解槽位
    for (let si = 0; si < slots.length; si += 1) {
      if (solvedSlots.has(si)) continue;
      const s = slots[si];
      if (isPieceSolved(cur, s.corner) && isPieceSolved(cur, s.edge)) solvedSlots.add(si);
    }

    // 停滞检测：已解槽数不变则计数，变化则清零
    if (solvedSlots.size > solvedCount) {
      solvedCount = solvedSlots.size;
      stallRounds = 0;
    } else {
      stallRounds += 1;
    }

    // keeps = 初始保持集 + 完整已解槽位
    const keeps: PieceSpec[] = [...initialKeeps];
    for (const j of solvedSlots) {
      keeps.push({ colors: slots[j].corner, kind: 'corner' });
      keeps.push({ colors: slots[j].edge, kind: 'edge' });
    }

    for (let si = 0; si < slots.length; si += 1) {
      if (solvedSlots.has(si)) continue;
      const slot = slots[si];
      const [x, y] = slotSide(slot.corner);
      const macros = filterPreserving(pairMacros(x, y), keeps);

      const cornerPiece: PieceSpec = { colors: slot.corner, kind: 'corner' };
      const edgePiece: PieceSpec = { colors: slot.edge, kind: 'edge' };
      const cornerDone = isPieceSolved(cur, slot.corner);
      const edgeDone = isPieceSolved(cur, slot.edge);

      if (cornerDone && edgeDone) {
        solvedSlots.add(si);
        progressed = true;
        break;
      }

      // 单件插入时保护本槽已解件，防止角/棱互相顶出死循环
      const localKeeps: PieceSpec[] =
        cornerDone ? [...keeps, edgePiece] : edgeDone ? [...keeps, cornerPiece] : keeps;

      let path: Move[] | null = null;
      // 快路径：保持性过滤宏（prune——中途与终点都不动 keeps/本槽已解件）
      if (!cornerDone && !edgeDone) {
        path = blockMacroBfs(cur, [cornerPiece, edgePiece], keeps, macros, 3);
      } else {
        path = blockMacroBfs(cur, [cornerDone ? edgePiece : cornerPiece], localKeeps, macros, 3);
      }
      // 完备搜索：全宏族 + 终态校验——keeps 只在终点强制归位，
      // 中途允许拆动任何非 keeps 块（含本槽已解件拆开重插、U 层组临时拆散）。
      // 宏族扩展：B 面全套（含 bottomEdge 直落宏）——目标块可能藏在
      // 底层背面槽（如 EOLine 后的 DB 棱），B2 是唯一的提取手段。
      // eoSafe 模式下 B 面宏剔除 F/B 四分之一转（保持棱定向）
      if (!path) {
        const bMacros = (a: Face, b: Face) => slotMacros(a, b);
        const fullMacros = [
          ...pairMacros(x, y),
          ...bMacros('B', x),
          ...bMacros('B', y),
        ];
        path = blockMacroBfs(cur, [cornerPiece, edgePiece], keeps, fullMacros, 3, {
          keepPolicy: 'final',
          nodeLimit: 2_000_000,
        });
      }
      if (!path) {
        const bMacros = (a: Face, b: Face) => slotMacros(a, b);
        const fullMacros = [
          ...pairMacros(x, y),
          ...bMacros('B', x),
          ...bMacros('B', y),
        ];
        path = blockMacroBfs(cur, [cornerPiece, edgePiece], keeps, fullMacros, 4, {
          keepPolicy: 'final',
          nodeLimit: 1_500_000,
        });
      }

      if (path && path.length > 0) {
        cur = applyMoves(cur, path);
        moves.push(...path);
        progressed = true;
        if (process.env.F2L_DEBUG) {
          console.error(`[${debugTag}] guard=${guard} slot ${si} 插入 ${path.length} 步: ${path.join(' ')}`);
        }
        break;
      }

      // 本槽已解件挡路 → 踢出重排
      if (cornerDone || edgeDone) {
        const pieceToKick: PieceSpec = cornerDone ? edgePiece : cornerPiece;
        const kickFamily = filterPreserving(pairMacros(x, y), keeps).filter((m) => {
          const after = applyMoves(cur, m);
          return !isPieceSolved(after, pieceToKick.colors);
        });
        if (kickFamily.length > 0) {
          const kick = kickFamily[0];
          cur = applyMoves(cur, kick);
          moves.push(...kick);
          progressed = true;
          if (process.env.F2L_DEBUG) {
            console.error(`[${debugTag}] guard=${guard} slot ${si} 踢出已解件: ${kick.join(' ')}`);
          }
          break;
        }
      }
      // 试下一槽
    }

    // 全部卡住 → 轮换对未解槽施加触发宏（保持 keeps 的三步触发）
    if (!progressed && solvedSlots.size < slots.length) {
      const unsolved: number[] = [];
      for (let si = 0; si < slots.length; si += 1) if (!solvedSlots.has(si)) unsolved.push(si);
      const startIdx = (guard - 1) % unsolved.length;
      for (let k = 0; k < unsolved.length && !progressed; k += 1) {
        const si = unsolved[(startIdx + k) % unsolved.length];
        const [x, y] = slotSide(slots[si].corner);
        const kickMacros = filterPreserving(
          eoFilter([
            [x, 'U', inv(x)],
            [inv(x), "U'", x],
            [y, 'U', inv(y)],
            [inv(y), "U'", y],
            [x, 'U2', inv(x)],
            [y, 'U2', inv(y)],
          ]),
          keeps,
        );
        if (kickMacros.length > 0) {
          const kick = kickMacros[guard % kickMacros.length];
          cur = applyMoves(cur, kick);
          moves.push(...kick);
          progressed = true;
          if (process.env.F2L_DEBUG) {
            console.error(`[${debugTag}] guard=${guard} 踢出 slot ${si}: ${kick.join(' ')}`);
          }
        }
      }
    }

    // 停滞处理：连续多轮保持性动作无进展 → 卡块必在某个已解槽里，
    // 拆开一个已解槽释放卡块（仍保护 initialKeeps），之后重新插入该槽
    if (stallRounds > slots.length * 2 && solvedSlots.size > 0) {
      const solvedArr = [...solvedSlots];
      const j = solvedArr[(guard - 1) % solvedArr.length];
      const [xj, yj] = slotSide(slots[j].corner);
      const breakCandidates = eoFilter(
        (
          [
            [xj, 'U', inv(xj)],
            [inv(xj), "U'", xj],
            [yj, 'U', inv(yj)],
            [inv(yj), "U'", yj],
            [xj, 'U2', inv(xj)],
            [yj, 'U2', inv(yj)],
          ] as Move[][]
        ),
      ).filter(
        (m) =>
          initialKeeps.every((p) => isPieceSolved(applyMoves(cur, m), p.colors)) &&
          (!isPieceSolved(applyMoves(cur, m), slots[j].corner) ||
            !isPieceSolved(applyMoves(cur, m), slots[j].edge)),
      );
      if (breakCandidates.length > 0) {
        const chosen = breakCandidates[(guard - 1) % breakCandidates.length];
        cur = applyMoves(cur, chosen);
        moves.push(...chosen);
        solvedSlots.delete(j);
        stallRounds = 0;
        progressed = true;
        if (process.env.F2L_DEBUG) {
          console.error(`[${debugTag}] guard=${guard} 拆开已解槽 ${j}: ${chosen.join(' ')}`);
        }
      }
    }

    if (!progressed) break;
  }

  const allDone = slots.every((s) => isPieceSolved(cur, s.corner) && isPieceSolved(cur, s.edge));
  if (!allDone) return { ok: false, moves, failedAt: 'f2l' };
  return { ok: true, moves };
}

interface PackedSpec {
  colors: Face[];
  kind: 'edge' | 'corner';
  home: number; // home 槽位的状态基址（slot*oriN）
  oriN: number;
}

export interface BlockBfsOptions {
  /**
   * keeps 校验策略：
   *  - 'prune'  逐步剪枝（默认，最快，但要求转动集本身能保持块）
   *  - 'final'  仅在目标达成时校验（允许中间拆块，搜索空间更大）
   */
  keepPolicy?: 'prune' | 'final';
  /** 搜索节点上限，超过即放弃（防止状态空间爆炸） */
  nodeLimit?: number;
}

export function blockBfs(
  cubies: Cubie[],
  targets: PieceSpec[],
  keeps: PieceSpec[],
  allowedMoves: Move[],
  maxDepth: number,
  options: BlockBfsOptions = {},
): Move[] | null {
  const { keepPolicy = 'prune', nodeLimit = 400_000 } = options;
  const specs: PackedSpec[] = [...targets, ...keeps].map((p) => {
    if (p.kind === 'edge') {
      return {
        colors: p.colors,
        kind: p.kind,
        home: edgeHomeSlot(p.colors as [Face, Face]) * 2,
        oriN: 2,
      };
    }
    return { colors: p.colors, kind: p.kind, home: cornerHomeSlot(p.colors) * 3, oriN: 3 };
  });
  const nTargets = targets.length;
  const moveIdxs = allowedMoves.map((m) => MOVE_LIST.indexOf(m));
  if (moveIdxs.some((i) => i < 0)) return null;
  const edge = getEdgeMoveTable();
  const corner = getCornerMoveTable();

  const startStates = specs.map((s) =>
    s.kind === 'edge' ? edgeStateOf(cubies, s.colors as [Face, Face]) : cornerStateOf(cubies, s.colors),
  );
  const keepsOk = (states: number[]) => {
    for (let i = nTargets; i < specs.length; i += 1) {
      if (states[i] !== specs[i].home) return false;
    }
    return true;
  };
  const isGoal = (states: number[]) => {
    if (!keepsOk(states)) return false;
    for (let i = 0; i < nTargets; i += 1) {
      if (states[i] !== specs[i].home) return false;
    }
    return true;
  };
  if (isGoal(startStates)) return [];

  const keyOf = (states: number[]) => states.join(',');
  const visited = new Set<string>([keepPolicy === 'prune' && !keepsOk(startStates) ? '' : keyOf(startStates)]);
  // prune 模式下起点必须 keeps 完好，否则无解
  if (keepPolicy === 'prune' && !keepsOk(startStates)) return null;
  // ≤5 块时用打包整数 visited（24^5 = 8M → 8MB），远快于字符串
  const usePacked = specs.length <= 5;
  const packedSpace = 24 ** specs.length;
  const packedVisited = usePacked ? new Uint8Array(packedSpace) : null;
  const packOf = (states: number[]) => {
    let p = 0;
    for (let i = 0; i < states.length; i += 1) p = p * 24 + states[i];
    return p;
  };
  if (usePacked) {
    packedVisited![packOf(startStates)] = 1;
  } else {
    visited.add(keyOf(startStates));
  }
  const seen = (states: number[]) => (usePacked ? packedVisited![packOf(states)] === 1 : visited.has(keyOf(states)));
  const mark = (states: number[]) => {
    if (usePacked) packedVisited![packOf(states)] = 1;
    else visited.add(keyOf(states));
  };
  let frontier: { states: number[]; path: Move[] }[] = [{ states: startStates, path: [] }];
  let visitedCount = 1;
  for (let depth = 0; depth < maxDepth; depth += 1) {
    const next: { states: number[]; path: Move[] }[] = [];
    for (const node of frontier) {
      for (const m of moveIdxs) {
        const states = node.states.map((st, i) => {
          const spec = specs[i];
          const table = spec.kind === 'edge' ? edge : corner;
          return table[st * 18 + m];
        });
        if (keepPolicy === 'prune' && !keepsOk(states)) continue;
        if (seen(states)) continue;
        mark(states);
        visitedCount += 1;
        const path = node.path.concat(MOVE_LIST[m]);
        if (isGoal(states)) return path;
        next.push({ states, path });
      }
    }
    if (visitedCount > nodeLimit) return null;
    if (next.length === 0) break;
    frontier = next;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 宏动作 BFS（cubie 级，签名 = 多块位置+贴纸朝向）
// ---------------------------------------------------------------------------

function multiSignature(cube: Cubie[], pieceKeys: Face[][]): string {
  return pieceKeys.map((colors) => {
    const p = findPiece(cube, colors);
    const faces = FACE_LIST.map((f) => (p.colors[f] ? stickerFace(p, p.colors[f]!) : '-')).join('');
    return `${p.pos.join(',')}|${faces}`;
  }).join('#');
}

/** 宏动作 BFS：goal(start) 已满足则返回 [] */
export function macroBfs(
  start: Cubie[],
  macros: Move[][],
  pieceKeys: Face[][],
  goal: (cube: Cubie[]) => boolean,
  maxDepth: number,
): Move[] | null {
  if (goal(start)) return [];
  const visited = new Set<string>([multiSignature(start, pieceKeys)]);
  let frontier: { cube: Cubie[]; path: Move[] }[] = [{ cube: start, path: [] }];
  for (let depth = 0; depth < maxDepth; depth += 1) {
    const next: { cube: Cubie[]; path: Move[] }[] = [];
    for (const node of frontier) {
      for (const macro of macros) {
        const cube = applyMoves(node.cube, macro);
        const key = multiSignature(cube, pieceKeys);
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

/** 单块完整签名（位置 + 每张贴纸朝向） */
export function pieceSignature(cube: Cubie[], colors: Face[]): string {
  const p = findPiece(cube, colors);
  const faces = FACE_LIST.map((f) => (p.colors[f] ? stickerFace(p, p.colors[f]!) : '-')).join('');
  return `${p.pos.join(',')}|${faces}`;
}

/** 某块是否完全归位 */
export function isPieceSolved(cube: Cubie[], colors: Face[]): boolean {
  const p = findPiece(cube, colors);
  for (const f of FACE_LIST) {
    const color = p.colors[f];
    if (!color) continue;
    if (faceOfVec(mulVec(p.rot, FACE_NORMAL[f])) !== color) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 阶段汇总工具
// ---------------------------------------------------------------------------

export function makePhase(key: string, name: string, hint: string, moves: Move[] | null): SolvePhase {
  return { key, name, hint, moves: moves ?? [] };
}

export function flattenPhases(phases: SolvePhase[]): Move[] {
  return phases.flatMap((p) => p.moves);
}

// ---------------------------------------------------------------------------
// 纯 EO 定向（Petrus 阶段 1）：12 bit 掩码全 0 的最短序列（4096 状态距离表）
// ---------------------------------------------------------------------------

const EO_DIST_SIZE = 4096;
let eoDistCache: Uint8Array | null = null;

export function getEoDist(): Uint8Array {
  if (eoDistCache) return eoDistCache;
  const dist = new Uint8Array(EO_DIST_SIZE).fill(255);
  const queue = new Int32Array(EO_DIST_SIZE);
  const invIdx = MOVE_LIST.map((m) => MOVE_LIST.indexOf(invertMoves([m])[0]));
  dist[0] = 0;
  let head = 0;
  let tail = 1;
  queue[0] = 0;
  while (head < tail) {
    const cur = queue[head];
    head += 1;
    const d = dist[cur];
    for (let m = 0; m < 18; m += 1) {
      const n = eoFlip(cur, invIdx[m]);
      if (dist[n] === 255) {
        dist[n] = d + 1;
        queue[tail] = n;
        tail += 1;
      }
    }
  }
  eoDistCache = dist;
  return dist;
}

/** 求把全部棱定向为 good 的最短序列 */
export function solveEoOnly(cubies: Cubie[]): Move[] | null {
  const dist = getEoDist();
  let mask = eoMaskOf(cubies);
  if (dist[mask] === 255) return null;
  const out: Move[] = [];
  let guard = 0;
  while (mask !== 0) {
    guard += 1;
    if (guard > 12) return null;
    let advanced = false;
    for (let m = 0; m < 18; m += 1) {
      const n = eoFlip(mask, m);
      if (dist[n] === dist[mask] - 1) {
        out.push(MOVE_LIST[m]);
        mask = n;
        advanced = true;
        break;
      }
    }
    if (!advanced) return null;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 宏动作版轻量块 BFS：状态 = targets+keeps 的 24 态编码，
// 转移按宏内单转逐步查表；keeps 在每步宏之后必须保持归位。
// ---------------------------------------------------------------------------

export function blockMacroBfs(
  cubies: Cubie[],
  targets: PieceSpec[],
  keeps: PieceSpec[],
  macros: Move[][],
  maxDepth: number,
  options: BlockBfsOptions = {},
): Move[] | null {
  const { keepPolicy = 'prune', nodeLimit = 400_000 } = options;
  const specs: PackedSpec[] = [...targets, ...keeps].map((p) =>
    p.kind === 'edge'
      ? { colors: p.colors, kind: p.kind, home: edgeHomeSlot(p.colors as [Face, Face]) * 2, oriN: 2 }
      : { colors: p.colors, kind: p.kind, home: cornerHomeSlot(p.colors) * 3, oriN: 3 },
  );
  const nTargets = targets.length;
  const edge = getEdgeMoveTable();
  const corner = getCornerMoveTable();
  const moveIdxOf = new Map<string, number>();
  for (let m = 0; m < 18; m += 1) moveIdxOf.set(MOVE_LIST[m], m);

  const startStates = specs.map((s) =>
    s.kind === 'edge' ? edgeStateOf(cubies, s.colors as [Face, Face]) : cornerStateOf(cubies, s.colors),
  );  const keepsOk = (states: number[]) => {
    for (let i = nTargets; i < specs.length; i += 1) {
      if (states[i] !== specs[i].home) return false;
    }
    return true;
  };
  const isGoal = (states: number[]) => {
    if (!keepsOk(states)) return false;
    for (let i = 0; i < nTargets; i += 1) {
      if (states[i] !== specs[i].home) return false;
    }
    return true;
  };
  if (isGoal(startStates)) return [];
  if (keepPolicy === 'prune' && !keepsOk(startStates)) return null;

  const keyOf = (states: number[]) => states.join(',');
  const visited = new Set<string>([keyOf(startStates)]);
  let frontier: { states: number[]; path: Move[] }[] = [{ states: startStates, path: [] }];
  let visitedCount = 1;
  for (let depth = 0; depth < maxDepth; depth += 1) {
    const next: { states: number[]; path: Move[] }[] = [];
    for (const node of frontier) {
      for (const macro of macros) {
        const states = node.states.slice();
        for (const mv of macro) {
          const m = moveIdxOf.get(mv);
          if (m === undefined) break;
          for (let i = 0; i < states.length; i += 1) {
            const table = specs[i].kind === 'edge' ? edge : corner;
            states[i] = table[states[i] * 18 + m];
          }
        }
        if (keepPolicy === 'prune' && !keepsOk(states)) continue;
        const key = keyOf(states);
        if (visited.has(key)) continue;
        visited.add(key);
        visitedCount += 1;
        const path = node.path.concat(macro);
        if (isGoal(states)) return path;
        next.push({ states, path });
      }
    }
    if (visitedCount > nodeLimit) return null;
    if (next.length === 0) break;
    frontier = next;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 最后层（CFOP / ZZ / Roux / Petrus 共用）
// ---------------------------------------------------------------------------

const TOP_EDGES: Face[][] = [
  ['U', 'F'],
  ['U', 'R'],
  ['U', 'B'],
  ['U', 'L'],
];

const TOP_CORNERS: Face[][] = [
  ['U', 'F', 'R'],
  ['U', 'R', 'B'],
  ['U', 'B', 'L'],
  ['U', 'L', 'F'],
];

function topEdgesOriented(cube: Cubie[]): boolean {
  return TOP_EDGES.every((colors) => stickerFace(findPiece(cube, colors), 'U') === 'U');
}

function topCornersOriented(cube: Cubie[]): boolean {
  return TOP_CORNERS.every((colors) => stickerFace(findPiece(cube, colors), 'U') === 'U');
}

function topCornersDone(cube: Cubie[]): boolean {
  return TOP_CORNERS.every((colors) => isPieceSolved(cube, colors));
}

function topEdgesDone(cube: Cubie[]): boolean {
  return TOP_EDGES.every((colors) => isPieceSolved(cube, colors));
}

/** 顶面十字（2 条 OLL 棱公式 × U 对齐） */
export function solveOllEdges(cube: Cubie[]): Move[] | null {
  const macros = withAligns(ALGS.ollEdge).concat(U_ALIGNS.slice(1));
  return macroBfs(cube, macros, TOP_EDGES, topEdgesOriented, 4);
}

/** 顶角定向（Sune / 反 Sune × U 对齐，保持 F2L） */
export function solveOllCorners(cube: Cubie[]): Move[] | null {
  const macros = withAligns(ALGS.sune).concat(U_ALIGNS.slice(1));
  return macroBfs(cube, macros, TOP_CORNERS.concat(TOP_EDGES), topCornersOriented, 5);
}

/** 顶角排列（A-perm × U 对齐 + 裸 U，可生成全部角置换） */
export function solvePllCorners(cube: Cubie[]): Move[] | null {
  const macros = withAligns([ALGS.aPerm, invertAlg(ALGS.aPerm)]).concat(U_ALIGNS.slice(1));
  return macroBfs(cube, macros, TOP_CORNERS, topCornersDone, 5);
}

/** 顶棱排列（U-perm / H-perm 的 U 共轭，角保持不动） */
export function solvePllEdges(cube: Cubie[]): Move[] | null {
  const macros = [ALGS.uPerm, invertAlg(ALGS.uPerm), ALGS.hPerm].flatMap((alg) => conjugates(alg));
  return macroBfs(cube, macros, TOP_EDGES, topEdgesDone, 4);
}

/** eoSafe 宏过滤：剔除含 F/B 四分之一转的宏（F2/B2 允许），保持棱定向 */
export function eoFilterMacros(list: Move[][]): Move[][] {
  return list.filter((macro) => !macro.some((mv) => mv === 'F' || mv === "F'" || mv === 'B' || mv === "B'"));
}

/** 顶层整体对齐（全部块归位但整体旋转时；无需对齐返回 null） */
export function finalAUF(cube: Cubie[]): Move[] | null {
  for (const align of [['U'], ['U2'], ["U'"]] as Move[][]) {
    if (applyMoves(cube, align).every(isCubieSolved)) return align;
  }
  return null;
}

/**
 * 松散底棱单件插入（Petrus 用：DF/DB 不属于 2×2×3 与 F2L 槽）。
 * 保持 keepsFn(c) 给出的全部已解块，EO 安全（默认），踢出-重排循环。
 */
export function solveLooseEdge(
  start: Cubie[],
  colors: [Face, Face],
  keepsFn: (c: Cubie[]) => PieceSpec[],
  eoSafe = true,
): Move[] | null {
  const allMoves: Move[] = [];
  let cur = start;
  const piece: PieceSpec = { colors, kind: 'edge' };
  const inv = (f: Face): Face => (f.length === 1 ? (`${f}'` as Face) : (f.slice(0, 1) as Face));
  const eoFilter = (mvs: Move[][]) =>
    eoSafe
      ? mvs.filter((mm) => !mm.some((mv) => mv === 'F' || mv === "F'" || mv === 'B' || mv === "B'"))
      : mvs;

  for (let guard = 0; guard < 10; guard += 1) {
    if (isPieceSolved(cur, colors)) return allMoves;
    const keeps = keepsFn(cur);

    // 快路径：多面保持性宏
    const macroSets: [Face, Face][] = [
      ['R', 'F'],
      ['R', 'B'],
      ['F', 'R'],
      ['B', 'R'],
    ];
    let done = false;
    for (const [a, b] of macroSets) {
      const path = blockMacroBfs(cur, [piece], keeps, eoFilter(f2lMacros(a, b)), 3);
      if (path && path.length > 0) {
        cur = applyMoves(cur, path);
        allMoves.push(...path);
        done = true;
        break;
      }
    }
    if (done) continue;

    // 完备搜索：全宏族 + 终态校验（EO 安全）
    const fullMacros = eoFilter([
      ...f2lMacros('R', 'F'),
      ...f2lMacros('F', 'R'),
      ...makeSlotMacros('B', 'R', { corner: true, midEdge: true, bottomEdge: true }),
      ...makeSlotMacros('B', 'F', { corner: true, midEdge: true, bottomEdge: true }),
    ]);
    const deep = blockMacroBfs(cur, [piece], keeps, fullMacros, 3, {
      keepPolicy: 'final',
      nodeLimit: 2_000_000,
    });
    if (deep && deep.length > 0) {
      cur = applyMoves(cur, deep);
      allMoves.push(...deep);
      continue;
    }

    // 踢出：保持 keeps 的三步触发（EO 安全）
    for (const [a, b] of macroSets) {
      const kicks = filterPreserving(
        eoFilter([
          [a, 'U', inv(a)],
          [inv(a), "U'", a],
          [b, 'U', inv(b)],
          [inv(b), "U'", b],
          [a, 'U2', inv(a)],
          [b, 'U2', inv(b)],
        ]),
        keeps,
      );
      if (kicks.length > 0) {
        const kick = kicks[guard % kicks.length];
        cur = applyMoves(cur, kick);
        allMoves.push(...kick);
        done = true;
        break;
      }
    }
    if (!done) break;
  }
  return isPieceSolved(cur, colors) ? allMoves : null;
}
