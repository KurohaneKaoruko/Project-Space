'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 实时求解器：算法以 generator 形式边执行边产出步骤。
 * 画面上看到的就是算法此刻正在做的事，用时也是真实耗时。
 */
export function useLiveSolver<S, R>(
  factory: () => Generator<S, R, void>,
  deps: React.DependencyList,
  options: { stepsPerFrame?: number } = {},
) {
  const { stepsPerFrame = 1 } = options;

  const [steps, setSteps] = useState<S[]>([]);
  /** 累计产出的步数（可能远大于 steps.length，因为只保留最近一段） */
  const [produced, setProduced] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  /** 算法本身的计算耗时（不含节流等待） */
  const [computeMs, setComputeMs] = useState(0);
  const [result, setResult] = useState<R | null>(null);
  const [index, setIndex] = useState(0);
  /** 暂停时用户可以回看已经产出的步骤 */
  const [following, setFollowing] = useState(true);

  const genRef = useRef<Generator<S, R, void> | null>(null);
  const startedAtRef = useRef(0);
  const rafRef = useRef(0);
  const stepsRef = useRef<S[]>([]);
  const producedRef = useRef(0);
  /** 只保留最近 200 步，避免长时间运行把内存吃满 */
  const KEEP = 200;
  const computeRef = useRef(0);
  /** 慢放时累积的步数配额 */
  const budgetRef = useRef(0);

  const reset = useCallback(() => {
    genRef.current = null;
    stepsRef.current = [];
    producedRef.current = 0;
    setProduced(0);
    setSteps([]);
    setIndex(0);
    setRunning(false);
    setDone(false);
    setElapsed(0);
    setComputeMs(0);
    computeRef.current = 0;
    budgetRef.current = 0;
    setResult(null);
    setFollowing(true);
  }, []);

  // 实例变化 → 重新开始
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const start = useCallback(() => {
    if (done) return;
    if (!genRef.current) {
      genRef.current = factory();
      startedAtRef.current = performance.now();
    }
    setFollowing(true);
    setRunning(true);
  }, [done, factory]);

  const pause = useCallback(() => setRunning(false), []);

  /** 单步：暂停状态下推进一步 */
  const stepOnce = useCallback(() => {
    if (done) return;
    if (!genRef.current) {
      genRef.current = factory();
      startedAtRef.current = performance.now();
    }
    const gen = genRef.current;
    const t0 = performance.now();
    const r = gen.next();
    computeRef.current += performance.now() - t0;
    setComputeMs(computeRef.current);
    setElapsed(performance.now() - startedAtRef.current);
    if (r.done) {
      setResult(r.value as R);
      setDone(true);
      return;
    }
    stepsRef.current = [...stepsRef.current, r.value as S].slice(-KEEP);
    producedRef.current += 1;
    setSteps(stepsRef.current);
    setProduced(producedRef.current);
    setIndex(stepsRef.current.length - 1);
  }, [done, factory]);

  useEffect(() => {
    if (!running) return;
    let cancelled = false;

    const tick = () => {
      const gen = genRef.current;
      if (!gen) return;

      const batch: S[] = [];
      let finished = false;

      budgetRef.current += stepsPerFrame;
      const budget = Math.floor(budgetRef.current);
      budgetRef.current -= budget;

      const frameStart = performance.now();
      for (let i = 0; i < budget; i++) {
        const t0 = performance.now();
        const r = gen.next();
        computeRef.current += performance.now() - t0;
        if (r.done) {
          finished = true;
          setResult(r.value as R);
          break;
        }
        batch.push(r.value as S);
        // 大实例单步可能要几十毫秒：批量循环超过 40ms 就截断本轮并清空配额，
        // 下一帧重新注入——保证任何规模下都不阻塞主线程
        if (performance.now() - frameStart > 40) {
          budgetRef.current = 0;
          break;
        }
      }

      if (batch.length) {
        stepsRef.current = [...stepsRef.current, ...batch].slice(-KEEP);
        producedRef.current += batch.length;
        setSteps(stepsRef.current);
        setProduced(producedRef.current);
        setIndex(stepsRef.current.length - 1);
      }
      setElapsed(performance.now() - startedAtRef.current);
      setComputeMs(computeRef.current);

      if (finished) {
        setDone(true);
        setRunning(false);
        return;
      }
      if (!cancelled) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [running, stepsPerFrame]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const seek = useCallback((i: number) => {
    setFollowing(false);
    setIndex(Math.max(0, Math.min(stepsRef.current.length - 1, i)));
  }, []);

  return {
    steps,
    stepCount: produced,
    result,
    running,
    done,
    elapsed,
    computeMs,
    index,
    current: steps[Math.min(index, steps.length - 1)],
    start,
    pause,
    reset,
    stepOnce,
    seek,
    following,
    stepsPerFrame,
  };
}

export type LiveSolverState<S, R> = ReturnType<typeof useLiveSolver<S, R>>;
