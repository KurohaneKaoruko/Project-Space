/**
 * GPU Engine - GPU计算引擎
 * 
 * 负责GPU设备检测、初始化和管理。
 * 使用GPU.js作为后端，支持自动回退到CPU模式。
 * 
 * 注意：GPU.js 在 Node.js 环境下依赖 'gl' 包（headless WebGL），
 * 该包在 Windows 上可能需要编译原生模块。如果 'gl' 包不可用，
 * 系统会自动回退到纯 CPU 模式。
 * 
 * Requirements: 1.1, 1.2, 1.3
 */

import { GPUEngineConfig, GPUDeviceInfo, KernelOptions, GPUBuffer } from './types';

// 动态导入 GPU.js 类型
type GPU = any;
type IKernelRunShortcut = any;

// GPU.js 模块引用（延迟加载）
let gpuModule: { GPU: new (options?: any) => GPU } | null = null;
let gpuLoadError: Error | null = null;

/**
 * 尝试加载 GPU.js 模块
 * 使用动态导入以便在 'gl' 包不可用时优雅降级
 */
async function loadGPUModule(): Promise<boolean> {
  if (gpuModule !== null) {
    return true;
  }
  if (gpuLoadError !== null) {
    return false;
  }
  
  try {
    // 动态导入 GPU.js
    gpuModule = await import('gpu.js');
    return true;
  } catch (error) {
    gpuLoadError = error as Error;
    console.warn('GPU.js could not be loaded:', (error as Error).message);
    console.warn('This is usually because the "gl" package (headless WebGL) is not available.');
    console.warn('On Windows, you may need to install Visual Studio Build Tools.');
    console.warn('Training will continue in CPU-only mode.');
    return false;
  }
}

/**
 * 默认GPU引擎配置
 */
export const DEFAULT_GPU_CONFIG: GPUEngineConfig = {
  enabled: true,
  batchSize: 64,
  deviceIndex: undefined,
  debug: false,
};

/**
 * GPU引擎类
 * 
 * 封装GPU.js，提供统一的GPU计算接口。
 * 支持GPU检测、初始化、内核创建和资源管理。
 */
export class GPUEngine {
  /** GPU.js实例 */
  private gpu: GPU | null = null;
  
  /** 设备信息 */
  private deviceInfo: GPUDeviceInfo | null = null;
  
  /** 配置 */
  private config: GPUEngineConfig;
  
  /** 是否已初始化 */
  private initialized: boolean = false;
  
  /** 创建的内核列表（用于资源清理） */
  private kernels: IKernelRunShortcut[] = [];
  
  /**
   * 构造函数
   * @param config GPU引擎配置
   */
  constructor(config: Partial<GPUEngineConfig> = {}) {
    this.config = { ...DEFAULT_GPU_CONFIG, ...config };
  }
  
  /**
   * 初始化GPU引擎
   * 
   * 检测可用GPU设备并初始化GPU.js实例。
   * 如果GPU不可用，自动回退到CPU模式。
   * 
   * @returns GPU设备信息
   * @throws 如果初始化失败且无法回退
   */
  async initialize(): Promise<GPUDeviceInfo> {
    if (this.initialized && this.deviceInfo) {
      return this.deviceInfo;
    }
    
    // 首先尝试加载 GPU.js 模块
    const gpuAvailable = await loadGPUModule();
    
    if (!gpuAvailable) {
      // GPU.js 不可用，直接使用 CPU 纯计算模式
      return this.fallbackToPureCPU();
    }
    
    try {
      // 尝试创建GPU实例
      if (this.config.enabled) {
        this.gpu = await this.createGPUInstance();
      } else {
        // 用户明确禁用GPU，使用CPU模式
        this.gpu = this.createCPUFallback();
      }
      
      // 获取设备信息
      this.deviceInfo = this.detectDeviceInfo();
      this.initialized = true;
      
      // 输出初始化信息
      this.logInitialization();
      
      return this.deviceInfo;
    } catch (error) {
      // GPU初始化失败，尝试回退到CPU
      console.warn(`GPU initialization failed: ${(error as Error).message}`);
      console.warn('Falling back to CPU mode...');
      
      return this.fallbackToCPU();
    }
  }
  
  /**
   * 创建GPU实例
   * 
   * 尝试创建GPU.js实例，优先使用GPU模式。
   */
  private async createGPUInstance(): Promise<GPU> {
    if (!gpuModule) {
      throw new Error('GPU.js module not loaded');
    }
    
    // 在Node.js环境中，GPU.js会自动检测可用的GPU
    const gpu = new gpuModule.GPU({
      mode: 'gpu',
    });
    
    // 验证GPU是否真正可用
    const testKernel = gpu.createKernel(function() {
      return 1;
    }, { output: [1] });
    
    try {
      const result = testKernel() as number[];
      if (result[0] !== 1) {
        throw new Error('GPU kernel test failed');
      }
      testKernel.destroy();
    } catch (error) {
      testKernel.destroy();
      gpu.destroy();
      throw error;
    }
    
    return gpu;
  }
  
  /**
   * 创建CPU回退实例
   */
  private createCPUFallback(): GPU {
    if (!gpuModule) {
      throw new Error('GPU.js module not loaded');
    }
    
    return new gpuModule.GPU({
      mode: 'cpu',
    });
  }
  
  /**
   * 回退到纯CPU模式（不使用GPU.js）
   * 
   * 当 GPU.js 完全不可用时使用此模式。
   * 这种情况下，GPU引擎将标记为不可用，
   * 训练器应该使用原生CPU训练器。
   */
  private fallbackToPureCPU(): GPUDeviceInfo {
    this.gpu = null;
    this.deviceInfo = {
      name: 'CPU (Pure - GPU.js unavailable)',
      isGPU: false,
      maxWorkGroupSize: 1,
      availableMemory: undefined,
      backend: 'cpu',
    };
    this.initialized = true;
    
    console.warn('');
    console.warn('='.repeat(60));
    console.warn('GPU.js is not available on this system.');
    console.warn('This is typically because the "gl" package could not be loaded.');
    console.warn('');
    console.warn('To enable GPU acceleration, you may need to:');
    console.warn('  1. Install Visual Studio Build Tools (Windows)');
    console.warn('  2. Run: npm rebuild gl');
    console.warn('');
    console.warn('Training will continue using CPU-only mode.');
    console.warn('='.repeat(60));
    console.warn('');
    
    return this.deviceInfo;
  }
  
  /**
   * 回退到CPU模式
   */
  private fallbackToCPU(): GPUDeviceInfo {
    if (this.gpu) {
      this.gpu.destroy();
    }
    
    this.gpu = this.createCPUFallback();
    this.deviceInfo = {
      name: 'CPU (Fallback)',
      isGPU: false,
      maxWorkGroupSize: 1,
      availableMemory: undefined,
      backend: 'cpu',
    };
    this.initialized = true;
    
    console.warn('Running in CPU fallback mode. Training will be slower.');
    
    return this.deviceInfo;
  }
  
  /**
   * 检测设备信息
   */
  private detectDeviceInfo(): GPUDeviceInfo {
    if (!this.gpu) {
      throw new Error('GPU not initialized');
    }
    
    // 获取GPU.js的canvas/context信息
    const canvas = (this.gpu as any).canvas;
    const context = (this.gpu as any).context;
    
    let name = 'Unknown GPU';
    let isGPU = false;
    let backend: GPUDeviceInfo['backend'] = 'cpu';
    let maxWorkGroupSize = 1;
    
    // 检测实际使用的模式
    const mode = (this.gpu as any).mode;
    
    if (mode === 'gpu' || mode === 'webgl' || mode === 'webgl2') {
      isGPU = true;
      backend = mode as GPUDeviceInfo['backend'];
      
      // 尝试获取GPU信息
      if (context) {
        try {
          const debugInfo = context.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            name = context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'GPU';
          } else {
            name = 'GPU (WebGL)';
          }
          
          // 获取最大工作组大小
          maxWorkGroupSize = context.getParameter(context.MAX_TEXTURE_SIZE) || 4096;
        } catch {
          name = 'GPU';
        }
      }
    } else if (mode === 'headlessgl') {
      isGPU = true;
      backend = 'headlessgl';
      name = 'Headless GL';
      maxWorkGroupSize = 4096;
    } else {
      isGPU = false;
      backend = 'cpu';
      name = 'CPU';
      maxWorkGroupSize = 1;
    }
    
    return {
      name,
      isGPU,
      maxWorkGroupSize,
      availableMemory: undefined, // GPU.js不直接提供内存信息
      backend,
    };
  }
  
  /**
   * 输出初始化日志
   */
  private logInitialization(): void {
    if (!this.deviceInfo) return;
    
    console.log('='.repeat(50));
    console.log('GPU Engine Initialized');
    console.log('='.repeat(50));
    console.log(`Device: ${this.deviceInfo.name}`);
    console.log(`Mode: ${this.deviceInfo.isGPU ? 'GPU' : 'CPU'}`);
    console.log(`Backend: ${this.deviceInfo.backend}`);
    console.log(`Batch Size: ${this.config.batchSize}`);
    if (this.config.debug) {
      console.log(`Debug Mode: enabled`);
    }
    console.log('='.repeat(50));
  }
  
  /**
   * 检查GPU是否可用
   */
  isAvailable(): boolean {
    return this.initialized && this.deviceInfo !== null && this.deviceInfo.isGPU;
  }
  
  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * 获取设备信息
   */
  getDeviceInfo(): GPUDeviceInfo | null {
    return this.deviceInfo;
  }
  
  /**
   * 获取配置
   */
  getConfig(): GPUEngineConfig {
    return { ...this.config };
  }
  
  /**
   * 获取GPU.js实例
   * 
   * 用于创建自定义内核。
   */
  getGPU(): GPU {
    if (!this.gpu) {
      throw new Error('GPU engine not initialized. Call initialize() first.');
    }
    return this.gpu;
  }

  /**
   * 创建GPU内核
   * 
   * 封装GPU.js的createKernel方法，自动跟踪创建的内核以便清理。
   * 
   * @param fn 内核函数
   * @param options 内核选项
   * @returns GPU内核
   */
  createKernel<T extends IKernelRunShortcut>(
    fn: Function,
    options: KernelOptions
  ): T {
    if (!this.gpu) {
      throw new Error('GPU engine not initialized. Call initialize() first.');
    }
    
    const kernel = this.gpu.createKernel(fn as any, {
      output: options.output as any,
      constants: options.constants,
      pipeline: options.pipeline,
      immutable: options.immutable,
      dynamicOutput: options.dynamicOutput,
      dynamicArguments: options.dynamicArguments,
    }) as T;
    
    this.kernels.push(kernel);
    
    return kernel;
  }
  
  /**
   * 分配GPU缓冲区
   * 
   * 创建一个用于GPU计算的缓冲区。
   * 
   * @param size 缓冲区大小
   * @param type 数据类型
   * @returns GPU缓冲区
   */
  allocateBuffer(size: number, type: 'float32' | 'int32' = 'float32'): GPUBuffer {
    const data = type === 'float32' 
      ? new Float32Array(size) 
      : new Int32Array(size);
    
    return {
      data,
      size,
      type,
    };
  }
  
  /**
   * 更新批量大小
   * 
   * 用于动态调整批量大小（如内存不足时）。
   * 
   * @param newBatchSize 新的批量大小
   */
  updateBatchSize(newBatchSize: number): void {
    if (newBatchSize < 1) {
      throw new Error('Batch size must be at least 1');
    }
    this.config.batchSize = newBatchSize;
    
    if (this.config.debug) {
      console.log(`Batch size updated to: ${newBatchSize}`);
    }
  }
  
  /**
   * 获取当前批量大小
   */
  getBatchSize(): number {
    return this.config.batchSize;
  }
  
  /**
   * 释放所有资源
   * 
   * 销毁所有创建的内核和GPU实例。
   * 应在训练结束或发生错误时调用。
   */
  dispose(): void {
    // 销毁所有内核
    for (const kernel of this.kernels) {
      try {
        kernel.destroy();
      } catch (error) {
        // 忽略销毁错误
        if (this.config.debug) {
          console.warn(`Failed to destroy kernel: ${(error as Error).message}`);
        }
      }
    }
    this.kernels = [];
    
    // 销毁GPU实例
    if (this.gpu) {
      try {
        this.gpu.destroy();
      } catch (error) {
        if (this.config.debug) {
          console.warn(`Failed to destroy GPU: ${(error as Error).message}`);
        }
      }
      this.gpu = null;
    }
    
    this.initialized = false;
    this.deviceInfo = null;
    
    if (this.config.debug) {
      console.log('GPU engine disposed');
    }
  }
  
  /**
   * 运行简单的GPU性能测试
   * 
   * 用于验证GPU是否正常工作并估算性能。
   * 
   * @returns 测试结果
   */
  async runBenchmark(): Promise<{ passed: boolean; opsPerSecond: number; message: string }> {
    if (!this.initialized || !this.gpu) {
      return {
        passed: false,
        opsPerSecond: 0,
        message: 'GPU engine not initialized',
      };
    }
    
    try {
      // 创建一个简单的矩阵乘法内核
      const size = 256;
      // 使用 any 类型来避免 TypeScript 对 GPU.js 内核函数中 this 的类型检查
      const kernelFn = function(this: any, a: number[][], b: number[][]) {
        let sum = 0;
        for (let i = 0; i < 256; i++) {
          sum += a[this.thread.y][i] * b[i][this.thread.x];
        }
        return sum;
      };
      const kernel = this.gpu.createKernel(kernelFn, { output: [size, size] });
      
      // 创建测试数据
      const a = Array(size).fill(0).map(() => Array(size).fill(1));
      const b = Array(size).fill(0).map(() => Array(size).fill(1));
      
      // 预热
      kernel(a, b);
      
      // 计时测试
      const iterations = 10;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        kernel(a, b);
      }
      
      const elapsed = performance.now() - start;
      const opsPerSecond = (iterations * size * size * size * 2) / (elapsed / 1000);
      
      kernel.destroy();
      
      return {
        passed: true,
        opsPerSecond,
        message: `Benchmark passed: ${(opsPerSecond / 1e9).toFixed(2)} GFLOPS`,
      };
    } catch (error) {
      return {
        passed: false,
        opsPerSecond: 0,
        message: `Benchmark failed: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * 创建并初始化GPU引擎的便捷函数
 * 
 * @param config GPU引擎配置
 * @returns 初始化后的GPU引擎
 */
export async function createGPUEngine(
  config: Partial<GPUEngineConfig> = {}
): Promise<GPUEngine> {
  const engine = new GPUEngine(config);
  await engine.initialize();
  return engine;
}
