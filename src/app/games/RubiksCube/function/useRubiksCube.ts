'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyMove,
  createSolvedCube,
  generateScramble,
  invertMove,
  isSolved,
  type Cubie,
  type Move,
} from './cubeEngine';

export type MoveKind = 'scramble' | 'user' | 'ai';

export interface AppliedMove {
  move: Move;
  kind: MoveKind;
}

export interface CubeController {
  cubies: Cubie[];
  /** 当前正在播放的转动，用于驱动 3D 动画 */
  anim: { move: Move; seq: number } | null;
  pending: number;
  isBusy: boolean;
  paused: boolean;
  solved: boolean;
  moveCount: number;
  elapsedMs: number;
  lastMove: Move | null;
  history: AppliedMove[];
  play: (moves: Move[], kind: MoveKind, duration?: number) => void;
  scramble: (length: number) => void;
  reset: () => void;
  undo: () => void;
  pause: () => void;
  resume: () => void;
  setDuration: (ms: number) => void;
  clearQueue: () => void;
  /** 立即应用一串转动（不逐帧动画），用于「直接完成」 */
  applyInstant: (moves: Move[], kind: MoveKind) => void;
  onApplied: (fn: ((move: AppliedMove) => void) | null) => void;
  onDrained: (fn: (() => void) | null) => void;
}

interface QueueItem {
  move: Move;
  kind: MoveKind;
  duration: number;
}

const SCRAMBLE_DURATION = 70;

export function useRubiksCube(initialDuration = 110): CubeController {
  const [cubies, setCubies] = useState<Cubie[]>(createSolvedCube);
  const [anim, setAnim] = useState<{ move: Move; seq: number } | null>(null);
  const [pending, setPending] = useState(0);
  const [paused, setPaused] = useState(false);
  const [solved, setSolved] = useState(true);
  const [moveCount, setMoveCount] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [history, setHistory] = useState<AppliedMove[]>([]);

  const cubiesRef = useRef(cubies);
  const queueRef = useRef<QueueItem[]>([]);
  const timeoutRef = useRef<number | null>(null);
  const seqRef = useRef(0);
  const pausedRef = useRef(false);
  const durationRef = useRef(initialDuration);
  const startedAtRef = useRef<number | null>(null);
  const appliedRef = useRef<((move: AppliedMove) => void) | null>(null);
  const drainedRef = useRef<(() => void) | null>(null);

  const onApplied = useCallback((fn: ((move: AppliedMove) => void) | null) => {
    appliedRef.current = fn;
  }, []);

  const onDrained = useCallback((fn: (() => void) | null) => {
    drainedRef.current = fn;
  }, []);

  const setDuration = useCallback((ms: number) => {
    durationRef.current = ms;
  }, []);

  const pump = useCallback(() => {
    if (timeoutRef.current !== null) return;
    if (pausedRef.current) return;
    const item = queueRef.current[0];
    if (!item) return;

    seqRef.current += 1;
    setAnim({ move: item.move, seq: seqRef.current });

    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      queueRef.current.shift();
      setPending(queueRef.current.length);

      const next = applyMove(cubiesRef.current, item.move);
      cubiesRef.current = next;
      setCubies(next);
      setAnim(null);
      setLastMove(item.move);

      const done = isSolved(next);
      setSolved(done);

      if (item.kind !== 'scramble') {
        setMoveCount((count) => count + 1);
        if (startedAtRef.current === null) startedAtRef.current = Date.now();
        setHistory((prev) => [...prev, { move: item.move, kind: item.kind }]);
      }
      if (done) setElapsedMs(startedAtRef.current ? Date.now() - startedAtRef.current : 0);

      appliedRef.current?.({ move: item.move, kind: item.kind });

      if (queueRef.current.length === 0) {
        drainedRef.current?.();
        return;
      }
      if (pausedRef.current) {
        setPaused(true);
        return;
      }
      // Web Animations API 不依赖 transition 重置，可以无缝衔接下一步
      pump();
    }, item.duration);
  }, []);

  const play = useCallback(
    (moves: Move[], kind: MoveKind, duration?: number) => {
      const ms = duration ?? durationRef.current;
      queueRef.current.push(...moves.map((move) => ({ move, kind, duration: ms })));
      setPending(queueRef.current.length);
      if (pausedRef.current) {
        pausedRef.current = false;
        setPaused(false);
      }
      pump();
    },
    [pump],
  );

  const clearQueue = useCallback(() => {
    queueRef.current = [];
    setPending(0);
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setAnim(null);
    pausedRef.current = false;
    setPaused(false);
  }, []);

  const reset = useCallback(() => {
    clearQueue();
    const fresh = createSolvedCube();
    cubiesRef.current = fresh;
    setCubies(fresh);
    setSolved(true);
    setMoveCount(0);
    setElapsedMs(0);
    setHistory([]);
    setLastMove(null);
    startedAtRef.current = null;
  }, [clearQueue]);

  const scramble = useCallback(
    (length: number) => {
      clearQueue();
      const fresh = createSolvedCube();
      cubiesRef.current = fresh;
      setCubies(fresh);
      setSolved(true);
      setMoveCount(0);
      setElapsedMs(0);
      setHistory([]);
      setLastMove(null);
      startedAtRef.current = null;

      const moves = generateScramble(length);
      queueRef.current.push(
        ...moves.map((move) => ({ move, kind: 'scramble' as MoveKind, duration: SCRAMBLE_DURATION })),
      );
      setPending(queueRef.current.length);
      pump();
    },
    [clearQueue, pump],
  );

  const applyInstant = useCallback(
    (moves: Move[], kind: MoveKind) => {
      clearQueue();
      let next = cubiesRef.current;
      for (const move of moves) next = applyMove(next, move);
      cubiesRef.current = next;
      setCubies(next);
      setSolved(isSolved(next));
      if (moves.length > 0) setLastMove(moves[moves.length - 1]);
      if (kind !== 'scramble') {
        setMoveCount((count) => count + moves.length);
        if (startedAtRef.current === null) startedAtRef.current = Date.now();
        setHistory((prev) => [...prev, ...moves.map((move) => ({ move, kind }))]);
      }
      if (isSolved(next) && startedAtRef.current !== null) {
        setElapsedMs(Date.now() - startedAtRef.current);
      }
      for (const move of moves) appliedRef.current?.({ move, kind });
    },
    [clearQueue],
  );

  const undo = useCallback(() => {
    if (queueRef.current.length > 0) return;
    if (timeoutRef.current !== null) return;
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((prev) => prev.slice(0, -1));
    setMoveCount((count) => Math.max(0, count - 1));
    play([invertMove(last.move)], 'user', Math.max(90, durationRef.current));
  }, [history, play]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);
    if (timeoutRef.current === null) pump();
  }, [pump]);

  // 计时器
  useEffect(() => {
    if (solved) return;
    const id = window.setInterval(() => {
      if (startedAtRef.current !== null) setElapsedMs(Date.now() - startedAtRef.current);
    }, 60);
    return () => window.clearInterval(id);
  }, [solved]);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  return {
    cubies,
    anim,
    pending,
    isBusy: pending > 0 || anim !== null,
    paused,
    solved,
    moveCount,
    elapsedMs,
    lastMove,
    history,
    play,
    scramble,
    reset,
    undo,
    pause,
    resume,
    setDuration,
    clearQueue,
    applyInstant,
    onApplied,
    onDrained,
  };
}
