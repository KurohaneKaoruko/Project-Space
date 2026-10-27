/**
 * Petrus 求解器（EO 先行变体）
 *
 * 原版 Petrus 的 EO 在 2×2×3 之后做，但 EO 修正必须动 F/B，
 * 会拆掉含 FL/BL 的块。这里把 EO 提前到第一步：
 *
 * 1. 边定向     —— 4096 状态距离表，最短 EO（≤6 步）
 * 2. 2×2×2 块  —— <U,D,L,R,F2,B2>（EO 保持）内 BFS
 * 3. 2×2×3 块  —— 扩展 DLF 角 + FL/DF 棱（标准 Petrus 2×2×3 = 2角5棱，
 *                 DF 属于块的一部分；此时 FL/DF 是目标非 keep，F2 直落合法）
 * 4. DR 底棱   —— R 面宏直落（R 转 EO 安全、构造上不碰左块）
 * 5. F2L ×2    —— f2lEngine（eoSafe）成对插入右前 / 右后槽
 * 6. 顶角定向   —— EO 已好，跳过顶面十字，直接 Sune
 * 7. 顶角排列   —— A-perm
 * 8. 顶棱排列   —— U-perm / H-perm
 * 9. 整体对齐
 */

import {
  applyMoves,
  type Cubie,
  type Face,
  type Move,
} from '../cubeEngine';
import {
  blockBfs,
  blockMacroBfs,
  eoFilterMacros,
  EO_SAFE_MOVES,
  f2lEngine,
  finalAUF,
  filterPreserving,
  isPieceSolved,
  makePhase,
  makeSlotMacros,
  solveEoOnly,
  solveOllCorners,
  solvePllCorners,
  solvePllEdges,
  type PieceSpec,
} from './shared';

/** 2×2×2 块：DBL 角 + DL / DB / BL 三棱 */
const BLOCK_222: PieceSpec[] = [
  { colors: ['D', 'B', 'L'], kind: 'corner' },
  { colors: ['D', 'L'], kind: 'edge' },
  { colors: ['D', 'B'], kind: 'edge' },
  { colors: ['B', 'L'], kind: 'edge' },
];

/** 扩展到 2×2×3：+ FL 棱 + DLF 角（标准 Petrus 2×2×3 = 2 角 5 棱；棱先角后与 ZZ 左块一致） */
const BLOCK_EXT: PieceSpec[] = [
  { colors: ['F', 'L'], kind: 'edge' },
  { colors: ['D', 'L', 'F'], kind: 'corner' },
];

/** 右侧两个 F2L 槽 */
const F2L_SLOTS: { key: string; corner: Face[]; edge: [Face, Face] }[] = [
  { key: 'f2l-fr', corner: ['D', 'F', 'R'], edge: ['F', 'R'] },
  { key: 'f2l-br', corner: ['D', 'R', 'B'], edge: ['B', 'R'] },
];

export function solvePetrus(cubies: Cubie[]): {
  ok: boolean;
  phases: ReturnType<typeof makePhase>[];
  failedAt?: string;
} {
  const phases: ReturnType<typeof makePhase>[] = [];
  let cur = cubies;

  // 1. 边定向
  const eo = solveEoOnly(cur);
  if (!eo) return { ok: false, phases, failedAt: 'eo' };
  phases.push(makePhase('eo', '边定向', '全部棱转为 good 状态', eo));
  cur = applyMoves(cur, eo);

  // 2. 2×2×2
  const b222 = blockBfs(cur, BLOCK_222, [], EO_SAFE_MOVES, 7);
  if (!b222) return { ok: false, phases, failedAt: 'block-2x2x2' };
  phases.push(makePhase('block-2x2x2', '2×2×2 块', '后左下角四块成块', b222));
  cur = applyMoves(cur, b222);

  // 3. DF 底棱（先于 FL：F2 直落时 FL 尚未成 keep，合法且 EO 安全）
  const baseKeepsPre: PieceSpec[] = [...BLOCK_222];
  let dfMoves: Move[] | null = null;
  if (!isPieceSolved(cur, ['D', 'F'])) {
    dfMoves = blockBfs(cur, [{ colors: ['D', 'F'], kind: 'edge' }], baseKeepsPre, EO_SAFE_MOVES, 8);
  }
  if (dfMoves === null && !isPieceSolved(cur, ['D', 'F'])) {
    return { ok: false, phases, failedAt: 'bottom-DF' };
  }
  if (dfMoves && dfMoves.length > 0) {
    phases.push(makePhase('bottom-DF', '底棱 DF', '保持 2×2×2，EO 安全直落', dfMoves));
    cur = applyMoves(cur, dfMoves);
  }
  baseKeepsPre.push({ colors: ['D', 'F'], kind: 'edge' });

  // 4. 2×2×3 逐件扩展（ZZ 左块同款：单件单转完备搜索，keeps 递增）
  for (const piece of BLOCK_EXT) {
    if (isPieceSolved(cur, piece.colors)) {
      baseKeepsPre.push({ colors: piece.colors, kind: piece.kind });
      continue;
    }
    const r = blockBfs(cur, [piece], baseKeepsPre, EO_SAFE_MOVES, 8, { keepPolicy: 'final', nodeLimit: 3_000_000 });
    if (!r) return { ok: false, phases, failedAt: `block-${piece.colors.join('')}` };
    phases.push(makePhase(`block-${piece.colors.join('')}`, `扩展 ${piece.colors.join('')}`, '单件归位（EO 保持）', r));
    cur = applyMoves(cur, r);
    baseKeepsPre.push({ colors: piece.colors, kind: piece.kind });
  }

  // 5. DR 底棱（R 面宏直落：R 转 EO 安全，且构造上不碰左块）
  let drMoves: Move[] | null = null;
  if (!isPieceSolved(cur, ['D', 'R'])) {
    const drPiece: PieceSpec = { colors: ['D', 'R'], kind: 'edge' };
    drMoves = blockMacroBfs(
      cur,
      [drPiece],
      baseKeepsPre,
      eoFilterMacros(filterPreserving(makeSlotMacros('R', 'F', { bottomEdge: true }), baseKeepsPre)),
      2,
    );
  }
  if (drMoves === null && !isPieceSolved(cur, ['D', 'R'])) {
    return { ok: false, phases, failedAt: 'bottom-DR' };
  }
  if (drMoves && drMoves.length > 0) {
    phases.push(makePhase('bottom-DR', '底棱 DR', '保持左块与 EO，R 面直落', drMoves));
    cur = applyMoves(cur, drMoves);
  }

  // 4. 右侧两槽 F2L（f2lEngine：保持左块 + 全部底棱，踢出重排）
  const baseKeeps: PieceSpec[] = [...baseKeepsPre];
  const f2l = f2lEngine(cur, F2L_SLOTS, baseKeeps, 'petrus', { eoSafe: true });
  if (!f2l.ok) return { ok: false, phases, failedAt: 'f2l' };
  cur = applyMoves(cur, f2l.moves);
  phases.push(makePhase('f2l', '右侧 F2L', '角+棱成对插入', f2l.moves));

  // 4b. 收尾检查：F2L 后底层应完整（DR 已在阶段 3b 归位；DF/DB 由 keeps 保证）

  // 5~7. 最后层（棱已定向）
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
  cur = applyMoves(cur, pllEdge);

  // 8. 对齐
  const auf = finalAUF(cur);
  if (auf) {
    phases.push(makePhase('align', '整体对齐', '顶层转到正确方位', auf));
    cur = applyMoves(cur, auf);
  }

  return { ok: true, phases };
}
