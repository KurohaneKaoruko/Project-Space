/**
 * 图标动画参数生成器（ProjectIcon / CategoryIcon 共用）。
 * 必须使用长写属性（animationName / animationDuration）：
 * 若用简写 animation: ...，会把 .icon-motion 的 animation-play-state: paused 重置为 running，
 * 导致所有图标在后台常驻耗 CPU。
 */
export function anim(name: string, dur: number, delay = 0, timing?: string) {
  return {
    animationName: name,
    animationDuration: `${dur}s`,
    ...(delay ? { animationDelay: `${delay}s` } : {}),
    ...(timing ? { animationTimingFunction: timing } : {}),
  };
}
