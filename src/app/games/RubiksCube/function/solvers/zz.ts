/**
 * ZZ 求解器
 *
 * 1. EOLine      —— 查距离表，一步得到「全部棱定向 + DF/DB 两棱归位」的最优序列
 * 2. 左块 1×2×3  —— 逐块插入（底线棱 → 左棱 ×2 → 左角 ×2），宏净保持已完成部分
 * 3. 右块 1×2×3  —— <R,U> 单转 BFS（轨道上不碰左块与底线，无需 keeps）
 * 4. 顶角定向    —— EO 已好，顶面十字自动成立，直接 Sune
 * 5. 顶角排列    —— A-perm + U
 * 6. 顶棱排列    —— U-perm / H-perm
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

/** 右块构建：<R,U> —— 构造上不碰左块/底线（其槽位不在 R/U 轨道） */
const RU_MOVES: Move[] = ['R', "R'", 'R2', 'U', "U'", 'U2'];

const RIGHT_BLOCK: PieceSpec[] = [
  { colors: ['D', 'F', 'R'], kind: 'corner' },
  { colors: ['D', 'R', 'B'], kind: 'corner' },
  { colors: ['D', 'R'], kind: 'edge' },
  { colors: ['F', 'R'], kind: 'edge' },
  { colors: ['B', 'R'], kind: 'edge' },
];

export function solveZZ(cubies: Cubie[]): {
  ok: boolean;
  phases: ReturnType<typeof makePhase>[];
  failedAt?: string;
} {
  const phases: ReturnType<typeof makePhase>[] = [];
  let cur = cubies;

  // 1. EOLine
  const eoline = solveEoLine(cur);
  if (!eoline) return { ok: false, phases, failedAt: 'eoline' };
  phases.push(makePhase('eoline', 'EOLine', '棱定向 + 底线两棱归位', eoline));
  cur = applyMoves(cur, eoline);

  // 2. 左块：逐块插入（单转完备搜索，final 校验保持底线与已完成块）
  const lineKeeps: PieceSpec[] = [
    { colors: ['D', 'F'], kind: 'edge' },
    { colors: ['D', 'B'], kind: 'edge' },
  ];
  const plan: InsertPlan[] = [
    {
      piece: { colors: ['D', 'L'], kind: 'edge' },
      moves: EO_SAFE_MOVES,
      maxDepth: 7,
    },
    {
      piece: { colors: ['F', 'L'], kind: 'edge' },
      moves: EO_SAFE_MOVES,
      maxDepth: 7,
    },
    {
      piece: { colors: ['B', 'L'], kind: 'edge' },
      moves: EO_SAFE_MOVES,
      maxDepth: 7,
    },
    {
      piece: { colors: ['D', 'L', 'F'], kind: 'corner' },
      moves: EO_SAFE_MOVES,
      maxDepth: 8,
    },
    {
      piece: { colors: ['D', 'B', 'L'], kind: 'corner' },
      moves: EO_SAFE_MOVES,
      maxDepth: 8,
    },
  ];
  const lb = insertPieceSequence(cur, plan, lineKeeps);
  if (!lb.ok) return { ok: false, phases, failedAt: 'left-block' };
  phases.push(makePhase('left-block', '左块 1×2×3', '底线保持，左侧五块逐块成块', lb.moves));
  cur = applyMoves(cur, lb.moves);

  // 3. 右块（<R,U> 轨道不含左块/底线槽位）
  const right = blockBfs(cur, RIGHT_BLOCK, [], RU_MOVES, 13, { nodeLimit: 8_000_000 });
  if (!right) return { ok: false, phases, failedAt: 'right-block' };
  phases.push(makePhase('right-block', '右块 1×2×3', '右侧五块成块', right));
  cur = applyMoves(cur, right);

  // 4~6. 最后层（棱已定向，跳过顶面十字）
  const ollCorner = solveOllCorners(cur);
  if (!ollCorner) return { ok: false, phases, failedAt: 'oll-corners' };
  phases.push(makePhase('oll-corners', '顶角定向', 'Sune 定向（棱已定向）', ollCorner));
  cur = applyMoves(cur, ollCorner);

  const pllCorner = solvePllCorners(cur);
  if (!pllCorner) return { ok: false, phases, failedAt: 'pll-corners' };
  phases.push(makePhase('pll-corners', '顶角排列', '角块循环归位', pllCorner));
  cur = applyMoves(cur, pllCorner);

  const pllEdge = solvePllEdges(cur);
  if (!pllEdge) return { ok: false, phases, failedAt: 'pll-edges' };
  phases.push(makePhase('pll-edges', '顶棱排列', '棱块循环归位', pllEdge));

  // 7. 对齐
  const cur2 = applyMoves(cur, pllEdge);
  const auf = finalAUF(cur2);
  if (auf) {
    phases.push(makePhase('align', '整体对齐', '顶层转到正确方位', auf));
  }

  return { ok: true, phases };
}
