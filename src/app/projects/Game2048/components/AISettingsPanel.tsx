'use client';

import { useEffect, useState } from 'react';
import { useAIController, type MoveSpeed, MOVE_SPEEDS } from '../function/useAIController';
import type { AIMode } from '../function/aiEngine';
import type { Direction } from '../types';

/**
 * AI设置面板组件属性
 */
interface AISettingsPanelProps {
  /** 当前棋盘状态 */
  board: number[][];
  /** 游戏是否结束 */
  gameOver: boolean;
  /** 执行移动的回调函数（带动画） */
  onMove: (direction: Direction) => void;
  /** 直接执行移动的回调函数（跳过动画，供极速模式使用） */
  onMoveImmediate?: (direction: Direction) => void;
}

/**
 * AI模式配置
 */
interface AIModeConfig {
  id: AIMode;
  name: string;
  description: string;
}

/**
 * 速度配置
 */
interface SpeedConfig {
  id: MoveSpeed;
  name: string;
}

/** AI模式列表 */
const AI_MODES: AIModeConfig[] = [
  {
    id: 'fast',
    name: '贪心策略',
    description: '优先级启发式，响应迅速',
  },
  {
    id: 'balanced',
    name: 'Minimax',
    description: '博弈树搜索，平衡速度与效果',
  },
  {
    id: 'optimal',
    name: 'Expectimax',
    description: '期望最大化搜索，效果最佳',
  },
  {
    id: 'ntuple',
    name: 'N-Tuple Network',
    description: '基于机器学习的评估函数，效果最优',
  },
];

/** 速度选项列表 */
const SPEED_OPTIONS: SpeedConfig[] = [
  { id: 'turbo', name: '极速' },
  { id: 'fast', name: '快' },
  { id: 'normal', name: '中' },
  { id: 'slow', name: '慢' },
];

/**
 * AI设置面板组件
 * 
 * 替代原有排行榜的UI组件，提供AI控制界面。
 * 包含AI模式选择、开始/停止按钮、速度调节功能。
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */
export default function AISettingsPanel({ board, gameOver, onMove, onMoveImmediate }: AISettingsPanelProps) {
  const [isClient, setIsClient] = useState(false);
  
  const {
    isRunning,
    currentMode,
    currentSpeed,
    isLoadingWeights,
    weightLoadError,
    startAI,
    stopAI,
    setMode,
    setSpeed,
  } = useAIController({ board, gameOver, onMove, onMoveImmediate });

  // 客户端加载检测
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return (
    <div className="p-4">
      {/* 标题 */}
      <div className="flex items-center mb-4">
        <h3 className="text-lg font-bold text-gray-800 flex items-center">
          <svg className="w-5 h-5 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
          </svg>
          AI 玩家
        </h3>
      </div>

      {/* AI模式选择 - Requirements: 2.1, 2.2, 2.6 */}
      <div className="mb-4">
        <div className="space-y-2">
          {AI_MODES.map((mode) => {
            const isSelected = currentMode === mode.id;
            const isNTupleLoading = mode.id === 'ntuple' && isLoadingWeights;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setMode(mode.id)}
                disabled={isNTupleLoading}
                className={`
                  w-full p-3 text-left rounded-lg transition-all duration-200 border-2
                  ${isSelected
                    ? 'bg-blue-50 border-blue-400 shadow-sm'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                  }
                  ${isNTupleLoading ? 'opacity-50 cursor-wait' : ''}
                `}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>
                    {mode.name}
                    {isNTupleLoading && ' (加载中...)'}
                  </span>
                  {isSelected && !isNTupleLoading && (
                    <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <p className={`text-xs mt-1 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                  {mode.description}
                </p>
              </button>
            );
          })}
        </div>
        
        {/* 权重加载错误提示 */}
        {weightLoadError && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
            <p className="text-xs text-red-600">
              ⚠️ {weightLoadError}
            </p>
          </div>
        )}
      </div>

      {/* 速度调节 - Requirements: 2.7 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          移动速度
        </label>
        <div className="grid grid-cols-4 gap-2">
          {SPEED_OPTIONS.map((speed) => {
            const isSelected = currentSpeed === speed.id;
            return (
              <button
                key={speed.id}
                type="button"
                onClick={() => setSpeed(speed.id)}
                className={`
                  py-2 px-3 text-center text-sm rounded-md transition-colors duration-200 border
                  ${isSelected
                    ? 'bg-blue-100 border-blue-400 text-blue-800 font-medium'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                {speed.name}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-1 text-center">
          {currentSpeed === 'turbo' ? '极速模式：无延迟' : `间隔: ${MOVE_SPEEDS[currentSpeed]}ms`}
        </p>
      </div>

      {/* 开始/停止按钮 - Requirements: 2.3, 2.4, 2.5 */}
      <button
        type="button"
        onClick={isRunning ? stopAI : startAI}
        disabled={gameOver && !isRunning}
        className={`
          w-full py-3 px-4 rounded-lg font-medium text-white transition-all duration-200
          flex items-center justify-center space-x-2
          ${isRunning
            ? 'bg-red-500 hover:bg-red-600 active:bg-red-700'
            : gameOver
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 active:bg-green-700'
          }
        `}
      >
        {isRunning ? (
          <>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
            </svg>
            <span>停止</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            <span>开始</span>
          </>
        )}
      </button>

      {/* 运行状态指示 */}
      {isRunning && (
        <div className="mt-3 flex items-center justify-center text-sm text-blue-600">
          <span className="relative flex h-3 w-3 mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
          </span>
          AI 运行中...
        </div>
      )}

      {/* 游戏结束提示 */}
      {gameOver && !isRunning && (
        <p className="mt-3 text-center text-sm text-gray-500">
          游戏已结束，请重新开始
        </p>
      )}
    </div>
  );
}
