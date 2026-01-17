/**
 * 2048游戏核心类型定义
 * 
 * 本文件定义了游戏引擎所需的所有TypeScript接口和类型。
 * 这些类型用于确保类型安全，并作为游戏引擎与UI层之间的契约。
 */

/**
 * 移动方向
 * 表示玩家可以执行的四个移动方向
 */
export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * 单个方块信息
 * 用于追踪方块状态和支持动画效果
 */
export interface Tile {
  /** 唯一标识，用于动画追踪 */
  id: string;
  /** 方块数值 (0, 2, 4, 8, 16, ...) */
  value: number;
  /** 行位置 (0-indexed, 0为顶部) */
  row: number;
  /** 列位置 (0-indexed, 0为左侧) */
  col: number;
  /** 是否为新生成的方块 */
  isNew?: boolean;
  /** 是否为合并产生的方块 */
  isMerged?: boolean;
}

/**
 * 扩展的方块接口，包含动画所需的位置信息
 * 用于追踪方块移动前后的位置，实现滑动动画
 */
export interface AnimatedTile extends Tile {
  /** 动画起始行位置（移动前） */
  previousRow?: number;
  /** 动画起始列位置（移动前） */
  previousCol?: number;
  /** 是否正在执行移动动画 */
  isMoving?: boolean;
}

/**
 * 动画阶段
 * 表示当前动画系统所处的阶段
 */
export type AnimationPhase = 'idle' | 'moving' | 'merging' | 'spawning';

/**
 * 动画状态管理
 * 用于协调移动、合并、生成动画的时序
 */
export interface AnimationState {
  /** 是否正在执行动画 */
  isAnimating: boolean;
  /** 当前动画阶段 */
  phase: AnimationPhase;
  /** 待执行的移动队列 */
  pendingMoves: Direction[];
  /** 动画持续时间(ms) */
  duration: number;
}

/**
 * 游戏状态
 * 包含游戏的完整状态信息
 */
export interface GameState {
  /** 棋盘数值矩阵，board[row][col] */
  board: number[][];
  /** 方块列表（用于动画追踪） */
  tiles: Tile[];
  /** 当前分数 */
  score: number;
  /** 游戏是否结束 */
  gameOver: boolean;
  /** 是否显示游戏结束弹窗 */
  showGameOver: boolean;
  /** 棋盘大小 (2-8) */
  size: number;
  /** 历史最高分 */
  highScore: number;
}

/**
 * 移动结果
 * 执行移动操作后返回的结果
 */
export interface MoveResult {
  /** 移动后的新状态 */
  state: GameState;
  /** 是否发生有效移动（棋盘是否有变化） */
  moved: boolean;
  /** 本次移动获得的分数 */
  scoreGained: number;
  /** 本次移动中合并的方块列表 */
  mergedTiles: Tile[];
}

/**
 * 序列化的游戏状态
 * 用于持久化存储到localStorage
 */
export interface SerializedGameState {
  /** 格式版本号，用于未来的格式升级 */
  version: number;
  /** 棋盘数值矩阵 */
  board: number[][];
  /** 当前分数 */
  score: number;
  /** 棋盘大小 */
  size: number;
  /** 历史最高分 */
  highScore: number;
  /** 保存时间戳 */
  timestamp: number;
  /** 是否显示游戏结束弹窗 */
  showGameOver?: boolean;
}

/**
 * 游戏历史记录项
 * 用于支持撤销功能
 */
export interface HistoryEntry {
  /** 棋盘状态快照 */
  board: number[][];
  /** 该状态时的分数 */
  score: number;
}

/**
 * 游戏历史管理Hook的配置选项
 */
export interface GameHistoryOptions {
  /** 最大历史记录数，默认5 */
  maxHistory?: number;
}

/**
 * 游戏历史管理Hook的返回值
 */
export interface GameHistoryReturn {
  /** 历史记录列表 */
  history: HistoryEntry[];
  /** 是否可以撤销 */
  canUndo: boolean;
  /** 添加新状态到历史 */
  pushState: (entry: HistoryEntry) => void;
  /** 弹出最近的状态（撤销） */
  popState: () => HistoryEntry | undefined;
  /** 清空历史记录 */
  clearHistory: () => void;
}

/**
 * 方向配置
 * 用于优化移动算法，避免矩阵旋转
 */
export interface DirectionConfig {
  /** 获取实际行索引 */
  getRow: (i: number, size: number, j: number) => number;
  /** 获取实际列索引 */
  getCol: (j: number, size: number, i: number) => number;
  /** 行遍历起始 */
  rowStart: number;
  /** 行遍历结束 */
  rowEnd: (size: number) => number;
  /** 行遍历步长 */
  rowStep: number;
  /** 列遍历起始 */
  colStart: number;
  /** 列遍历结束 */
  colEnd: (size: number) => number;
  /** 列遍历步长 */
  colStep: number;
}

/**
 * 压缩合并结果
 * 单行/列压缩合并操作的返回值
 */
export interface CompressMergeResult {
  /** 压缩合并后的行/列 */
  result: number[];
  /** 本次操作获得的分数 */
  score: number;
  /** 是否发生移动 */
  moved: boolean;
  /** 合并的位置索引列表 */
  mergedIndices: number[];
}
