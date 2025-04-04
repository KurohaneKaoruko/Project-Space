'use client';

import { useEffect, useState } from 'react';

interface GameSettingsProps {
  size: number;
  onSizeChange: (size: number) => void;
}

export default function GameSettings({ size, onSizeChange }: GameSettingsProps) {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  if (!isClient) return null;
  
  // 定义可选的棋盘大小
  const sizeOptions = [2, 4, 6, 8];
  
  return (
    <div className="bg-white rounded-lg p-3 shadow-sm">
      <div className="grid grid-cols-4 gap-1">
        {sizeOptions.map((sizeOption) => {
          const isSelected = size === sizeOption;
          return (
            <button
              key={sizeOption}
              type="button"
              onClick={() => onSizeChange(sizeOption)}
              className={`
                py-1 px-2 text-center text-sm rounded-md transition-colors duration-200 border
                ${isSelected
                  ? 'bg-blue-100 border-blue-400 text-blue-800 font-medium' 
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              {sizeOption}
            </button>
          );
        })}
      </div>
    </div>
  );
} 