/**
 * Roux 求解器（EO-Line 先行变体）
 *
 * 原版 Roux 的 LSE 依赖 M 层转动，本引擎不支持中层；
 * 因此采用与 ZZ 相同的 EOLine 开局（这在该约束下是 Roux 的标准变体做法）：
 *
 * 1. EO-Line     —— 全部棱定向 + DF/DB 两棱归位（距离表最优）
 * 2. 左块 1×2×3  —— 五块群搜（EO 安全集内，块间不干扰）
 * 3. 右块 1×2×3  —— <R,U> 单转 BFS（构造上不碰左块与底线）
 * 4. CMLL 上半   —— 顶角定向（Sune，宏观保持双块）
 * 5. CMLL 下半   —— 顶角排列（A-perm + U）
 * 6. EPLL       —— 顶棱排列（U-perm / H-perm，EO 已好可直接用）
 * 7. 整体对齐
 */

import {
  applyMoves,
  type Cubie,
  type Move,
} from '../cubeEngine';
import {
  blockBfs,
  EO_SAFE_MOVES,
  finalAUF,
  insertPieceSequence,
  makePhase,
  solveEoLine,
  solveOllCorners,
  solvePllCorners,
  solvePllEdges,
  type InsertPlan,
  type PieceSpec,
} from './shared';

/** 右块构建：<R,U> —— 构造上不碰左块与底线（其槽位不在 R/U 轨道） */
const RU_MOVES: Move[] = ['R', "R'", 'R2', 'U', "U'", 'U2'];

const FIRST_BLOCK: PieceSpec[] = [
  { colors: ['D', 'L'], kind: 'edge' },
  { colors: ['F', 'L'], kind: 'edge' },
  { colors: ['B', 'L'], kind: 'edge' },
  { colors: ['D', 'L', 'F'], kind: 'corner' },
  { colors: ['D', 'B', 'L'], kind: 'corner' },
];

const SECOND_BLOCK: PieceSpec[] = [
  { colors: ['D', 'R'], kind: 'edge' },
  { colors: ['F', 'R'], kind: 'edge' },
  { colors: ['B', 'R'], kind: 'edge' },
  { colors: ['D', 'F', 'R'], kind: 'corner' },
  { colors: ['D', 'R', 'B'], kind: 'corner' },
];

export function solveRoux(cubies: Cubie[]): {
  ok: boolean;
  phases: ReturnType<typeof makePhase>[];
  failedAt?: string;
} {
  const phases: ReturnType<typeof makePhase>[] = [];
  let cur = cubies;

  // 1. EO-Line（棱定向 + DF/DB 归位）
  const eoline = solveEoLine(cur);
  if (!eoline) return { ok: false, phases, failedAt: 'eo-line' };
  phases.push(makePhase('eo-line', 'EO-Line', '棱定向 + 底线两棱归位', eoline));
  cur = applyMoves(cur, eoline);

  // 2. 左块：逐块插入（与 ZZ 同款——单转完备搜索，逐件 keeps 递增）
  const lineKeeps: PieceSpec[] = [
    { colors: ['D', 'F'], kind: 'edge' },
    { colors: ['D', 'B'], kind: 'edge' },
  ];
  const plan: InsertPlan[] = [
    { piece: { colors: ['D', 'L'], kind: 'edge' }, moves: EO_SAFE_MOVES, maxDepth: 7 },
    { piece: { colors: ['F', 'L'], kind: 'edge' }, moves: EO_SAFE_MOVES, maxDepth: 7 },
    { piece: { colors: ['B', 'L'], kind: 'edge' }, moves: EO_SAFE_MOVES, maxDepth: 7 },
    { piece: { colors: ['D', 'L', 'F'], kind: 'corner' }, moves: EO_SAFE_MOVES, maxDepth: 8 },
    { piece: { colors: ['D', 'B', 'L'], kind: 'corner' }, moves: EO_SAFE_MOVES, maxDepth: 8 },
  ];
  const fb = insertPieceSequence(cur, plan, lineKeeps);
  if (!fb.ok) return { ok: false, phases, failedAt: 'first-block' };
  phases.push(makePhase('first-block', '左块 1×2×3', '左侧五块成块（EO 保持）', fb.moves));
  cur = applyMoves(cur, fb.moves);

  // 3. 右块（<R,U> 轨道不含左块槽位与底线）
  const sb = blockBfs(cur, SECOND_BLOCK, [], RU_MOVES, 13, { nodeLimit: 8_000_000 });
  if (!sb) return { ok: false, phases, failedAt: 'second-block' };
  phases.push(makePhase('second-block', '右块 1×2×3', '右侧五块成块', sb));
  cur = applyMoves(cur, sb);

  // 4~6. CMLL + EPLL
  const ollCorner = solveOllCorners(cur);
  if (!ollCorner) return { ok: false, phases, failedAt: 'cmll-1' };
  phases.push(makePhase('cmll-1', 'CMLL · 定向', '顶角定向（双块保持）', ollCorner));
  cur = applyMoves(cur, ollCorner);

  const pllCorner = solvePllCorners(cur);
  if (!pllCorner) return { ok: false, phases, failedAt: 'cmll-2' };
  phases.push(makePhase('cmll-2', 'CMLL · 排列', '顶角循环归位', pllCorner));
  cur = applyMoves(cur, pllCorner);

  const pllEdge = solvePllEdges(cur);
  if (!pllEdge) return { ok: false, phases, failedAt: 'epll' };
  phases.push(makePhase('epll', 'EPLL', '顶棱循环归位', pllEdge));
  cur = applyMoves(cur, pllEdge);

  // 7. 对齐
  const auf = finalAUF(cur);
  if (auf) {
    phases.push(makePhase('align', '整体对齐', '顶层转到正确方位', auf));
  }

  return { ok: true, phases };
}
