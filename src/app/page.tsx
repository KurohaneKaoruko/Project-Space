import Navigation from './components/Navigation';
import ProjectGridCard from './components/ProjectGridCard';
import StaggerCleanup from './components/StaggerCleanup';
import { games, tools, simulations, visualizations, algorithms, Project, ProjectCategory } from './data/projects';

interface SectionProps {
  no: string;
  title: string;
  subtitle: string;
  projects: Project[];
  type: ProjectCategory;
  startIndex?: number;
}

/** 分类区块：标题栏 + 网格布局 */
function ProjectSection({ no, title, subtitle, projects, type, startIndex = 0 }: SectionProps) {
  return (
    <section className="mb-16 scroll-mt-24">
      <div className="mb-5 flex items-end justify-between border-b border-zinc-200 pb-3">
        <h2 className="flex items-center gap-3 text-xl font-bold text-zinc-900 md:text-2xl">
          <span className="font-mono text-base text-blue-600">{no}.</span>
          {title}
        </h2>
        <span className="hidden font-mono text-xs text-zinc-400 md:block">{subtitle}</span>
      </div>

      <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7">
        {projects.map((project, i) => (
          <ProjectGridCard key={project.id} project={project} type={type} index={startIndex + i} />
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navigation />
      <StaggerCleanup />

      <div className="flex min-h-screen flex-col justify-center px-4 pb-12 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* 首页头部 */}
          <header className="relative mb-12 border-l-2 border-blue-500/50 pl-6 md:mb-14">
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
              00
            </div>
          </header>

          {/* 分类快速导航锚点 */}
          <nav aria-label="分类导航" className="mb-14 flex flex-wrap gap-2">
            {(
              [
                ['01', 'GAMES', 'games'],
                ['02', 'SIMULATIONS', 'simulations'],
                ['03', 'ALGORITHMS', 'algorithms'],
                ['04', 'VISUALIZATIONS', 'visualizations'],
                ['05', 'TOOLS', 'tools'],
              ] as const
            ).map(([no, label, anchor]) => (
              <a
                key={anchor}
                href={`#${anchor}`}
                className="group border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs tracking-wider text-zinc-600 transition-colors hover:border-blue-500/50 hover:text-blue-600"
              >
                <span className="mr-1.5 text-blue-600/70">{no}</span>
                {label}
              </a>
            ))}
          </nav>

          <div id="games">
            <ProjectSection
              no="01"
              title="GAMES"
              subtitle="INTERACTIVE_ENTERTAINMENT_MODULES"
              projects={games}
              type="GAME"
            />
          </div>

          <div id="simulations">
            <ProjectSection
              no="02"
              title="SIMULATIONS"
              subtitle="PHYSICS_AND_MATH_EXPERIMENTS"
              projects={simulations}
              type="SIMULATION"
            />
          </div>

          <div id="algorithms">
            <ProjectSection
              no="03"
              title="ALGORITHMS"
              subtitle="CLASSIC_ALGORITHM_VISUALIZATIONS"
              projects={algorithms}
              type="ALGORITHM"
            />
          </div>

          <div id="visualizations">
            <ProjectSection
              no="04"
              title="VISUALIZATIONS"
              subtitle="MATH_AND_ALGORITHM_VISUALIZATIONS"
              projects={visualizations}
              type="VISUALIZATION"
            />
          </div>

          <div id="tools">
            <ProjectSection
              no="05"
              title="TOOLS"
              subtitle="UTILITY_AND_PROCESSING_UNITS"
              projects={tools}
              type="TOOL"
            />
          </div>

          {/* 页脚 */}
          <footer className="mt-16 border-t border-zinc-200 pt-6">
            <div className="flex flex-col items-start justify-between gap-2 font-mono text-xs text-zinc-400 md:flex-row md:items-center">
              <span>PROJECT_SPACE // ALL_SYSTEMS_OPERATIONAL</span>
              <span>
                MODULES_TOTAL:{' '}
                <span className="text-blue-600">
                  {games.length + simulations.length + algorithms.length + visualizations.length + tools.length}
                </span>
              </span>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}
