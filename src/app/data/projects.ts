export type ProjectCategory = 'GAME' | 'SIMULATION' | 'ALGORITHM' | 'VISUALIZATION' | 'TOOL';

export interface Project {
  id: string;
  title: string;
  description: string;
  image: string;
  technologies: string[];
  link?: string;
}

export const games: Project[] = [
  {
    id: 'Game2048',
    title: '2048 游戏',
    description: '经典的2048数字方块游戏，使用React和TypeScript实现。通过方向键控制，将相同数字的方块合并，达到2048获胜。',
    image: '/images/2048.png',
    technologies: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS'],
    link: '/games/Game2048'
  },
  {
    id: 'Snake',
    title: '贪吃蛇',
    description: '经典贪吃蛇小游戏：支持键盘操作与暂停重开，并提供可一键接管的 AI 玩家（自动寻路与避险策略）。',
    image: '/images/snake.svg',
    technologies: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS'],
    link: '/games/Snake'
  },
  {
    id: 'DanmakuDodge',
    title: '弹幕躲避',
    description: '简约弹幕躲避生存游戏：操控小球在密集弹幕中存活更久，支持 AI 自动躲避与手动切换。',
    image: '/images/bullet-dodge.svg',
    technologies: ['React', 'TypeScript', 'Next.js', 'Canvas'],
    link: '/games/DanmakuDodge'
  },
  {
    id: 'RubiksCube',
    title: '魔方 · AI 还原',
    description: 'CSS 3D 渲染的三阶魔方：支持拖动视角、键鼠转动与打乱，内置分层还原求解器（十字全状态查表 + 顶层宏动作 BFS），逐步演示 7 个还原阶段。',
    image: '/images/rubiks-cube.svg',
    technologies: ['React', 'TypeScript', 'CSS 3D', 'BFS'],
    link: '/games/RubiksCube'
  }
];

export const simulations: Project[] = [
  {
    id: 'GameOfLife',
    title: '生命游戏',
    description: '康威生命游戏：经典的元胞自动机模拟。支持自定义网格大小、速度、颜色主题，可自由绘制初始状态。',
    image: '/images/game-of-life.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    link: '/simulations/GameOfLife'
  },
  {
    id: 'LangtonsAnt',
    title: '兰顿蚂蚁',
    description: '经典零玩家游戏：简单的转向规则在混沌后会涌现出稳定的“高速公路”结构。支持多蚂蚁、速度/格子大小调节与手动改图。',
    image: '/images/langtons-ant.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    link: '/simulations/LangtonsAnt'
  },
  {
    id: 'ParticleLife',
    title: '粒子生命',
    description: '基于 WebGPU 加速的粒子人工生命模拟。数千个粒子根据简单的交互矩阵涌现出复杂的类生命行为。',
    image: '/images/particle-life.svg',
    technologies: ['React', 'WebGPU', 'WGSL', 'TypeScript'],
    link: '/simulations/ParticleLife'
  },
  {
    id: 'PendulumSim',
    title: '混沌摆模拟',
    description: '基于约束物理与数值积分的双摆/三摆模拟：支持拖拽调参，显示轨迹与能量变化曲线。',
    image: '/images/pendulum-sim.svg',
    technologies: ['React', 'TypeScript', 'Next.js', 'Canvas'],
    link: '/simulations/PendulumSim'
  },
  {
    id: 'TuringMachine',
    title: '图灵机',
    description: '一维无限纸带图灵机模拟：忙碌海狸 BB(1)~BB(6) 等预设机器，可单步执行、全速运行并对照理论 σ/S 值。',
    image: '/images/turing-machine.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    link: '/simulations/TuringMachine'
  },
  {
    id: 'TuringMachine2D',
    title: '二维图灵机',
    description: '二维图灵机模拟：规则为写符号 + 上下左右移动 + 状态转移，网格无界。内置镜面编织、方形织机、混沌甩尾等预设，点击画布可改格子。',
    image: '/images/turing-machine-2d.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    link: '/simulations/TuringMachine2D'
  },
  {
    id: 'PowSim',
    title: 'PoW 模拟器',
    description: '工作量证明模拟：纯 TS 实现的 SHA-256，实时求解（可调难度）、篡改区块破坏整链校验、雪崩效应试算。',
    image: '/images/pow-sim.svg',
    technologies: ['React', 'TypeScript'],
    link: '/simulations/PowSim'
  },
];

export const algorithms: Project[] = [
  {
    id: 'TSPAntColony',
    title: 'TSP 蚁群算法',
    description: '旅行商问题的蚁群优化：动态可视化信息素演化与最优路径收敛过程，支持参数调节。',
    image: '/images/tsp-ant-colony.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    link: '/algorithms/TSPAntColony'
  },
  {
    id: 'SortingVisualizer',
    title: '排序算法可视化',
    description: '覆盖 13 种经典排序算法的动态可视化：冒泡、鸡尾酒、侏儒、梳、插入、希尔、选择、快速、归并、堆、计数、桶、基数，支持调速、单步与多种数据分布。',
    image: '/images/sorting-visualizer.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    link: '/algorithms/SortingVisualizer'
  },
  {
    id: 'CryptoVisualizer',
    title: '加密算法可视化',
    description: '7 种加密算法分步演示：凯撒、维吉尼亚、栅栏、XOR、AES-128（完整 10 轮状态矩阵）、RSA、Diffie-Hellman，支持加解密双向演示与逐步播放。',
    image: '/images/crypto-visualizer.svg',
    technologies: ['React', 'TypeScript'],
    link: '/algorithms/CryptoVisualizer'
  },
];

export const visualizations: Project[] = [
  {
    id: 'Mandelbrot',
    title: '分形几何',
    description: '分形几何可视化合集：Mandelbrot / Julia / Newton 分形，支持中心、缩放、迭代次数与参数调节。',
    image: '/images/fractal-geometry.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    link: '/visualizations/Mandelbrot'
  },
  {
    id: 'DigitSumTurtle',
    title: '数位和海龟绘图',
    description: '遍历自然数：n 进制数位和为偶数则前进画线，为奇数则旋转 360°/m。n=2 即 Thue–Morse 海龟曲线，默认参数（初始朝向右下、逆时针）呈水平延展的科赫雪花式分形；无限画布、镜头跟随自动展示完整图案。',
    image: '/images/digit-sum-turtle.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    link: '/visualizations/DigitSumTurtle'
  },
];

export const tools: Project[] = [
  {
    id: 'Brainfuck',
    title: 'Brainfuck 解释器',
    description: '轻量 Brainfuck 解释器：支持运行/单步、输入输出、内存窗与步数限制，适合快速验证与教学演示。',
    image: '/images/brainfuck.svg',
    technologies: ['React', 'TypeScript', 'Interpreter'],
    link: '/tools/Brainfuck'
  }
];
