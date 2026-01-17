'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BigNumber } from './bigNumber';
import type { FunctionIdleSnapshot, FunctionIdleState } from '../types';
import { BN_ZERO, bnFormat, bnGte, bnLog10, bnPow10, bnSub } from './bigNumber';
import { costBase, costBCurve, costMultiplier, costR, costRCurve, rFromLevel, baseFromLevel } from './balance';
import { simulateOffline, tick } from './engine';
import { clearState, defaultState, loadState, saveState } from './storage';
import { decodeState, encodeState } from './saveCodec';

const DEFAULT_AUTO_BUY = {
  base: false,
  r: false,
  multiplier: false,
  bCurve: false,
  rCurve: false,
};

const DEFAULT_TICK_MS = 1000;

const TICK_MS = (() => {
  const raw = process.env.NEXT_PUBLIC_FUNCTION_IDLE_TICK_MS;
  const parsed = raw ? Number(raw) : DEFAULT_TICK_MS;
  if (!Number.isFinite(parsed)) return DEFAULT_TICK_MS;
  const clamped = Math.max(100, Math.min(10_000, Math.floor(parsed)));
  return clamped;
})();

type UseFunctionIdleResult = {
  state: FunctionIdleState | null;
  offline: FunctionIdleSnapshot | null;
  now: number;
  history: { t: number; logP: number }[];
  pointsText: string;
  baseText: string;
  rText: string;
  buyBase: () => void;
  buyR: () => void;
  buyMultiplier: () => void;
  buyBCurve: () => void;
  buyRCurve: () => void;
  prestige: () => void;
  prestigeInfo: {
    available: boolean;
    gainPhi: number;
    requirement: BigNumber;
  };
  autoBuy: typeof DEFAULT_AUTO_BUY;
  toggleAutoBuy: (key: keyof typeof DEFAULT_AUTO_BUY) => void;
  reset: () => void;
  exportSave: () => string;
  importSave: (raw: string) => { ok: boolean; error?: string };
  dismissOffline: () => void;
  costs: {
    base: BigNumber;
    r: BigNumber;
    multiplier: BigNumber;
    bCurve: BigNumber;
    rCurve: BigNumber;
  };
};

export function useFunctionIdle(): UseFunctionIdleResult {
  const [state, setState] = useState<FunctionIdleState | null>(null);
  const [offline, setOffline] = useState<FunctionIdleSnapshot | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [history, setHistory] = useState<{ t: number; logP: number }[]>([]);
  const stateRef = useRef<FunctionIdleState | null>(null);

  useEffect(() => {
    const now = Date.now();
    const loaded = loadState(now);
    const simulated = simulateOffline(loaded, now);
    setState(simulated.next);
    stateRef.current = simulated.next;
    if (simulated.offlineSeconds > 1) {
      setOffline({ state: simulated.next, offlineSeconds: simulated.offlineSeconds, gainedPoints: simulated.gained });
    }
    const initialLogP = bnLog10(simulated.next.points);
    setHistory([{ t: simulated.next.lastTimestamp, logP: Number.isFinite(initialLogP) ? initialLogP : 0 }]);
    setNow(now);
  }, []);

  useEffect(() => {
    if (!state) return;
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      setNow(now);
      setState(prev => {
        if (!prev) return prev;
        const { next } = tick(prev, now);
        return next;
      });
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (stateRef.current) saveState(stateRef.current);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && stateRef.current) saveState(stateRef.current);
    };
    const onUnload = () => {
      if (stateRef.current) saveState(stateRef.current);
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const s = stateRef.current;
      if (!s) return;
      const raw = bnLog10(s.points);
      const logP = Number.isFinite(raw) ? raw : 0;
      setHistory(prev => {
        const next = prev.length === 0 ? [{ t: s.lastTimestamp, logP }] : [...prev, { t: s.lastTimestamp, logP }];
        const max = 4000;
        if (next.length <= max) return next;
        return next.slice(next.length - max);
      });
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, []);

  const costs = useMemo(() => {
    if (!state) return { base: BN_ZERO, r: BN_ZERO, multiplier: BN_ZERO, bCurve: BN_ZERO, rCurve: BN_ZERO };
    return {
      base: costBase(state.bLevel),
      r: costR(state.rLevel),
      multiplier: costMultiplier(state.multiplierLevel),
      bCurve: costBCurve(state.bCurveLevel),
      rCurve: costRCurve(state.rCurveLevel),
    };
  }, [state]);

  const autoBuy = useMemo(() => {
    return state ? { ...DEFAULT_AUTO_BUY, ...state.autoBuy } : DEFAULT_AUTO_BUY;
  }, [state]);

  const toggleAutoBuy = useCallback((key: keyof typeof DEFAULT_AUTO_BUY) => {
    setState(prev => {
      if (!prev) return prev;
      const nextAuto = { ...DEFAULT_AUTO_BUY, ...prev.autoBuy };
      nextAuto[key] = !nextAuto[key];
      return { ...prev, autoBuy: nextAuto };
    });
  }, []);

  const buy = useCallback((kind: 'base' | 'r' | 'multiplier' | 'bCurve' | 'rCurve') => {
    setState(prev => {
      if (!prev) return prev;
      const now = Date.now();
      const phi = prev.phi;
      const bCurveLevel = prev.bCurveLevel;
      const rCurveLevel = prev.rCurveLevel;

      const cost =
        kind === 'base'
          ? costBase(prev.bLevel)
          : kind === 'r'
            ? costR(prev.rLevel)
            : kind === 'multiplier'
              ? costMultiplier(prev.multiplierLevel)
              : kind === 'bCurve'
                ? costBCurve(bCurveLevel)
                : costRCurve(rCurveLevel);
      if (!bnGte(prev.points, cost)) return prev;

      const points = bnSub(prev.points, cost);
      if (kind === 'base') {
        const nextLevel = prev.bLevel + 1;
        return { ...prev, points, bLevel: nextLevel, base: baseFromLevel(nextLevel, bCurveLevel, phi), lastTimestamp: now };
      }
      if (kind === 'r') {
        const nextLevel = prev.rLevel + 1;
        return { ...prev, points, rLevel: nextLevel, r: rFromLevel(nextLevel, rCurveLevel), lastTimestamp: now };
      }
      if (kind === 'multiplier') {
        const nextLevel = prev.multiplierLevel + 1;
        return { ...prev, points, multiplierLevel: nextLevel, lastTimestamp: now };
      }
      if (kind === 'bCurve') {
        const next = bCurveLevel + 1;
        return { ...prev, points, bCurveLevel: next, base: baseFromLevel(prev.bLevel, next, phi), lastTimestamp: now };
      }
      const next = rCurveLevel + 1;
      return { ...prev, points, rCurveLevel: next, r: rFromLevel(prev.rLevel, next), lastTimestamp: now };
    });
  }, []);

  const buyBase = useCallback(() => buy('base'), [buy]);
  const buyR = useCallback(() => buy('r'), [buy]);
  const buyMultiplier = useCallback(() => buy('multiplier'), [buy]);
  const buyBCurve = useCallback(() => buy('bCurve'), [buy]);
  const buyRCurve = useCallback(() => buy('rCurve'), [buy]);

  const prestigeInfo = useMemo(() => {
    if (!state) return { available: false, gainPhi: 0, requirement: BN_ZERO };
    const phi = state.phi;
    const requirement = bnPow10(8 + phi * 2);
    const available = bnGte(state.points, requirement);
    const logP = bnLog10(state.points);
    const gainPhi = available ? Math.max(1, Math.floor(logP / 10)) : 0;
    return { available, gainPhi, requirement };
  }, [state]);

  const prestige = useCallback(() => {
    const current = stateRef.current;
    if (!current) return;
    const phi = current.phi;
    const requirement = bnPow10(8 + phi * 2);
    if (!bnGte(current.points, requirement)) return;
    const gainPhi = Math.max(1, Math.floor(bnLog10(current.points) / 10));
    const nextPhi = phi + gainPhi;
    const now = Date.now();
    const next: FunctionIdleState = {
      ...current,
      points: BN_ZERO,
      bLevel: 0,
      rLevel: 0,
      multiplierLevel: 0,
      bCurveLevel: 0,
      rCurveLevel: 0,
      phi: nextPhi,
      autoBuy: { ...DEFAULT_AUTO_BUY, ...current.autoBuy },
      base: baseFromLevel(0, 0, nextPhi),
      r: rFromLevel(0, 0),
      lastTimestamp: now,
    };
    setState(next);
    stateRef.current = next;
    setHistory([{ t: now, logP: 0 }]);
    setNow(now);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = stateRef.current;
      if (!current) return;
      const ab = { ...DEFAULT_AUTO_BUY, ...current.autoBuy };
      if (!Object.values(ab).some(Boolean)) return;
      setState(prev => {
        if (!prev) return prev;
        const now = Date.now();
        let s = prev;
        const phi = s.phi;
        let bCurveLevel = s.bCurveLevel;
        let rCurveLevel = s.rCurveLevel;

        const tryBuy = (kind: 'base' | 'r' | 'multiplier' | 'bCurve' | 'rCurve'): boolean => {
          const cost =
            kind === 'base'
              ? costBase(s.bLevel)
              : kind === 'r'
                ? costR(s.rLevel)
                : kind === 'multiplier'
                  ? costMultiplier(s.multiplierLevel)
                  : kind === 'bCurve'
                    ? costBCurve(bCurveLevel)
                    : costRCurve(rCurveLevel);
          if (!bnGte(s.points, cost)) return false;
          const points = bnSub(s.points, cost);
          if (kind === 'base') {
            const nextLevel = s.bLevel + 1;
            s = { ...s, points, bLevel: nextLevel, base: baseFromLevel(nextLevel, bCurveLevel, phi), lastTimestamp: now };
            return true;
          }
          if (kind === 'r') {
            const nextLevel = s.rLevel + 1;
            s = { ...s, points, rLevel: nextLevel, r: rFromLevel(nextLevel, rCurveLevel), lastTimestamp: now };
            return true;
          }
          if (kind === 'multiplier') {
            const nextLevel = s.multiplierLevel + 1;
            s = { ...s, points, multiplierLevel: nextLevel, lastTimestamp: now };
            return true;
          }
          if (kind === 'bCurve') {
            bCurveLevel += 1;
            s = { ...s, points, bCurveLevel, base: baseFromLevel(s.bLevel, bCurveLevel, phi), lastTimestamp: now };
            return true;
          }
          rCurveLevel += 1;
          s = { ...s, points, rCurveLevel, r: rFromLevel(s.rLevel, rCurveLevel), lastTimestamp: now };
          return true;
        };

        for (let i = 0; i < 12; i++) {
          let bought = false;
          if (ab.bCurve) bought = tryBuy('bCurve') || bought;
          if (ab.rCurve) bought = tryBuy('rCurve') || bought;
          if (ab.multiplier) bought = tryBuy('multiplier') || bought;
          if (ab.r) bought = tryBuy('r') || bought;
          if (ab.base) bought = tryBuy('base') || bought;
          if (!bought) break;
        }
        s = { ...s, autoBuy: ab };
        return s;
      });
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, []);

  const reset = useCallback(() => {
    const now = Date.now();
    clearState();
    const fresh = defaultState(now);
    saveState(fresh);
    setState(fresh);
    stateRef.current = fresh;
    setOffline(null);
    setHistory([{ t: now, logP: 0 }]);
    setNow(now);
  }, []);

  const dismissOffline = useCallback(() => setOffline(null), []);

  const exportSave = useCallback((): string => {
    const s = stateRef.current;
    if (!s) return '';
    return encodeState(s);
  }, []);

  const importSave = useCallback((raw: string): { ok: boolean; error?: string } => {
    const now = Date.now();
    const coerced = decodeState(raw, now);
    if (!coerced) return { ok: false, error: '导入码无效' };
    saveState(coerced);
    const simulated = simulateOffline(coerced, now);
    setState(simulated.next);
    stateRef.current = simulated.next;
    setOffline(null);
    const initialLogP = bnLog10(simulated.next.points);
    setHistory([{ t: simulated.next.lastTimestamp, logP: Number.isFinite(initialLogP) ? initialLogP : 0 }]);
    setNow(now);
    return { ok: true };
  }, []);

  const pointsText = useMemo(() => (state ? bnFormat(state.points, 4) : '...'), [state]);
  const baseText = useMemo(() => (state ? bnFormat(state.base, 4) : '...'), [state]);
  const rText = useMemo(() => {
    if (!state) return '...';
    const r = state.r;
    if (!Number.isFinite(r)) return '∞/s';
    const abs = Math.abs(r);
    const text =
      abs === 0 ? '0' : abs >= 1e6 || abs < 1e-3 ? r.toExponential(3).replace('e+', 'e') : r.toFixed(3);
    return `${text}/s`;
  }, [state]);

  return {
    state,
    offline,
    now,
    history,
    pointsText,
    baseText,
    rText,
    buyBase,
    buyR,
    buyMultiplier,
    buyBCurve,
    buyRCurve,
    prestige,
    prestigeInfo,
    autoBuy,
    toggleAutoBuy,
    reset,
    exportSave,
    importSave,
    dismissOffline,
    costs,
  };
}
