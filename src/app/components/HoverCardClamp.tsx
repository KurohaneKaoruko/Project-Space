'use client';

import { useEffect } from 'react';

/**
 * 悬停详情卡越界修正（全局事件委托，仅处理带 [data-hovercard] 的卡片）：
 * 卡片固定 16rem 宽、以条目水平居中，在首尾列会伸出视口，
 * 被外层 overflow-x-clip 裁掉半边。悬停时测量越界量，
 * 将 left 夹回视口范围内（8px 边距）；居中位置放得下时不做任何事。
 */
export default function HoverCardClamp() {
  useEffect(() => {
    const EDGE = 8;

    const position = (item: HTMLElement) => {
      const card = item.querySelector<HTMLElement>('[data-hovercard]');
      if (!card) return;
      card.style.left = ''; // 先复位，测量未夹紧时的自然位置
      const cardRect = card.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const dx =
        cardRect.left < EDGE
          ? EDGE - cardRect.left
          : cardRect.right > vw - EDGE
            ? vw - EDGE - cardRect.right
            : 0;
      if (dx !== 0) {
        const itemRect = item.getBoundingClientRect();
        // 卡片带 -translate-x-1/2（宽度一半的负位移），设置 left 时需补偿，
        // 否则夹紧量会被位移抵消一半、卡片反而跑偏
        const half = card.offsetWidth / 2;
        card.style.left = `${Math.round(cardRect.left - itemRect.left + dx + half)}px`;
      }
    };

    const onOver = (e: MouseEvent) => {
      const item = (e.target as HTMLElement | null)?.closest?.('.group');
      if (item instanceof HTMLElement && item.querySelector('[data-hovercard]')) {
        position(item);
      }
    };

    document.addEventListener('mouseover', onOver);
    return () => document.removeEventListener('mouseover', onOver);
  }, []);

  return null;
}
