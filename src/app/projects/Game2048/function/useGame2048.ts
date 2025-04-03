import { useState, useEffect, useCallback } from 'react';
import { getValidSize, getGameSize, saveGameSize, getHighScore, saveHighScore } from './localData'
import { submitScore } from './submitScore'
import { sha256 } from 'js-sha256';

import { checkGameOver, rotateBoard, generateRandomTileNumber } from './gameUtils'

interface GameState {
  board: number[][];
  score: number;
  gameOver: boolean;
  size: number;
  highScore: number;
}

// 定义游戏记录项的类型
interface GameRecordItem {
  board: string;
  score: number;
  hash: string;
}

export function useGame2048() {
  const [gameState, setGameState] = useState<GameState>({
    board: [],
    score: 0,
    gameOver: false,
    size: 4,
    highScore: 0
  });

  const [gameRecord, setGameRecord] = useState<GameRecordItem[]>([])

  // 计算游戏盘面的哈希值
  const calculateBoardHash = (prevRecord: GameRecordItem | null = null) => {
    if (!prevRecord) {
      return sha256('GAME_2048_RECORD');
    }
    // 使用上一个记录的完整信息和当前盘面计算
    return sha256(JSON.stringify(prevRecord));
  };

  // 初始化游戏
  const initGame = useCallback((size: number = 4) => {
    try {
      const validSize = getValidSize(size);
      const newBoard = Array(validSize).fill(0).map(() => Array(validSize).fill(0));
      const highScore = getHighScore(validSize)
      
      // 添加初始方块
      addNewTile(newBoard, validSize);
      
      // 初始盘面记录，哈希值为空字符串
      const boardStr = JSON.stringify(newBoard);
      const initialHash = calculateBoardHash(gameRecord[0]);
      setGameRecord([
        {
          board: boardStr,
          hash: initialHash,
          score: 0
        }
      ]);
      setGameState({
        board: newBoard,
        score: 0,
        gameOver: false,
        size: validSize,
        highScore: highScore
      });
    } catch (error) {
      console.error('Error initializing game:', error);
    }
  }, []);

  // 切换游戏大小
  const onSizeChange = useCallback((size: number = 4) => {
    saveGameSize(size);
    initGame(size);
  }, [initGame]);

  // 重新开始游戏
  const onRestart = useCallback(() => {
    const size = getGameSize();
    initGame(size);
  }, [initGame]);

  // 提交分数
  const onSubmitScore = useCallback(async (playerName: string = 'No Name') => {
    const score = gameState.score;
    const timestamp = Date.now();
    
    // 创建加密的数据对象
    const rawData = {
      playerName: playerName || 'No Name',
      score,
      timestamp,
      gameSize: gameState.size,
      gameRecord: btoa(JSON.stringify(gameRecord))
    };

    return await submitScore(rawData);
  }, [gameState.score, gameState.size, gameRecord]);

  // 更新最高分
  const updateHighScore = useCallback((score: number) => {
    if (score > gameState.highScore) {
      setGameState(prev => ({
        ...prev,
        highScore: score
      }));
      const size = gameState.size;
      saveHighScore(size, gameState.highScore)
    }
  }, [gameState.highScore, gameState.size]);

  // 添加新方块
  const addNewTile = (board: number[][], size: number) => {
    const emptyCells = [];
    for (let i = 0; i < board.length; i++) {
      for (let j = 0; j < board.length; j++) {
        if (board[i][j] === 0) {
          emptyCells.push({ x: i, y: j });
        }
      }
    }
    if (emptyCells.length > 0) {
      const { x, y } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      const tileValue = generateRandomTileNumber(size);
      board[x][y] = tileValue;
      return tileValue;
    }
    return 0;
  };

  // 移动方块
  const moveTiles = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (gameState.gameOver) return;

    // 使用深拷贝，但保留Infinity值
    const newBoard = gameState.board.map(row => row.map(cell => cell));
    
    let moved = false;
    let newScore = gameState.score;

    // 根据方向旋转矩阵，使所有移动都变成向左移动
    switch (direction) {
      case 'up': rotateBoard(newBoard, 1); break;
      case 'right': rotateBoard(newBoard, 2); break;
      case 'down': rotateBoard(newBoard, 3); break;
    }

    // 向左移动并合并
    for (let i = 0; i < newBoard.length; i++) {
      const row = newBoard[i].filter((cell: number) => cell !== 0 || cell === Infinity);
      for (let j = 0; j < row.length - 1; j++) {
        if (row[j] === row[j + 1]) {
          row[j] *= 2;
          newScore += row[j];
          row.splice(j + 1, 1);
          moved = true;
        }
      }
      const newRow = [...row, ...Array(newBoard.length - row.length).fill(0)].map(value => value ?? Infinity);
      if (JSON.stringify(newBoard[i]) !== JSON.stringify(newRow)) {
        moved = true;
      }
      newBoard[i] = newRow;
    }

    // 旋转回原始方向
    switch (direction) {
      case 'up': rotateBoard(newBoard, 3); break;
      case 'right': rotateBoard(newBoard, 2); break;
      case 'down': rotateBoard(newBoard, 1); break;
    }

    if (moved) {
      // 添加新方块并
      addNewTile(newBoard, gameState.size);
      
      const isGameOver = checkGameOver(newBoard);
      
      // 记录游戏盘面
      const boardStr = JSON.stringify(newBoard);
      const prevRecord = gameRecord[gameRecord.length - 1];
      const newHash = calculateBoardHash(prevRecord);
      
      setGameRecord(prev => [
        ...prev,
        {
          board: boardStr,
          score: newScore - gameState.score,
          hash: newHash,
        }
      ]);
      
      setGameState(prev => ({
        board: newBoard,
        score: newScore,
        gameOver: isGameOver,
        size: prev.size,
        highScore: prev.highScore
      }));
      updateHighScore(newScore);
    }
  }, [gameState.board, gameState.score, gameState.gameOver, gameState.size, updateHighScore, gameRecord]);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          moveTiles('down');
          break;
        case 'ArrowDown':
          event.preventDefault();
          moveTiles('up');
          break;
        case 'ArrowLeft':
          event.preventDefault();
          moveTiles('left');
          break;
        case 'ArrowRight':
          event.preventDefault();
          moveTiles('right');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveTiles]);

  // 初始化游戏
  useEffect(() => {
    const size = getGameSize();
    initGame(size);
  }, [initGame]);

  return {
    board: gameState.board,
    score: gameState.score,
    gameOver: gameState.gameOver,
    size: gameState.size,
    highScore: gameState.highScore,
    onSizeChange,
    onRestart,
    onSubmitScore
  };
}