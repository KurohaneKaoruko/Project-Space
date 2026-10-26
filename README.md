# Project-Rosmarin

> 一个以 `Next.js + React + TypeScript` 构建的互动实验与项目合集仓库，覆盖游戏、可视化模拟、实用工具等多种类型。

![Next.js](https://img.shields.io/badge/Next.js-15.2.8-000000?logo=next.js)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?logo=tailwindcss)
![Vitest](https://img.shields.io/badge/Test-Vitest-729B1B?logo=vitest)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

## 目录

- [项目简介](#项目简介)
- [模块地图](#模块地图)
- [功能亮点](#功能亮点)
- [快速开始](#快速开始)
- [可用脚本](#可用脚本)
- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [许可证](#许可证)

## 项目简介

Project-Rosmarin 是一个“可玩 + 可看 + 可用”的前端项目集合：

- `Games`：交互性较强的游戏模块（如 2048、贪吃蛇等）。
- `Simulations`：偏规则与物理可视化的实验模块（如生命游戏、混沌摆、粒子生命）。
- `Algorithms`：经典算法的动态可视化（如 TSP 蚁群、排序算法）。
- `Tools`：实用型处理工具（如图片短字符串编码器）。

目标是将不同类型的想法快速落地为独立页面，同时保持统一的 UI 风格与工程规范。

## 模块地图

| 分区 | 路由 | 当前内容 |
| --- | --- | --- |
| 首页 | `/` | 总览入口，聚合所有模块 |
| Games | `/games` | 2048、贪吃蛇、弹幕躲避、魔方 |
| Simulations | `/simulations` | 生命游戏、兰顿蚂蚁、粒子生命、混沌摆、图灵机、二维图灵机、PoW 模拟器 |
| Algorithms | `/algorithms` | TSP 蚁群、排序算法可视化、加密算法可视化 |
| Visualizations | `/visualizations` | 分形几何、数位和海龟绘图 |
| Tools | `/tools` | Brainfuck 解释器 |

### Games

- `/games/Game2048`：多棋盘尺寸、撤销、自动 AI。
- `/games/Snake`：经典贪吃蛇，带 AI 接管能力。
- `/games/RubiksCube`：CSS 3D 渲染的三阶魔方，支持拖动视角、键鼠转动、打乱与撤销，内置分层还原求解器，可逐阶段演示 AI 还原过程。

### Simulations

- `/simulations/GameOfLife`：康威生命游戏（元胞自动机）。
- `/simulations/LangtonsAnt`：兰顿蚂蚁规则演化。
- `/simulations/ParticleLife`：WebGPU 加速的粒子生命系统。
- `/simulations/PendulumSim`：双摆/三摆混沌运动模拟。
- `/simulations/TuringMachine`：一维图灵机 · 忙碌海狸。
- `/simulations/TuringMachine2D`：二维图灵机 (Turmite)。
- `/simulations/PowSim`：SHA-256 工作量证明模拟。

### Algorithms

- `/algorithms/TSPAntColony`：TSP 蚁群优化，动态展示信息素演化与最优路径收敛。
- `/algorithms/SortingVisualizer`：13 种经典排序算法可视化（冒泡、鸡尾酒、侏儒、梳、插入、希尔、选择、快速、归并、堆、计数、桶、基数），支持调速、单步、多种数据分布与复杂度档案。
- `/algorithms/CryptoVisualizer`：7 种加密算法分步演示（凯撒、维吉尼亚、栅栏、XOR、AES-128 完整 10 轮状态矩阵、RSA、Diffie-Hellman），支持加解密双向演示、逐步播放与 FIPS-197 官方向量校验的实现。

### Visualizations

- `/visualizations/Mandelbrot`：Mandelbrot / Julia / Newton 分形合集。
- `/visualizations/DigitSumTurtle`：数位和奇偶驱动的海龟作图（Thue–Morse / 科赫雪花式分形），支持初始朝向、镜头跟随与无限画布平移缩放。

### Tools

- `/tools/Brainfuck`：Brainfuck 解释器，支持运行/单步与内存窗。

## 功能亮点

- 统一的模块化页面组织，便于新增项目和快速扩展。
- 魔方模块自带确定性求解算法：底面十字用 19 万状态的全量 BFS 查表求最优解，前两层用按块 BFS 组合标准公式，顶层把 OLL / PLL 公式当作宏动作在抽象状态空间做广度优先搜索，200 组随机打乱的还原成功率为 100%（平均约 104 步、单次求解约 10ms）。
- 游戏与模拟并行，覆盖规则系统、物理系统与 UI 交互场景。
- 包含 WebGPU（Particle Life）等较高性能图形实验方向。
- 使用 TypeScript 全链路约束，降低迭代时的回归风险。

## 快速开始

### 1) 环境要求

- Node.js `>= 18.18`（建议使用 LTS）
- npm `>= 9`

### 2) 安装依赖

```bash
npm install
```

### 3) 启动开发环境

```bash
npm run dev
```

启动后访问：`http://localhost:3000`

### 4) 构建与运行生产版本

```bash
npm run build
npm run start
```

## 可用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动本地开发服务（Turbopack） |
| `npm run build` | 构建生产版本 |
| `npm run start` | 启动生产服务 |
| `npm run lint` | 执行 ESLint 检查 |
| `npm run test` | 运行 Vitest 测试 |
| `npm run test:watch` | Vitest 监听模式 |

## 项目结构

```text
project-rosmarin/
├─ src/
│  ├─ app/
│  │  ├─ components/      # 通用 UI 组件（如导航）
│  │  ├─ data/            # 项目元数据（games/simulations/algorithms/visualizations/tools）
│  │  ├─ games/           # 游戏模块
│  │  ├─ simulations/     # 模拟模块
│  │  ├─ algorithms/      # 算法可视化模块
│  │  ├─ visualizations/  # 数学/图形可视化模块
│  │  └─ tools/           # 工具模块
│  ├─ utils/              # 通用工具函数
│  └─ types/              # 类型声明
├─ tools/                 # 训练或辅助脚本
└─ docs/                  # 项目文档
```

## 技术栈

- 框架：Next.js 15、React 19
- 语言：TypeScript
- 样式：Tailwind CSS 4、Sass、DaisyUI
- 测试：Vitest
- 图形：Canvas、WebGPU（部分模块）

## 许可证

本项目采用 [MIT License](LICENSE)。
