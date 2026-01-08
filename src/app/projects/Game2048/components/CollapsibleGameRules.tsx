'use client';

import { useEffect, useState } from 'react';

export default function CollapsibleGameRules() {
  const [isClient, setIsClient] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  
  useEffect(() => {
    setIsClient(true);
    
    // 检测是否为移动设备
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  if (!isClient) return null;
  
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium text-sm transition-colors justify-center flex items-center"
      >
        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        游戏规则
      </button>
      
      {/* 游戏规则内容 - 移动端内联展开，桌面端浮窗显示 */}
      {isOpen && (
        isMobile ? (
          <div className="bg-white rounded-lg shadow-md p-4 animate-fade-in">
            <GameRulesContent />
          </div>
        ) : (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.5)] backdrop-blur-[2px]">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full animate-pop-in relative">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                aria-label="关闭游戏规则"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                游戏规则
              </h2>
              
              <GameRulesContent />
              
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  了解了
                </button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

// 提取出规则内容组件以便复用
function GameRulesContent() {
  return (
    <>
      <div>
        <Rule icon="🎮" text="使用方向键或滑动来移动所有方块" />
        <Rule icon="🔢" text="相同数字的方块会合并成它们的和" />
        <Rule icon="🎯" text="每次移动后会在空位置随机生成一个新方块" />
        <Rule icon="🏆" text="尽可能获得高分，挑战最好成绩" />
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-100">
        <h3 className="text-base font-semibold mb-2 text-gray-800 flex items-center">
          <svg className="w-4 h-4 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          小贴士
        </h3>
        <div className="space-y-1.5 text-gray-600 text-sm">
          <p>• 尝试将大数字保持在一个角落</p>
          <p>• 不要让小数字分散太远</p>
          <p>• 提前规划你的移动路径</p>
          <p>• 当你接近胜利时要格外小心</p>
        </div>
      </div>
    </>
  );
}

function Rule({ icon, text }: { icon: string, text: string }) {
  return (
    <div className="flex items-start mt-2 text-sm text-gray-600">
      <span className="text-center w-6 flex-shrink-0">{icon}</span>
      <span className="ml-2">{text}</span>
    </div>
  );
} 