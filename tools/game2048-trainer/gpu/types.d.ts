/**
 * GPU.js Type Declarations for 2048 AI Training
 * Extends the built-in GPU.js types with project-specific interfaces
 */

import { GPU, IKernelRunShortcut, KernelOutput } from 'gpu.js';

export { GPU, IKernelRunShortcut, KernelOutput };

/**
 * GPU Engine Configuration
 */
export interface GPUEngineConfig {
  /** 是否启用GPU加速 */
  enabled: boolean;
  /** 批量大小（并行游戏数） */
  batchSize: number;
  /** 指定GPU设备索引 */
  deviceIndex?: number;
  /** 是否启用调试模式 */
  debug?: boolean;
}

/**
 * GPU Device Information
 */
export interface GPUDeviceInfo {
  /** 设备名称 */
  name: string;
  /** 是否为GPU模式 */
  isGPU: boolean;
  /** 最大工作组大小 */
  maxWorkGroupSize: number;
  /** 可用内存（字节） */
  availableMemory?: number;
  /** 后端类型 */
  backend: 'gpu' | 'cpu' | 'webgl' | 'webgl2' | 'headlessgl';
}

/**
 * Kernel Options for GPU.js
 */
export interface KernelOptions {
  output: number | [number] | [number, number] | [number, number, number];
  constants?: Record<string, number>;
  pipeline?: boolean;
  immutable?: boolean;
  dynamicOutput?: boolean;
  dynamicArguments?: boolean;
}

/**
 * GPU Buffer wrapper
 */
export interface GPUBuffer {
  data: Float32Array | Int32Array;
  size: number;
  type: 'float32' | 'int32';
}
