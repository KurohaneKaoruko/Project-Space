// 检查游戏是否结束
export const checkGameOver = (board: number[][]) => {
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

// 根据方向旋转矩阵，使所有移动都变成向左移动
export const rotateBoard = (board: number[][], times: number) => {
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


export const generateRandomTileNumber = (size: number) => {
  if (size <= 4) {
    // 90% 10%
    return Math.random() < 0.9 ? 2 : 4;
  } else if (size <= 6) {
    // 70% 21% 9%
    return Math.random() < 0.7 ? 2 :
                Math.random() < 0.7 ? 4 : 8;
  } else {
    const maxNum = 65536
    const f = (p:  number, n: number) => {
      if (n >= maxNum || Math.random() < p) return n;
      return f(p, n * 2);
    }
    return f(0.4, 64);
  }
}
