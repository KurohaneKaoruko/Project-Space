'use client';

import { useEffect, useState } from 'react';

interface GameOverProps {
  score: number;
  onRestart: () => void;
  onClose: () => void;
}

export default function GameOver({ score, onRestart, onClose }: GameOverProps) {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  if (!isClient) return null;
  
  return (
    <div className="fixed inset-0 bg-[rgba(0,0,0,0.5)] backdrop-blur-[2px] flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl shadow-2xl max-w-md w-full mx-4 transform animate-pop-in">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
            <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">游戏结束!</h2>
          <p className="text-gray-600">游戏结束了。你的最终得分是：</p>
        </div>
        
        <div className="bg-white py-4 px-6 rounded-lg shadow-inner mb-6">
          <p className="text-center text-3xl font-bold text-blue-600">{score}</p>
        </div>
        
        <div className='flex flex-row gap-4'>
          <button
            onClick={onRestart}
            className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md transition-colors duration-200"
          >
            重新开始
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg shadow-md transition-colors duration-200"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
