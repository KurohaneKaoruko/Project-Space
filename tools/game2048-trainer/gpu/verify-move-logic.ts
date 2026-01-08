/**
 * Move Logic Verification Script
 * 
 * Checkpoint 4: 验证移动计算逻辑
 * 
 * 这个脚本直接测试移动计算逻辑，不依赖GPU.js。
 * 验证预计算查找表和移动算法的正确性。
 * 
 * Requirements: 2.2, 2.3, 2.4, 2.5
 */

import {
  Board,
  matrixToBoard,
  boardToMatrix,
  move as cpuMove,
  moveLeft,
  moveRight,
  moveUp,
  moveDown,
  initTables,
  getTile,
  setTile,
  Direction,
} from '../game';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean): void {
  try {
    if (fn()) {
      console.log(`✓ ${name}`);
      passed++;
    } else {
      console.log(`✗ ${name}`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ ${name} - Error: ${e}`);
    failed++;
  }
}

function arraysEqual(a: number[][], b: number[][]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].length !== b[i].length) return false;
    for (let j = 0; j < a[i].length; j++) {
      if (a[i][j] !== b[i][j]) return false;
    }
  }
  return true;
}


// ============================================
// Row Move LUT Generation (same as move-kernels.ts)
// ============================================

interface RowMoveLUT {
  rows: Float32Array;
  scores: Float32Array;
}

function computeRowLeft(row: number): [number, number] {
  const tiles = [
    (row >> 12) & 0xF,
    (row >> 8) & 0xF,
    (row >> 4) & 0xF,
    row & 0xF,
  ];

  let score = 0;
  const nonEmpty = tiles.filter(t => t !== 0);
  const merged: number[] = [];
  let i = 0;
  
  while (i < nonEmpty.length) {
    if (i + 1 < nonEmpty.length && nonEmpty[i] === nonEmpty[i + 1]) {
      const newValue = nonEmpty[i] + 1;
      merged.push(newValue);
      score += 1 << newValue;
      i += 2;
    } else {
      merged.push(nonEmpty[i]);
      i++;
    }
  }
  
  while (merged.length < 4) {
    merged.push(0);
  }
  
  const newRow = (merged[0] << 12) | (merged[1] << 8) | (merged[2] << 4) | merged[3];
  return [newRow, score];
}

function reverseRow(row: number): number {
  return (
    ((row & 0xF) << 12) |
    (((row >> 4) & 0xF) << 8) |
    (((row >> 8) & 0xF) << 4) |
    ((row >> 12) & 0xF)
  );
}

function generateLeftLUT(): RowMoveLUT {
  const rows = new Float32Array(65536);
  const scores = new Float32Array(65536);
  
  for (let row = 0; row < 65536; row++) {
    const [newRow, score] = computeRowLeft(row);
    rows[row] = newRow;
    scores[row] = score;
  }
  
  return { rows, scores };
}

function generateRightLUT(): RowMoveLUT {
  const rows = new Float32Array(65536);
  const scores = new Float32Array(65536);
  
  for (let row = 0; row < 65536; row++) {
    const reversed = reverseRow(row);
    const [leftResult, score] = computeRowLeft(reversed);
    rows[row] = reverseRow(leftResult);
    scores[row] = score;
  }
  
  return { rows, scores };
}


// ============================================
// CPU Reference Move Implementation (same as move-kernels.ts)
// ============================================

class CPUMoveReference {
  private leftLUT: RowMoveLUT;
  private rightLUT: RowMoveLUT;
  
  constructor() {
    this.leftLUT = generateLeftLUT();
    this.rightLUT = generateRightLUT();
  }
  
  moveLeft(board: Float32Array): [Float32Array, number, boolean] {
    const result = new Float32Array(16);
    let totalScore = 0;
    let changed = false;
    
    for (let row = 0; row < 4; row++) {
      const t0 = Math.floor(board[row * 4 + 0]);
      const t1 = Math.floor(board[row * 4 + 1]);
      const t2 = Math.floor(board[row * 4 + 2]);
      const t3 = Math.floor(board[row * 4 + 3]);
      
      const rowIndex = t0 * 4096 + t1 * 256 + t2 * 16 + t3;
      const newRow = this.leftLUT.rows[rowIndex];
      const score = this.leftLUT.scores[rowIndex];
      
      result[row * 4 + 0] = Math.floor(newRow / 4096) % 16;
      result[row * 4 + 1] = Math.floor(newRow / 256) % 16;
      result[row * 4 + 2] = Math.floor(newRow / 16) % 16;
      result[row * 4 + 3] = Math.floor(newRow) % 16;
      
      totalScore += score;
      if (newRow !== rowIndex) changed = true;
    }
    
    return [result, totalScore, changed];
  }
  
  moveRight(board: Float32Array): [Float32Array, number, boolean] {
    const result = new Float32Array(16);
    let totalScore = 0;
    let changed = false;
    
    for (let row = 0; row < 4; row++) {
      const t0 = Math.floor(board[row * 4 + 0]);
      const t1 = Math.floor(board[row * 4 + 1]);
      const t2 = Math.floor(board[row * 4 + 2]);
      const t3 = Math.floor(board[row * 4 + 3]);
      
      const rowIndex = t0 * 4096 + t1 * 256 + t2 * 16 + t3;
      const newRow = this.rightLUT.rows[rowIndex];
      const score = this.rightLUT.scores[rowIndex];
      
      result[row * 4 + 0] = Math.floor(newRow / 4096) % 16;
      result[row * 4 + 1] = Math.floor(newRow / 256) % 16;
      result[row * 4 + 2] = Math.floor(newRow / 16) % 16;
      result[row * 4 + 3] = Math.floor(newRow) % 16;
      
      totalScore += score;
      if (newRow !== rowIndex) changed = true;
    }
    
    return [result, totalScore, changed];
  }
  
  moveUp(board: Float32Array): [Float32Array, number, boolean] {
    const result = new Float32Array(16);
    let totalScore = 0;
    let changed = false;
    
    for (let col = 0; col < 4; col++) {
      const t0 = Math.floor(board[0 * 4 + col]);
      const t1 = Math.floor(board[1 * 4 + col]);
      const t2 = Math.floor(board[2 * 4 + col]);
      const t3 = Math.floor(board[3 * 4 + col]);
      
      const colIndex = t0 * 4096 + t1 * 256 + t2 * 16 + t3;
      const newCol = this.leftLUT.rows[colIndex];
      const score = this.leftLUT.scores[colIndex];
      
      result[0 * 4 + col] = Math.floor(newCol / 4096) % 16;
      result[1 * 4 + col] = Math.floor(newCol / 256) % 16;
      result[2 * 4 + col] = Math.floor(newCol / 16) % 16;
      result[3 * 4 + col] = Math.floor(newCol) % 16;
      
      totalScore += score;
      if (newCol !== colIndex) changed = true;
    }
    
    return [result, totalScore, changed];
  }
  
  moveDown(board: Float32Array): [Float32Array, number, boolean] {
    const result = new Float32Array(16);
    let totalScore = 0;
    let changed = false;
    
    for (let col = 0; col < 4; col++) {
      const t0 = Math.floor(board[0 * 4 + col]);
      const t1 = Math.floor(board[1 * 4 + col]);
      const t2 = Math.floor(board[2 * 4 + col]);
      const t3 = Math.floor(board[3 * 4 + col]);
      
      const colIndex = t0 * 4096 + t1 * 256 + t2 * 16 + t3;
      const newCol = this.rightLUT.rows[colIndex];
      const score = this.rightLUT.scores[colIndex];
      
      result[0 * 4 + col] = Math.floor(newCol / 4096) % 16;
      result[1 * 4 + col] = Math.floor(newCol / 256) % 16;
      result[2 * 4 + col] = Math.floor(newCol / 16) % 16;
      result[3 * 4 + col] = Math.floor(newCol) % 16;
      
      totalScore += score;
      if (newCol !== colIndex) changed = true;
    }
    
    return [result, totalScore, changed];
  }
  
  move(board: Float32Array, direction: number): [Float32Array, number, boolean] {
    switch (direction) {
      case 0: return this.moveUp(board);
      case 1: return this.moveRight(board);
      case 2: return this.moveDown(board);
      case 3: return this.moveLeft(board);
      default: throw new Error(`Invalid direction: ${direction}`);
    }
  }
}


// ============================================
// Board Conversion Utilities
// ============================================

function boardToFloat32Array(board: Board): Float32Array {
  const result = new Float32Array(16);
  for (let i = 0; i < 16; i++) {
    result[i] = getTile(board, i);
  }
  return result;
}

function float32ArrayToBoard(tiles: Float32Array): Board {
  let board: Board = 0n;
  for (let i = 0; i < 16; i++) {
    board = setTile(board, i, Math.floor(tiles[i]));
  }
  return board;
}

function generateRandomBoard(): Float32Array {
  const board = new Float32Array(16);
  for (let i = 0; i < 16; i++) {
    if (Math.random() < 0.5) {
      board[i] = 0;
    } else {
      board[i] = Math.floor(Math.random() * 11) + 1;
    }
  }
  return board;
}

function float32Equal(a: Float32Array, b: Float32Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
