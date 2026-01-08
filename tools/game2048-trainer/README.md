# 2048 N-Tuple 网络训练器

一个使用 N-Tuple 网络和 TD 学习的高性能 2048 AI 训练工具。支持 CPU 和 GPU 加速训练模式。

## 功能特性

- **N-Tuple 网络**: 实现了最先进的 2048 N-Tuple 网络架构
- **TD 学习**: 基于后继状态评估的时序差分学习
- **GPU 加速**: 可选的 GPU.js 加速训练（10-50倍加速）
- **检查点系统**: 保存和恢复训练进度
- **学习率衰减**: 可配置的学习率调度
- **性能监控**: 实时训练统计和 GPU 指标

## 安装

```bash
# 安装依赖
pnpm install

# 或使用 npm
npm install
```

## 快速开始

### CPU 训练（默认）

```bash
# 基础训练，100,000 轮
npx ts-node tools/game2048-trainer/train.ts --output weights.json

# 带学习率衰减的训练
npx ts-node tools/game2048-trainer/train.ts --episodes 100000 --decay --output weights.json
```

### GPU 训练

```bash
# 启用 GPU 加速
npx ts-node tools/game2048-trainer/train.ts --gpu --output gpu-weights.json

# 自定义批量大小的 GPU 训练
npx ts-node tools/game2048-trainer/train.ts --gpu --batch-size 128 --output weights.json

# 指定设备的 GPU 训练
npx ts-node tools/game2048-trainer/train.ts --gpu --device 0 --batch-size 64 --output weights.json
```

## 命令行选项

### 通用选项

| 选项 | 简写 | 描述 | 默认值 |
|--------|-------|-------------|---------|
| `--episodes <n>` | `-e` | 训练轮数 | 100000 |
| `--learning-rate <n>` | `-l` | 学习率 alpha | 0.0025 |
| `--output <path>` | `-o` | 权重输出文件路径 | weights.json |
| `--decay` | `-d` | 启用学习率衰减 | 禁用 |
| `--optimistic <n>` | | 乐观初始权重值 | 0 |
| `--report <n>` | `-r` | 进度报告间隔 | 100 |
| `--checkpoint <n>` | `-c` | 检查点保存间隔 | 1000 |
| `--checkpoint-path <p>` | | 检查点文件路径 | checkpoint.json |
| `--resume` | | 从检查点恢复训练 | 禁用 |
| `--help` | `-h` | 显示帮助信息 | |

### GPU 选项

| 选项 | 简写 | 描述 | 默认值 |
|--------|-------|-------------|---------|
| `--gpu` | `-g` | 启用 GPU 加速 | 禁用 |
| `--batch-size <n>` | `-b` | 并行游戏数量 (1-1024) | 64 |
| `--device <n>` | | GPU 设备索引 | 自动选择 |

## GPU 训练指南

### 系统要求

- Node.js 16+ 且支持 GPU.js
- 兼容 WebGL 2.0 的 GPU
- 足够的 GPU 显存（建议 512MB+）

### GPU 训练原理

GPU 训练通过并行运行多个游戏来加速：

1. **批量游戏模拟**: 多个游戏在 GPU 上并行运行
2. **并行状态评估**: N-Tuple 网络同时评估所有游戏状态
3. **批量权重更新**: TD 学习梯度累积后批量应用

### 选择批量大小

| GPU 显存 | 推荐批量大小 |
|------------|----------------------|
| 512MB | 32-64 |
| 1GB | 64-128 |
| 2GB+ | 128-256 |

较大的批量大小通常能提高吞吐量，但需要更多 GPU 显存。

### 性能预期

| 模式 | 典型速度 | 备注 |
|------|--------------|-------|
| CPU | ~50 轮/秒 | 单线程 |
| GPU (batch=64) | ~500-1000 轮/秒 | 10-20倍加速 |
| GPU (batch=128) | ~800-1500 轮/秒 | 15-30倍加速 |

*实际性能因硬件而异。*

## 训练示例

### 基础训练会话

```bash
# 使用默认设置训练 100,000 轮
npx ts-node tools/game2048-trainer/train.ts --output my-weights.json
```

### 带检查点的长时间训练

```bash
# 每 5000 轮保存检查点
npx ts-node tools/game2048-trainer/train.ts \
  --episodes 500000 \
  --checkpoint 5000 \
  --decay \
  --output trained-weights.json
```

### 恢复中断的训练

```bash
# 从检查点恢复
npx ts-node tools/game2048-trainer/train.ts --resume --output weights.json
```

### 高性能 GPU 训练

```bash
# 最大吞吐量 GPU 训练
npx ts-node tools/game2048-trainer/train.ts \
  --gpu \
  --batch-size 256 \
  --episodes 1000000 \
  --decay \
  --checkpoint 10000 \
  --output high-perf-weights.json
```

## 输出文件

### 权重文件 (*.json)

包含 JSON 格式的训练后 N-Tuple 网络权重。可被游戏 AI 加载使用。

### 检查点文件 (*-checkpoint.json / *-gpu.json)

包含用于恢复的训练状态：
- 当前轮数
- 学习率
- 训练统计
- 网络权重

## 故障排除

### GPU 未检测到

**症状**: 训练回退到 CPU 模式并显示警告信息。

**解决方案**:
1. 确保 GPU 驱动程序是最新的
2. 检查 WebGL 支持: `node -e "console.log(require('gpu.js').GPU.isGPUSupported)"`
3. 尝试使用 `--device 0` 显式选择 GPU

### 内存不足错误

**症状**: 训练崩溃或自动减小批量大小。

**解决方案**:
1. 减小批量大小: `--batch-size 32`
2. 关闭其他 GPU 密集型应用程序
3. 训练器会在 OOM 错误时自动减小批量大小

### GPU 性能较慢

**症状**: GPU 训练比预期慢。

**可能原因**:
1. 批量大小太小 - 尝试增加到 128+
2. GPU 回退到 CPU 模式 - 检查初始化消息
3. 热节流 - 确保散热良好

### 验证失败

**症状**: 训练期间出现"验证失败"警告。

**含义**: GPU 计算与 CPU 参考结果有偏差。

**解决方案**:
1. 通常可以继续 - 轻微的数值差异是正常的
2. 如果持续出现，尝试减小批量大小
3. 使用 `--device` 尝试不同的 GPU

### 训练不收敛

**症状**: 经过多轮训练后分数没有提升。

**解决方案**:
1. 增加训练轮数（建议 500,000+）
2. 启用学习率衰减: `--decay`
3. 尝试不同的学习率: `--learning-rate 0.001`

## 架构

```
tools/game2048-trainer/
├── train.ts              # CLI 入口点
├── trainer.ts            # CPU 训练器实现
├── network.ts            # N-Tuple 网络
├── game.ts               # 2048 游戏逻辑
├── patterns.ts           # N-Tuple 模式
└── gpu/
    ├── gpu-engine.ts     # GPU.js 封装
    ├── gpu-trainer.ts    # GPU 训练器
    ├── gpu-network.ts    # GPU N-Tuple 网络
    ├── batch-simulator.ts # 并行游戏模拟
    ├── move-kernels.ts   # GPU 移动计算
    ├── board-utils.ts    # 棋盘状态工具
    ├── weight-serialization.ts # 检查点系统
    ├── error-handler.ts  # 错误恢复
    ├── performance-monitor.ts # GPU 指标
    └── validation.ts     # GPU/CPU 验证
```

## 许可证

MIT
