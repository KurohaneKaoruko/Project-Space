import Link from 'next/link';
import Navigation from './components/Navigation';
import CategoryIcon from './components/CategoryIcon';
import StaggerCleanup from './components/StaggerCleanup';
import { categories, Category, projectCount, projectsIn } from './data/projects';
import { CLASS_META } from './pnp/lib/types';

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * 分类磁贴：大图标 + 编号 + 中英名称 + 收录数量。
 * 首页只做「分类索引」，具体项目一律进分类页看，避免首页堆满 20+ 磁贴。
 */
function CategoryCard({
  category,
  count,
  index,
}: {
  category: Category;
  count: number;
  index: number;
}) {
  const { key, no, title, label, href } = category;

  return (
    <Link
      href={href}
      aria-label={`${title} · ${label}`}
      className="stagger-in group relative flex min-h-[260px] flex-col justify-between overflow-hidden border border-zinc-200 bg-white p-5 transition-colors duration-300 hover:border-blue-500/40 hover:bg-blue-50/30 sm:min-h-[300px] xl:min-h-[360px] xl:p-6"
      style={{ '--stagger': index } as React.CSSProperties}
    >
      {/* 编号 + 右上角标（hover 时拉长成横条） */}
      <div className="flex items-start justify-between font-mono text-[11px] leading-none">
        <span className="text-blue-600">{no}</span>
        <span className="h-1.5 w-1.5 bg-zinc-200 transition-all duration-300 group-hover:w-5 group-hover:bg-blue-600" />
      </div>

      {/* 分类图标：hover 时播放动画并染成主题蓝 */}
      <div className="flex flex-1 items-center justify-center py-5">
        <div className="h-24 w-24 text-zinc-800 transition-all duration-300 ease-out group-hover:scale-[1.06] group-hover:text-blue-600 md:h-28 md:w-28">
          <CategoryIcon id={key} className="h-full w-full" />
        </div>
      </div>

      {/* 名称与数量 */}
      <div>
        <h3 className="font-mono text-[13px] tracking-[0.22em] text-zinc-900 transition-colors group-hover:text-blue-600">
          {title}
        </h3>
        <p className="mt-1.5 text-[11px] text-zinc-400">
          {label} · {pad2(count)} {count > 1 ? 'MODULES' : 'MODULE'}
        </p>
      </div>

      {/* 底部指示线 */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px w-0 bg-blue-600 transition-all duration-300 ease-out group-hover:w-full"
      />
    </Link>
  );
}

/**
 * 0 号位分类：整行大卡片。
 * 只用「图标 + 编号 + 名称 + 复杂度标签 + 数量」说话，不放任何说明文字。
 */
function FeatureCategoryCard({ category, count }: { category: Category; count: number }) {
  const { key, no, title, href } = category;

  return (
    <Link
      href={href}
      aria-label={title}
      className="stagger-in group relative mb-4 flex items-center overflow-hidden border border-zinc-200 bg-white p-5 transition-colors duration-300 hover:border-blue-500/40 hover:bg-blue-50/30 md:p-6"
      style={{ '--stagger': 0 } as React.CSSProperties}
    >
      <div className="flex items-center gap-4 md:gap-5">
        <div className="h-16 w-16 shrink-0 text-zinc-800 transition-all duration-300 ease-out group-hover:scale-[1.06] group-hover:text-blue-600 sm:h-20 sm:w-20 md:h-24 md:w-24">
          <CategoryIcon id={key} className="h-full w-full" />
        </div>

        <div className="min-w-0">
          <span className="block font-mono text-[11px] leading-none text-blue-600">{no}</span>
          <h3 className="mt-1.5 font-mono text-lg tracking-[0.2em] text-zinc-900 transition-colors group-hover:text-blue-600 md:text-xl">
            {title}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(['P', 'NP', 'NPC', 'NPH'] as const).map((cls) => (
              <span
                key={cls}
                className={`rounded border px-1.5 py-0.5 font-mono text-[10px] leading-none ${CLASS_META[cls].chip}`}
                title={CLASS_META[cls].full}
              >
                {CLASS_META[cls].label}
              </span>
            ))}
            <span className="ml-1 font-mono text-[11px] text-zinc-400">{pad2(count)} MODULES</span>
          </div>
        </div>
      </div>

      {/* 底部指示线 */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px w-0 bg-blue-600 transition-all duration-300 ease-out group-hover:w-full"
      />
    </Link>
  );
}

export default function Home() {
  const featured = categories.find((category) => category.featured);
  const rest = categories.filter((category) => !category.featured);

  return (
    <main className="min-h-screen">
      <Navigation />
      <StaggerCleanup />

      <div className="flex min-h-screen flex-col px-4 pb-10 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col">
          {/* 首页头部 */}
          <header className="relative mb-10 border-l-2 border-blue-500/50 pl-6 md:mb-12">
            <h1 className="mb-3 text-4xl font-black tracking-tighter text-zinc-900 md:text-6xl">
              PROJECT
              <br />
              <span className="bg-linear-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                SPACE
              </span>
            </h1>
            <p className="max-w-2xl text-base font-light text-zinc-500 md:text-lg">
              / 探索与构建 <br />
              <span className="mt-2 block font-mono text-xs text-zinc-400">
                EXPLORATION_AND_CONSTRUCTION_PROTOCOL_INITIATED
              </span>
            </p>

            {/* 背景装饰水印 */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-4 right-0 -z-10 select-none overflow-hidden text-[7rem] font-black leading-none text-zinc-100 opacity-50 md:text-[10rem]"
            >
              {pad2(categories.length)}
            </div>
          </header>

          {/* 分类索引 */}
          <section aria-label="项目分类" className="mb-4">
            <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-zinc-200 pb-2">
              <h2 className="shrink-0 font-mono text-[11px] tracking-[0.25em] text-zinc-400 sm:tracking-[0.3em]">
                CATEGORY_INDEX
              </h2>
              {/* 窄屏只留模块总数，避免这一行被挤爆 */}
              <span className="whitespace-nowrap font-mono text-[11px] text-zinc-300">
                <span className="hidden sm:inline">
                  {pad2(categories.length)} CATEGORIES /{' '}
                </span>
                {pad2(projectCount)} MODULES
              </span>
            </div>

            {/* 0 号位：特殊分类整行展示 */}
            {featured && (
              <FeatureCategoryCard category={featured} count={projectsIn(featured.key).length} />
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
              {rest.map((category, index) => (
                <CategoryCard
                  key={category.key}
                  category={category}
                  count={projectsIn(category.key).length}
                  index={index + 1}
                />
              ))}
            </div>
          </section>

          {/* 页脚 */}
          <footer className="mt-auto border-t border-zinc-200 pt-6">
            <div className="flex flex-col items-start justify-between gap-2 font-mono text-xs text-zinc-400 md:flex-row md:items-center">
              <span>PROJECT_SPACE // ALL_SYSTEMS_OPERATIONAL</span>
              <span>
                MODULES_TOTAL:{' '}
                <span className="text-blue-600">{projectCount}</span>
              </span>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}
