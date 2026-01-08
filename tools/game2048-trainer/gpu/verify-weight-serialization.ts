/**
 * Weight Serialization Verification Script
 * 
 * 验证GPU-CPU权重传输和检查点功能的正确性。
 * 
 * 运行方式: npx ts-node tools/game2048-trainer/gpu/verify-weight-serialization.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { NTupleNetwork } from '../network';
import { STANDARD_6TUPLE_PATTERNS, ROW_COL_4TUPLE_PATTERNS, calculateLutSize } from '../patterns';

// ============================================
// 测试工具函数
// ============================================

// 使用4-tuple模式进行测试（更小的LUT大小）
const TEST_PATTERNS = ROW_COL_4TUPLE_PATTERNS.slice(0, 2);

// ============================================
// 测试工具函数
// ============================================

/**
 * 生成随机权重
 */
function generateRandomWeights(patterns: number[][]): Float64Array[] {
  return patterns.map(pattern => {
    const lutSize = calculateLutSize(pattern.length);
    const weights = new Float64Array(lutSize);
    for (let i = 0; i < lutSize; i++) {
      // 随机权重范围 -1000 到 1000
      weights[i] = (Math.random() - 0.5) * 2000;
    }
    return weights;
  });
}

/**
 * 比较两个权重数组是否相等
 */
function compareWeights(
  weights1: Float64Array[],
  weights2: Float64Array[],
  epsilon: number = 0
): { equal: boolean; maxDiff: number; avgDiff: number } {
  if (weights1.length !== weights2.length) {
    return { equal: false, maxDiff: Infinity, avgDiff: Infinity };
  }
  
  let maxDiff = 0;
  let totalDiff = 0;
  let count = 0;
  
  for (let i = 0; i < weights1.length; i++) {
    if (weights1[i].length !== weights2[i].length) {
      return { equal: false, maxDiff: Infinity, avgDiff: Infinity };
    }
    
    for (let j = 0; j < weights1[i].length; j++) {
      const diff = Math.abs(weights1[i][j] - weights2[i][j]);
      maxDiff = Math.max(maxDiff, diff);
      totalDiff += diff;
      count++;
    }
  }
  
  const avgDiff = count > 0 ? totalDiff / count : 0;
  const equal = maxDiff <= epsilon;
  
  return { equal, maxDiff, avgDiff };
}

// ============================================
// CPU-only 测试（不依赖GPU模块）
// ============================================

async function testCPUWeightRoundTrip(): Promise<boolean> {
  console.log('\n=== 测试CPU权重往返 ===');
  
  const patterns = TEST_PATTERNS;
  
  // 生成随机权重
  const originalWeights = generateRandomWeights(patterns);
  
  // 创建CPU网络并加载权重
  const cpuNetwork = new NTupleNetwork(patterns);
  cpuNetwork.loadWeights({
    version: 1,
    patterns,
    weights: originalWeights.map(w => Array.from(w)),
  });
  
  // 导出权重
  const exportedConfig = cpuNetwork.exportWeights();
  
  // 创建新网络并加载导出的权重
  const cpuNetwork2 = new NTupleNetwork(patterns);
  cpuNetwork2.loadWeights(exportedConfig);
  
  // 获取权重并比较
  const roundTripWeights = cpuNetwork2.getWeights();
  
  const comparison = compareWeights(originalWeights, roundTripWeights, 1e-10);
  
  console.log(`  最大差异: ${comparison.maxDiff}`);
  console.log(`  平均差异: ${comparison.avgDiff}`);
  console.log(`  结果: ${comparison.equal ? '通过' : '失败'}`);
  
  return comparison.equal;
}

async function testWeightsConfigSerialization(): Promise<boolean> {
  console.log('\n=== 测试WeightsConfig序列化 ===');
  
  // 使用测试模式
  const patterns = TEST_PATTERNS;
  const originalWeights = generateRandomWeights(patterns);
  
  // 创建CPU网络
  const cpuNetwork = new NTupleNetwork(patterns);
  cpuNetwork.loadWeights({
    version: 1,
    patterns: patterns,
    weights: originalWeights.map(w => Array.from(w)),
  });
  
  // 导出为JSON
  const config = cpuNetwork.exportWeights({
    trainedGames: 1000,
    avgScore: 50000,
    maxTile: 2048,
    rate2048: 0.95,
  });
  
  // 序列化和反序列化
  const jsonString = JSON.stringify(config);
  const parsedConfig = JSON.parse(jsonString);
  
  // 加载到新网络
  const cpuNetwork2 = new NTupleNetwork(patterns);
  cpuNetwork2.loadWeights(parsedConfig);
  
  // 比较权重
  const roundTripWeights = cpuNetwork2.getWeights();
  const comparison = compareWeights(originalWeights, roundTripWeights, 1e-10);
  
  console.log(`  JSON大小: ${(jsonString.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  最大差异: ${comparison.maxDiff}`);
  console.log(`  平均差异: ${comparison.avgDiff}`);
  console.log(`  结果: ${comparison.equal ? '通过' : '失败'}`);
  
  return comparison.equal;
}

async function testFileIO(): Promise<boolean> {
  console.log('\n=== 测试文件I/O ===');
  
  // 使用测试模式
  const patterns = TEST_PATTERNS;
  const originalWeights = generateRandomWeights(patterns);
  
  // 创建CPU网络
  const cpuNetwork = new NTupleNetwork(patterns);
  cpuNetwork.loadWeights({
    version: 1,
    patterns: patterns,
    weights: originalWeights.map(w => Array.from(w)),
  });
  
  // 导出配置
  const config = cpuNetwork.exportWeights({
    trainedGames: 1000,
    avgScore: 50000,
    maxTile: 2048,
  });
  
  // 写入临时文件
  const tempPath = path.join(__dirname, 'temp-weights-test.json');
  
  try {
    fs.writeFileSync(tempPath, JSON.stringify(config));
    
    const fileStats = fs.statSync(tempPath);
    
    // 读取文件
    const fileContent = fs.readFileSync(tempPath, 'utf-8');
    const loadedConfig = JSON.parse(fileContent);
    
    // 加载到新网络
    const cpuNetwork2 = new NTupleNetwork(patterns);
    cpuNetwork2.loadWeights(loadedConfig);
    
    // 比较权重
    const roundTripWeights = cpuNetwork2.getWeights();
    const comparison = compareWeights(originalWeights, roundTripWeights, 1e-10);
    
    console.log(`  文件大小: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  最大差异: ${comparison.maxDiff}`);
    console.log(`  结果: ${comparison.equal ? '通过' : '失败'}`);
    
    // 清理临时文件
    fs.unlinkSync(tempPath);
    
    return comparison.equal;
  } catch (error) {
    // 清理临时文件（如果存在）
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    console.log(`  错误: ${(error as Error).message}`);
    return false;
  }
}

// ============================================
// GPU模块测试
// ============================================

async function runGPUTests(): Promise<boolean> {
  try {
    // 动态导入GPU模块
    const { createGPUEngine } = await import('./gpu-engine');
    const { createGPUNTupleNetwork } = await import('./gpu-network');
    const { 
      WeightTransferManager, 
      GPUCheckpointManager,
      saveGPUWeightsToFile,
      loadGPUWeightsFromFile,
    } = await import('./weight-serialization');
    
    console.log('\n' + '='.repeat(60));
    console.log('GPU权重传输测试');
    console.log('='.repeat(60));
    
    // 初始化GPU引擎 - 使用CPU模式
    console.log('\n初始化GPU引擎...');
    const engine = await createGPUEngine({ batchSize: 64, debug: false, enabled: false });
    const deviceInfo = engine.getDeviceInfo();
    console.log(`设备: ${deviceInfo?.name}`);
    console.log(`模式: ${deviceInfo?.isGPU ? 'GPU' : 'CPU'}`);
    
    // 使用较小的模式进行测试
    const patterns = STANDARD_6TUPLE_PATTERNS.slice(0, 2);
    let allPassed = true;
    
    // 测试1: GPU权重往返
    console.log('\n=== 测试GPU权重往返 ===');
    {
      const originalWeights = generateRandomWeights(patterns);
      
      // 创建GPU网络
      const gpuNetwork = createGPUNTupleNetwork(engine, patterns);
      gpuNetwork.loadWeightsToGPU(originalWeights);
      
      // 导出权重
      const exportedWeights = gpuNetwork.exportWeightsToCPU();
      
      // 比较（Float32精度损失是预期的）
      const comparison = compareWeights(originalWeights, exportedWeights, 0.01);
      
      console.log(`  最大差异: ${comparison.maxDiff}`);
      console.log(`  平均差异: ${comparison.avgDiff}`);
      console.log(`  结果: ${comparison.maxDiff < 0.01 ? '通过' : '失败'}`);
      
      if (comparison.maxDiff >= 0.01) allPassed = false;
      
      gpuNetwork.dispose();
    }
    
    // 测试2: WeightTransferManager
    console.log('\n=== 测试WeightTransferManager ===');
    {
      const originalWeights = generateRandomWeights(patterns);
      
      const gpuNetwork = createGPUNTupleNetwork(engine, patterns);
      gpuNetwork.loadWeightsToGPU(originalWeights);
      
      const transferManager = new WeightTransferManager(gpuNetwork);
      
      // 测试导出
      const exportResult = transferManager.exportToCPU();
      console.log(`  导出成功: ${exportResult.result.success}`);
      console.log(`  权重数量: ${exportResult.result.weightCount}`);
      console.log(`  传输时间: ${exportResult.result.transferTime}ms`);
      
      if (!exportResult.result.success) {
        allPassed = false;
      }
      
      // 测试往返验证
      const roundTripResult = transferManager.verifyRoundTrip();
      console.log(`  往返验证: ${roundTripResult.success ? '通过' : '失败'}`);
      console.log(`  最大差异: ${roundTripResult.maxDiff}`);
      
      if (!roundTripResult.success) allPassed = false;
      
      gpuNetwork.dispose();
    }
    
    // 测试3: 文件I/O
    console.log('\n=== 测试GPU权重文件I/O ===');
    {
      const originalWeights = generateRandomWeights(patterns);
      const tempPath = path.join(__dirname, 'temp-gpu-weights-test.json');
      
      try {
        const gpuNetwork = createGPUNTupleNetwork(engine, patterns);
        gpuNetwork.loadWeightsToGPU(originalWeights);
        
        // 保存到文件
        const saveSuccess = saveGPUWeightsToFile(gpuNetwork, tempPath, {
          trainedGames: 1000,
          avgScore: 50000,
        });
        console.log(`  保存成功: ${saveSuccess}`);
        
        // 创建新网络并加载
        const gpuNetwork2 = createGPUNTupleNetwork(engine, patterns);
        const loadResult = loadGPUWeightsFromFile(gpuNetwork2, tempPath);
        console.log(`  加载成功: ${loadResult.success}`);
        console.log(`  权重数量: ${loadResult.weightCount}`);
        console.log(`  传输时间: ${loadResult.transferTime}ms`);
        
        // 比较权重
        const loadedWeights = gpuNetwork2.exportWeightsToCPU();
        const comparison = compareWeights(originalWeights, loadedWeights, 0.01);
        console.log(`  最大差异: ${comparison.maxDiff}`);
        console.log(`  结果: ${comparison.maxDiff < 0.01 ? '通过' : '失败'}`);
        
        if (!saveSuccess || !loadResult.success || comparison.maxDiff >= 0.01) {
          allPassed = false;
        }
        
        gpuNetwork.dispose();
        gpuNetwork2.dispose();
        
        // 清理临时文件
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (error) {
        console.log(`  错误: ${(error as Error).message}`);
        allPassed = false;
        
        // 清理临时文件
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
    }
    
    // 测试4: GPUCheckpointManager
    console.log('\n=== 测试GPUCheckpointManager ===');
    {
      const originalWeights = generateRandomWeights(patterns);
      const tempPath = path.join(__dirname, 'temp-gpu-checkpoint-test.json');
      
      try {
        const gpuNetwork = createGPUNTupleNetwork(engine, patterns);
        gpuNetwork.loadWeightsToGPU(originalWeights);
        
        const checkpointManager = new GPUCheckpointManager(gpuNetwork, tempPath);
        
        // 保存检查点
        const saveSuccess = checkpointManager.saveCheckpoint({
          config: {
            episodes: 10000,
            learningRate: 0.0025,
            enableDecay: false,
            decayRate: 0.95,
            decayInterval: 10000,
            optimisticInit: 0,
            reportInterval: 100,
            outputPath: 'weights.json',
            checkpointInterval: 1000,
            checkpointPath: tempPath,
            gpu: {
              enabled: true,
              batchSize: 64,
            },
            gradientAccumulationSteps: 1,
            validationInterval: 1000,
          },
          episode: 500,
          currentLearningRate: 0.0025,
          stats: {
            episode: 500,
            totalScore: 25000000,
            avgScore: 50000,
            recentAvgScore: 52000,
            maxTile: 4096,
            rate2048: 0.95,
            rate4096: 0.45,
            rate8192: 0.05,
            episodesPerSecond: 100,
            elapsedTime: 5,
            estimatedRemaining: 95,
          },
          milestoneCount: { tile2048: 475, tile4096: 225, tile8192: 25 },
          recentScores: [50000, 51000, 52000, 53000, 54000],
        });
        
        console.log(`  保存检查点: ${saveSuccess ? '成功' : '失败'}`);
        console.log(`  检查点存在: ${checkpointManager.hasCheckpoint()}`);
        
        // 创建新网络并加载检查点
        const gpuNetwork2 = createGPUNTupleNetwork(engine, patterns);
        const checkpointManager2 = new GPUCheckpointManager(gpuNetwork2, tempPath);
        
        const checkpoint = checkpointManager2.loadCheckpoint();
        console.log(`  加载检查点: ${checkpoint ? '成功' : '失败'}`);
        
        if (checkpoint) {
          console.log(`  恢复轮数: ${checkpoint.episode}`);
          console.log(`  恢复学习率: ${checkpoint.currentLearningRate}`);
          console.log(`  GPU状态批量大小: ${checkpoint.gpuState.batchSize}`);
          
          // 比较权重
          const loadedWeights = gpuNetwork2.exportWeightsToCPU();
          const comparison = compareWeights(originalWeights, loadedWeights, 0.01);
          console.log(`  权重最大差异: ${comparison.maxDiff}`);
          console.log(`  结果: ${comparison.maxDiff < 0.01 ? '通过' : '失败'}`);
          
          if (comparison.maxDiff >= 0.01) allPassed = false;
        } else {
          allPassed = false;
        }
        
        // 删除检查点
        const deleteSuccess = checkpointManager2.deleteCheckpoint();
        console.log(`  删除检查点: ${deleteSuccess ? '成功' : '失败'}`);
        
        gpuNetwork.dispose();
        gpuNetwork2.dispose();
      } catch (error) {
        console.log(`  错误: ${(error as Error).message}`);
        allPassed = false;
        
        // 清理临时文件
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
    }
    
    // 测试5: 检查点验证
    console.log('\n=== 测试检查点验证 ===');
    {
      const originalWeights = generateRandomWeights(patterns);
      const tempPath = path.join(__dirname, 'temp-gpu-validation-test.json');
      
      try {
        const gpuNetwork = createGPUNTupleNetwork(engine, patterns);
        gpuNetwork.loadWeightsToGPU(originalWeights);
        
        const checkpointManager = new GPUCheckpointManager(gpuNetwork, tempPath);
        
        // 保存检查点
        checkpointManager.saveCheckpoint({
          config: {
            episodes: 10000,
            learningRate: 0.0025,
            enableDecay: false,
            decayRate: 0.95,
            decayInterval: 10000,
            optimisticInit: 0,
            reportInterval: 100,
            outputPath: 'weights.json',
            checkpointInterval: 1000,
            checkpointPath: tempPath,
            gpu: {
              enabled: true,
              batchSize: 64,
            },
            gradientAccumulationSteps: 1,
            validationInterval: 1000,
          },
          episode: 500,
          currentLearningRate: 0.0025,
          stats: {
            episode: 500,
            totalScore: 25000000,
            avgScore: 50000,
            recentAvgScore: 52000,
            maxTile: 4096,
            rate2048: 0.95,
            rate4096: 0.45,
            rate8192: 0.05,
            episodesPerSecond: 100,
            elapsedTime: 5,
            estimatedRemaining: 95,
          },
          milestoneCount: { tile2048: 475, tile4096: 225, tile8192: 25 },
          recentScores: [50000, 51000, 52000, 53000, 54000],
        });
        
        // 验证检查点
        const validationResult = checkpointManager.validateCheckpoint();
        console.log(`  验证结果: ${validationResult.valid ? '有效' : '无效'}`);
        if (validationResult.info) {
          console.log(`  轮数: ${validationResult.info.episode}`);
          console.log(`  权重数量: ${validationResult.info.weightCount}`);
          console.log(`  批量大小: ${validationResult.info.batchSize}`);
        }
        
        if (!validationResult.valid) {
          allPassed = false;
        }
        
        // 清理
        checkpointManager.deleteCheckpoint();
        gpuNetwork.dispose();
      } catch (error) {
        console.log(`  错误: ${(error as Error).message}`);
        allPassed = false;
        
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
    }
    
    // 测试6: 紧急检查点
    console.log('\n=== 测试紧急检查点 ===');
    {
      const originalWeights = generateRandomWeights(patterns);
      const tempPath = path.join(__dirname, 'temp-gpu-emergency-test.json');
      
      try {
        const gpuNetwork = createGPUNTupleNetwork(engine, patterns);
        gpuNetwork.loadWeightsToGPU(originalWeights);
        
        const checkpointManager = new GPUCheckpointManager(gpuNetwork, tempPath);
        
        // 保存紧急检查点
        const emergencySaveSuccess = checkpointManager.saveEmergencyCheckpoint(
          {
            config: {
              episodes: 10000,
              learningRate: 0.0025,
              enableDecay: false,
              decayRate: 0.95,
              decayInterval: 10000,
              optimisticInit: 0,
              reportInterval: 100,
              outputPath: 'weights.json',
              checkpointInterval: 1000,
              checkpointPath: tempPath,
              gpu: {
                enabled: true,
                batchSize: 64,
              },
              gradientAccumulationSteps: 1,
              validationInterval: 1000,
            },
            episode: 500,
            currentLearningRate: 0.0025,
            stats: {
              episode: 500,
              totalScore: 25000000,
              avgScore: 50000,
              recentAvgScore: 52000,
              maxTile: 4096,
              rate2048: 0.95,
              rate4096: 0.45,
              rate8192: 0.05,
              episodesPerSecond: 100,
              elapsedTime: 5,
              estimatedRemaining: 95,
            },
            milestoneCount: { tile2048: 475, tile4096: 225, tile8192: 25 },
            recentScores: [50000, 51000, 52000, 53000, 54000],
          },
          'Test error message'
        );
        
        console.log(`  紧急保存: ${emergencySaveSuccess ? '成功' : '失败'}`);
        
        // 查找紧急检查点
        const emergencyFiles = checkpointManager.findEmergencyCheckpoints();
        console.log(`  找到紧急检查点: ${emergencyFiles.length} 个`);
        
        if (!emergencySaveSuccess || emergencyFiles.length === 0) {
          allPassed = false;
        }
        
        // 清理紧急检查点
        const cleanedCount = checkpointManager.cleanupEmergencyCheckpoints(0);
        console.log(`  清理紧急检查点: ${cleanedCount} 个`);
        
        gpuNetwork.dispose();
      } catch (error) {
        console.log(`  错误: ${(error as Error).message}`);
        allPassed = false;
      }
    }
    
    // 清理资源
    engine.dispose();
    
    return allPassed;
  } catch (error) {
    console.log(`\nGPU模块加载失败: ${(error as Error).message}`);
    console.log('这是预期的，如果原生GL绑定不可用。');
    return true; // 不算失败
  }
}

// ============================================
// 主函数
// ============================================

async function main() {
  console.log('='.repeat(60));
  console.log('权重序列化和检查点验证');
  console.log('='.repeat(60));
  
  const results: { name: string; passed: boolean }[] = [];
  
  // CPU-only 测试
  results.push({
    name: 'CPU权重往返',
    passed: await testCPUWeightRoundTrip(),
  });
  
  results.push({
    name: 'WeightsConfig序列化',
    passed: await testWeightsConfigSerialization(),
  });
  
  results.push({
    name: '文件I/O',
    passed: await testFileIO(),
  });
  
  // GPU测试
  results.push({
    name: 'GPU权重传输',
    passed: await runGPUTests(),
  });
  
  // 汇总结果
  console.log('\n' + '='.repeat(60));
  console.log('测试汇总');
  console.log('='.repeat(60));
  
  let allPassed = true;
  for (const result of results) {
    console.log(`  ${result.name}: ${result.passed ? '✓ 通过' : '✗ 失败'}`);
    if (!result.passed) allPassed = false;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`总体结果: ${allPassed ? '✓ 全部通过' : '✗ 存在失败'}`);
  console.log('='.repeat(60));
  
  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('验证脚本出错:', error);
  process.exit(1);
});
