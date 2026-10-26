import Link from 'next/link';
import Image from 'next/image';
import Navigation from '../components/Navigation';
import { algorithms } from '../data/projects';

export default function AlgorithmsPage() {
  return (
    <main className="min-h-screen">
      <Navigation />

      <div className="pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12 border-l-2 border-blue-500/50 pl-6">
            <h1 className="text-4xl font-bold text-zinc-900 mb-2 flex items-center gap-3">
              <span className="text-blue-600 font-mono text-lg">04.</span>
              ALL_ALGORITHMS
            </h1>
            <p className="text-zinc-500 font-mono text-sm">
              {'/// CLASSIC_ALGORITHM_VISUALIZATIONS_LIST'}
            </p>
          </div>

          <div className="grid gap-4">
            {algorithms.map((project, index) => (
              <Link
                key={project.id}
                href={project.link ?? `/algorithms/${project.id}`}
                className="group relative block bg-white border border-zinc-200 hover:border-blue-500/50 transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md"
              >
                {/* 装饰：序号背景 */}
                <div className="absolute right-4 top-2 text-5xl font-black text-zinc-100 opacity-50 pointer-events-none group-hover:text-blue-50 group-hover:scale-110 transition-all duration-500">
                  {String(index + 1).padStart(2, '0')}
                </div>

                {/* 装饰：左侧激活条 */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>

                <div className="flex items-center p-4 sm:p-6 relative z-10">
                  <div className="w-24 h-24 shrink-0 relative bg-zinc-100 border border-zinc-200 group-hover:border-blue-500/30 transition-colors">
                    {project.image ? (
                      <Image
                        src={project.image}
                        alt={project.title}
                        fill
                        className="object-cover opacity-90 group-hover:opacity-100 transition-all duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-400 font-mono text-xs">
                        NO_IMG
                      </div>
                    )}
                  </div>

                  <div className="ml-6 flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-zinc-900 mb-2 flex items-center gap-2 group-hover:text-blue-600 transition-colors">
                      {project.title}
                      <svg className="w-4 h-4 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity transform -translate-x-2 group-hover:translate-x-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </h2>
                    <p className="text-sm text-zinc-500 line-clamp-1 mb-3 font-light">
                      {project.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {project.technologies.map((tech) => (
                        <span
                          key={tech}
                          className="px-1.5 py-0.5 text-[10px] bg-zinc-50 text-zinc-500 font-mono uppercase tracking-wider border border-zinc-200 group-hover:border-blue-500/20 group-hover:text-blue-600 transition-colors"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="ml-4 hidden sm:block">
                    <div className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center group-hover:bg-blue-600 group-hover:border-blue-600 transition-all duration-300">
                      <svg className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/"
              className="inline-flex items-center text-zinc-400 hover:text-zinc-900 transition-colors font-mono text-sm group"
            >
              <svg className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              RETURN_TO_BASE
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
