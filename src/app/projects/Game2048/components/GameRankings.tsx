"use client";

import { useEffect, useState } from "react";

// 排行榜数据类型
type RankingItem = {
  id: number;
  name: string;
  score: number;
  date: string;
};

export default function GameRankings({size = 4}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError('获取排行榜出错')
    } finally {
      setIsLoading(false);
    }
  };

  // 打开排行榜时获取数据
  const openRankings = () => {
    setIsModalOpen(true);
    fetchRankings();
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={openRankings}
        className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium text-sm transition-colors justify-center flex items-center"
      >
        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.363 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.363-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        排行榜
      </button>

      {/* 排行榜弹窗 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.8)] backdrop-blur-[2px]">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                <svg className="w-5 h-5 inline-block mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.363 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.363-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                2048 游戏排行榜 {`(${size} x ${size})`}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="关闭排行榜"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isLoading ? (
              <div className="py-10 text-center">
                <span className="loading loading-spinner loading-xl text-neutral mx-auto mb-2"></span>
                <p className="mt-3 text-gray-600 text-lg">加载中...</p>
              </div>
            ) : error ? (
              <div className="py-10 text-center">
                <p className="text-red-500">{error}</p>
              </div>
            ) : (
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        排名
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        玩家
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        分数
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        日期
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 ">
                    {rankings.map((item, index) => (
                      <tr key={item.id} className={index < 3 ? "bg-yellow-50" : ""}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            {index === 0 ? (
                              <span className="flex items-center justify-center w-6 h-6 bg-yellow-400 text-white rounded-full font-bold text-sm">1</span>
                            ) : index === 1 ? (
                              <span className="flex items-center justify-center w-6 h-6 bg-gray-300 text-white rounded-full font-bold text-sm">2</span>
                            ) : index === 2 ? (
                              <span className="flex items-center justify-center w-6 h-6 bg-yellow-600 text-white rounded-full font-bold text-sm">3</span>
                            ) : (
                              <span className="text-gray-600 font-medium pl-2">{index + 1}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-bold">{item.score.toLocaleString()}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{item.date}</div>
                        </td>
                      </tr>
                    ))}
                    {rankings.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                          暂无排行榜数据
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
