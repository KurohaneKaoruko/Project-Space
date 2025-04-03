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