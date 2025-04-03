'use client';

import { useEffect, useState } from 'react';

// 排行榜数据类型
type RankingItem = {
  id: number;
  name: string;
  score: number;
};

export default function EmbeddedRankings({ size = 4 }) {
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  
  // 客户端加载检测
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // 获取排行榜数据
  const fetchRankings = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/game2048/rankings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ size }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setRankings(data);
    } catch (err) {
      setError('获取排行榜出错');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 组件加载时或size变化时获取数据
  useEffect(() => {
    if (isClient) {
      fetchRankings();
    }
  }, [isClient, size]);
  
  if (!isClient) return null;
  
  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-800 flex items-center">
          <svg className="w-5 h-5 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.363 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.363-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          排行榜 {`(${size}x${size})`}
        </h3>
        <button
          type="button"
          onClick={fetchRankings}
          className="text-blue-600 hover:text-blue-800"
          title="刷新排行榜"
          aria-label="刷新排行榜"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      
      {isLoading ? (
        <div className="py-6 text-center">
          <span className="loading loading-spinner loading-xl text-neutral mx-auto mb-2"></span>
          <p className="mt-2 text-gray-600 text-lg">加载中...</p>
        </div>
      ) : error ? (
        <div className="py-6 text-center">
          <p className="text-red-500 text-sm">{error}</p>
          <button 
            type="button"
            onClick={fetchRankings}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
          >
            重试
          </button>
        </div>
      ) : (
        <div className="overflow-hidden">
          {rankings.length === 0 ? (
            <div className="py-6 text-center text-gray-500 text-sm">
              暂无排行榜数据
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase bg-gray-50">
                    <th className="py-2 px-3 text-left">排名</th>
                    <th className="py-2 px-3 text-left">玩家</th>
                    <th className="py-2 px-3 text-right">分数</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rankings.slice(0, 10).map((item, index) => (
                    <tr key={item.id} className={index < 3 ? "bg-yellow-50" : ""}>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {index === 0 ? (
                          <span className="flex items-center justify-center w-5 h-5 bg-yellow-400 text-white rounded-full font-bold text-xs">1</span>
                        ) : index === 1 ? (
                          <span className="flex items-center justify-center w-5 h-5 bg-gray-300 text-white rounded-full font-bold text-xs">2</span>
                        ) : index === 2 ? (
                          <span className="flex items-center justify-center w-5 h-5 bg-yellow-600 text-white rounded-full font-bold text-xs">3</span>
                        ) : (
                          <span className="text-gray-600 text-xs pl-1">{index + 1}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <div className="text-gray-900 font-medium truncate max-w-[100px]" title={item.name}>
                          {item.name}
                        </div>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-right">
                        <div className="text-gray-900 font-bold">{item.score.toLocaleString()}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 