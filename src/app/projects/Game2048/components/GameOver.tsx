'use client';

import { useEffect, useState } from 'react';

interface GameOverProps {
  score: number;
  onRestart: () => void;
  onSubmitScore: (playerName: string) => Promise<{ success: boolean; message: string }>;
}

export default function GameOver({ score, onRestart, onSubmitScore }: GameOverProps) {
  const [isClient, setIsClient] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [submitStatus, setSubmitStatus] = useState<{message: string, isError: boolean} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // 当提交状态更新时显示消息弹窗
  useEffect(() => {
    if (submitStatus) {
      setShowToast(true);
      // 3秒后自动关闭
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [submitStatus]);
  
  // 处理分数提交
  const handleSubmitScore = async () => {
    try {
      setIsSubmitting(true);
      setSubmitStatus(null);
      
      // 调用传入的提交函数
      const result = await onSubmitScore(playerName || 'No Name');
      
      // 提交成功
      setSubmitStatus({
        message: result.message || '分数上传成功！',
        isError: !result.success
      });
      
      // 如果上传成功，设置提交标志
      if (result.success) {
        setIsSubmitted(true);
      }
      
    } catch (error) {
      console.error('提交分数时出错:', error);
      setSubmitStatus({
        message: '分数上传失败，请稍后再试',
        isError: true
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
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
        
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              id="playerName"
              className="w-full px-4 py-3 rounded-lg bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 shadow-sm text-gray-700 placeholder-gray-400 text-center"
              placeholder="输入名字以上传分数"
              onChange={(e) => setPlayerName(e.target.value)}
              value={playerName}
              disabled={isSubmitted}
            />
          </div>
        </div>
        
        <div className='flex flex-row gap-4'>
          <button
            type="button"
            onClick={onRestart}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            再玩一次
          </button>
          <button
            type="button"
            onClick={handleSubmitScore}
            disabled={isSubmitting || isSubmitted}
            className={`w-full text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center ${
              isSubmitting || isSubmitted ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSubmitting ? (
              <>
                上传中
                <span className="loading loading-dots loading-xs ml-2"></span>
              </>
            ) : isSubmitted ? (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                已上传
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 3l5 5h-3v9H8V8H5l5-5zM3 13h14v2H3v-2z"/>
                </svg>
                上传得分
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* 消息弹窗 */}
      {showToast && submitStatus && (
        <div className="fixed inset-x-0 top-5 mx-auto flex justify-center z-50 animate-fade-in-down">
          <div 
            className={`rounded-lg shadow-xl p-4 flex items-center ${
              submitStatus.isError ? 'bg-red-500' : 'bg-green-500'
            } text-white max-w-xs ${
              submitStatus.isError ? 'border-red-600' : 'border-green-600'
            } border-2 backdrop-blur-sm`}
          >
            {submitStatus.isError ? (
              <svg className="w-6 h-6 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span className="font-medium">{submitStatus.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
