/** 复杂度类与题目规格的公共类型 */

import type { ComplexityClass } from '../../data/projects';

export type { ComplexityClass };

export const CLASS_META: Record<
  ComplexityClass,
  { label: string; full: string; chip: string; dot: string }
> = {
  P: {
    label: 'P',
    full: '多项式时间可解',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  NP: {
    label: 'NP',
    full: '解可在多项式时间验证（未知是否属于 P）',
    chip: 'border-sky-200 bg-sky-50 text-sky-700',
    dot: 'bg-sky-500',
  },
  NPC: {
    label: 'NP-C',
    full: 'NP 完全：属于 NP，且所有 NP 问题都能归约到它',
    chip: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
  },
  NPH: {
    label: 'NP-H',
    full: 'NP 困难：不要求自身属于 NP，至少和 NP 中最难的问题一样难',
    chip: 'border-rose-200 bg-rose-50 text-rose-700',
    dot: 'bg-rose-500',
  },
};

export interface TestCase<I = unknown, O = unknown> {
  name: string;
  input: I;
  /** 参考答案；存在多解时仅供参考，判定一律走 validate */
  expected: O;
  /** 判定输出是否正确 */
  validate: (output: O, input: I) => boolean;
}

/** 截断 JSON 用于展示 */
export function preview(value: unknown, max = 72): string {
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch {
    text = String(value);
  }
  if (text === undefined) return 'undefined';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
