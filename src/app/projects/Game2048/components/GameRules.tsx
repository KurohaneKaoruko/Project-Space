'use client';

import { useEffect, useState } from 'react';

export default function GameRules() {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  if (!isClient) return null;
  
  return (
    <div className="p-4">
      <h3 className="text-base font-semibold mb-2 text-gray-800 flex items-center">
        <svg className="w-4 h-4 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        游戏规则
      </h3>
      <Rule icon="🎮" text="使用方向键或滑动来移动所有方块" />
      <Rule icon="🔢" text="相同数字的方块会合并成它们的和" />
      <Rule icon="🎯" text="每次移动后会在空位置随机生成一个新方块" />
      <Rule icon="🏆" text="尽可能获得高分，挑战最好成绩" />
    </div>
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