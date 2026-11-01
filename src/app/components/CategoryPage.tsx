import Link from 'next/link';
import Navigation from '../components/Navigation';
import ProjectIcon from '../components/ProjectIcon';
import StaggerCleanup from '../components/StaggerCleanup';
import { CLASS_META } from '../complexity/lib/types';
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
 * P & NP 用带描述的卡片网格（信息密度更高），其余分类沿用紧凑图标网格。
 */
export default function CategoryPage({ categoryKey }: { categoryKey: CategoryKey }) {
  const category = categoryMap[categoryKey];
  const items = projectsIn(categoryKey);
  const isComplexity = categoryKey === 'complexity';

  return (
    <main className="min-h-screen">
      <Navigation />
      <StaggerCleanup />

      <div className="flex min-h-screen flex-col px-4 pb-12 pt-16 sm:px-6 lg:px-8">
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
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((project, index) => {
                const meta = project.complexity ? CLASS_META[project.complexity] : null;
                return (
                  <Link
                    key={project.id}
                    href={projectHref(project)}
                    aria-label={project.title}
                    className="stagger-in group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-xl hover:shadow-zinc-900/5"
                    style={{ '--stagger': index } as React.CSSProperties}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-mono text-[11px] text-zinc-300">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      {meta && (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${meta.chip}`}
                          title={meta.full}
                        >
                          <i className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 transition-transform duration-300 group-hover:scale-110">
                        <ProjectIcon id={project.id} className="h-full w-full" />
                      </div>
                      <h2 className="text-lg font-bold tracking-tight text-zinc-900 transition-colors group-hover:text-blue-600">
                        {project.title}
                      </h2>
                    </div>

                    <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-zinc-500">
                      {project.description}
                    </p>

                    <div className="mt-auto flex items-center gap-1.5 pt-4 font-mono text-[10px] uppercase tracking-widest text-zinc-400 transition-colors group-hover:text-blue-600">
                      打开
                      <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                    </div>
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
