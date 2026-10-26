'use client';

import type { Move } from '../function/cubeEngine';
import type { CubeController } from '../function/useRubiksCube';

const MOVE_PAD: { label: string; move: Move }[] = [
  { label: 'U', move: 'U' },
  { label: "U'", move: "U'" },
  { label: 'D', move: 'D' },
  { label: "D'", move: "D'" },
  { label: 'L', move: 'L' },
  { label: "L'", move: "L'" },
  { label: 'R', move: 'R' },
  { label: "R'", move: "R'" },
  { label: 'F', move: 'F' },
  { label: "F'", move: "F'" },
  { label: 'B', move: 'B' },
  { label: "B'", move: "B'" },
];

function formatTime(ms: number): string {
  const total = Math.floor(ms / 10);
  const m = Math.floor(total / 6000);
  const s = Math.floor((total % 6000) / 100);
  const cs = total % 100;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

interface Props {
  cube: CubeController;
  scrambleLen: number;
  onScrambleLen: (n: number) => void;
  onManualMove: (move: Move) => void;
  onScramble: () => void;
  onReset: () => void;
  onUndo: () => void;
}

export default function ControlPanel({
  cube,
  scrambleLen,
  onScrambleLen,
  onManualMove,
  onScramble,
  onReset,
  onUndo,
}: Props) {
  const status = cube.isBusy
    ? cube.anim
      ? '转动中'
      : '排队中'
    : cube.solved
      ? '已还原'
      : '打乱状态';

  return (
    <section className="w-full bg-white/85 backdrop-blur-sm border border-zinc-200 shadow-xl shadow-zinc-200/40 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-zinc-900 rounded-full" />
          <div className="text-sm font-bold text-zinc-800 tracking-wide">游戏控制</div>
        </div>
        <div
          className={`px-2 py-1 text-[10px] font-mono font-bold rounded border ${
            cube.solved
              ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
              : 'bg-amber-50 text-amber-600 border-amber-100'
          }`}
        >
          {status}
        </div>
      </div>

      {/* HUD */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-zinc-200 rounded-md px-3 py-2 bg-zinc-50/60">
          <div className="text-[10px] font-mono text-zinc-400 tracking-wider uppercase mb-1">Time</div>
          <div className="font-mono text-lg font-bold text-zinc-900 tabular-nums leading-none">
            {formatTime(cube.elapsedMs)}
          </div>
        </div>
        <div className="border border-zinc-200 rounded-md px-3 py-2 bg-zinc-50/60">
          <div className="text-[10px] font-mono text-zinc-400 tracking-wider uppercase mb-1">Moves</div>
          <div className="font-mono text-lg font-bold text-zinc-900 tabular-nums leading-none">
            {cube.moveCount.toString().padStart(3, '0')}
          </div>
        </div>
      </div>

      {/* 主操作 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onScramble}
          className="px-4 py-3 bg-zinc-900 text-white text-xs font-bold tracking-wider uppercase hover:bg-zinc-800 transition-all rounded-md shadow-lg shadow-zinc-900/20 active:scale-[0.98]"
        >
          打乱
        </button>
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-3 bg-white border-2 border-zinc-100 text-zinc-600 text-xs font-bold tracking-wider uppercase hover:border-zinc-300 hover:text-zinc-900 transition-all rounded-md active:scale-[0.98]"
        >
          复原
        </button>
        <button
          type="button"
          onClick={onUndo}
          disabled={cube.history.length === 0 || cube.isBusy}
          className="col-span-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-500 text-[11px] font-bold tracking-wider uppercase hover:border-zinc-300 hover:text-zinc-900 transition-all rounded-md active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          撤销上一步
        </button>
      </div>

      {/* 打乱步数 */}
      <div>
        <div className="flex justify-between mb-2">
          <label className="text-[10px] font-bold text-zinc-400 font-mono uppercase tracking-wider">
            打乱步数
          </label>
          <span className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
            {scrambleLen}
          </span>
        </div>
        <input
          type="range"
          min={10}
          max={40}
          step={5}
          value={scrambleLen}
          onChange={(e) => onScrambleLen(Number(e.target.value))}
          className="w-full h-1.5 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-zinc-900"
        />
      </div>

      {/* 手动转动 */}
      <div>
        <div className="text-[10px] font-bold text-zinc-400 font-mono uppercase tracking-wider mb-2">
          手动转动
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {MOVE_PAD.map(({ label, move }) => (
            <button
              key={label}
              type="button"
              onClick={() => onManualMove(move)}
              disabled={cube.pending > 0}
              className="py-2 text-[11px] font-mono font-bold text-zinc-600 bg-zinc-50 border border-zinc-200 rounded hover:bg-white hover:border-blue-400 hover:text-blue-600 transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 快捷键 */}
      <div className="text-[11px] text-zinc-400 leading-relaxed border-t border-zinc-100 pt-3 space-y-1">
        <div className="flex items-center justify-between">
          <span>转动某一面</span>
          <kbd className="px-1.5 py-0.5 bg-zinc-50 border border-zinc-200 rounded text-[10px] font-mono text-zinc-500">
            U D L R F B
          </kbd>
        </div>
        <div className="flex items-center justify-between">
          <span>逆时针 / 180°</span>
          <span className="flex gap-1">
            <kbd className="px-1.5 py-0.5 bg-zinc-50 border border-zinc-200 rounded text-[10px] font-mono text-zinc-500">
              SHIFT
            </kbd>
            <kbd className="px-1.5 py-0.5 bg-zinc-50 border border-zinc-200 rounded text-[10px] font-mono text-zinc-500">
              2
            </kbd>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>拖动魔方旋转视角</span>
          <kbd className="px-1.5 py-0.5 bg-zinc-50 border border-zinc-200 rounded text-[10px] font-mono text-zinc-500">
            DRAG
          </kbd>
        </div>
      </div>
    </section>
  );
}
