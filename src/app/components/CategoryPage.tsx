import Link from 'next/link';
import Navigation from '../components/Navigation';
import ProjectIcon from '../components/ProjectIcon';
import { Project } from '../data/projects';

/**
 * 分类页通用模板：动态 SVG 图标 + 项目名的紧凑网格。
 */
export default function CategoryPage({
  no,
  title,
  subtitle,
  projects,
  basePath,
}: {
  no: string;
  title: string;
  subtitle: string;
  projects: Project[];
  basePath: string;
}) {
  return (
    <main className="min-h-screen">
      <Navigation />

      <div className="flex min-h-screen flex-col justify-center px-4 pb-12 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 border-l-2 border-blue-500/50 pl-6">
            <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-zinc-900">
              <span className="font-mono text-base text-blue-600">{no}.</span>
              {title}
            </h1>
            <p className="font-mono text-sm text-zinc-500">{'/// ' + subtitle}</p>
          </div>

          <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7">
            {projects.map((project, index) => (
              <Link
                key={project.id}
                href={project.link ?? `${basePath}/${project.id}`}
                title={project.description}
                aria-label={project.title}
                className="stagger-in group flex flex-col items-center justify-center gap-2 px-2 py-3"
                style={{ '--stagger': index } as React.CSSProperties}
              >
                <div className="h-16 w-16 transition-transform duration-300 ease-out group-hover:scale-110 group-hover:-translate-y-0.5">
                  <ProjectIcon id={project.id} className="h-full w-full" />
                </div>
                <span className="line-clamp-2 text-center text-[13px] font-bold leading-snug text-zinc-600 transition-colors group-hover:text-blue-600">
                  {project.title}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
