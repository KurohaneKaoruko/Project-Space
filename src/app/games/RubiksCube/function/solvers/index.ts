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
