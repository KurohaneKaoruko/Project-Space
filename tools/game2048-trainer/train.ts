/**
 * 2048 N-Tuple Network Training - Command Line Entry Point
 * 
 * 命令行训练程序入口，支持配置训练参数。
 * 支持CPU和GPU两种训练模式。
 * 
 * 用法：
 *   npx ts-node training/train.ts [options]
 * 
 * 选项：
 *   --episodes <n>       训练轮数（默认：100000）
 *   --learning-rate <n>  学习率（默认：0.0025）
 *   --output <path>      输出文件路径（默认：weights.json）
 *   --decay              启用学习率衰减
 *   --optimistic <n>     乐观初始值（默认：0，不使用）
 *   --report <n>         进度报告间隔（默认：1000）
 *   --gpu                启用GPU加速训练
 *   --batch-size <n>     GPU批量大小（默认：64）
 *   --device <n>         GPU设备索引（默认：自动选择）
 *   --help               显示帮助信息
 */

import { NTupleNetwork } from './network';
import { Trainer, TrainingConfig } from './trainer';
import { DEFAULT_TRAINING_PATTERNS } from './patterns';

// GPU模块使用动态导入，避免在 gl 包不可用时导致启动失败
// import { GPUEngine, createGPUEngine } from './gpu/gpu-engine';
// import { GPUTrainer, createGPUTrainer, GPUTrainingConfig } from './gpu/gpu-trainer';

// ============================================
// 命令行参数接口
// ============================================

/**
 * 命令行参数
 */
interface CLIArgs {
  /** 训练轮数 */
  episodes: number;
  
  /** 学习率 */
  learningRate: number;
  
  /** 输出文件路径 */
  output: string;
  
  /** 是否启用学习率衰减 */
  decay: boolean;
  
  /** 乐观初始值 */
  optimistic: number;
  
  /** 进度报告间隔 */
  reportInterval: number;
  
  /** 检查点保存间隔 */
  checkpointInterval: number;
  
  /** 检查点文件路径 */
  checkpointPath: string;
  
  /** 权重保存间隔（秒） */
  weightsSaveInterval: number;
  
  /** 是否从检查点恢复 */
  resume: boolean;
  
  /** 是否启用GPU加速 */
  gpu: boolean;
  
  /** GPU批量大小 */
  batchSize: number;
  
  /** GPU设备索引 */
  device: number | undefined;
  
  /** 是否显示帮助 */
  help: boolean;
}

// ============================================
// 默认值
// ============================================

const DEFAULT_ARGS: CLIArgs = {
  episodes: 100000,
  learningRate: 0.0025,
  output: 'weights.json',
  decay: false,
  optimistic: 0,
  reportInterval: 100,
  checkpointInterval: 1000,
  checkpointPath: 'checkpoint.json',
  weightsSaveInterval: 300,  // 默认每5分钟保存一次权重
  resume: false,
  gpu: false,
  batchSize: 64,
  device: undefined,
  help: false,
};

// ============================================
// 帮助信息
// ============================================

/**
 * 打印帮助信息
 */
function printHelp(): void {
  console.log(`
2048 N-Tuple Network 训练程序

用法：
  npx ts-node tools/game2048-trainer/train.ts [选项]

基本选项：
  --episodes <n>       训练轮数（默认：${DEFAULT_ARGS.episodes}）
  --learning-rate <n>  学习率 α（默认：${DEFAULT_ARGS.learningRate}）
  --output <path>      权重输出文件路径（默认：${DEFAULT_ARGS.output}）
  --decay              启用学习率衰减
  --optimistic <n>     乐观初始权重值（默认：${DEFAULT_ARGS.optimistic}，禁用）
  --report <n>         进度报告间隔（默认：${DEFAULT_ARGS.reportInterval}）
  --checkpoint <n>     检查点保存间隔（默认：${DEFAULT_ARGS.checkpointInterval}）
  --checkpoint-path <p> 检查点文件路径（默认：checkpoint.json）
  --weights-save <n>   权重保存间隔（秒）（默认：${DEFAULT_ARGS.weightsSaveInterval}，0表示禁用）
  --resume             从检查点恢复训练
  --help               显示此帮助信息

GPU 选项：
  --gpu                启用 GPU 加速训练
  --batch-size <n>     GPU 模式下的并行游戏数（默认：${DEFAULT_ARGS.batchSize}）
  --device <n>         使用的 GPU 设备索引（默认：自动选择）

示例：
  # 基本训练，100,000 轮（CPU 模式）
  npx ts-node tools/game2048-trainer/train.ts --output weights.json

  # 启用学习率衰减的训练
  npx ts-node tools/game2048-trainer/train.ts --episodes 100000 --decay --output weights.json

  # GPU 加速训练
  npx ts-node tools/game2048-trainer/train.ts --gpu --batch-size 128 --output gpu-weights.json

  # 指定 GPU 设备的训练
  npx ts-node tools/game2048-trainer/train.ts --gpu --device 0 --batch-size 64 --output weights.json

  # 恢复中断的训练
  npx ts-node tools/game2048-trainer/train.ts --resume --output weights.json

  # 自定义检查点间隔（每 5000 轮保存一次）
  npx ts-node tools/game2048-trainer/train.ts --checkpoint 5000 --output weights.json

  # 自定义权重保存间隔（每 10 分钟保存一次）
  npx ts-node tools/game2048-trainer/train.ts --weights-save 600 --output weights.json

  # 禁用定时权重保存
  npx ts-node tools/game2048-trainer/train.ts --weights-save 0 --output weights.json

注意：
  - 按 Ctrl+C 中断训练，进度将自动保存到检查点。
  - 使用 --resume 从上次中断的位置继续训练。
  - GPU 模式需要 GPU.js 和兼容的 GPU，如不可用将自动回退到 CPU 模式。
`);
}

// ============================================
// 参数解析
// ============================================

/**
 * 解析命令行参数
 * @returns 解析后的参数对象
 */
function parseArgs(): CLIArgs {
  const args: CLIArgs = { ...DEFAULT_ARGS };
  const argv = process.argv.slice(2);
  
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        args.help = true;
        break;
        
      case '--episodes':
      case '-e':
        if (i + 1 < argv.length) {
          const value = parseInt(argv[++i], 10);
          if (isNaN(value) || value <= 0) {
            console.error(`Error: Invalid episodes value: ${argv[i]}`);
            process.exit(1);
          }
          args.episodes = value;
        } else {
          console.error('Error: --episodes requires a value');
          process.exit(1);
        }
        break;
        
      case '--learning-rate':
      case '-l':
        if (i + 1 < argv.length) {
          const value = parseFloat(argv[++i]);
          if (isNaN(value) || value <= 0 || value > 1) {
            console.error(`Error: Invalid learning rate value: ${argv[i]} (must be between 0 and 1)`);
            process.exit(1);
          }
          args.learningRate = value;
        } else {
          console.error('Error: --learning-rate requires a value');
          process.exit(1);
        }
        break;
        
      case '--output':
      case '-o':
        if (i + 1 < argv.length) {
          args.output = argv[++i];
        } else {
          console.error('Error: --output requires a value');
          process.exit(1);
        }
        break;
        
      case '--decay':
      case '-d':
        args.decay = true;
        break;
        
      case '--optimistic':
        if (i + 1 < argv.length) {
          const value = parseFloat(argv[++i]);
          if (isNaN(value)) {
            console.error(`Error: Invalid optimistic value: ${argv[i]}`);
            process.exit(1);
          }
          args.optimistic = value;
        } else {
          console.error('Error: --optimistic requires a value');
          process.exit(1);
        }
        break;
        
      case '--report':
      case '-r':
        if (i + 1 < argv.length) {
          const value = parseInt(argv[++i], 10);
          if (isNaN(value) || value <= 0) {
            console.error(`Error: Invalid report interval value: ${argv[i]}`);
            process.exit(1);
          }
          args.reportInterval = value;
        } else {
          console.error('Error: --report requires a value');
          process.exit(1);
        }
        break;
        
      case '--checkpoint':
      case '-c':
        if (i + 1 < argv.length) {
          const value = parseInt(argv[++i], 10);
          if (isNaN(value) || value < 0) {
            console.error(`Error: Invalid checkpoint interval value: ${argv[i]}`);
            process.exit(1);
          }
          args.checkpointInterval = value;
        } else {
          console.error('Error: --checkpoint requires a value');
          process.exit(1);
        }
        break;
        
      case '--checkpoint-path':
        if (i + 1 < argv.length) {
          args.checkpointPath = argv[++i];
        } else {
          console.error('Error: --checkpoint-path requires a value');
          process.exit(1);
        }
        break;
        
      case '--resume':
        args.resume = true;
        break;
      
      case '--weights-save':
      case '-w':
        if (i + 1 < argv.length) {
          const value = parseInt(argv[++i], 10);
          if (isNaN(value) || value < 0) {
            console.error(`Error: Invalid weights save interval value: ${argv[i]}`);
            process.exit(1);
          }
          args.weightsSaveInterval = value;
        } else {
          console.error('Error: --weights-save requires a value');
          process.exit(1);
        }
        break;
      
      case '--gpu':
      case '-g':
        args.gpu = true;
        break;
      
      case '--batch-size':
      case '-b':
        if (i + 1 < argv.length) {
          const value = parseInt(argv[++i], 10);
          if (isNaN(value) || value < 1 || value > 1024) {
            console.error(`Error: Invalid batch size value: ${argv[i]} (must be between 1 and 1024)`);
            process.exit(1);
          }
          args.batchSize = value;
        } else {
          console.error('Error: --batch-size requires a value');
          process.exit(1);
        }
        break;
      
      case '--device':
        if (i + 1 < argv.length) {
          const value = parseInt(argv[++i], 10);
          if (isNaN(value) || value < 0) {
            console.error(`Error: Invalid device index value: ${argv[i]} (must be >= 0)`);
            process.exit(1);
          }
          args.device = value;
        } else {
          console.error('Error: --device requires a value');
          process.exit(1);
        }
        break;
        
      default:
        if (arg.startsWith('-')) {
          console.error(`Error: Unknown option: ${arg}`);
          console.error('Use --help to see available options');
          process.exit(1);
        }
        break;
    }
  }
  
  return args;
}

// ============================================
// 主函数
// ============================================

/**
 * 打印GPU配置信息
 */
function printGPUConfig(args: CLIArgs): void {
  console.log('GPU Configuration:');
  console.log(`  Mode: GPU Accelerated`);
  console.log(`  Batch Size: ${args.batchSize}`);
  if (args.device !== undefined) {
    console.log(`  Device Index: ${args.device}`);
  } else {
    console.log(`  Device Index: auto-select`);
  }
}

/**
 * 运行CPU训练
 */
function runCPUTraining(args: CLIArgs): void {
  // 创建N-Tuple Network
  const network = new NTupleNetwork(DEFAULT_TRAINING_PATTERNS);
  
  // 配置训练参数
  const config: Partial<TrainingConfig> = {
    episodes: args.episodes,
    learningRate: args.learningRate,
    outputPath: args.output,
    enableDecay: args.decay,
    optimisticInit: args.optimistic,
    reportInterval: args.reportInterval,
    checkpointInterval: args.checkpointInterval,
    checkpointPath: args.checkpointPath,
    weightsSaveInterval: args.weightsSaveInterval,
  };
  
  // 创建训练器
  const trainer = new Trainer(network, config);
  
  // 开始训练
  trainer.train(args.resume);
}

/**
 * 运行GPU训练
 */
async function runGPUTraining(args: CLIArgs): Promise<void> {
  console.log('Initializing GPU training...');
  console.log('');
  
  // 打印GPU配置
  printGPUConfig(args);
  console.log('');
  
  try {
    // 动态导入GPU模块，避免在 gl 包不可用时导致启动失败
    let gpuModule: any;
    try {
      gpuModule = await import('./gpu/gpu-engine');
    } catch (importError) {
      console.error('Failed to load GPU module:', (importError as Error).message);
      console.log('');
      console.log('GPU.js requires the "gl" package which may not be available on your system.');
      console.log('Falling back to CPU training...');
      console.log('');
      runCPUTraining(args);
      return;
    }
    
    const { createGPUEngine } = gpuModule;
    
    // 创建GPU引擎
    const engine = await createGPUEngine({
      enabled: true,
      batchSize: args.batchSize,
      deviceIndex: args.device,
      debug: false,
    });
    
    // 检查GPU是否可用
    const deviceInfo = engine.getDeviceInfo();
    if (!deviceInfo) {
      console.error('Failed to get GPU device info');
      console.log('Falling back to CPU training...');
      console.log('');
      runCPUTraining(args);
      return;
    }
    
    // 检查 GPU.js 是否真正可用（gpu 实例存在）
    try {
      engine.getGPU();
    } catch {
      // GPU.js 不可用，回退到 CPU 训练
      console.log('GPU.js is not available, using CPU training instead.');
      console.log('');
      engine.dispose();
      runCPUTraining(args);
      return;
    }
    
    if (!deviceInfo.isGPU) {
      console.warn('GPU not available, running in CPU fallback mode');
      console.warn('Training will be slower than native CPU mode');
      console.log('');
    }
    
    // 动态导入GPU训练器
    let trainerModule: any;
    try {
      trainerModule = await import('./gpu/gpu-trainer');
    } catch (importError) {
      console.error('Failed to load GPU trainer module:', (importError as Error).message);
      console.log('Falling back to CPU training...');
      console.log('');
      engine.dispose();
      runCPUTraining(args);
      return;
    }
    
    const { createGPUTrainer } = trainerModule;
    
    // 配置GPU训练参数
    const gpuConfig = {
      episodes: args.episodes,
      learningRate: args.learningRate,
      outputPath: args.output,
      enableDecay: args.decay,
      optimisticInit: args.optimistic,
      reportInterval: args.reportInterval,
      checkpointInterval: args.checkpointInterval,
      checkpointPath: args.checkpointPath.replace('.json', '-gpu.json'),
      weightsSaveInterval: args.weightsSaveInterval,
      gpu: {
        enabled: true,
        batchSize: args.batchSize,
        deviceIndex: args.device,
        debug: false,
      },
      gradientAccumulationSteps: 1,
      validationInterval: 10000,
      fallbackOnValidationFailure: true,
    };
    
    // 创建GPU训练器
    const trainer = await createGPUTrainer(engine, DEFAULT_TRAINING_PATTERNS, gpuConfig);
    
    // 开始训练
    await trainer.train(args.resume);
    
    // 清理资源
    trainer.dispose();
    engine.dispose();
    
  } catch (error) {
    console.error('GPU training failed:', (error as Error).message);
    console.log('');
    console.log('Falling back to CPU training...');
    console.log('');
    runCPUTraining(args);
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  // 解析命令行参数
  const args = parseArgs();
  
  // 显示帮助信息
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  
  // 根据参数选择CPU或GPU训练
  if (args.gpu) {
    await runGPUTraining(args);
  } else {
    runCPUTraining(args);
  }
}

// 运行主函数
main().catch((error) => {
  console.error('Training failed:', error);
  process.exit(1);
});
