/**
 * 路由切换骨架屏（根级 loading）：
 * App Router 中点击 <Link> 后立即以 Suspense fallback 形式出现，
 * 消除"点击后旧页面冻结、无反馈"的等待感。初始 SSR 加载不经过此组件。
 * 保持极轻量：纯静态标记 + opacity 脉冲，无 JS。
 */
export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-10 w-10 skeleton-pulse border border-zinc-300 bg-zinc-50">
          {/* tech 风格装饰角标 */}
          <span className="absolute -left-px -top-px h-1.5 w-1.5 border-l border-t border-blue-600" />
          <span className="absolute -bottom-px -right-px h-1.5 w-1.5 border-b border-r border-blue-600" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-400">
          Loading///
        </span>
      </div>
    </div>
  );
}
