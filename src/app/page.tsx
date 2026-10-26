import Link from 'next/link';
import Image from 'next/image';
import Navigation from './components/Navigation';
import { games, tools, simulations, visualizations, algorithms, Project, ProjectCategory } from './data/projects';

const CATEGORY_BASE: Record<ProjectCategory, string> = {
  GAME: '/games',
  SIMULATION: '/simulations',
  ALGORITHM: '/algorithms',
  VISUALIZATION: '/visualizations',
  TOOL: '/tools',
};

// 卡片组件复用
function ProjectCard({ project, type }: { project: Project; type: ProjectCategory }) {
  return (
    <Link
      href={project.link ?? `${CATEGORY_BASE[type]}/${project.id}`}
      className="group relative block bg-white tech-border tech-border-corner hover:border-blue-500/50 transition-all duration-300 shadow-sm hover:shadow-md"
    >
      {/* 装饰性顶部标签 */}
      <div className="absolute top-0 left-0 z-10 bg-zinc-900/10 px-2 py-0.5 text-[10px] font-mono text-zinc-600 backdrop-blur-sm">
        {type}_{project.id.toUpperCase().slice(0, 3)}
      </div>

      <div className="relative h-48 overflow-hidden bg-zinc-100">
        {/* 图片遮罩效果 */}
        <div className="absolute inset-0 z-10 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 mix-blend-multiply"></div>
        {/* 扫描线动画 */}
        <div className="absolute inset-0 z-10 bg-linear-to-b from-transparent via-blue-500/10 to-transparent -translate-y-full group-hover:translate-y-full transition-transform duration-1000 ease-in-out"></div>
        
        {project.image ? (
          <Image
            src={project.image}
            alt={project.title}
            fill
            className="object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-400 font-mono text-xs border-b border-zinc-200">
            NO_IMAGE_DATA
          </div>
        )}
      </div>
      
      <div className="p-5">
        <h3 className="text-lg font-bold text-zinc-900 mb-2 group-hover:text-blue-600 transition-colors flex items-center gap-2">
          {project.title}
          <span className="w-1 h-1 bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></span>
        </h3>
        <p className="text-zinc-500 text-sm mb-4 line-clamp-2 leading-relaxed">{project.description}</p>
        
        <div className="flex flex-wrap gap-2">
          {project.technologies.map((tech) => (
            <span
              key={tech}
              className="px-1.5 py-0.5 text-[10px] border border-zinc-200 text-zinc-500 font-mono uppercase tracking-wider group-hover:border-blue-500/30 group-hover:text-blue-600 transition-colors"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navigation />
      
      <div className="pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* 首页头部 */}
          <div className="relative mb-20 pl-8 border-l-2 border-blue-500/50">
            <h1 className="text-6xl md:text-8xl font-black text-zinc-900 mb-4 tracking-tighter">
              PROJECT<br/>
              <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-blue-400">SPACE</span>
            </h1>
            <p className="text-xl text-zinc-500 max-w-2xl font-light">
              / 探索与构建 <br/>
              <span className="text-sm font-mono text-zinc-400 mt-2 block">
                EXPLORATION_AND_CONSTRUCTION_PROTOCOL_INITIATED
              </span>
            </p>
            
            {/* 背景装饰字 - 极浅水印 */}
            <div className="absolute top-0 right-0 -z-10 text-[10rem] md:text-[15rem] font-black text-zinc-100 opacity-50 select-none overflow-hidden leading-none pointer-events-none">
              00
            </div>
          </div>

          <section className="mb-24">
            <div className="flex items-end justify-between mb-8 border-b border-zinc-200 pb-4">
              <h2 className="text-3xl font-bold text-zinc-900 flex items-center gap-3">
                <span className="text-blue-600 font-mono text-lg">01.</span>
                GAMES
              </h2>
              <span className="hidden md:block font-mono text-xs text-zinc-400">
                INTERACTIVE_ENTERTAINMENT_MODULES
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {games.map((project) => (
                <ProjectCard key={project.id} project={project} type="GAME" />
              ))}
            </div>
          </section>

          <section className="mb-24">
            <div className="flex items-end justify-between mb-8 border-b border-zinc-200 pb-4">
              <h2 className="text-3xl font-bold text-zinc-900 flex items-center gap-3">
                <span className="text-blue-600 font-mono text-lg">02.</span>
                SIMULATIONS
              </h2>
              <span className="hidden md:block font-mono text-xs text-zinc-400">
                PHYSICS_AND_MATH_EXPERIMENTS
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {simulations.map((sim) => (
                <ProjectCard key={sim.id} project={sim} type="SIMULATION" />
              ))}
            </div>
          </section>

          <section className="mb-24">
            <div className="flex items-end justify-between mb-8 border-b border-zinc-200 pb-4">
              <h2 className="text-3xl font-bold text-zinc-900 flex items-center gap-3">
                <span className="text-blue-600 font-mono text-lg">03.</span>
                ALGORITHMS
              </h2>
              <span className="hidden md:block font-mono text-xs text-zinc-400">
                CLASSIC_ALGORITHM_VISUALIZATIONS
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {algorithms.map((algo) => (
                <ProjectCard key={algo.id} project={algo} type="ALGORITHM" />
              ))}
            </div>
          </section>

          <section className="mb-24">
            <div className="flex items-end justify-between mb-8 border-b border-zinc-200 pb-4">
              <h2 className="text-3xl font-bold text-zinc-900 flex items-center gap-3">
                <span className="text-blue-600 font-mono text-lg">04.</span>
                VISUALIZATIONS
              </h2>
              <span className="hidden md:block font-mono text-xs text-zinc-400">
                MATH_AND_ALGORITHM_VISUALIZATIONS
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visualizations.map((vis) => (
                <ProjectCard key={vis.id} project={vis} type="VISUALIZATION" />
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-end justify-between mb-8 border-b border-zinc-200 pb-4">
              <h2 className="text-3xl font-bold text-zinc-900 flex items-center gap-3">
                <span className="text-blue-600 font-mono text-lg">05.</span>
                TOOLS
              </h2>
              <span className="hidden md:block font-mono text-xs text-zinc-400">
                UTILITY_AND_PROCESSING_UNITS
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tools.map((tool) => (
                <ProjectCard key={tool.id} project={tool} type="TOOL" />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
