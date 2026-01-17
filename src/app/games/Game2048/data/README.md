# 训练权重目录

此目录包含2048游戏AI的N-Tuple Network训练权重文件。

## 如何使用训练权重

### 1. 训练新权重

从项目根目录运行训练程序：

```bash
# 基本训练（10万局）
npx ts-node tools/game2048-trainer/train.ts --output weights.json

# 使用学习率衰减（推荐，收敛效果更好）
npx ts-node tools/game2048-trainer/train.ts --episodes 100000 --decay --output weights.json

# 自定义学习率
npx ts-node tools/game2048-trainer/train.ts --episodes 50000 --learning-rate 0.001 --output weights.json

# 使用乐观初始化
npx ts-node tools/game2048-trainer/train.ts --episodes 100000 --optimistic 100000 --output weights.json
```

### 2. 断点续训

训练过程中会自动保存检查点，支持中断后继续训练：

```bash
# 按 Ctrl+C 中断训练后，使用 --resume 继续
npx ts-node tools/game2048-trainer/train.ts --resume --output weights.json

# 自定义检查点保存间隔（每5000局保存一次）
npx ts-node tools/game2048-trainer/train.ts --checkpoint 5000 --output weights.json

# 指定检查点文件路径
npx ts-node tools/game2048-trainer/train.ts --checkpoint-path my-checkpoint.json --output weights.json
```

### 3. 使用npm脚本

也可以使用预定义的npm脚本：

```bash
# 基本训练
npm run train:2048

# 快速训练（1万局，用于测试）
npm run train:2048:fast

# 完整训练（10万局 + 学习率衰减）
npm run train:2048:full
```

### 4. 复制权重到此目录

训练完成后，将生成的权重文件复制到此目录：

```bash
cp weights.json src/app/games/Game2048/data/trained-weights.json
```

### 5. 更新应用使用新权重

修改 `src/app/games/Game2048/function/nTupleWeights.ts` 加载新的权重文件，或替换 `defaultWeights.json` 中的默认权重。

## 权重文件格式

权重文件使用JSON格式，兼容 `WeightsConfig` 接口：

```typescript
interface WeightsConfig {
  version: number;           // 格式版本号
  patterns: number[][];      // 元组模式定义
  weights: number[][];       // 每个模式的权重值
  metadata?: {
    trainedGames: number;    // 训练局数
    avgScore: number;        // 平均得分
    maxTile: number;         // 达到的最大方块
    rate2048?: number;       // 达到2048的比例
    rate4096?: number;       // 达到4096的比例
    rate8192?: number;       // 达到8192的比例
    trainingTime?: number;   // 训练时长（秒）
  };
}
```

## 训练技巧

- **更多局数 = 更好性能**：10万局是一个好的起点，但50万局以上可以获得更好的效果
- **学习率衰减**：长时间训练时使用 `--decay` 参数可以获得更好的收敛效果
- **乐观初始化**：可以帮助早期训练阶段的探索
- **训练速度**：在现代硬件上预计约1000局/秒

## 性能预期

使用默认设置（10万局）：
- 平均得分：约20,000-40,000
- 2048达成率：约90%以上
- 4096达成率：约50-70%
- 8192达成率：约5-15%

更长时间训练（50万局以上）可以达到：
- 平均得分：约50,000-100,000
- 2048达成率：约98%以上
- 4096达成率：约80%以上
- 8192达成率：约20-40%

## 命令行参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--episodes <n>` | 训练局数 | 100000 |
| `--learning-rate <n>` | 学习率 | 0.0025 |
| `--output <path>` | 输出文件路径 | weights.json |
| `--decay` | 启用学习率衰减 | 关闭 |
| `--optimistic <n>` | 乐观初始值 | 0（不使用） |
| `--report <n>` | 进度报告间隔 | 100 |
| `--checkpoint <n>` | 检查点保存间隔 | 1000 |
| `--checkpoint-path <p>` | 检查点文件路径 | checkpoint.json |
| `--resume` | 从检查点恢复训练 | - |
| `--help` | 显示帮助信息 | - |
