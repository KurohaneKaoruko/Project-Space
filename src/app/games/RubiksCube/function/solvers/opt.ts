/**
 * 近似最短优化器（OPT）
 *
 * 思路：先拿到 LBL 的可行解，再对解序列做「局部窗口最短化」——
 * 对每个长度 ≤5 的窗口，用 IDDFS 在轻量 20 块整数状态空间里
 * 搜索效果完全相同但更短的替代序列，反复迭代直到不动点。
 *
 * 不是全局最优（那是 Kociemba 级别的工程），但能把 100+ 步的
 * 分层解压短一截，且全程确定性。
 *
 * 剪枝合法性：同一轴的两个转动相互交换（如 R L = L R），
 * 因此任何序列都能规范化为「同轴转动相邻且按固定面序分组」，
 * 搜索时禁止相邻同轴转动不丢完备性。
 */

import { simplifyMoves, type Cubie, type Face, type Move } from '../cubeEngine';
import { solveCube } from '../solver';
import {
  CORNER_SLOTS,
  EDGE_SLOTS,
  cornerStateOf,
  edgeStateOf,
  getCornerMoveTable,
  getEdgeMoveTable,
} from './shared';

const WINDOW_MAX = 5;
const PASS_MAX = 4;

const MOVE_LIST: Move[] = [
  'U', "U'", 'U2', 'D', "D'", 'D2',
  'L', "L'", 'L2', 'R', "R'", 'R2',
  'F', "F'", 'F2', 'B', "B'", 'B2',
];

const MOVE_TO_IDX = new Map<string, number>(MOVE_LIST.map((m, i) => [m, i]));

/** 轴编号：UD=0, LR=1, FB=2；同轴内面序：UD 中 D=0/U=1，LR 中 L=0/R=1，FB 中 B=0/F=1 */
const AXIS_OF = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2];
const FACE_RANK = [1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0];

/** 20 块整数全状态：12 棱（EDGE_SLOTS 序）+ 8 角（CORNER_SLOTS 序） */
type FullState = number[];

function fullStateOf(cubies: Cubie[]): FullState {
  const out: number[] = [];
  for (const s of EDGE_SLOTS) out.push(edgeStateOf(cubies, s.faces as [Face, Face]));
  for (const s of CORNER_SLOTS) out.push(cornerStateOf(cubies, s.faces));
  return out;
}

function stepState(state: FullState, moveIdx: number): FullState {
  const edge = getEdgeMoveTable();
  const corner = getCornerMoveTable();
  const out = state.slice();
  for (let i = 0; i < 12; i += 1) out[i] = edge[out[i] * 18 + moveIdx];
  for (let i = 12; i < 20; i += 1) out[i] = corner[out[i] * 18 + moveIdx];
  return out;
}

function statesEqual(a: FullState, b: FullState): boolean {
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/** IDDFS：找 s0 → target 的最短序列（≤ maxDepth）。
 *  剪枝：同轴转动相互交换，可规范化为同轴按面序排列 ⟹ 禁止
 *  「相邻同轴且面序 ≤ 前一个」的转动，不丢完备性。 */
function findReplacement(s0: FullState, target: FullState, maxDepth: number): Move[] | null {
  const path: Move[] = [];

  const dfs = (state: FullState, budget: number, prev: number): boolean => {
    if (statesEqual(state, target)) return true;
    if (budget === 0) return false;
    for (let m = 0; m < 18; m += 1) {
      if (prev >= 0 && AXIS_OF[m] === AXIS_OF[prev] && FACE_RANK[m] <= FACE_RANK[prev]) continue;
      path.push(MOVE_LIST[m]);
      if (dfs(stepState(state, m), budget - 1, m)) return true;
      path.pop();
    }
    return false;
  };

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    path.length = 0;
    if (dfs(s0, depth, -1)) return path.slice();
  }
  return null;
}

/** 对整条解做迭代局部最短化 */
export function optimizeSolution(cubies: Cubie[], solution: Move[]): Move[] {
  let moves = simplifyMoves(solution);
  if (moves.length === 0) return moves;

  for (let pass = 0; pass < PASS_MAX; pass += 1) {
    // 前缀状态缓存：prefixStates[i] = 从初始状态施加前 i 步后的状态
    const prefixStates: FullState[] = [fullStateOf(cubies)];
    let valid = true;
    for (let i = 0; i < moves.length; i += 1) {
      const idx = MOVE_TO_IDX.get(moves[i]);
      if (idx === undefined) {
        valid = false;
        break;
      }
      prefixStates.push(stepState(prefixStates[i], idx));
    }
    if (!valid) break;

    let changed = false;
    for (let i = 0; !changed && i + 2 <= moves.length; i += 1) {
      for (let len = Math.min(WINDOW_MAX, moves.length - i); len >= 2; len -= 1) {
        const win = moves.slice(i, i + len);
        const s0 = prefixStates[i];
        let target = s0;
        for (const mv of win) target = stepState(target, MOVE_TO_IDX.get(mv)!);
        const rep = findReplacement(s0, target, len - 1);
        if (rep && rep.length < len) {
          moves = [...moves.slice(0, i), ...rep, ...moves.slice(i + len)];
          changed = true;
          break;
        }
      }
    }

    moves = simplifyMoves(moves);
    if (!changed) break;
  }

  return moves;
}

export interface OptResult {
  ok: boolean;
  moves: Move[];
  originalLength: number;
  failedAt?: string;
}

/** OPT 入口：LBL 求解 + 局部最短化 */
export function solveOpt(cubies: Cubie[]): OptResult {
  const base = solveCube(cubies);
  if (!base.ok) return { ok: false, moves: [], originalLength: 0, failedAt: base.failedAt };
  const optimized = optimizeSolution(cubies, base.moves);
  return { ok: true, moves: optimized, originalLength: base.moves.length };
}
