/**
 * Game Engine Verification Script
 * 
 * 验证位棋盘游戏引擎的核心功能是否正确工作。
 * 这是一个简单的验证脚本，用于Checkpoint 3。
 */

import {
  Game,
  Board,
  initTables,
  matrixToBoard,
  boardToMatrix,
  move,
  moveLeft,
  moveRight,
  moveUp,
  moveDown,
  transpose,
  countEmpty,
  getMaxTile,
  isGameOver,
  getTile,
  setTile,
} from './game';

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

console.log('=== Game Engine Verification ===\n');

// Initialize tables
initTables();
console.log('Tables initialized.\n');

// Test 1: Matrix to Board conversion
test('Matrix to Board and back', () => {
  const matrix = [
    [2, 4, 8, 16],
    [32, 64, 128, 256],
    [512, 1024, 2048, 4096],
    [0, 0, 0, 0],
  ];
  const board = matrixToBoard(matrix);
  const result = boardToMatrix(board);
  return arraysEqual(matrix, result);
});

// Test 2: Move Left - basic merge
test('Move Left - basic merge', () => {
  const matrix = [
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const expected = [
    [4, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const board = matrixToBoard(matrix);
  const result = moveLeft(board);
  if (!result) return false;
  return arraysEqual(boardToMatrix(result.board), expected) && result.score === 4;
});

// Test 3: Move Left - multiple merges
test('Move Left - multiple merges', () => {
  const matrix = [
    [2, 2, 2, 2],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const expected = [
    [4, 4, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const board = matrixToBoard(matrix);
  const result = moveLeft(board);
  if (!result) return false;
  return arraysEqual(boardToMatrix(result.board), expected) && result.score === 8;
});

// Test 4: Move Right
test('Move Right - basic merge', () => {
  const matrix = [
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const expected = [
    [0, 0, 0, 4],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const board = matrixToBoard(matrix);
  const result = moveRight(board);
  if (!result) return false;
  return arraysEqual(boardToMatrix(result.board), expected) && result.score === 4;
});

// Test 5: Move Up
test('Move Up - basic merge', () => {
  const matrix = [
    [2, 0, 0, 0],
    [2, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const expected = [
    [4, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const board = matrixToBoard(matrix);
  const result = moveUp(board);
  if (!result) return false;
  return arraysEqual(boardToMatrix(result.board), expected) && result.score === 4;
});

// Test 6: Move Down
test('Move Down - basic merge', () => {
  const matrix = [
    [2, 0, 0, 0],
    [2, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const expected = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [4, 0, 0, 0],
  ];
  const board = matrixToBoard(matrix);
  const result = moveDown(board);
  if (!result) return false;
  return arraysEqual(boardToMatrix(result.board), expected) && result.score === 4;
});

// Test 7: No move possible
test('No move when tiles cannot merge or slide', () => {
  const matrix = [
    [2, 4, 2, 4],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const board = matrixToBoard(matrix);
  const result = moveLeft(board);
  return result === null;
});

// Test 8: Transpose
test('Transpose board', () => {
  const matrix = [
    [2, 4, 8, 16],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const expected = [
    [2, 0, 0, 0],
    [4, 0, 0, 0],
    [8, 0, 0, 0],
    [16, 0, 0, 0],
  ];
  const board = matrixToBoard(matrix);
  const transposed = transpose(board);
  return arraysEqual(boardToMatrix(transposed), expected);
});

// Test 9: Count empty
test('Count empty tiles', () => {
  const matrix = [
    [2, 4, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const board = matrixToBoard(matrix);
  return countEmpty(board) === 14;
});

// Test 10: Get max tile
test('Get max tile', () => {
  const matrix = [
    [2, 4, 8, 16],
    [32, 64, 128, 256],
    [512, 1024, 2048, 4096],
    [0, 0, 0, 0],
  ];
  const board = matrixToBoard(matrix);
  return getMaxTile(board) === 4096;
});

// Test 11: Game over detection - not over
test('Game over detection - not over (has empty)', () => {
  const matrix = [
    [2, 4, 8, 16],
    [32, 64, 128, 256],
    [512, 1024, 2048, 4096],
    [0, 0, 0, 0],
  ];
  const board = matrixToBoard(matrix);
  return isGameOver(board) === false;
});

// Test 12: Game over detection - not over (can merge horizontally)
test('Game over detection - not over (can merge)', () => {
  const matrix = [
    [2, 2, 8, 16],    // Has adjacent 2s in row 0
    [32, 64, 128, 256],
    [512, 1024, 2048, 4096],
    [4, 8, 16, 32],
  ];
  const board = matrixToBoard(matrix);
  // Has adjacent 2s in row 0, so game is not over
  return isGameOver(board) === false;
});

// Test 13: Game over detection - is over
test('Game over detection - is over', () => {
  const matrix = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2],
  ];
  const board = matrixToBoard(matrix);
  return isGameOver(board) === true;
});

// Test 14: Get/Set tile
test('Get and Set tile', () => {
  let board: Board = 0n;
  board = setTile(board, 0, 1);  // Set position 0 to value 1 (=2)
  board = setTile(board, 5, 3);  // Set position 5 to value 3 (=8)
  board = setTile(board, 15, 11); // Set position 15 to value 11 (=2048)
  
  return getTile(board, 0) === 1 && 
         getTile(board, 5) === 3 && 
         getTile(board, 15) === 11 &&
         getTile(board, 1) === 0;
});

// Test 15: Game class - init
test('Game class - init creates valid game', () => {
  const game = new Game();
  game.init();
  
  // Should have 2 tiles
  const emptyCount = game.countEmpty();
  return emptyCount === 14 && game.score === 0;
});

// Test 16: Game class - move
test('Game class - move updates state', () => {
  const game = new Game();
  game.setFromMatrix([
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  
  const result = game.move(3); // Left
  return result.moved === true && result.score === 4 && game.score === 4;
});

// Test 17: Game class - getAfterstate
test('Game class - getAfterstate returns correct state', () => {
  const game = new Game();
  game.setFromMatrix([
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  
  const afterstate = game.getAfterstate(3); // Left
  if (!afterstate) return false;
  
  const expected = [
    [4, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  
  // Original game should not be modified
  const originalMatrix = game.toMatrix();
  const originalExpected = [
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  
  return arraysEqual(boardToMatrix(afterstate.board), expected) && 
         afterstate.score === 4 &&
         arraysEqual(originalMatrix, originalExpected);
});

// Test 18: Complex merge scenario
test('Complex merge - chain does not double merge', () => {
  // In 2048, [2,2,2,2] -> [4,4,0,0] not [8,0,0,0]
  const matrix = [
    [2, 2, 4, 4],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const expected = [
    [4, 8, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const board = matrixToBoard(matrix);
  const result = moveLeft(board);
  if (!result) return false;
  return arraysEqual(boardToMatrix(result.board), expected) && result.score === 12;
});

// Test 19: Move with gaps
test('Move with gaps - tiles slide correctly', () => {
  const matrix = [
    [2, 0, 0, 2],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const expected = [
    [4, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const board = matrixToBoard(matrix);
  const result = moveLeft(board);
  if (!result) return false;
  return arraysEqual(boardToMatrix(result.board), expected) && result.score === 4;
});

// Test 20: Full board move
test('Full board move', () => {
  const matrix = [
    [2, 4, 8, 16],
    [2, 4, 8, 16],
    [2, 4, 8, 16],
    [2, 4, 8, 16],
  ];
  // When moving up, each column [2,2,2,2] merges to [4,4,0,0]
  const expected = [
    [4, 8, 16, 32],
    [4, 8, 16, 32],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const board = matrixToBoard(matrix);
  const result = moveUp(board);
  if (!result) return false;
  return arraysEqual(boardToMatrix(result.board), expected);
});

// Summary
console.log('\n=== Summary ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed > 0) {
  console.log('\n❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}
