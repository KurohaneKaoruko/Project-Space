'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';
import ControlPanel from './components/ControlPanel';
import Cube3D from './components/Cube3D';
import SolverPanel from './components/SolverPanel';
import { invertMove, type Move } from './function/cubeEngine';
import { solveCube, warmUpSolver, type SolveResult } from './function/solver';
import { solveWith, warmUpSolvers, type SolverId } from './function/solvers';
import { useRubiksCube } from './function/useRubiksCube';

export default function RubiksCubePage() {
  const cube = useRubiksCube(110);
  const [speed, setSpeed] = useState(110);
  const [scrambleLen, setScrambleLen] = useState(25);
  const [solverId, setSolverId] = useState<SolverId>('lbl');
  const [solution, setSolution] = useState<SolveResult | null>(null);
  const [aiApplied, setAiApplied] = useState(0);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { onApplied } = cube;
  const stepDeltaRef = useRef(1);
  const totalRef = useRef(0);
  totalRef.current = solution?.moves.length ?? 0;

  useEffect(() => {
    onApplied((applied) => {
      if (applied.kind !== 'ai') return;
      const delta = stepDeltaRef.current;
      stepDeltaRef.current = 1;
      setAiApplied((n) => Math.max(0, Math.min(totalRef.current, n + delta)));
    });
    return () => onApplied(null);
  }, [onApplied]);

  // 后台预热查找表：LBL 十字表 + 按当前方法的附加表（如 EOLine）
  useEffect(() => {
    const id = window.setTimeout(() => warmUpSolvers(solverId), 260);
    return () => window.clearTimeout(id);
  }, [solverId]);

  const clearSolution = useCallback(() => {
    setSolution(null);
    setAiApplied(0);
    setError(null);
    stepDeltaRef.current = 1;
  }, []);

  const handleManualMove = useCallback(
    (move: Move) => {
      if (cube.isBusy) return;
      clearSolution();
      cube.play([move], 'user', Math.max(90, speed));
    },
    [clearSolution, cube, speed],
  );

  const handleScramble = useCallback(() => {
    clearSolution();
    cube.scramble(scrambleLen);
  }, [clearSolution, cube, scrambleLen]);

  const handleReset = useCallback(() => {
    clearSolution();
    cube.reset();
  }, [clearSolution, cube]);

  const handleUndo = useCallback(() => {
    clearSolution();
    cube.undo();
  }, [clearSolution, cube]);

  const handleSolve = useCallback(async () => {
    if (computing || cube.isBusy || cube.solved) return;
    setComputing(true);
    setError(null);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => window.setTimeout(resolve, 0));
    });
    try {
      const result = solverId === 'lbl' ? solveCube(cube.cubies) : solveWith(solverId, cube.cubies);
      if (!result.ok || result.moves.length === 0) {
        setError('这一步的状态无法求解，请重新打乱后再试。');
        setComputing(false);
        return;
      }
      setSolution(result);
      setAiApplied(0);
      stepDeltaRef.current = 1;
      cube.play(result.moves, 'ai', speed);
    } catch {
      setError('求解器运行异常，请重新打乱后再试。');
    }
    setComputing(false);
  }, [computing, cube, speed, solverId]);

  const handleSolverChange = useCallback(
    (id: SolverId) => {
      setSolverId(id);
      clearSolution();
      // 立即预热新方法的表（若尚未构建）
      window.setTimeout(() => warmUpSolvers(id), 0);
    },
    [clearSolution],
  );

  const handlePause = useCallback(() => cube.pause(), [cube]);
  const handleResume = useCallback(() => cube.resume(), [cube]);

  const handleStepForward = useCallback(() => {
    if (!solution || cube.isBusy) return;
    if (aiApplied >= solution.moves.length) return;
    stepDeltaRef.current = 1;
    cube.play([solution.moves[aiApplied]], 'ai', Math.max(90, speed));
  }, [aiApplied, cube, solution, speed]);

  const handleStepBack = useCallback(() => {
    if (!solution || cube.isBusy || aiApplied <= 0) return;
    stepDeltaRef.current = -1;
    cube.play([invertMove(solution.moves[aiApplied - 1])], 'ai', Math.max(90, speed));
  }, [aiApplied, cube, solution, speed]);

  const handleSkip = useCallback(() => {
    if (!solution) return;
    const remaining = solution.moves.slice(aiApplied);
    if (remaining.length === 0) return;
    stepDeltaRef.current = 1;
    cube.applyInstant(remaining, 'ai');
    setAiApplied(solution.moves.length);
  }, [aiApplied, cube, solution]);

  const handleSpeed = useCallback(
    (ms: number) => {
      setSpeed(ms);
      cube.setDuration(ms);
    },
    [cube],
  );

  // 键盘操作
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toUpperCase();
      if (key.length === 1 && 'UDLRFB'.includes(key)) {
        e.preventDefault();
        handleManualMove(`${key}${e.shiftKey ? "'" : ''}` as Move);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (cube.paused) handleResume();
        else if (solution && aiApplied < solution.moves.length) handlePause();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleScramble();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [aiApplied, cube.paused, handleManualMove, handlePause, handleResume, handleScramble, solution]);

  const playing = Boolean(solution) && aiApplied < (solution?.moves.length ?? 0);
  const lastMoveLabel = cube.lastMove ?? '—';

  return (
    <main className="min-h-screen bg-zinc-50 relative overflow-hidden">
      <div
        className="absolute inset-0 z-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <Navigation title="RUBIK_AI" />

      <div className="px-4 pt-6 pb-4 sm:px-6 lg:px-8 lg:pt-8 lg:pb-6 lg:pr-11 relative z-10 lg:h-screen lg:overflow-hidden">
        <div className="mx-auto w-full max-w-[1560px] h-full">
          <div className="grid grid-cols-1 lg:grid-cols-[262px_minmax(0,1fr)] xl:grid-cols-[286px_minmax(0,1fr)_340px] gap-5 xl:gap-6 items-start lg:h-full">
            <div className="order-2 lg:order-1 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1 hide-scrollbar">
              <ControlPanel
                cube={cube}
                scrambleLen={scrambleLen}
                onScrambleLen={setScrambleLen}
                onManualMove={handleManualMove}
                onScramble={handleScramble}
                onReset={handleReset}
                onUndo={handleUndo}
              />
            </div>

            <section className="order-1 lg:order-2 w-full lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1 hide-scrollbar">
              <div className="flex items-center justify-between px-1 mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      cube.isBusy ? 'bg-blue-500 animate-pulse' : cube.solved ? 'bg-emerald-500' : 'bg-amber-400'
                    }`}
                  />
                  <span className="text-sm font-bold text-zinc-700 tracking-wider uppercase">模拟视窗</span>
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                    playing
                      ? 'bg-blue-50 text-blue-600 border-blue-100'
                      : 'bg-zinc-50 text-zinc-500 border-zinc-200'
                  }`}
                >
                  {playing ? (cube.paused ? 'AI 已暂停' : 'AI 托管中') : '手动模式'}
                </div>
              </div>

              <div className="relative bg-white/70 backdrop-blur-sm border border-zinc-200 rounded-lg shadow-xl shadow-zinc-200/40 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

                <div className="flex items-center justify-between px-5 pt-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                      Last move
                    </span>
                    <span className="font-mono text-lg font-bold text-zinc-900 tabular-nums">
                      {lastMoveLabel}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400 tracking-wider">
                    {cube.solved ? 'STATE / SOLVED' : 'STATE / SCRAMBLED'}
                  </div>
                </div>

                <div className="py-2">
                  <Cube3D cubies={cube.cubies} anim={cube.anim} duration={cube.anim ? speed : 0} />
                </div>

                <div className="px-5 pb-4 flex items-center justify-between text-[10px] font-mono text-zinc-400 tracking-wider">
                  <span>3×3×3 · CSS 3D RENDER</span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-1 h-1 rounded-full bg-zinc-300" />
                    拖动旋转视角
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3">
                {[
                  { label: '还原阶段', value: solution ? `${solution.phases.length}` : '—', unit: 'stage' },
                  { label: '解法步数', value: solution ? `${solution.moves.length}` : '—', unit: 'moves' },
                  {
                    label: '当前进度',
                    value: solution ? `${Math.round((aiApplied / Math.max(1, solution.moves.length)) * 100)}` : '—',
                    unit: '%',
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="border border-zinc-200 bg-white/70 rounded-md px-3 py-2 flex items-center justify-between"
                  >
                    <span className="text-[10px] font-mono text-zinc-400 tracking-wider">{item.label}</span>
                    <span className="font-mono text-sm font-bold text-zinc-800 tabular-nums">
                      {item.value}
                      <span className="text-[9px] text-zinc-400 ml-0.5">{item.unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <div className="order-3 lg:col-span-2 xl:col-span-1 xl:h-full xl:min-h-0">
              <SolverPanel
                solution={solution}
                aiApplied={aiApplied}
                computing={computing}
                paused={cube.paused}
                error={error}
                speed={speed}
                solved={cube.solved}
                busy={cube.isBusy}
                solverId={solverId}
                onSolver={handleSolverChange}
                onSpeed={handleSpeed}
                onSolve={handleSolve}
                onPause={handlePause}
                onResume={handleResume}
                onStepForward={handleStepForward}
                onStepBack={handleStepBack}
                onSkip={handleSkip}
                onClear={clearSolution}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
