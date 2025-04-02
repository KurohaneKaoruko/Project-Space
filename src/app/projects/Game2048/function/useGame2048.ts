import { useState, useEffect, useCallback } from 'react';

import { getSize, getHighScore } from './localData'

interface GameState {
  board: number[][];
  score: number;
  gameOver: boolean;
  size: number;
  highScore: number;
}

const STORAGE_KEYS = {
  SIZE: 'game2048_size',
  HIGH_SCORE: 'game2048_high_score',
  HIGH_SCORE_4: 'game2048_high_score',
  HIGH_SCORE_5: 'game2048_high_score_5',
  HIGH_SCORE_6: 'game2048_high_score_6',
  HIGH_SCORE_7: 'game2048_high_score_7',
  HIGH_SCORE_8: 'game2048_high_score_8'
};

// 确保大小是有效的数字
const getValidSize = (size: number): number => {
  return !isNaN(size) && size >= 4 && size <= 8 ? size : 4;
};

const initializeClientState = (): GameState => {
  const size = getSize()
  const highScore = getHighScore(size)
  
  return {
    board: Array(size).fill(0).map(() => Array(size).fill(0)),
    score: 0,
    gameOver: false,
    size,
    highScore
  };
};

export function useGame2048() {
  const [gameState, setGameState] = useState<GameState>({
    board: [],
    score: 0,
    gameOver: false,
    size: 4,
    highScore: 0
  });

  useEffect(() => {
    const clientState = initializeClientState();
    addNewTile(clientState.board, clientState.size);
    setGameState(clientState);
  }, []);

  // 初始化游戏
  const initGame = useCallback((size: number = 4) => {
    try {
      const validSize = getValidSize(size);
      const newBoard = Array(validSize).fill(0).map(() => Array(validSize).fill(0));
      
      // 客户端存储操作
      const savedHighScore = 
        size === 4 ? localStorage.getItem(STORAGE_KEYS.HIGH_SCORE) :
        size === 5 ? localStorage.getItem(STORAGE_KEYS.HIGH_SCORE_5) :
        size === 6 ? localStorage.getItem(STORAGE_KEYS.HIGH_SCORE_6) :
        size === 7 ? localStorage.getItem(STORAGE_KEYS.HIGH_SCORE_7) :
        size === 8 ? localStorage.getItem(STORAGE_KEYS.HIGH_SCORE_8) :
        0;
      const highScore = savedHighScore ? parseInt(savedHighScore) : 0;
      
      addNewTile(newBoard, validSize);
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

  const onSizeChange = useCallback((size: number = 4) => {
    localStorage.setItem(STORAGE_KEYS.SIZE, size.toString());
    initGame(size);
  }, [initGame]);

  const onRestart = useCallback(() => {
    const savedSize = localStorage.getItem(STORAGE_KEYS.SIZE);
    const size = getValidSize(savedSize ? parseInt(savedSize) : 4);
    initGame(size);
  }, [initGame]);

  const submitScore = useCallback(async (playerName: string = 'No Name') => {
    const score = gameState.score;
    const timestamp = Date.now();
    
    // 创建加密的数据对象
    const rawData = {
      playerName: playerName || 'No Name',
      score,
      timestamp,
      gameSize: gameState.size
    };
    
    // 简单加密函数 - Base64 + 简单密钥混淆
    const encryptData = (data: {
      playerName: string,
      score: number,
      timestamp: number,
      gameSize: number
    }) => {
      // 转成字符串
      const jsonStr = JSON.stringify(data);
      // 简单密钥
      const secretKey = process.env.NEXT_PUBLIC_GAME_2048_SUBMIT_KEY;
      // 添加密钥特征码
      const dataWithKey = jsonStr + '|' + secretKey;
      // Base64编码
      return btoa(dataWithKey);
    };
    
    // 发送加密后的数据
    const response = await fetch('/api/game2048/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: encryptData(rawData),
        // 添加一个校验和
        checksum: btoa(String(rawData.score) + rawData.timestamp)
      }),
    });
    
    if (!response.ok) {
      throw new Error(`提交分数失败: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || '提交分数失败');
    }
    
    return result;
  }, [gameState.score, gameState.size]);

  // 更新最高分
  const updateHighScore = useCallback((score: number) => {
    if (score > gameState.highScore) {
      setGameState(prev => ({
        ...prev,
        highScore: score
      }));
      const size = gameState.size;
      if (size === 4) {
        localStorage.setItem(STORAGE_KEYS.HIGH_SCORE, score.toString());
      } else if (size === 5) {
        localStorage.setItem(STORAGE_KEYS.HIGH_SCORE_5, score.toString());
      } else if (size === 6) {
        localStorage.setItem(STORAGE_KEYS.HIGH_SCORE_6, score.toString());
      } else if (size === 7) {
        localStorage.setItem(STORAGE_KEYS.HIGH_SCORE_7, score.toString());
      } else if (size === 8) {
        localStorage.setItem(STORAGE_KEYS.HIGH_SCORE_8, score.toString());
      }
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
      if (size <= 4) {
        // 90% 9% 1%
        board[x][y] = Math.random() < 0.9 ? 2 :
                      Math.random() < 0.9 ? 4 : 8;
      } else if (size <= 6) {
        // 70% 21% 6.3% 2.7%
        board[x][y] = Math.random() < 0.7 ? 2 :
                      Math.random() < 0.7 ? 4 :
                      Math.random() < 0.7 ? 8 : 16;
      } else {
        // 50% 25% 12.5% 6.25% 3.125%
        board[x][y] = Math.random() < 0.5 ? 2 :
                      Math.random() < 0.5 ? 4 :
                      Math.random() < 0.5 ? 8 :
                      Math.random() < 0.5 ? 16 : 32;
      }
    }
  };

  // 移动方块
  const moveTiles = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (gameState.gameOver) return;

    const newBoard = JSON.parse(JSON.stringify(gameState.board));
    let moved = false;
    let newScore = gameState.score;

    // 根据方向旋转矩阵，使所有移动都变成向左移动
    const rotateBoard = (board: number[][], times: number) => {
      for (let t = 0; t < times; t++) {
        const rotated = Array(board.length).fill(0).map(() => Array(board.length).fill(0));
        for (let i = 0; i < board.length; i++) {
          for (let j = 0; j < board.length; j++) {
            rotated[i][j] = board[board.length - 1 - j][i];
          }
        }
        for (let i = 0; i < board.length; i++) {
          for (let j = 0; j < board.length; j++) {
            board[i][j] = rotated[i][j];
          }
        }
      }
    };

    // 根据方向旋转矩阵
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
      addNewTile(newBoard, gameState.size);
      const isGameOver = checkGameOver(newBoard);
      setGameState(prev => ({
        board: newBoard,
        score: newScore,
        gameOver: isGameOver,
        size: prev.size,
        highScore: prev.highScore
      }));
      updateHighScore(newScore);
    }
  }, [gameState.board, gameState.score, gameState.gameOver, gameState.size, updateHighScore]);

  // 检查游戏是否结束
  const checkGameOver = (board: number[][]) => {
    // 检查是否有空格
    for (let i = 0; i < board.length; i++) {
      for (let j = 0; j < board.length; j++) {
        if (board[i][j] === 0) return false;
      }
    }

    // 检查是否有相邻的相同数字
    for (let i = 0; i < board.length; i++) {
      for (let j = 0; j < board.length; j++) {
        const current = board[i][j];
        if (
          (i < board.length - 1 && current === board[i + 1][j]) ||
          (j < board.length - 1 && current === board[i][j + 1])
        ) {
          return false;
        }
      }
    }

    return true;
  };

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
    const savedSize = localStorage.getItem(STORAGE_KEYS.SIZE);
    const size = getValidSize(savedSize ? parseInt(savedSize) : 4);
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
    submitScore
  };
}