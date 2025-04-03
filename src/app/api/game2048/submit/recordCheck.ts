import { createHash } from 'crypto';

interface GameRecordItem {
  board: string;
  hash: string;
}

// 计算游戏盘面的哈希值
function calculateBoardHash(boardStr: string, prevRecord: GameRecordItem | null = null) {
  if (!prevRecord) {
    // 初始记录，只用当前盘面计算
    return createHash('sha256').update(boardStr).digest('hex');
  }
  // 使用上一个记录的完整信息和当前盘面计算
  return createHash('sha256').update(JSON.stringify(prevRecord) + boardStr).digest('hex');
}

// 验证游戏记录的正确性
export function recordCheck(record: GameRecordItem[]) {
  // 验证基本游戏记录
  if (!Array.isArray(record)) {
    return false;
  }

  // 检查游戏记录的哈希链
  try {
    // 检查记录长度
    if (record.length < 2) { // 至少需要初始状态和一次移动
      return false;
    }

    // 验证首条记录的哈希
    const firstBoard = record[0].board;
    const firstHash = record[0].hash;
    const expectedFirstHash = calculateBoardHash(firstBoard);
    if (firstHash !== expectedFirstHash) {
      console.log(`首条记录哈希验证失败: 期望 ${expectedFirstHash}, 实际 ${firstHash}`);
      return false;
    }

    // 验证哈希链
    for (let i = 1; i < record.length; i++) {
      const currentBoard = record[i].board;
      const currentHash = record[i].hash;
      const prevRecord = record[i-1];
      
      // 验证当前哈希是否正确
      const expectedHash = calculateBoardHash(currentBoard, prevRecord);
      if (currentHash !== expectedHash) {
        console.log(`哈希验证失败在步骤 ${i}: 期望 ${expectedHash}, 实际 ${currentHash}`);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('验证游戏记录时出错:', error);
    return false;
  }
}
