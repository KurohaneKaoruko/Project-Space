/**
 * 求解器统一入口：注册全部方法，供 UI 选择与调用。
 */

import type { Cubie, Move } from '../cubeEngine';
import { solveCube as solveLbl, warmUpSolver, type SolveResult } from '../solver';
import { solveCfop } from './cfop';
import { solveOpt } from './opt';
import { solvePetrus } from './petrus';
import { solveRoux } from './roux';
import { warmUpEoLine } from './shared';
import { solveZZ } from './zz';

export type SolverId = 'lbl' | 'cfop' | 'petrus' | 'zz' | 'roux' | 'opt';

export interface SolverMeta {
  id: SolverId;
  name: string;
  en: string;
  hint: string;
}

export const SOLVER_LIST: SolverMeta[] = [
  { id: 'lbl', name: '分层还原', en: 'LBL', hint: '七阶段逐层还原，教学演示首选' },
  { id: 'cfop', name: '速拧 CFOP', en: 'CFOP', hint: '十字 + F2L 成对插入 + 4-look 末层' },
  { id: 'petrus', name: '块构建 Petrus', en: 'Petrus', hint: '边定向 + 2×2×2 / 2×2×3 成块推进' },
  { id: 'zz', name: 'ZZ', en: 'ZZ', hint: 'EOLine 一次定向，末层自动带十字' },
  { id: 'roux', name: 'Roux', en: 'Roux', hint: '双 1×2×3 块 + CMLL，步数最少的方法之一' },
  { id: 'opt', name: '近似最短', en: 'OPT', hint: '分层解 + 局部窗口最短化，明显更短' },
];

export function getSolverMeta(id: SolverId): SolverMeta {
  return SOLVER_LIST.find((s) => s.id === id) ?? SOLVER_LIST[0];
}

function phaseOfSingle(name: string, hint: string, moves: Move[]) {
  return [{ key: 'opt', name, hint, moves }];
}

/** 按求解器 ID 求解；返回与 LBL 同构的 SolveResult */
export function solveWith(id: SolverId, cubies: Cubie[]): SolveResult {
  if (id === 'lbl') {
    // 延迟 require 会破坏打包，直接同步 import 已在顶部声明
    return solveLbl(cubies);
  }
  if (id === 'opt') {
    const r = solveOpt(cubies);
    if (!r.ok) return { ok: false, phases: [], moves: [], failedAt: r.failedAt };
    const phases = phaseOfSingle('近似最短', `LBL ${r.originalLength} 步优化至 ${r.moves.length} 步`, r.moves);
    return { ok: true, phases, moves: r.moves };
  }

  const r =
    id === 'cfop'
      ? solveCfop(cubies)
      : id === 'zz'
        ? solveZZ(cubies)
        : id === 'roux'
          ? solveRoux(cubies)
          : solvePetrus(cubies);

  if (!r.ok) return { ok: false, phases: [], moves: [], failedAt: r.failedAt };
  const { phases } = r;
  return { ok: true, phases, moves: phases.flatMap((p) => p.moves) };
}

/** 各方法的还原流程预览（无解时展示；与各求解器 makePhase 的阶段命名一致） */
export const SOLVER_FLOW: Record<SolverId, { name: string; hint: string }[]> = {
  lbl: [
    { name: '底面十字', hint: '把 4 个底面棱块归位，形成十字' },
    { name: '底角归位', hint: '完成整个底层' },
    { name: '中层棱块', hint: '插入 4 个中层棱块，前两层完成' },
    { name: '顶面十字', hint: '让顶层 4 个棱块的顶色朝上' },
    { name: '顶面定向', hint: '让顶层 4 个角块的顶色朝上' },
    { name: '顶层角块', hint: '把 4 个顶角转到正确位置' },
    { name: '顶层棱块', hint: '调整顶层棱块，完成还原' },
  ],
  cfop: [
    { name: '底面十字', hint: '查找表一次成型底层十字' },
    { name: 'F2L', hint: '四槽角棱成对插入，前两层完成' },
    { name: '顶面十字', hint: '顶层棱定向' },
    { name: '顶面定向', hint: '顶层角定向' },
    { name: '顶层角块', hint: '角块循环归位' },
    { name: '顶层棱块', hint: '棱块循环归位，完成还原' },
  ],
  petrus: [
    { name: '边定向', hint: '全部棱转为 good 状态' },
    { name: '2×2×2 块', hint: '后左下角四块成块' },
    { name: '底棱 DF', hint: '保持 2×2×2，EO 安全直落' },
    { name: '扩展 2×2×3', hint: 'FL 棱 + DLF 角逐件归位' },
    { name: '底棱 DR', hint: '保持左块与 EO，R 面直落' },
    { name: '右侧 F2L', hint: '角+棱成对插入两槽' },
    { name: '末层', hint: '顶角定向 / 排列 + 顶棱排列' },
  ],
  zz: [
    { name: 'EO-Line', hint: '棱定向 + DF/DB 两棱归位' },
    { name: '左块 1×2×3', hint: '左侧五块逐件成块（EO 保持）' },
    { name: '右块 1×2×3', hint: '<R,U> 内构建，构造上不碰左块' },
    { name: '顶面定向', hint: 'EO 已好，跳过顶面十字直接角定向' },
    { name: '顶层角块', hint: '角块循环归位' },
    { name: '顶层棱块', hint: '棱块循环归位，完成还原' },
  ],
  roux: [
    { name: 'EO-Line', hint: '棱定向 + 底线两棱归位' },
    { name: '左块 1×2×3', hint: '左侧五块成块（EO 保持）' },
    { name: '右块 1×2×3', hint: '右侧五块成块' },
    { name: 'CMLL · 定向', hint: '顶角定向（双块保持）' },
    { name: 'CMLL · 排列', hint: '顶角循环归位' },
    { name: 'EPLL', hint: '顶棱循环归位，完成还原' },
  ],
  opt: [
    { name: '分层还原', hint: '先取得 LBL 完整解' },
    { name: '窗口最短化', hint: '滑动窗口内 IDDFS 搜更短序列' },
    { name: '输出', hint: '明显短于 LBL 的等效解' },
  ],
};

/**
 * 后台预热：LBL 十字表（全部方法受益）+ EOLine 表（ZZ/Roux/Petrus）。
 * 在页面空闲时调用，避免首次求解卡顿。
 */
export function warmUpSolvers(id: SolverId): void {
  warmUpSolver();
  if (id === 'zz' || id === 'roux' || id === 'petrus') {
    // EOLine 表构建约 0.5-1s，错过首帧无所谓（后台 setTimeout 内执行）
    warmUpEoLine();
  }
}
