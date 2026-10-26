'use client';

import { useEffect } from 'react';

/**
 * 入场动画性能优化（全局一份，挂载在页面级）：
 * .stagger-in 的 riseIn 动画结束后，标记 data-entered="true"，
 * 移除 will-change，让浏览器回收合成层，避免常驻显存占用。
 * 使用事件委托，无需在每个卡片上绑定监听。
 */
export default function StaggerCleanup() {
  useEffect(() => {
    const handler = (e: AnimationEvent) => {
      if (e.animationName === 'riseIn') {
        const el = e.target as HTMLElement;
        if (el.classList?.contains('stagger-in')) {
          el.dataset.entered = 'true';
        }
      }
    };
    document.addEventListener('animationend', handler);
    return () => document.removeEventListener('animationend', handler);
  }, []);

  return null;
}
