/**
 * CFOP 求解器
 *
 * 1. 底面十字   —— 复用 LBL 的全状态 BFS（最优十字）
 * 2. F2L ×4    —— f2lEngine（保持性宏 + 贪心槽位 + 踢出重排）
 * 3. 顶面十字   —— 2-look OLL（棱公式宏 BFS）
 * 4. 顶角定向   —— Sune / 反 Sune
 * 5. 顶角排列   —— A-perm + U
 * 6. 顶棱排列   —— U-perm / H-perm
 * 7. 整体对齐
 */

import {
  applyMoves,
  type Cubie,
  type Face,
} from '../cubeEngine';
import { solveCross } from '../solver';
import {
  f2lEngine,
  finalAUF,
  makePhase,
  solveOllCorners,
  solveOllEdges,
  solvePllCorners,
  solvePllEdges,
  type PieceSpec,
} from './shared';

/** 四个 F2L 槽位：角 + 棱 */
const F2L_SLOTS: { corner: Face[]; edge: [Face, Face] }[] = [
  { corner: ['D', 'F', 'R'], edge: ['F', 'R'] },
  { corner: ['D', 'R', 'B'], edge: ['B', 'R'] },
  { corner: ['D', 'B', 'L'], edge: ['B', 'L'] },
  { corner: ['D', 'L', 'F'], edge: ['F', 'L'] },
];

export function solveCfop(cubies: Cubie[]): {
  ok: boolean;
  phases: ReturnType<typeof makePhase>[];
  failedAt?: string;
} {
  const phases: ReturnType<typeof makePhase>[] = [];
  let cur = cubies;

  // 1. 十字
  const cross = solveCross(cur);
  if (!cross) return { ok: false, phases, failedAt: 'cross' };
  phases.push(makePhase('cross', '底面十字', '底层十字一次成型', cross));
  cur = applyMoves(cur, cross);

  // 2. F2L
  const crossKeeps: PieceSpec[] = [
    { colors: ['D', 'F'], kind: 'edge' },
    { colors: ['D', 'R'], kind: 'edge' },
    { colors: ['D', 'B'], kind: 'edge' },
    { colors: ['D', 'L'], kind: 'edge' },
  ];
  const f2l = f2lEngine(cur, F2L_SLOTS, crossKeeps, 'cfop');
  if (!f2l.ok) return { ok: false, phases, failedAt: 'f2l' };
  cur = applyMoves(cur, f2l.moves);
  phases.push(makePhase('f2l', 'F2L', '四槽成对插入', f2l.moves));

  // 3~6. 最后层
  const ollEdge = solveOllEdges(cur);
  if (!ollEdge) return { ok: false, phases, failedAt: 'oll-edges' };
  phases.push(makePhase('oll-edges', '顶面十字', '顶层棱定向', ollEdge));
  cur = applyMoves(cur, ollEdge);

  const ollCorner = solveOllCorners(cur);
  if (!ollCorner) return { ok: false, phases, failedAt: 'oll-corners' };
  phases.push(makePhase('oll-corners', '顶面定向', '顶层角定向', ollCorner));
  cur = applyMoves(cur, ollCorner);

  const pllCorner = solvePllCorners(cur);
  if (!pllCorner) return { ok: false, phases, failedAt: 'pll-corners' };
  phases.push(makePhase('pll-corners', '顶层角块', '角块循环归位', pllCorner));
  cur = applyMoves(cur, pllCorner);

  const pllEdge = solvePllEdges(cur);
  if (!pllEdge) return { ok: false, phases, failedAt: 'pll-edges' };
  phases.push(makePhase('pll-edges', '顶层棱块', '棱块循环归位', pllEdge));
  cur = applyMoves(cur, pllEdge);

  // 7. 对齐
  const auf = finalAUF(cur);
  if (auf) {
    phases.push(makePhase('align', '整体对齐', '顶层转到正确方位', auf));
  }

  return { ok: true, phases };
}
