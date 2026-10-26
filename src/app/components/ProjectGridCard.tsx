import Link from 'next/link';
import { Project, ProjectCategory } from '../data/projects';
import ProjectIcon from './ProjectIcon';

export const CATEGORY_BASE: Record<ProjectCategory, string> = {
  GAME: '/games',
  SIMULATION: '/simulations',
  ALGORITHM: '/algorithms',
  VISUALIZATION: '/visualizations',
  TOOL: '/tools',
};

/**
 * 项目磁贴：裸露的动态 SVG 图标 + 项目名，无边框无底色。
 * hover 时图标运行动画、轻微上浮，文字变蓝；描述放入 title 提示。
 */
export default function ProjectGridCard({
  project,
  type,
  index = 0,
}: {
  project: Project;
  type: ProjectCategory;
  index?: number;
}) {
  return (
    <Link
      href={project.link ?? `${CATEGORY_BASE[type]}/${project.id}`}
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
  );
}
