/**
 * GPU Training Module
 * 
 * GPU加速训练模块的入口文件。
 * 导出所有GPU相关的类和接口。
 */

export { GPUEngine, createGPUEngine, DEFAULT_GPU_CONFIG } from './gpu-engine';
export type { 
  GPUEngineConfig, 
  GPUDeviceInfo, 
  KernelOptions, 
  GPUBuffer 
} from './types';

// Board utilities
export {
  boardToFloat32Array,
  float32ArrayToBoard,
  writeBoardToArray,
  readBoardFromArray,
  createBatchBoardState,
  createBatchGameState,
  boardsToBatchState,
  batchStateToBoards,
  getBoardFromBatch,
  setBoardInBatch,
  getTileFromBatch,
  setTileInBatch,
  copyBatchBoardState,
  copyBatchGameState,
  resetGameInBatch,
  isBoardEmpty,
  countEmptyInBatch,
  getEmptyPositionsInBatch,
  toMatrix,
  printBoardFromBatch,
} from './board-utils';
export type {
  GPUBoardState,
  BatchBoardState,
  BatchGameState,
} from './board-utils';

// Move kernels
export {
  GPUMoveKernels,
  CPUMoveReference,
  generateLeftLUT,
  generateRightLUT,
} from './move-kernels';
export type {
  MoveResult,
  RowMoveLUT,
} from './move-kernels';

// Batch simulator
export {
  BatchGameSimulator,
  createBatchSimulator,
} from './batch-simulator';

// GPU N-Tuple Network
export {
  GPUNTupleNetwork,
  CPUEvaluationReference,
  createGPUNTupleNetwork,
  createGPUNetworkFromCPU,
  precomputeSymmetryIndices,
  getSymmetryOffsets,
} from './gpu-network';
export type {
  GPUWeightBuffers,
  GPUGradientBuffers,
} from './gpu-network';

// Weight Serialization and Checkpoint
export {
  WeightTransferManager,
  GPUCheckpointManager,
  createWeightTransferManager,
  createGPUCheckpointManager,
  saveGPUWeightsToFile,
  loadGPUWeightsFromFile,
} from './weight-serialization';
export type {
  WeightTransferResult,
  GPUCheckpointData,
  GPUTrainingCheckpointConfig,
  GPUStateSnapshot,
} from './weight-serialization';

// GPU Trainer
export {
  GPUTrainer,
  createGPUTrainer,
  createGPUTrainerFromNetwork,
  DEFAULT_GPU_TRAINING_CONFIG,
} from './gpu-trainer';
export type {
  GPUTrainingConfig,
  GPUTrainingStats,
} from './gpu-trainer';

// Validation
export {
  GPUValidator,
  ValidationFailureHandler,
  ValidationFailureStrategy,
  createGPUValidator,
  createValidationFailureHandler,
  DEFAULT_VALIDATION_CONFIG,
} from './validation';
export type {
  ValidationResult,
  ValidationDiagnostics,
  ValidationConfig,
} from './validation';

// Error Handler
export {
  GPUErrorHandler,
  BatchSizeAdjuster,
  GPUErrorType,
  RecoveryAction,
  createGPUErrorHandler,
  createBatchSizeAdjuster,
  withErrorHandling,
  withErrorHandlingSync,
  DEFAULT_ERROR_HANDLER_CONFIG,
  DEFAULT_BATCH_SIZE_ADJUSTER_CONFIG,
} from './error-handler';
export type {
  GPUErrorInfo,
  GPUErrorContext,
  ErrorHandlerConfig,
  ErrorHandlingResult,
  MemoryStatus,
  BatchSizeAdjusterConfig,
} from './error-handler';

// Performance Monitor
export {
  GPUPerformanceMonitor,
  KernelTimer,
  DataTransferTimer,
  PerformanceWarningType,
  createGPUPerformanceMonitor,
  createKernelTimer,
  createDataTransferTimer,
  withKernelTiming,
  withKernelTimingAsync,
  DEFAULT_PERFORMANCE_MONITOR_CONFIG,
} from './performance-monitor';
export type {
  KernelTimingRecord,
  GPUMemoryInfo,
  MemoryBreakdown,
  PerformanceStats,
  PerformanceWarning,
  PerformanceMonitorConfig,
  PerformanceReport,
} from './performance-monitor';
