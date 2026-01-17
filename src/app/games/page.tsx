import Link from 'next/link';
import Image from 'next/image';
import Navigation from '../components/Navigation';
import { games } from '../data/games';

export default function games() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              所有项目
            </h1>
            <p className="text-xl text-gray-600">
              Game-Space 项目列表
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {games.map((project, index) => (
              <Link 
                key={project.id} 
                href={`/games/${project.id}`}
                className={`block hover:bg-gray-50 transition-colors duration-200 ${
                  index !== games.length - 1 ? 'border-b border-gray-200' : ''
                }`}
              >
                <div className="flex items-center p-4">
                  <div className="w-16 h-16 flex-shrink-0 relative rounded-md overflow-hidden">
                    {project.image ? (
                      <Image
                        src={project.image}
                        alt={project.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500 text-xs">
                        No Image
                      </div>
                    )}
                  </div>
                  
                  <div className="ml-4 flex-1">
                    <h2 className="text-lg font-medium text-gray-900">
                      {project.title}
                    </h2>
                    <p className="text-sm text-gray-600 line-clamp-1 mb-1">
                      {project.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {project.technologies.map((tech) => (
                        <span
                          key={tech}
                          className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="ml-4">
                    <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          
          <div className="mt-8 text-center">
            <Link 
              href="/" 
              className="inline-flex items-center text-blue-600 hover:text-blue-800"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              返回主页
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
