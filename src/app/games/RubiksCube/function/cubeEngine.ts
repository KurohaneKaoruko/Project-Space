/**
 * 3x3x3 魔方引擎
 *
 * 坐标系统一采用 CSS 3D 坐标系：x 向右、y 向下、z 朝向观察者。
 * 因此 U 面为 y = -1，D 面为 y = +1，F 面为 z = +1。
 *
 * 状态以 26 个“块”（cubie）描述：
 *   pos     —— 当前所处的格点坐标，每个分量取 -1 / 0 / 1
 *   rot     —— 3x3 整数旋转矩阵，表示该块的朝向（贴纸随之旋转）
 *   colors  —— 该块各局部面上贴的颜色，转动过程中恒定
 * 这套表示天然满足“贴纸跟着块走”，渲染与逻辑共用同一份数据。
 */

export type Face = 'U' | 'D' | 'F' | 'B' | 'R' | 'L';
export type MoveSuffix = '' | "'" | '2';
export type Move = `${Face}${MoveSuffix}`;

export type Vec3 = readonly [number, number, number];
export type Mat3 = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
];

export interface Cubie {
  /** 稳定 id，供 React 作为 key 使用 */
  id: number;
  pos: Vec3;
  rot: Mat3;
  colors: Record<Face, Face | null>;
  /** 颜色集合指纹（排序后拼接），用于快速定位某个块 */
  key: string;
}

export const FACE_LIST: Face[] = ['U', 'D', 'F', 'B', 'R', 'L'];

/** 各面外法线（CSS 坐标系，y 向下） */
export const FACE_NORMAL: Record<Face, Vec3> = {
  U: [0, -1, 0],
  D: [0, 1, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
  R: [1, 0, 0],
  L: [-1, 0, 0],
};

/** 贴纸配色：上白下黄、前绿后蓝、右红左橙 */
export const FACE_COLORS: Record<Face, string> = {
  U: '#f7f8fa',
  D: '#f5c518',
  F: '#1fa85c',
  B: '#1f6feb',
  R: '#dc3b3b',
  L: '#f07d1a',
};

/** 贴纸的深色描边，让色块有塑料质感 */
export const FACE_COLORS_DARK: Record<Face, string> = {
  U: '#c9ccd4',
  D: '#b98f04',
  F: '#137a40',
  B: '#134a9e',
  R: '#9c2323',
  L: '#a9530c',
};

const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** 各面顺时针 90° 的旋转矩阵（行主序） */
const BASE_ROT: Record<Face, Mat3> = {
  U: [0, 0, -1, 0, 1, 0, 1, 0, 0],
  D: [0, 0, 1, 0, 1, 0, -1, 0, 0],
  R: [1, 0, 0, 0, 0, -1, 0, 1, 0],
  L: [1, 0, 0, 0, 0, 1, 0, -1, 0],
  F: [0, -1, 0, 1, 0, 0, 0, 0, 1],
  B: [0, 1, 0, -1, 0, 0, 0, 0, 1],
};

/** 18 种基本转动，索引固定，供查找表复用 */
export const MOVE_LIST: Move[] = FACE_LIST.flatMap((f) => [f, `${f}'`, `${f}2`] as Move[]);
export const MOVE_FACES: Face[] = MOVE_LIST.map((m) => m[0] as Face);
export const MOVE_TURNS: number[] = MOVE_LIST.map((m) => (m.length === 1 ? 1 : m[1] === '2' ? 2 : 3));

export function mulVec(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

export function mulMat(a: Mat3, b: Mat3): Mat3 {
  const r = new Array<number>(9);
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    }
  }
  return r as unknown as Mat3;
}

export function matPow(m: Mat3, turns: number): Mat3 {
  const t = ((turns % 4) + 4) % 4;
  let out = IDENTITY;
  for (let i = 0; i < t; i += 1) out = mulMat(m, out);
  return out;
}

export function sameVec(a: Vec3, b: Vec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/** 把单位轴向量映射回面 */
export function faceOfVec(v: Vec3): Face {
  if (v[1] === -1) return 'U';
  if (v[1] === 1) return 'D';
  if (v[2] === 1) return 'F';
  if (v[2] === -1) return 'B';
  if (v[0] === 1) return 'R';
  return 'L';
}

export function onFace(pos: Vec3, face: Face): boolean {
  const n = FACE_NORMAL[face];
  return pos[0] * n[0] + pos[1] * n[1] + pos[2] * n[2] === 1;
}

export function parseMove(move: Move): { face: Face; turns: number } {
  const face = move[0] as Face;
  const suffix = move.slice(1);
  return { face, turns: suffix === '' ? 1 : suffix === '2' ? 2 : 3 };
}

export function invertMove(move: Move): Move {
  const { face, turns } = parseMove(move);
  if (turns === 2) return move;
  return (turns === 1 ? `${face}'` : face) as Move;
}

export function invertMoves(moves: Move[]): Move[] {
  return moves.slice().reverse().map(invertMove);
}

function colorKeyOf(colors: Record<Face, Face | null>): string {
  return FACE_LIST.filter((f) => colors[f]).map((f) => colors[f]).sort().join('');
}

export function createSolvedCube(): Cubie[] {
  const cubies: Cubie[] = [];
  let id = 0;
  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let z = -1; z <= 1; z += 1) {
        if (x === 0 && y === 0 && z === 0) continue;
        const colors: Record<Face, Face | null> = { U: null, D: null, F: null, B: null, R: null, L: null };
        if (y === -1) colors.U = 'U';
        if (y === 1) colors.D = 'D';
        if (z === 1) colors.F = 'F';
        if (z === -1) colors.B = 'B';
        if (x === 1) colors.R = 'R';
        if (x === -1) colors.L = 'L';
        cubies.push({
          id: id += 1,
          pos: [x, y, z],
          rot: IDENTITY,
          colors,
          key: colorKeyOf(colors),
        });
      }
    }
  }
  return cubies;
}

export function applyMove(cubies: Cubie[], move: Move): Cubie[] {
  const { face, turns } = parseMove(move);
  const m = matPow(BASE_ROT[face], turns);
  return cubies.map((c) => {
    if (!onFace(c.pos, face)) return c;
    return { ...c, pos: mulVec(m, c.pos), rot: mulMat(m, c.rot) };
  });
}

export function applyMoves(cubies: Cubie[], moves: Move[]): Cubie[] {
  let cur = cubies;
  for (const move of moves) cur = applyMove(cur, move);
  return cur;
}

/** 某个块上指定颜色贴纸当前朝向哪个面 */
export function stickerFace(cubie: Cubie, color: Face): Face {
  const localFace = FACE_LIST.find((f) => cubie.colors[f] === color);
  if (!localFace) throw new Error(`cubie has no sticker of color ${color}`);
  return faceOfVec(mulVec(cubie.rot, FACE_NORMAL[localFace]));
}

/** 该块是否完全归位：每张贴纸都朝向它应该朝向的面 */
export function isCubieSolved(cubie: Cubie): boolean {
  for (const f of FACE_LIST) {
    const color = cubie.colors[f];
    if (!color) continue;
    if (faceOfVec(mulVec(cubie.rot, FACE_NORMAL[f])) !== color) return false;
  }
  return true;
}

export function isSolved(cubies: Cubie[]): boolean {
  return cubies.every(isCubieSolved);
}

/** 按颜色集合定位一个块（如 ['D','F'] 为底前棱） */
export function findPiece(cubies: Cubie[], colors: Face[]): Cubie {
  const key = colors.slice().sort().join('');
  for (const c of cubies) {
    if (c.key === key) return c;
  }
  throw new Error(`piece not found: ${colors.join('')}`);
}

export function findPieces(cubies: Cubie[], colorsList: Face[][]): Cubie[] {
  return colorsList.map((colors) => findPiece(cubies, colors));
}

/** 合并同一面上的连续转动，消除互相抵消的步骤 */
export function simplifyMoves(moves: Move[]): Move[] {
  const out: Move[] = [];
  for (const move of moves) {
    const { face, turns } = parseMove(move);
    const last = out[out.length - 1];
    if (last && last[0] === face) {
      const prev = parseMove(last);
      const total = (prev.turns + turns) % 4;
      out.pop();
      if (total !== 0) out.push((total === 1 ? face : total === 2 ? `${face}2` : `${face}'`) as Move);
      continue;
    }
    out.push(move);
  }
  return out;
}

/** 随机打乱序列，避免同一面连续出现与「转动—反转动」的空转 */
export function generateScramble(length: number, rng: () => number = Math.random): Move[] {
  const moves: Move[] = [];
  const suffixes: MoveSuffix[] = ['', "'", '2'];
  let lastFace: Face | null = null;
  let beforeLast: Face | null = null;
  while (moves.length < length) {
    const face = FACE_LIST[Math.floor(rng() * 6)];
    if (face === lastFace) continue;
    if (face === beforeLast && isOpposite(face, lastFace)) continue;
    const suffix = suffixes[Math.floor(rng() * 3)];
    moves.push(`${face}${suffix}` as Move);
    beforeLast = lastFace;
    lastFace = face;
  }
  return moves;
}

function isOpposite(a: Face | null, b: Face | null): boolean {
  if (!a || !b) return false;
  const pairs: Record<Face, Face> = { U: 'D', D: 'U', F: 'B', B: 'F', R: 'L', L: 'R' };
  return pairs[a] === b;
}

/** 一个可复现的伪随机数发生器（mulberry32），用于测试与「同一步骤重放」 */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function moveToMatrix(move: Move): Mat3 {
  const { face, turns } = parseMove(move);
  return matPow(BASE_ROT[face], turns);
}

export const CUBIE_FACE_ORDER: Face[] = FACE_LIST;
