/**
 * 项目元数据 —— 全站唯一数据源。
 *
 * 分类是**多对多**的：一个项目可以同时属于多个分类（例如「排序算法可视化」
 * 既是算法演示，也是图形可视化）。因此这里只定义一份项目列表，每个项目用
 * `categories` 标记归属，分类页按成员关系筛选，不再按分类拆成多个数组。
 *
 * 标注原则（避免把所有模拟都塞进可视化，导致分类失去区分度）：
 * - GAMES      可玩，有胜负/操作反馈
 * - SIMULATIONS 规则或物理系统随时间演化，可调参观察涌现
 * - ALGORITHMS 以演示某个具名算法本身为目的，能看到执行步骤/状态转移
 * - VISUALIZATIONS 主体是图形或数学对象本身（分形、曲线、图形动画）
 * - TOOLS      对用户输入做实际处理
 *
 * 注意：游戏/模拟里内置的求解器、AI 只服务于玩法，**不算算法演示**。
 * 例如魔方带分层还原求解器、鸟群基于 Reynolds 转向规则，但它们的页面呈现的是
 * 玩法与群体行为，而不是算法步骤，因此都不归入 ALGORITHMS。
 */

/** 分类键，与 CategoryIcon 的图标一一对应 */
export type CategoryKey =
  | 'games'
  | 'simulations'
  | 'algorithms'
  | 'visualizations'
  | 'tools'
  | 'complexity';

/** 计算复杂度类别，仅 P & NP 分类下的条目使用 */
export type ComplexityClass = 'P' | 'NP' | 'NPC' | 'NPH';

export interface Project {
  id: string;
  title: string;
  description: string;
  image?: string;
  technologies?: string[];
  /**
   * 所属分类，允许跨分类。
   * 约定：**第一项为主分类**，决定项目页路由 `/{主分类}/{id}`，
   * 也决定它在分类页里的排序位置（主分类项目在前，跨分类的排在后面）。
   */
  categories: CategoryKey[];
  /** 仅当项目页不在 `/{主分类}/{id}` 时才需要显式指定 */
  link?: string;
  /** 该问题所属的复杂度类，分类页会渲染成徽章 */
  complexity?: ComplexityClass;
}

export const projects: Project[] = [
  /* ---------------- GAMES ---------------- */
  {
    id: 'Game2048',
    title: '2048 游戏',
    description:
      '经典的2048数字方块游戏，使用React和TypeScript实现。通过方向键控制，将相同数字的方块合并，达到2048获胜。',
    image: '/images/2048.png',
    technologies: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS'],
    categories: ['games'],
  },
  {
    id: 'Snake',
    title: '贪吃蛇',
    description:
      '经典贪吃蛇小游戏：支持键盘操作与暂停重开，并提供可一键接管的 AI 玩家（自动寻路与避险策略）。',
    image: '/images/snake.svg',
    technologies: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS'],
    categories: ['games'],
  },
  {
    id: 'DanmakuDodge',
    title: '弹幕躲避',
    description:
      '简约弹幕躲避生存游戏：操控小球在密集弹幕中存活更久，支持 AI 自动躲避与手动切换。',
    image: '/images/bullet-dodge.svg',
    technologies: ['React', 'TypeScript', 'Next.js', 'Canvas'],
    categories: ['games'],
  },
  {
    id: 'RubiksCube',
    title: '魔方 · AI 还原',
    description:
      'CSS 3D 渲染的三阶魔方：支持拖动视角、键鼠转动与打乱，内置分层还原求解器（十字全状态查表 + 顶层宏动作 BFS），逐步演示 7 个还原阶段。',
    image: '/images/rubiks-cube.svg',
    technologies: ['React', 'TypeScript', 'CSS 3D', 'BFS'],
    // 求解器是玩法的一部分，不是算法演示，故只归入游戏
    categories: ['games'],
  },

  /* ---------------- SIMULATIONS ---------------- */
  {
    id: 'GameOfLife',
    title: '生命游戏',
    description:
      '康威生命游戏：经典的元胞自动机模拟。支持自定义网格大小、速度、颜色主题，可自由绘制初始状态。',
    image: '/images/game-of-life.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    categories: ['simulations'],
  },
  {
    id: 'LangtonsAnt',
    title: '兰顿蚂蚁',
    description:
      '经典零玩家游戏：简单的转向规则在混沌后会涌现出稳定的“高速公路”结构。支持多蚂蚁、速度/格子大小调节与手动改图。',
    image: '/images/langtons-ant.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    categories: ['simulations'],
  },
  {
    id: 'ParticleLife',
    title: '粒子生命',
    description:
      '基于 WebGPU 加速的粒子人工生命模拟。数千个粒子根据简单的交互矩阵涌现出复杂的类生命行为。',
    image: '/images/particle-life.svg',
    technologies: ['React', 'WebGPU', 'WGSL', 'TypeScript'],
    categories: ['simulations'],
  },
  {
    id: 'PendulumSim',
    title: '混沌摆模拟',
    description:
      '基于约束物理与数值积分的双摆/三摆模拟：支持拖拽调参，显示轨迹与能量变化曲线。',
    image: '/images/pendulum-sim.svg',
    technologies: ['React', 'TypeScript', 'Next.js', 'Canvas'],
    categories: ['simulations'],
  },
  {
    id: 'TuringMachine',
    title: '图灵机',
    description:
      '一维无限纸带图灵机模拟：忙碌海狸 BB(1)~BB(6) 等预设机器，可单步执行、全速运行并对照理论 σ/S 值。',
    image: '/images/turing-machine.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    categories: ['simulations'],
  },
  {
    id: 'TuringMachine2D',
    title: '二维图灵机',
    description:
      '二维图灵机模拟：规则为写符号 + 上下左右移动 + 状态转移，网格无界。内置镜面编织、方形织机、混沌甩尾等预设，点击画布可改格子。',
    image: '/images/turing-machine-2d.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    categories: ['simulations'],
  },
  {
    id: 'PowSim',
    title: 'PoW 模拟器',
    description:
      '工作量证明模拟：纯 TS 实现的 SHA-256，实时求解（可调难度）、篡改区块破坏整链校验、雪崩效应试算。',
    image: '/images/pow-sim.svg',
    technologies: ['React', 'TypeScript'],
    categories: ['simulations'],
  },
  {
    id: 'NBody',
    title: 'N 体引力',
    description:
      '牛顿引力 N 体模拟：太阳系、双星、星系碰撞与随机星团等预设，拖拽发射新天体，可调引力常数、时间流速、轨迹持续与软化长度，支持碰撞并合。',
    image: '/images/n-body.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    categories: ['simulations'],
  },
  {
    id: 'BrownianMotion',
    title: '布朗运动',
    description:
      '二维随机游走粒子群：方向持久 + 高斯扰动的布朗模型，可调温度、扰动与轨迹长度，实时统计均方位移 MSD 并绘制双对数扩散曲线。',
    image: '/images/brownian-motion.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    categories: ['simulations'],
  },
  {
    id: 'Boids',
    title: '鸟群算法',
    description:
      'Reynolds Boids 群体智能模拟：分离/对齐/聚合三条局部规则涌现鸟群行为，支持捕食者追击逃逸、指针驱赶、环绕/反弹边界与轨迹残影，可实时调权重观察群形变化。',
    image: '/images/boids.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    // 呈现的是群体行为涌现，不是转向规则的执行步骤，故只归入模拟
    categories: ['simulations'],
  },
  {
    id: 'MontyHall',
    title: '三门问题',
    description:
      'Monty Hall 概率悖论：手动选门体验主持人开门的信息量，蒙特卡洛批量模拟看「换门 2/3、坚持 1/3」的频率收敛曲线，附直觉陷阱解释。',
    technologies: ['React', 'TypeScript'],
    categories: ['simulations'],
  },

  /* ---------------- ALGORITHMS ---------------- */
  {
    id: 'TSPAntColony',
    title: 'TSP 蚁群算法',
    description:
      '旅行商问题的蚁群优化：动态可视化信息素演化与最优路径收敛过程，支持参数调节。',
    image: '/images/tsp-ant-colony.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    // 蚁群本质是信息素驱动的多智能体模拟
    categories: ['algorithms', 'simulations'],
  },
  {
    id: 'SortingVisualizer',
    title: '排序算法可视化',
    description:
      '覆盖 13 种经典排序算法的动态可视化：冒泡、鸡尾酒、侏儒、梳、插入、希尔、选择、快速、归并、堆、计数、桶、基数，支持调速、单步与多种数据分布。',
    image: '/images/sorting-visualizer.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    categories: ['algorithms', 'visualizations'],
  },
  {
    id: 'CryptoVisualizer',
    title: '加密算法可视化',
    description:
      '7 种加密算法分步演示：凯撒、维吉尼亚、栅栏、XOR、AES-128（完整 10 轮状态矩阵）、RSA、Diffie-Hellman，支持加解密双向演示与逐步播放。',
    image: '/images/crypto-visualizer.svg',
    technologies: ['React', 'TypeScript'],
    // 分步演示算法执行过程，归算法演示；不承担日常加解密工具职能
    categories: ['algorithms'],
  },
  {
    id: 'Pathfinding',
    title: '寻路可视化',
    description:
      'A* / Dijkstra / BFS / Greedy BFS 四算法网格寻路：拖拽绘制墙体、移动起终点，可调启发权重 ε 观察最优性权衡，支持随机迷宫与四算法访问范围对比。',
    image: '/images/pathfinding.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    categories: ['algorithms', 'visualizations'],
  },
  {
    id: 'HuffmanTree',
    title: '哈夫曼编码树',
    description:
      '输入任意文本实时构建哈夫曼树：频率统计、贪心建树、前缀码分配、压缩率对照定长编码，点击树叶高亮编码路径。',
    image: '/images/huffman-tree.svg',
    technologies: ['React', 'TypeScript', 'SVG'],
    categories: ['algorithms', 'visualizations'],
  },

  /* ---------------- VISUALIZATIONS ---------------- */
  {
    id: 'Mandelbrot',
    title: '分形几何',
    description:
      '分形几何可视化合集：Mandelbrot / Julia / Newton 分形，支持中心、缩放、迭代次数与参数调节。',
    image: '/images/fractal-geometry.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    categories: ['visualizations'],
  },
  {
    id: 'DigitSumTurtle',
    title: '数位和海龟绘图',
    description:
      '遍历自然数：n 进制数位和为偶数则前进画线，为奇数则旋转 360°/m。n=2 即 Thue–Morse 海龟曲线，默认参数（初始朝向右下、逆时针）呈水平延展的科赫雪花式分形；无限画布、镜头跟随自动展示完整图案。',
    image: '/images/digit-sum-turtle.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    categories: ['visualizations'],
  },
  {
    id: 'Collatz',
    title: '冰雹猜想',
    description:
      '广义冰雹猜想实验台：能被 c 整除则除以 c，否则乘 a 加 b。可调 a/b/c 参数对比 3n+1、5n+1 等规则的收敛、循环环与发散轨道，支持多起点轨迹叠加与逐帧回放。',
    image: '/images/collatz.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    categories: ['visualizations'],
  },
  {
    id: 'Lissajous',
    title: '利萨茹曲线',
    description:
      '互垂直正弦叠加 x=sin(at+δ)、y=sin(bt)：频率比与相位差实时可调，残影拖尾与投影引导点，内置 1:1、3:2、5:4 等经典频率比预设。',
    image: '/images/lissajous.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    categories: ['visualizations'],
  },
  {
    id: 'FourierSeries',
    title: '傅里叶级数',
    description:
      '旋转圆叠加合成方波/锯齿波/三角波：谐波组数实时可调，展示级数系数 bₙ 与吉布斯现象，虚线对照理想目标波形。',
    image: '/images/fourier-series.svg',
    technologies: ['React', 'TypeScript', 'Canvas'],
    categories: ['visualizations'],
  },

  /* ---------------- TOOLS ---------------- */
  {
    id: 'BaseConverter',
    title: '进制转换',
    description:
      '2~36 进制互转工具：BigInt 大数无精度损失，二/八/十/十六/32/36 进制一览，字节对齐位宽视图，支持分组分隔与一键复制。',
    technologies: ['React', 'TypeScript', 'BigInt'],
    categories: ['tools'],
  },
  {
    id: 'Brainfuck',
    title: 'Brainfuck 解释器',
    description:
      '轻量 Brainfuck 解释器：支持运行/单步、输入输出、内存窗与步数限制，适合快速验证与教学演示。',
    image: '/images/brainfuck.svg',
    technologies: ['React', 'TypeScript', 'Interpreter'],
    categories: ['tools'],
  },

  /* ---------------- P & NP ---------------- */
  {
    id: 'TopologicalSort',
    title: '拓扑排序',
    description:
      'DAG 上的线性排序：Kahn 与 DFS 逆后序两种内置算法，逐步演示入队、出队与入度更新，可导入自己的实现跑同一套用例。',
    technologies: ['React', 'TypeScript', 'Web Worker'],
    categories: ['complexity'],
    complexity: 'P',
  },
  {
    id: 'MaxFlow',
    title: '最大流',
    description:
      '从源点到汇点最多能推多少流量：Edmonds–Karp 逐条增广，边上实时显示 流量/容量，可调网络规模。',
    technologies: ['React', 'TypeScript'],
    categories: ['complexity'],
    complexity: 'P',
  },
  {
    id: 'Eulerian',
    title: '欧拉回路',
    description:
      '一笔画走过每条边恰好一次并回到起点：Hierholzer 逐边推进、退栈归位，可调点数与附加边数。',
    technologies: ['React', 'TypeScript'],
    categories: ['complexity'],
    complexity: 'P',
  },
  {
    id: 'Factoring',
    title: '整数分解',
    description:
      "把 n 拆成质因子乘积：试除法与 Pollard's Rho 对比，展示因子逐步拆出的过程，可导入自己的分解实现。",
    technologies: ['React', 'TypeScript', 'Web Worker'],
    categories: ['complexity'],
    complexity: 'NP',
  },
  {
    id: 'DLP',
    title: '离散对数',
    description:
      '已知 g^x = h 求 x：模 p 乘法群与椭圆曲线（ECDLP）两种群可切换，暴力线性搜索与 Baby-step Giant-step 实时对比。',
    technologies: ['React', 'TypeScript'],
    categories: ['complexity'],
    complexity: 'NP',
  },
  {
    id: 'SAT',
    title: '3-SAT',
    description:
      '合取范式的可满足性判定：暴力枚举与 DPLL 两种内置算法，实时显示子句满足状态、决策与回溯次数，可导入自己的求解器。',
    technologies: ['React', 'TypeScript', 'Web Worker'],
    categories: ['complexity'],
    complexity: 'NPC',
  },
  {
    id: 'SubsetSum',
    title: '子集和',
    description:
      '给一组数字和目标值，判断能否选出若干数之和恰好等于目标：DP 表逐格填充，可调物品数与目标，可导入自己的实现。',
    technologies: ['React', 'TypeScript'],
    categories: ['complexity'],
    complexity: 'NPC',
  },
  {
    id: 'Hamiltonian',
    title: '哈密顿回路',
    description:
      '找一条经过每个点恰好一次并回到起点的回路：回溯搜索实时可视化，可调节点数与边密度，可导入自己的实现。',
    technologies: ['React', 'TypeScript'],
    categories: ['complexity'],
    complexity: 'NPC',
  },
  {
    id: 'VertexCover',
    title: '顶点覆盖',
    description:
      '选出最少的点，使每条边至少有一个端点被选中：分支定界实时剪枝，可调点数与边密度。',
    technologies: ['React', 'TypeScript'],
    categories: ['complexity'],
    complexity: 'NPC',
  },
  {
    id: 'MaxClique',
    title: '最大团',
    description:
      '找出两两相邻的最大点集：回溯搜索 + 候选剪枝，实时显示当前团、候选点与历史最优。',
    technologies: ['React', 'TypeScript'],
    categories: ['complexity'],
    complexity: 'NPC',
  },
  {
    id: 'SetCover',
    title: '集合覆盖',
    description:
      '用尽量少的集合覆盖全部元素：贪心与精确搜索对比，逐轮点亮已覆盖元素，可导入自己的实现。',
    technologies: ['React', 'TypeScript'],
    categories: ['complexity'],
    complexity: 'NPC',
  },
  {
    id: 'GraphColoring',
    title: '图着色',
    description:
      '用 k 种颜色给图着色：回溯与贪心两种内置算法，动态演示取色与回退，可导入自己的实现。',
    technologies: ['React', 'TypeScript', 'Web Worker'],
    categories: ['complexity'],
    complexity: 'NPC',
  },
  {
    id: 'BinPacking',
    title: '装箱',
    description:
      '把大小不一的物品装进容量相同的箱子，用尽量少的箱子：First-Fit Decreasing 逐件装箱，可调物品数与容量。',
    technologies: ['React', 'TypeScript'],
    categories: ['complexity'],
    complexity: 'NPH',
  },
  {
    id: 'TSP',
    title: '旅行商问题',
    description:
      '最短闭合回路：最近邻、2-opt、暴力最优三种内置算法，可视化回路构造过程并给出与最优解的差距，可导入自己的实现。',
    technologies: ['React', 'TypeScript', 'Web Worker'],
    categories: ['complexity'],
    complexity: 'NPH',
  },
];

export interface Category {
  key: CategoryKey;
  /** 分类序号，与分类页标题左侧的编号保持一致 */
  no: string;
  title: string;
  label: string;
  subtitle: string;
  href: string;
  /** 首页用整行大卡片展示，用来突出特殊分类 */
  featured?: boolean;
  /** 分类页标题，缺省为 ALL_{KEY} */
  pageTitle?: string;
}

/**
 * 顺序即首页展示顺序。
 * P & NP 是特殊分类（按计算复杂度横切，不是按项目形态划分），放在 0 号位并整行展示。
 */
export const categories: Category[] = [
  {
    key: 'complexity',
    no: '00',
    title: 'P & NP',
    label: '复杂度',
    subtitle: 'COMPUTATIONAL_COMPLEXITY_CLASSES',
    href: '/complexity',
    featured: true,
    pageTitle: 'P & NP',
  },
  {
    key: 'games',
    no: '01',
    title: 'GAMES',
    label: '游戏',
    subtitle: 'INTERACTIVE_ENTERTAINMENT_MODULES',
    href: '/games',
  },
  {
    key: 'simulations',
    no: '02',
    title: 'SIMULATIONS',
    label: '模拟',
    subtitle: 'PHYSICS_AND_MATH_EXPERIMENTS',
    href: '/simulations',
  },
  {
    key: 'algorithms',
    no: '03',
    title: 'ALGORITHMS',
    label: '算法',
    subtitle: 'CLASSIC_ALGORITHM_VISUALIZATIONS',
    href: '/algorithms',
  },
  {
    key: 'visualizations',
    no: '04',
    title: 'VISUALIZATIONS',
    label: '可视化',
    subtitle: 'MATH_AND_ALGORITHM_VISUALIZATIONS',
    href: '/visualizations',
  },
  {
    key: 'tools',
    no: '05',
    title: 'TOOLS',
    label: '工具',
    subtitle: 'UTILITY_AND_PROCESSING_UNITS',
    href: '/tools',
  },
];

export const categoryMap = Object.fromEntries(categories.map((c) => [c.key, c])) as Record<
  CategoryKey,
  Category
>;

/** 主分类：`categories` 的第一项 */
export const primaryCategory = (project: Project): CategoryKey => project.categories[0];

/** 除主分类外的其他分类，用于在分类页标注「还属于哪些分类」 */
export const otherCategories = (project: Project): CategoryKey[] => project.categories.slice(1);

/** 项目页地址，默认由主分类推导 */
export const projectHref = (project: Project) =>
  project.link ?? `/${primaryCategory(project)}/${project.id}`;

/** 某分类下的项目：主分类项目在前，跨分类收录的排在后面 */
export function projectsIn(key: CategoryKey): Project[] {
  const primary = projects.filter((p) => primaryCategory(p) === key);
  const shared = projects.filter((p) => primaryCategory(p) !== key && p.categories.includes(key));
  return [...primary, ...shared];
}

/** 项目总数（去重） */
export const projectCount = projects.length;

/** 收录条目总数（跨分类项目会重复计数） */
export const listingCount = projects.reduce((sum, p) => sum + p.categories.length, 0);
