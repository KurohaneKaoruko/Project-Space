import Link from 'next/link';
import Navigation from '../components/Navigation';
import ProjectIcon from '../components/ProjectIcon';
import StaggerCleanup from '../components/StaggerCleanup';
import HoverCardClamp from '../components/HoverCardClamp';
import { CLASS_META } from '../pnp/lib/types';
import {
  CategoryKey,
  categoryMap,
  otherCategories,
  projectHref,
  projectsIn,
} from '../data/projects';

const CLASS_ORDER = ['P', 'NP', 'NPC', 'NPH'] as const;

/**
 * 分类页：编号、标题、条目全部由 categoryKey 推导。
 * 全部分类统一用紧凑图标网格；P & NP 额外带复杂度徽章，
 * 项目详情（描述、复杂度全称）悬停时以浮层卡片显示。
 */
export default function CategoryPage({ categoryKey }: { categoryKey: CategoryKey }) {
  const category = categoryMap[categoryKey];
  const items = projectsIn(categoryKey);
  const isComplexity = categoryKey === 'pnp';

  return (
    <main className="min-h-screen overflow-x-clip">
      <Navigation />
      <StaggerCleanup />
      <HoverCardClamp />

      <div className="flex min-h-screen flex-col overflow-x-clip px-4 pb-12 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1500px]">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-5">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-blue-600">{category.no}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-400">
                  {category.subtitle}
                </span>
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-900 md:text-4xl">
                {category.pageTitle ?? `ALL_${category.key.toUpperCase()}`}
              </h1>
            </div>
            <span className="font-mono text-[11px] text-zinc-400">
              {String(items.length).padStart(2, '0')} MODULES
            </span>
          </div>

          {isComplexity && (
            <div className="mb-6 flex flex-wrap gap-2">
              {CLASS_ORDER.map((cls) => (
                <span
                  key={cls}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] ${CLASS_META[cls].chip}`}
                >
                  <i className={`h-1.5 w-1.5 rounded-full ${CLASS_META[cls].dot}`} />
                  <b>{CLASS_META[cls].label}</b>
                  <span className="opacity-70">{CLASS_META[cls].full}</span>
                </span>
              ))}
            </div>
          )}

          {isComplexity ? (
            <div className="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 2xl:grid-cols-9">
              {items.map((project, index) => {
                const meta = project.complexity ? CLASS_META[project.complexity] : null;
                return (
                  <Link
                    key={project.id}
                    href={projectHref(project)}
                    aria-label={project.title}
                    className="stagger-in group relative flex flex-col items-center gap-2 px-2 py-3"
                    style={{ '--stagger': index } as React.CSSProperties}
                  >
                    <div className="h-16 w-16 transition-transform duration-300 ease-out group-hover:scale-110 group-hover:-translate-y-0.5">
                      <ProjectIcon id={project.id} className="h-full w-full" />
                    </div>
                    <span className="line-clamp-2 text-center text-[13px] font-bold leading-snug text-zinc-600 transition-colors group-hover:text-blue-600">
                      {project.title}
                    </span>
                    {meta && (
                      <span
                        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-bold leading-none ${meta.chip}`}
                      >
                        <i className={`h-1 w-1 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    )}

                    {/* 悬停详情卡：图标下方浮出，指向条目本身；data-hovercard 供越界夹紧 */}
                    <span
                      data-hovercard
                      className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 w-64 -translate-x-1/2 translate-y-1 rounded-xl border border-zinc-200 bg-white p-3 text-left opacity-0 shadow-xl shadow-zinc-900/10 transition-[opacity,transform] duration-200 group-hover:translate-y-0 group-hover:opacity-100"
                    >
                      <span className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-bold ${meta?.chip ?? 'border-zinc-200 bg-zinc-50 text-zinc-500'}`}>
                          {meta?.label ?? '—'}
                        </span>
                        <span className="truncate font-mono text-[10px] text-zinc-400">{meta?.full}</span>
                      </span>
                      <span className="mt-1.5 block text-[11px] leading-relaxed text-zinc-500">{project.description}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 2xl:grid-cols-9">
              {items.map((project, index) => {
                const others = otherCategories(project);

                return (
                  <Link
                    key={project.id}
                    href={projectHref(project)}
                    title={project.description}
                    aria-label={project.title}
                    className="stagger-in group flex flex-col items-center gap-2 px-2 py-3"
                    style={{ '--stagger': index } as React.CSSProperties}
                  >
                    <div className="h-16 w-16 transition-transform duration-300 ease-out group-hover:scale-110 group-hover:-translate-y-0.5">
                      <ProjectIcon id={project.id} className="h-full w-full" />
                    </div>
                    <span className="line-clamp-2 text-center text-[13px] font-bold leading-snug text-zinc-600 transition-colors group-hover:text-blue-600">
                      {project.title}
                    </span>
                    {others.length > 0 && (
                      <span className="text-center font-mono text-[10px] leading-none tracking-[0.08em] text-zinc-400 transition-colors group-hover:text-blue-500">
                        {others.map((key) => categoryMap[key].label).join(' · ')}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
