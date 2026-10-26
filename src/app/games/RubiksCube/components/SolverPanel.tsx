'use client';

import { useEffect, useMemo, useRef } from 'react';
import { PHASE_META, type SolveResult } from '../function/solver';

const SPEEDS = [
  { label: '慢', ms: 240 },
  { label: '标准', ms: 110 },
  { label: '快', ms: 55 },
  { label: '极速', ms: 24 },
];

interface Props {
  solution: SolveResult | null;
  aiApplied: number;
  computing: boolean;
  paused: boolean;
  error: string | null;
  speed: number;
  solved: boolean;
  busy: boolean;
  onSpeed: (ms: number) => void;
  onSolve: () => void;
  onPause: () => void;
  onResume: () => void;
  onStepForward: () => void;
  onStepBack: () => void;
  onSkip: () => void;
  onClear: () => void;
}

export default function SolverPanel({
  solution,
  aiApplied,
  computing,
  paused,
  error,
  speed,
  solved,
  busy,
  onSpeed,
  onSolve,
  onPause,
  onResume,
  onStepForward,
  onStepBack,
  onSkip,
  onClear,
}: Props) {
  const chipRef = useRef<HTMLSpanElement | null>(null);
  const total = solution?.moves.length ?? 0;
  const finished = solution !== null && aiApplied >= total;

  const phases = useMemo(() => {
    if (!solution) return [];
    let acc = 0;
    return solution.phases.map((phase) => {
      const start = acc;
      acc += phase.moves.length;
      return { ...phase, start };
    });
  }, [solution]);

  const currentPhase = useMemo(() => {
    if (!solution) return -1;
    if (aiApplied >= total) return phases.length - 1;
    const idx = phases.findIndex((p) => aiApplied >= p.start && aiApplied < p.start + p.moves.length);
    return idx < 0 ? 0 : idx;
  }, [solution, phases, aiApplied, total]);

  useEffect(() => {
    chipRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [aiApplied]);

  const statusText = computing
    ? '计算解法…'
    : !solution
      ? solved
        ? '魔方已还原'
        : '等待求解'
      : finished
        ? '还原完成'
        : paused
          ? `已暂停 · ${aiApplied}/${total}`
          : `执行中 ${aiApplied}/${total}`;

  return (
    <section className="w-full xl:h-full xl:min-h-0 flex flex-col gap-3 bg-white/85 backdrop-blur-sm border border-zinc-200 shadow-xl shadow-zinc-200/40 rounded-lg p-4">
      {/* 头部（固定） */}
      <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-blue-600 rounded-full" />
          <div className="text-sm font-bold text-zinc-800 tracking-wide">AI 求解器</div>
        </div>
        <div className="px-2 py-1 bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-mono font-bold rounded">
          LBL · 7 STAGE
        </div>
      </div>

      {/* 状态（固定） */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${
            computing
              ? 'bg-amber-400 animate-pulse'
              : solution && !finished
                ? 'bg-blue-500 animate-pulse'
                : 'bg-zinc-300'
          }`}
        />
        <span className="text-[11px] font-mono text-zinc-500 tracking-wider truncate">
          {statusText}
        </span>
        {solution ? (
          <span className="ml-auto text-[10px] font-mono text-zinc-400 shrink-0">
            {total} 步 · {phases.length} 阶段
          </span>
        ) : null}
      </div>

      {/* 主按钮（固定） */}
      {!solution || finished ? (
        <button
          type="button"
          onClick={onSolve}
          disabled={computing || busy || solved}
          className="w-full px-4 py-3 bg-blue-600 text-white text-xs font-bold tracking-[0.2em] uppercase rounded-md shadow-lg shadow-blue-600/25 hover:bg-blue-500 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none shrink-0"
        >
          {computing ? '求解中…' : solved ? '无需还原' : '开始还原'}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={paused ? onResume : onPause}
            className="px-4 py-2.5 bg-blue-600 text-white text-xs font-bold tracking-wider uppercase rounded-md shadow-lg shadow-blue-600/25 hover:bg-blue-500 transition-all active:scale-[0.98]"
          >
            {paused ? '继续' : '暂停'}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-2.5 bg-white border-2 border-zinc-100 text-zinc-600 text-xs font-bold tracking-wider uppercase hover:border-zinc-300 hover:text-zinc-900 transition-all rounded-md active:scale-[0.98]"
          >
            直接完成
          </button>
          <button
            type="button"
            onClick={onStepBack}
            disabled={aiApplied === 0}
            className="px-3 py-2 bg-white border border-zinc-200 text-zinc-500 text-[11px] font-bold tracking-wider rounded-md hover:border-zinc-300 hover:text-zinc-900 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← 上一步
          </button>
          <button
            type="button"
            onClick={onStepForward}
            disabled={aiApplied >= total}
            className="px-3 py-2 bg-white border border-zinc-200 text-zinc-500 text-[11px] font-bold tracking-wider rounded-md hover:border-zinc-300 hover:text-zinc-900 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            下一步 →
          </button>
        </div>
      )}

      {error ? (
        <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 shrink-0">
          {error}
        </div>
      ) : null}

      {/* 中段：阶段列表 + 步骤序列（弹性区，内部滚动，永不撑开面板） */}
      <div className="flex-1 min-h-0 flex flex-col gap-2.5">
        <div className="flex-1 min-h-[84px] overflow-y-auto hide-scrollbar">
          <div className="text-[10px] font-bold text-zinc-400 font-mono uppercase tracking-wider mb-1.5">
            {solution ? '还原阶段' : '还原流程预览'}
          </div>

          {solution ? (
            <div className="space-y-1">
              {phases.map((phase, i) => {
                const done = Math.min(Math.max(aiApplied - phase.start, 0), phase.moves.length);
                const ratio = phase.moves.length === 0 ? 0 : done / phase.moves.length;
                const active = i === currentPhase && !finished;
                return (
                  <div
                    key={phase.key}
                    className={`flex items-center gap-2 rounded border px-2 py-1 transition-colors ${
                      active ? 'border-blue-200 bg-blue-50/60' : 'border-zinc-100 bg-zinc-50/40'
                    }`}
                  >
                    <span
                      className={`text-[9px] font-mono font-bold w-4 shrink-0 ${
                        active ? 'text-blue-600' : 'text-zinc-300'
                      }`}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={`text-[11px] font-bold shrink-0 ${
                        active ? 'text-blue-900' : 'text-zinc-500'
                      }`}
                    >
                      {phase.name}
                    </span>
                    <div className="flex-1 h-[3px] bg-zinc-200/70 rounded-full overflow-hidden min-w-0">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          ratio >= 1 ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-zinc-400 shrink-0 tabular-nums">
                      {done}/{phase.moves.length}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              {PHASE_META.filter((m) => m.key !== 'align').map((meta, i) => (
                <div
                  key={meta.key}
                  className="flex items-center gap-2 rounded border border-zinc-100 bg-zinc-50/40 px-2 py-1"
                >
                  <span className="text-[9px] font-mono font-bold text-zinc-300 w-4 shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[11px] font-bold text-zinc-500 shrink-0">{meta.name}</span>
                  <span className="text-[9px] text-zinc-400 truncate">{meta.hint}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {solution ? (
          <div className="shrink-0">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] font-bold text-zinc-400 font-mono uppercase tracking-wider">
                步骤序列
              </div>
              <button
                type="button"
                onClick={onClear}
                className="text-[10px] font-mono text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                清空
              </button>
            </div>
            <div className="max-h-[72px] overflow-y-auto hide-scrollbar flex flex-wrap gap-1 pr-1">
              {solution.moves.map((move, i) => {
                const isDone = i < aiApplied;
                const isCurrent = i === aiApplied - 1 && !finished;
                return (
                  <span
                    key={`${move}-${i}`}
                    ref={isCurrent ? chipRef : undefined}
                    className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded border transition-colors ${
                      isCurrent
                        ? 'bg-blue-600 text-white border-blue-600'
                        : isDone
                          ? 'bg-zinc-100 text-zinc-400 border-zinc-200'
                          : 'bg-white text-zinc-500 border-zinc-200'
                    }`}
                  >
                    {move}
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* 速度（固定） */}
      <div className="pt-2.5 border-t border-zinc-100 shrink-0">
        <div className="text-[10px] font-bold text-zinc-400 font-mono uppercase tracking-wider mb-2">
          播放速度
        </div>
        <div className="grid grid-cols-4 gap-1 bg-zinc-100 p-1 rounded-lg">
          {SPEEDS.map((s) => (
            <button
              key={s.ms}
              type="button"
              onClick={() => onSpeed(s.ms)}
              className={`py-1.5 text-[10px] font-bold tracking-widest font-mono rounded-md transition-all ${
                speed === s.ms ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-[10px] text-zinc-500 leading-relaxed bg-blue-50/40 px-3 py-2 rounded-md border border-blue-100/60 shrink-0">
        <span className="font-bold text-blue-900/70">算法 · </span>
        分层还原（LBL）：十字<span className="font-mono text-blue-700">全状态查表</span>（最优解），
        前两层<span className="font-mono text-blue-700">按块 BFS</span> 组合公式，
        顶层以 OLL / PLL 为宏动作在抽象状态空间搜索。
      </div>
    </section>
  );
}
