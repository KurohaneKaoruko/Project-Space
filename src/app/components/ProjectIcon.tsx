import { anim } from './iconAnim';

/**
 * 动态 SVG 图标组件
 * 每个项目对应一个轻量内联 SVG，动画默认 paused，卡片 hover 时通过 CSS 类运行。
 * 注意：
 * 1. 动画属性必须用长写（animationName/Duration/Delay），
 *    若用简写 animation: ... 会把 play-state 重置为 running，导致后台常驻耗 CPU。
 * 2. keyframes 集中定义在 globals.css，不要在 SVG 内嵌 <style>（会泄漏为可见文本）。
 * 相比大预览图：零图片请求、体积以字节计、hover 前零 CPU 消耗。
 */
export type ProjectIconId =
  | 'Game2048'
  | 'Snake'
  | 'DanmakuDodge'
  | 'RubiksCube'
  | 'GameOfLife'
  | 'LangtonsAnt'
  | 'ParticleLife'
  | 'PendulumSim'
  | 'TuringMachine'
  | 'TuringMachine2D'
  | 'PowSim'
  | 'TSPAntColony'
  | 'SortingVisualizer'
  | 'CryptoVisualizer'
  | 'Mandelbrot'
  | 'DigitSumTurtle'
  | 'Collatz'
  | 'BaseConverter'
  | 'Brainfuck'
  | 'NBody'
  | 'BrownianMotion'
  | 'Pathfinding'
  | 'HuffmanTree'
  | 'Lissajous'
  | 'FourierSeries'
  | 'Boids'
  | 'MontyHall'
  | 'TopologicalSort'
  | 'MaxFlow'
  | 'ShortestPath'
  | 'ConvexHull'
  | 'Eulerian'
  | 'MST'
  | 'EditDistance'
  | 'Factoring'
  | 'DLP'
  | 'GraphIso'
  | 'SAT'
  | 'SubsetSum'
  | 'Knapsack'
  | 'Sudoku'
  | 'Hamiltonian'
  | 'VertexCover'
  | 'MaxIndependentSet'
  | 'MaxClique'
  | 'SetCover'
  | 'GraphColoring'
  | 'BinPacking'
  | 'TSP'
  | 'QR'
  | 'SVP'
  | 'SteinerTree'
  | 'JobScheduling'
  | 'LongestPath'
  | 'ClosestPair'
  | 'CoinChange'
  | 'BitonicTSP';

const S = 64; // viewBox 尺寸

/** 通用底座：方形画布 */
function Base({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${S} ${S}`} fill="none" aria-hidden="true" className="h-full w-full">
      {children}
    </svg>
  );
}

/* ---------------- GAMES ---------------- */

function Icon2048() {
  return (
    <Base>
      {/* 四块数字方块，hover 时轮流闪烁 */}
      {[
        { x: 10, y: 10, v: 2 },
        { x: 34, y: 10, v: 4 },
        { x: 34, y: 34, v: 8 },
        { x: 10, y: 34, v: 16 },
      ].map((c, i) => (
        <g key={c.v} className="icon-motion" style={anim('pulse2048', 1.6, i * 0.4)}>
          <rect x={c.x} y={c.y} width={20} height={20} fill="currentColor" opacity={0.08 + i * 0.06} />
          <rect x={c.x} y={c.y} width={20} height={20} stroke="currentColor" strokeWidth={1.5} />
          <text x={c.x + 10} y={c.y + 14} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="currentColor">
            {c.v}
          </text>
        </g>
      ))}
    </Base>
  );
}

function IconSnake() {
  return (
    <Base>
      {/* 蛇身沿网格爬行 */}
      <g className="icon-motion" style={anim('snakeCrawl', 3)}>
        <polyline
          className="icon-snake-line"
          points="12,52 12,36 28,36 28,20 44,20 44,28"
          stroke="currentColor"
          strokeWidth={5}
          strokeLinecap="square"
          fill="none"
        />
      </g>
      <circle cx="44" cy="28" r="3" fill="currentColor" />
      <rect className="icon-motion" style={anim('snakeFood', 1)} x="47" y="45" width="7" height="7" fill="currentColor" opacity="0.5" />
      <g stroke="currentColor" strokeWidth="0.4" opacity="0.15">
        <path d="M4 20H60 M4 36H60 M20 4V60 M36 4V60" />
      </g>
    </Base>
  );
}

function IconDanmakuDodge() {
  return (
    <Base>
      {/* 中心小球 + 环形弹幕 */}
      <circle cx="32" cy="32" r="4" fill="currentColor" />
      {[0, 1, 2].map((i) => (
        <g key={i} className="icon-motion" style={anim('danmakuSpin', 2.4, -i * 0.8)}>
          <circle cx="32" cy="12" r="2.5" fill="currentColor" opacity="0.7" />
        </g>
      ))}
      <circle cx="32" cy="32" r="14" stroke="currentColor" strokeWidth="0.75" strokeDasharray="2 4" opacity="0.35" />
    </Base>
  );
}

function IconRubiksCube() {
  return (
    <Base>
      {/* 2.5D 三阶魔方：正面 + 顶面 + 右侧面，网格线跟随透视方向 */}
      <g className="icon-motion" style={{ ...anim('cubeTilt', 6, 0, 'ease-in-out'), transformOrigin: '32px 31px' }}>
        <g stroke="currentColor" strokeLinejoin="miter">
          {/* 面：左前(亮) 顶(更亮) 右(暗) */}
          <rect x="15" y="24" width="24" height="24" fill="currentColor" opacity="0.15" strokeWidth="1.2" />
          <path d="M15 24l10-10h24l-10 10z" fill="currentColor" opacity="0.25" strokeWidth="1.2" />
          <path d="M39 24l10-10v24l-10 10z" fill="currentColor" opacity="0.07" strokeWidth="1.2" />
          {/* 正面网格 3x3 */}
          <path d="M23 24v24 M31 24v24 M15 32h24 M15 40h24" opacity="0.5" strokeWidth="0.75" />
          {/* 顶面网格：分割线沿进深方向(10,-10)，横线按进深 1/3、2/3 */}
          <path d="M23 24l10-10 M31 24l10-10 M18.3 20.7h24 M21.7 17.3h24" opacity="0.45" strokeWidth="0.75" />
          {/* 右侧面网格：竖线沿棱方向，横线沿进深方向(10,-10) */}
          <path d="M42.3 20.7v24 M45.7 17.3v24 M39 32l10-10 M39 40l10-10" opacity="0.35" strokeWidth="0.75" />
        </g>
      </g>
    </Base>
  );
}

/* ---------------- SIMULATIONS ---------------- */

function IconGameOfLife() {
  return (
    <Base>
      {/* 元胞自动机网格：部分格子呼吸闪烁 */}
      <g stroke="currentColor" strokeWidth="0.5" opacity="0.2">
        <path d="M8 22H56 M8 36H56 M22 8V56 M36 8V56" />
      </g>
      {[
        { x: 8, y: 8 }, { x: 36, y: 8 }, { x: 22, y: 22 }, { x: 50, y: 22 },
        { x: 8, y: 36 }, { x: 36, y: 36 }, { x: 22, y: 50 }, { x: 50, y: 50 },
      ].map((c, i) => (
        <rect key={i} className="icon-motion" style={anim('cellBreathe', 2, i * 0.25)} x={c.x + 2} y={c.y + 2} width={10} height={10} fill="currentColor" />
      ))}
    </Base>
  );
}

function IconLangtonsAnt() {
  return (
    <Base>
      {/* 黑白格翻转 + 蚂蚁移动 */}
      <g stroke="currentColor" strokeWidth="0.5" opacity="0.2">
        <path d="M8 24H56 M8 40H56 M24 8V56 M40 8V56" />
      </g>
      {[
        { x: 24, y: 24 }, { x: 40, y: 8 }, { x: 8, y: 40 }, { x: 40, y: 40 },
      ].map((c, i) => (
        <rect key={i} className="icon-motion" style={anim('cellFlip', 1.8, i * 0.45)} x={c.x} y={c.y} width={16} height={16} fill="currentColor" opacity="0.25" />
      ))}
      <g className="icon-motion" style={anim('antWalk', 4)}>
        <circle cx="32" cy="32" r="4" fill="currentColor" />
      </g>
    </Base>
  );
}

function IconParticleLife() {
  return (
    <Base>
      {/* 粒子群绕中心轨道运行 */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const r = 10 + (i % 3) * 7;
        const dur = 3 + (i % 3);
        return (
          <g key={i} className="icon-motion" style={{ ...anim('orbit', dur, -i * 0.5), transformOrigin: '32px 32px' }}>
            <circle cx={32 + r} cy="32" r="2.5" fill="currentColor" opacity={0.85 - i * 0.1} />
          </g>
        );
      })}
      <circle cx="32" cy="32" r="2" fill="currentColor" opacity="0.4" />
    </Base>
  );
}

function IconPendulumSim() {
  return (
    <Base>
      {/* 双摆摆动 */}
      <g className="icon-motion" style={{ ...anim('swing1', 2.4, 0, 'ease-in-out'), transformOrigin: '32px 12px' }}>
        <line x1="32" y1="12" x2="32" y2="34" stroke="currentColor" strokeWidth="1.2" />
        <g style={{ ...anim('swing2', 2.4, 0, 'ease-in-out'), transformOrigin: '32px 34px' }}>
          <line x1="32" y1="34" x2="46" y2="48" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="46" cy="48" r="4.5" fill="currentColor" opacity="0.6" />
        </g>
        <circle cx="32" cy="34" r="3.5" fill="currentColor" />
      </g>
      <line x1="22" y1="12" x2="42" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </Base>
  );
}

function IconTuringMachine() {
  return (
    <Base>
      {/* 一维纸带读写头移动 */}
      <g stroke="currentColor" strokeWidth="1" opacity="0.6">
        <rect x="8" y="36" width="48" height="12" />
        <path d="M20 36v12 M32 36v12 M44 36v12" strokeWidth="0.6" opacity="0.5" />
      </g>
      {[{ x: 8 }, { x: 32 }, { x: 44 }].map((c, i) => (
        <rect key={i} x={c.x + 1.5} y={37.5} width={9} height={9} fill="currentColor" opacity="0.3" />
      ))}
      <g className="icon-motion" style={anim('headMove', 2.8, 0, 'steps(1)')}>
        <path d="M28 20h8l-2.5 4h-3z" fill="currentColor" />
        <rect x="30" y="24" width="4" height="12" fill="currentColor" opacity="0.5" />
      </g>
      <text x="32" y="16" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="currentColor" opacity="0.5">
        0→1
      </text>
    </Base>
  );
}

function IconTuringMachine2D() {
  return (
    <Base>
      {/* 二维网格编织轨迹（底层淡色 + 上层流动描线） */}
      <g stroke="currentColor" strokeWidth="0.5" opacity="0.2">
        <path d="M8 20H56 M8 32H56 M8 44H56 M20 8V56 M32 8V56 M44 8V56" />
      </g>
      <path
        className="icon-turmite-path"
        d="M14 14H50V50H26V26H38V38"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinejoin="miter"
        opacity="0.2"
      />
      <g className="icon-motion" style={anim('turmiteDraw', 3)}>
        <path
          className="icon-turmite-path"
          d="M14 14H50V50H26V26H38V38"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinejoin="miter"
        />
      </g>
    </Base>
  );
}

function IconPowSim() {
  return (
    <Base>
      {/* 区块链 + 哈希方块 */}
      <g stroke="currentColor" strokeWidth="1.2" fill="none">
        <rect x="8" y="26" width="14" height="14" fill="currentColor" opacity="0.25" />
        <rect className="icon-motion" style={anim('blockHash', 1.6)} x="25" y="26" width="14" height="14" fill="currentColor" opacity="0.4" />
        <rect x="42" y="26" width="14" height="14" />
        <path d="M22 33h3 M39 33h3" />
      </g>
      <text x="49" y="35" textAnchor="middle" fontSize="7" fontFamily="monospace" fill="currentColor">0</text>
      <g className="icon-motion" style={anim('blockHash', 2)} fontFamily="monospace" fontSize="6" fill="currentColor" opacity="0.5">
        <text x="15" y="52">1F</text>
        <text x="32" y="52">0A</text>
        <text x="49" y="52">00</text>
      </g>
      <text x="15" y="20" textAnchor="middle" fontSize="7" fontFamily="monospace" fill="currentColor" opacity="0.7">SHA</text>
    </Base>
  );
}

/* ---------------- ALGORITHMS ---------------- */

function IconTSPAntColony() {
  return (
    <Base>
      {/* 节点图 + 信息素路径流动 */}
      {[
        { x: 32, y: 12 }, { x: 12, y: 28 }, { x: 52, y: 28 }, { x: 20, y: 52 }, { x: 44, y: 52 },
      ].map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="currentColor" opacity="0.7" />
      ))}
      <path
        className="icon-pheromone-path icon-motion"
        style={anim('pheromone', 2)}
        d="M32 12L52 28L44 52L20 52L12 28Z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.5"
      />
    </Base>
  );
}

function IconSortingVisualizer() {
  return (
    <Base>
      {/* 柱状图扫描排序 */}
      {[
        { x: 10, h: 16 }, { x: 18, h: 30 }, { x: 26, h: 10 }, { x: 34, h: 40 }, { x: 42, h: 22 }, { x: 50, h: 34 },
      ].map((b, i) => (
        <rect
          key={i}
          className="icon-motion"
          style={{ ...anim('barScan', 2.4, i * 0.2), transformOrigin: `${b.x + 2.75}px 54px` }}
          x={b.x}
          y={54 - b.h}
          width="5.5"
          height={b.h}
          fill="currentColor"
          opacity={0.35 + i * 0.1}
        />
      ))}
      <line x1="8" y1="55" x2="56" y2="55" stroke="currentColor" strokeWidth="1" opacity="0.6" />
    </Base>
  );
}

function IconCryptoVisualizer() {
  return (
    <Base>
      {/* 锁 + 密钥脉冲 */}
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        <rect x="20" y="28" width="24" height="20" fill="currentColor" opacity="0.15" />
        <path d="M26 28v-6a6 6 0 0112 0v6" />
      </g>
      <circle cx="32" cy="36" r="3" fill="currentColor" className="icon-motion" style={anim('keyPulse', 1.8)} />
      <g className="icon-motion" style={anim('blockHash', 1.5)} fontFamily="monospace" fontSize="7" fill="currentColor" opacity="0.45">
        <text x="12" y="16">A3</text>
        <text x="44" y="16">F9</text>
        <text x="12" y="60" opacity="0.7">K*</text>
        <text x="44" y="60" opacity="0.7">7X</text>
      </g>
    </Base>
  );
}

/* ---------------- VISUALIZATIONS ---------------- */

function IconMandelbrot() {
  return (
    <Base>
      {/* 分形：心形 + 圆盘 + 发散探针 */}
      <g stroke="currentColor" fill="none">
        <path d="M32 14c-8 0-13 6-13 14s5 12 9 22c1 2 4 2 5 0 4-10 12-8 12-22 0-8-5-14-13-14z" strokeWidth="1.4" fill="currentColor" fillOpacity="0.1" />
        <circle cx="47" cy="26" r="6.5" strokeWidth="1.4" fill="currentColor" fillOpacity="0.1" />
      </g>
      <g className="icon-motion" style={anim('probe', 3, 0, 'ease-in-out')}>
        <circle cx="32" cy="14" r="1.8" fill="currentColor" />
      </g>
      <path d="M32 14L56 8" stroke="currentColor" strokeWidth="0.6" opacity="0.4" strokeDasharray="2 3" />
    </Base>
  );
}

function IconDigitSumTurtle() {
  return (
    <Base>
      {/* 海龟绘图对称螺旋（底层静止淡色，上层流动描线） */}
      <path
        d="M32 32L48 16L48 48L16 48L16 16L40 40"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinejoin="miter"
        opacity="0.2"
      />
      <g className="icon-motion" style={anim('turtlePath', 3.2)}>
        <path
          className="icon-turtle-path"
          d="M32 32L48 16L48 48L16 48L16 16L40 40"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinejoin="miter"
        />
      </g>
      <circle cx="40" cy="40" r="2.5" fill="currentColor" />
    </Base>
  );
}

/* ---------------- TOOLS ---------------- */

/** 进制转换：0/1 位流 + 底数雷达环 */
function IconBaseConverter() {
  return (
    <Base>
      {/* 二进制位流 */}
      <g fontFamily="monospace" fontSize="11" fontWeight="bold" fill="currentColor" textAnchor="middle">
        <text x="14" y="20" opacity="0.9">1</text>
        <text x="26" y="20" opacity="0.4">0</text>
        <text x="38" y="20" opacity="0.9">1</text>
        <text x="50" y="20" opacity="0.4">1</text>
      </g>
      {/* 底数标记 2 / 8 / 10 / 16 沿弧线排布 */}
      <g fontFamily="monospace" fontSize="9" fontWeight="bold" fill="currentColor" textAnchor="middle">
        <text x="12" y="46" opacity="0.85">2</text>
        <text x="24" y="54" opacity="0.5">8</text>
        <text x="40" y="54" opacity="0.85">10</text>
        <text x="52" y="46" opacity="0.5">16</text>
      </g>
      {/* 转换箭头，hover 时流动 */}
      <g className="icon-motion" style={anim('bfBlink', 1.6)}>
        <path d="M20 30 h20 m-5 -4 l5 4 l-5 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      </g>
    </Base>
  );
}

function IconBrainfuck() {
  return (
    <Base>
      {/* Brainfuck 八指令符号矩阵 */}
      <g fontFamily="monospace" fontSize="13" fontWeight="bold" fill="currentColor" textAnchor="middle">
        <text x="16" y="22" opacity="0.9">&gt;</text>
        <text x="32" y="22" opacity="0.5">&lt;</text>
        <text x="48" y="22" opacity="0.9">+</text>
        <text x="16" y="40" opacity="0.5">-</text>
        <text x="32" y="40" opacity="0.9">.</text>
        <text x="48" y="40" opacity="0.5">,</text>
        <text x="24" y="56" opacity="0.7">[</text>
        <text x="40" y="56" opacity="0.7">]</text>
      </g>
      <g className="icon-motion" style={anim('bfBlink', 1.4)}>
        <rect x="12" y="58" width="40" height="2" fill="currentColor" opacity="0.6" />
      </g>
    </Base>
  );
}

function IconCollatz() {
  return (
    <Base>
      {/* 冰雹轨迹：剧烈起伏的路径，hover 时描线生长 */}
      <path
        className="icon-collatz-path"
        d="M8 50 20 50 20 26 30 26 30 42 38 42 38 12 46 12 46 30 56 30 56 38 50 38 50 44 44 44"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinejoin="miter"
        opacity="0.2"
      />
      <g className="icon-motion" style={anim('collatzDraw', 3.2)}>
        <path
          className="icon-collatz-path"
          d="M8 50 20 50 20 26 30 26 30 42 38 42 38 12 46 12 46 30 56 30 56 38 50 38 50 44 44 44"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinejoin="miter"
        />
      </g>
      {/* 峰值点 */}
      <rect x="36" y="10" width="4" height="4" fill="currentColor" opacity="0.8" />
      {/* 起点与终点标记 */}
      <rect x="5" y="47" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <text x="60" y="58" textAnchor="end" fontSize="7" fontFamily="monospace" fill="currentColor" opacity="0.5">
        ax+b
      </text>
    </Base>
  );
}

/* ---------------- 新增：SIMULATIONS ---------------- */

function IconNBody() {
  return (
    <Base>
      {/* 中心恒星 + 轨道行星（反向两轨道） */}
      <circle cx="32" cy="32" r="6" fill="currentColor" />
      <circle cx="32" cy="32" r="9" fill="currentColor" opacity="0.15" />
      <g stroke="currentColor" strokeWidth="0.5" opacity="0.2" fill="none">
        <ellipse cx="32" cy="32" rx="14" ry="20" />
        <ellipse cx="32" cy="32" rx="22" ry="12" />
      </g>
      <g className="icon-motion" style={{ ...anim('orbit', 4), transformOrigin: '32px 32px' }}>
        <circle cx="32" cy="12" r="2.6" fill="currentColor" />
      </g>
      <g className="icon-motion" style={{ ...anim('orbit', 6.5, -2), transformOrigin: '32px 32px' }}>
        <circle cx="54" cy="32" r="2" fill="currentColor" opacity="0.8" />
      </g>
      <g className="icon-motion" style={{ ...anim('orbit', 5, -3.4), transformOrigin: '32px 32px' }}>
        <circle cx="10" cy="32" r="1.6" fill="currentColor" opacity="0.6" />
      </g>
    </Base>
  );
}

function IconBrownianMotion() {
  return (
    <Base>
      {/* 随机折线轨迹 + 游走粒子 */}
      <path
        d="M10 44 L16 38 L13 32 L20 28 L18 22 L26 24 L28 18 L34 22 L40 18 L38 12 L46 16 L52 12"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.5"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="44" r="1.8" fill="currentColor" opacity="0.5" />
      <g className="icon-motion" style={anim('cellBreathe', 1.6)}>
        <circle cx="52" cy="12" r="3.4" fill="currentColor" />
      </g>
      <g className="icon-motion" style={{ ...anim('cellBreathe', 2.2, -0.8) }}>
        <circle cx="30" cy="40" r="2.4" fill="currentColor" opacity="0.6" />
        <path d="M24 34 L36 46 M36 34 L24 46" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      </g>
    </Base>
  );
}

/* ---------------- 新增：ALGORITHMS ---------------- */

function IconPathfinding() {
  return (
    <Base>
      {/* 网格 + 墙 + 路径点 */}
      <g stroke="currentColor" strokeWidth="0.5" opacity="0.2">
        <path d="M8 22H56 M8 36H56 M22 8V56 M36 8V56" />
      </g>
      <rect x="22" y="8" width="14" height="28" fill="currentColor" opacity="0.55" />
      <rect x="8" y="36" width="14" height="6" fill="currentColor" opacity="0.55" />
      <rect x="36" y="36" width="20" height="6" fill="currentColor" opacity="0.55" />
      {[
        { x: 15, y: 15 }, { x: 29, y: 43 }, { x: 43, y: 15 }, { x: 49, y: 29 },
      ].map((c, i) => (
        <circle key={i} className="icon-motion" style={anim('barScan', 1.4, i * 0.3)} cx={c.x} cy={c.y} r="3" fill="currentColor" />
      ))}
      <circle cx="13" cy="49" r="4" fill="currentColor" />
      <circle cx="51" cy="13" r="4" fill="currentColor" opacity="0.7" />
    </Base>
  );
}

function IconHuffmanTree() {
  return (
    <Base>
      {/* 二叉树：根 → 两内部 → 四叶子，叶子码字闪烁 */}
      <g stroke="currentColor" strokeWidth="1.2" opacity="0.7">
        <path d="M32 14V22 M32 22L18 34 M32 22L46 34 M18 34L11 46 M18 34L25 46 M46 34L39 46 M46 34L53 46" fill="none" />
      </g>
      <circle cx="32" cy="14" r="5" fill="currentColor" />
      <circle cx="18" cy="34" r="4" fill="currentColor" opacity="0.7" />
      <circle cx="46" cy="34" r="4" fill="currentColor" opacity="0.7" />
      {[
        { x: 11, y: 46 }, { x: 25, y: 46 }, { x: 39, y: 46 }, { x: 53, y: 46 },
      ].map((c, i) => (
        <circle key={i} className="icon-motion" style={anim('keyPulse', 1.8, i * 0.4)} cx={c.x} cy={c.y} r="3.4" fill="currentColor" />
      ))}
    </Base>
  );
}

/* ---------------- 新增：VISUALIZATIONS ---------------- */

function IconLissajous() {
  return (
    <Base>
      {/* 3:2 利萨加曲线 + 光点沿线运行 */}
      <path
        d="M32 10 C42 14, 50 22, 50 32 C50 42, 42 50, 32 50 C26 50, 22 46, 22 40 C22 34, 26 30, 32 30 C40 30, 46 24, 46 18"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.75"
      />
      <g className="icon-motion" style={anim('antWalk', 3.2)}>
        <circle cx="46" cy="18" r="3" fill="currentColor" />
      </g>
      <g className="icon-motion" style={{ ...anim('cellBreathe', 2, -1) }}>
        <circle cx="32" cy="10" r="2" fill="currentColor" opacity="0.6" />
        <circle cx="22" cy="40" r="2" fill="currentColor" opacity="0.6" />
      </g>
    </Base>
  );
}

function IconFourierSeries() {
  return (
    <Base>
      {/* 旋转圆叠加 → 合成波 */}
      <circle cx="18" cy="32" r="12" stroke="currentColor" strokeWidth="0.8" opacity="0.35" fill="none" />
      <circle cx="30" cy="32" r="6" stroke="currentColor" strokeWidth="0.8" opacity="0.35" fill="none" />
      <g className="icon-motion" style={{ ...anim('orbit', 5), transformOrigin: '18px 32px' }}>
        <line x1="18" y1="32" x2="30" y2="32" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="30" cy="32" r="2" fill="currentColor" />
      </g>
      <g className="icon-motion" style={{ ...anim('orbit', 2.2, -1), transformOrigin: '30px 32px' }}>
        <line x1="30" y1="32" x2="36" y2="32" stroke="currentColor" strokeWidth="1" opacity="0.8" />
        <circle cx="36" cy="32" r="1.6" fill="currentColor" />
      </g>
      <path
        d="M40 32 C44 20, 48 20, 52 32 C56 44, 60 44, 64 32"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.85"
        transform="translate(-4 0)"
      />
    </Base>
  );
}

/* ---------------- P & NP ---------------- */

function IconTopologicalSort() {
  const nodes = [
    { x: 12, y: 18 },
    { x: 12, y: 46 },
    { x: 32, y: 32 },
    { x: 52, y: 18 },
    { x: 52, y: 46 },
  ];
  return (
    <Base>
      <g stroke="currentColor" strokeWidth="1.2" opacity="0.45" fill="none">
        <path d="M12 18L32 32M12 46L32 32M32 32L52 18M32 32L52 46" />
      </g>
      {nodes.map((n, i) => (
        <circle
          key={i}
          className={i === 2 ? 'icon-motion' : undefined}
          style={i === 2 ? anim('keyPulse', 2) : undefined}
          cx={n.x}
          cy={n.y}
          r={i === 2 ? 6 : 4.5}
          fill="currentColor"
        />
      ))}
    </Base>
  );
}

function IconMaxFlow() {
  return (
    <Base>
      <circle cx="13" cy="32" r="8" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle cx="51" cy="32" r="8" stroke="currentColor" strokeWidth="1.8" fill="none" />
      {/* 上路：流量沿边流动 */}
      <path
        d="M21 27 Q32 15 43 27"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeDasharray="5 4"
        className="icon-motion"
        style={anim('edgeFlow', 1.6, 0, 'linear')}
      />
      <path d="M21 37 Q32 49 43 37" stroke="currentColor" strokeWidth="1.8" fill="none" opacity="0.6" />
      <path d="M38 23 l6 3 -6 3z" fill="currentColor" />
      <path d="M38 41 l6 -3 -6 -3z" fill="currentColor" />
    </Base>
  );
}

function IconFactoring() {
  return (
    <Base>
      {/* 待分解的 n */}
      <rect x="19" y="8" width="26" height="17" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <text x="32" y="20.5" textAnchor="middle" fontSize="11" fontFamily="monospace" fill="currentColor">
        n
      </text>
      {/* 分裂成两个因子 */}
      <g stroke="currentColor" strokeWidth="1.2" opacity="0.5" fill="none">
        <path d="M32 25L19 36M32 25L45 36" />
      </g>
      <rect
        className="icon-motion"
        style={anim('keyPulse', 2)}
        x="7"
        y="36"
        width="24"
        height="15"
        rx="2"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect x="33" y="36" width="24" height="15" rx="2" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.4" />
      <text x="19" y="47" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="currentColor">
        p
      </text>
      <text x="45" y="47" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="currentColor">
        q
      </text>
    </Base>
  );
}

function IconSAT() {
  return (
    <Base>
      {/* 子句矩阵：每行一个子句，每格一个字面量 */}
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => (
          <rect
            key={`${row}-${col}`}
            className={row === 1 && col === 0 ? 'icon-motion' : undefined}
            style={row === 1 && col === 0 ? anim('keyPulse', 1.8) : undefined}
            x={12 + col * 15}
            y={12 + row * 14}
            width={11}
            height={10}
            rx={1.5}
            fill="currentColor"
            fillOpacity={row === 1 ? 0.75 : 0.18}
            stroke="currentColor"
            strokeWidth={1}
          />
        )),
      )}
      <path d="M9 9v46" stroke="currentColor" strokeWidth="1.4" opacity="0.4" />
    </Base>
  );
}

function IconSubsetSum() {
  return (
    <Base>
      {[0, 1, 2, 3].map((row) =>
        [0, 1, 2, 3].map((col) => {
          const active = (row + col) % 3 === 0;
          const isCursor = row === 1 && col === 2;
          return (
            <rect
              key={`${row}-${col}`}
              x={9 + col * 12}
              y={9 + row * 12}
              width={9}
              height={9}
              rx={1.5}
              fill="currentColor"
              fillOpacity={active ? 0.8 : 0.14}
              stroke="currentColor"
              strokeWidth={0.9}
              className={isCursor ? 'icon-motion' : undefined}
              style={isCursor ? anim('keyPulse', 1.8) : undefined}
            />
          );
        }),
      )}
    </Base>
  );
}

function IconHamiltonian() {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return { x: 32 + 21 * Math.cos(a), y: 32 + 21 * Math.sin(a) };
  });
  return (
    <Base>
      <polyline
        points={[...pts, pts[0]].map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeDasharray="4 3"
        opacity="0.7"
        className="icon-mst-probe"
        style={anim('mstProbe', 2.2, 0, 'linear')}
      />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4.6} fill="currentColor" opacity={i === 0 ? 1 : 0.55} />
      ))}
    </Base>
  );
}

function IconEulerian() {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return { x: 32 + 21 * Math.cos(a), y: 32 + 21 * Math.sin(a) };
  });
  return (
    <Base>
      <polygon
        points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.35"
      />
      <polyline
        points={[pts[0], pts[1], pts[2], pts[3], pts[4]]
          .map((p) => `${p.x},${p.y}`)
          .join(' ')}
        stroke="currentColor"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="6 5"
        className="icon-motion"
        style={anim('mstProbe', 1.8, 0, 'linear')}
      />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill="currentColor" opacity={i <= 4 ? 1 : 0.3} />
      ))}
    </Base>
  );
}

function IconVertexCover() {
  const nodes = [
    { x: 16, y: 16 },
    { x: 48, y: 16 },
    { x: 32, y: 33 },
    { x: 16, y: 50 },
    { x: 48, y: 50 },
  ];
  const edges: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 2],
    [2, 3],
    [2, 4],
    [3, 4],
  ];
  const picked = new Set([2, 3]);
  return (
    <Base>
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.45"
        />
      ))}
      {nodes.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={5}
          fill={picked.has(i) ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.8"
          opacity={picked.has(i) ? 0.9 : 0.55}
          className={i === 3 ? 'icon-motion' : undefined}
          style={i === 3 ? anim('keyPulse', 2) : undefined}
        />
      ))}
    </Base>
  );
}

function IconMaxClique() {
  const nodes = [
    { x: 32, y: 12 },
    { x: 52, y: 32 },
    { x: 32, y: 52 },
    { x: 12, y: 32 },
  ];
  return (
    <Base>
      {nodes.map((a, i) =>
        nodes.map((b, j) =>
          i < j ? (
            <line
              key={`${i}-${j}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="currentColor"
              strokeWidth="1.6"
              opacity="0.5"
              strokeDasharray="5 4"
              className="icon-motion"
              style={anim('edgeFlow', 1.8, i * 0.3, 'linear')}
            />
          ) : null,
        ),
      )}
      {nodes.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={5.5} fill="currentColor" opacity={0.9} />
      ))}
    </Base>
  );
}

function IconSetCover() {
  const rows = [0, 1, 2];
  return (
    <Base>
      {rows.map((r) =>
        [0, 1, 2, 3, 4].map((c) => {
          const on = (r + c) % 3 === 0 || (r === 1 && c < 3);
          const isScan = r === 1 && c === 2;
          return (
            <circle
              key={`${r}-${c}`}
              cx={12 + c * 10}
              cy={16 + r * 16}
              r={3.6}
              fill={on ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.2"
              opacity={on ? 0.9 : 0.35}
              className={isScan ? 'icon-motion' : undefined}
              style={isScan ? anim('keyPulse', 1.8) : undefined}
            />
          );
        }),
      )}
    </Base>
  );
}

function IconDLP() {
  const ring = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    return { x: 32 + 21 * Math.cos(a), y: 32 + 21 * Math.sin(a) };
  });
  return (
    <Base>
      <circle cx="32" cy="32" r="21" stroke="currentColor" strokeWidth="1.1" opacity="0.25" fill="none" />
      {ring.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === 0 || i === 5 ? 4.2 : 2.6}
          fill="currentColor"
          opacity={i === 0 || i === 5 ? 0.95 : 0.45}
        />
      ))}
      {/* 一次「跳跃」：g^k 直接落到 h */}
      <line
        x1={ring[0].x}
        y1={ring[0].y}
        x2={ring[5].x}
        y2={ring[5].y}
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.8"
        strokeDasharray="3 2"
        className="icon-motion"
        style={anim('edgeFlow', 1.4, 0, 'linear')}
      />
    </Base>
  );
}

function IconGraphColoring() {
  const points = Array.from({ length: 5 }, (_, i) => {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
    return { x: 32 + 21 * Math.cos(angle), y: 32 + 21 * Math.sin(angle) };
  });
  return (
    <Base>
      {points.map((p, i) => {
        const next = points[(i + 1) % 5];
        return <line key={i} x1={p.x} y1={p.y} x2={next.x} y2={next.y} stroke="currentColor" strokeWidth={1} opacity="0.35" />;
      })}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={5}
          fill="currentColor"
          fillOpacity={i % 2 === 0 ? 0.9 : 0.15}
          stroke="currentColor"
          strokeWidth={1.3}
          className={i === 1 ? 'icon-motion' : undefined}
          style={i === 1 ? anim('sudokuCycle', 2.1) : undefined}
        />
      ))}
    </Base>
  );
}

function IconBinPacking() {
  return (
    <Base>
      {[10, 26, 42].map((x, i) => (
        <rect
          key={x}
          x={x}
          y={i === 1 ? 20 : 28}
          width={12}
          height={i === 1 ? 30 : 22}
          rx={1.5}
          stroke="currentColor"
          strokeWidth="1.6"
          fill="currentColor"
          fillOpacity={i === 1 ? 0.55 : 0.15}
          className={i === 2 ? 'icon-motion' : undefined}
          style={i === 2 ? anim('knapsackDrop', 2.2) : undefined}
        />
      ))}
    </Base>
  );
}

function IconTSP() {
  const points: [number, number][] = [
    [12, 40],
    [20, 16],
    [44, 12],
    [54, 36],
    [38, 52],
    [18, 54],
  ];
  return (
    <Base>
      <polyline
        points={points.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
        opacity="0.75"
        strokeDasharray="6 5"
        className="icon-motion"
        style={anim('mstProbe', 2.4, 0, 'linear')}
      />
      <line x1={18} y1={54} x2={12} y2={40} stroke="currentColor" strokeWidth={1.2} strokeDasharray="3 3" opacity="0.5" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3.4} fill="currentColor" />
      ))}
    </Base>
  );
}

/* ---------------- P & NP（新增） ---------------- */

function IconMST() {
  // 5 点：中心 1 + 四角，生成树 4 条边 + 落选的 2 条交叉虚线
  const pts: [number, number][] = [
    [32, 10],
    [54, 26],
    [46, 52],
    [18, 52],
    [10, 26],
  ];
  const tree: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
  ];
  return (
    <Base>
      {/* 落选边：成环跳过 */}
      <line x1={pts[0][0]} y1={pts[0][1]} x2={pts[2][0]} y2={pts[2][1]} stroke="currentColor" strokeWidth={1} strokeDasharray="3 3" opacity={0.28} />
      <line x1={pts[4][0]} y1={pts[4][1]} x2={pts[1][0]} y2={pts[1][1]} stroke="currentColor" strokeWidth={1} strokeDasharray="3 3" opacity={0.28} />
      {tree.map(([a, b], i) => (
        <line
          key={i}
          x1={pts[a][0]}
          y1={pts[a][1]}
          x2={pts[b][0]}
          y2={pts[b][1]}
          stroke="currentColor"
          strokeWidth={2.1}
          opacity={0.85}
          className={i === 0 ? 'icon-mst-probe' : undefined}
          style={i === 0 ? anim('mstProbe', 1.6, 0, 'linear') : undefined}
        />
      ))}
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={4.2} fill="currentColor" opacity={i === 0 ? 1 : 0.6} />
      ))}
    </Base>
  );
}

function IconEditDistance() {
  // 4×4 DP 表 + 光标格游走
  return (
    <Base>
      {[0, 1, 2, 3].map((row) =>
        [0, 1, 2, 3].map((col) => {
          const isCursor = row === 1 && col === 2;
          return (
            <rect
              key={`${row}-${col}`}
              x={11 + col * 11}
              y={11 + row * 11}
              width={9}
              height={9}
              rx={1.5}
              fill="currentColor"
              fillOpacity={row + col <= 2 ? 0.75 : 0.14}
              stroke="currentColor"
              strokeWidth={0.9}
            />
          );
        }),
      )}
      <rect
        x={33}
        y={22}
        width={9}
        height={9}
        rx={1.5}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        className="icon-motion"
        style={anim('edCursor', 2.4, 0, 'ease-in-out')}
      />
    </Base>
  );
}

function IconKnapsack() {
  // 背包轮廓 + 物品滑入
  return (
    <Base>
      <path
        d="M20 24 v-6 a4 4 0 0 1 4-4 h16 a4 4 0 0 1 4 4 v6"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        opacity={0.55}
      />
      <rect x={16} y={24} width={32} height={28} rx={4} fill="currentColor" fillOpacity={0.1} stroke="currentColor" strokeWidth={2} opacity={0.8} />
      <rect x={12} y={38} width={13} height={9} rx={1.5} fill="currentColor" fillOpacity={0.75} className="icon-motion" style={anim('knapsackDrop', 2.2)} />
      <rect x={40} y={30} width={13} height={9} rx={1.5} fill="currentColor" fillOpacity={0.35} className="icon-motion" style={anim('knapsackDrop', 2.2, 1.1)} />
    </Base>
  );
}

function IconSudoku() {
  // 3×3 宫格 + 中央候选数字轮换
  return (
    <Base>
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={11 + col * 15}
            y={11 + row * 15}
            width={13}
            height={13}
            rx={1.5}
            fill="currentColor"
            fillOpacity={(row * 3 + col) % 5 === 0 ? 0.5 : 0.12}
            stroke="currentColor"
            strokeWidth={0.9}
          />
        )),
      )}
      <text
        x={32.5}
        y={37}
        textAnchor="middle"
        fontSize={11}
        fontFamily="monospace"
        fontWeight={700}
        fill="currentColor"
        className="icon-motion"
        style={anim('sudokuCycle', 2.1)}
      >
        7
      </text>
    </Base>
  );
}

function IconShortestPath() {
  // 5 点加权图 + 源点到目标的最短路高亮流动
  const pts: [number, number][] = [
    [10, 44],
    [26, 16],
    [44, 40],
    [54, 14],
    [50, 52],
  ];
  return (
    <Base>
      {/* 非最短路 */}
      <line x1={26} y1={16} x2={54} y2={14} stroke="currentColor" strokeWidth={1.1} strokeDasharray="3 3" opacity={0.3} />
      <line x1={10} y1={44} x2={50} y2={52} stroke="currentColor" strokeWidth={1.1} strokeDasharray="3 3" opacity={0.3} />
      <line x1={44} y1={40} x2={50} y2={52} stroke="currentColor" strokeWidth={1.1} opacity={0.3} />
      {/* 最短路径 0→1→2 */}
      <polyline
        points={`${pts[0][0]},${pts[0][1]} ${pts[1][0]},${pts[1][1]} ${pts[2][0]},${pts[2][1]}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        opacity={0.9}
        className="icon-mst-probe"
        style={anim('mstProbe', 1.8, 0, 'linear')}
      />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={4.4} fill="currentColor" opacity={i === 0 ? 1 : i === 2 ? 0.9 : 0.55} />
      ))}
      {/* 距离标注 */}
      <text x={7} y={38} fontSize={7} fontFamily="monospace" fill="currentColor" opacity={0.8}>0</text>
      <text x={46} y={46} fontSize={7} fontFamily="monospace" fill="currentColor" opacity={0.8}>3</text>
    </Base>
  );
}

function IconConvexHull() {
  // 点云 + 包围多边形（沿周长流动的描边）
  const pts: [number, number][] = [
    [14, 40],
    [22, 16],
    [40, 10],
    [52, 24],
    [48, 48],
    [26, 50],
    [32, 30],
    [38, 26],
  ];
  const hull: [number, number][] = [
    [14, 40],
    [22, 16],
    [40, 10],
    [52, 24],
    [48, 48],
    [26, 50],
  ];
  return (
    <Base>
      <polygon
        points={hull.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="currentColor"
        fillOpacity={0.08}
        stroke="none"
      />
      <polygon
        points={hull.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinejoin="round"
        opacity={0.9}
        className="icon-mst-probe"
        style={anim('mstProbe', 2.4, 0, 'linear')}
      />
      {pts.map(([x, y], i) => {
        const onHull = hull.some(([hx, hy]) => hx === x && hy === y);
        return <circle key={i} cx={x} cy={y} r={onHull ? 3.4 : 2.4} fill="currentColor" opacity={onHull ? 0.95 : 0.4} />;
      })}
    </Base>
  );
}

function IconGraphIso() {
  // 左右两张小图,配对点用同色实心表示
  const left: [number, number][] = [
    [12, 18],
    [12, 42],
    [28, 30],
  ];
  const right: [number, number][] = [
    [50, 16],
    [46, 46],
    [36, 30],
  ];
  return (
    <Base>
      {/* G1: 三角 */}
      <polygon
        points={left.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.3}
        opacity={0.45}
      />
      {/* G2: 同构三角(旋转) */}
      <polygon
        points={right.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.3}
        opacity={0.45}
      />
      {/* 映射虚线 */}
      <line x1={left[0][0]} y1={left[0][1]} x2={right[0][0]} y2={right[0][1]} stroke="currentColor" strokeWidth={0.9} strokeDasharray="2 3" opacity={0.75} className="icon-motion" style={anim('edgeFlow', 1.6, 0, 'linear')} />
      <line x1={left[1][0]} y1={left[1][1]} x2={right[1][0]} y2={right[1][1]} stroke="currentColor" strokeWidth={0.9} strokeDasharray="2 3" opacity={0.75} className="icon-motion" style={anim('edgeFlow', 1.6, 0.5, 'linear')} />
      <line x1={left[2][0]} y1={left[2][1]} x2={right[2][0]} y2={right[2][1]} stroke="currentColor" strokeWidth={0.9} strokeDasharray="2 3" opacity={0.75} className="icon-motion" style={anim('edgeFlow', 1.6, 1, 'linear')} />
      {left.map(([x, y], i) => (
        <circle key={`l${i}`} cx={x} cy={y} r={3.6} fill="currentColor" opacity={i === 0 ? 1 : 0.6} />
      ))}
      {right.map(([x, y], i) => (
        <circle key={`r${i}`} cx={x} cy={y} r={3.6} fill="currentColor" opacity={i === 0 ? 1 : 0.6} />
      ))}
    </Base>
  );
}

function IconMaxIndependentSet() {
  // 5 点图:独立集 3 点实心,其余空心,独立集内部的"无边"用间隔表示
  const pts: [number, number][] = [
    [32, 10],
    [54, 28],
    [44, 54],
    [20, 54],
    [10, 28],
  ];
  const independent = [0, 2, 4];
  const edges: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 0],
    [1, 3],
  ];
  return (
    <Base>
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={pts[a][0]}
          y1={pts[a][1]}
          x2={pts[b][0]}
          y2={pts[b][1]}
          stroke="currentColor"
          strokeWidth={1.1}
          opacity={0.3}
        />
      ))}
      {pts.map(([x, y], i) => {
        const chosen = independent.includes(i);
        return chosen ? (
          <circle key={i} cx={x} cy={y} r={5} fill="currentColor" className={i === 0 ? 'icon-motion' : undefined} style={i === 0 ? anim('keyPulse', 2) : undefined} />
        ) : (
          <circle key={i} cx={x} cy={y} r={4.2} fill="none" stroke="currentColor" strokeWidth={1.4} opacity={0.45} />
        );
      })}
    </Base>
  );
}

function IconQR() {
  // 平方表网格:部分格子点亮(QR 值),目标格脉冲
  const lit = [1, 4, 9, 16, 6, 13];
  return (
    <Base>
      {[0, 1, 2, 3].map((row) =>
        [0, 1, 2, 3].map((col) => {
          const idx = row * 4 + col + 1;
          const isLit = lit.includes(idx);
          const isTarget = idx === 16;
          return (
            <rect
              key={`${row}-${col}`}
              x={11 + col * 11}
              y={11 + row * 11}
              width={9.5}
              height={9.5}
              rx={1.5}
              fill="currentColor"
              fillOpacity={isTarget ? 0.75 : isLit ? 0.45 : 0.1}
              stroke="currentColor"
              strokeWidth={0.7}
              strokeOpacity={isTarget ? 0.9 : 0.3}
              className={isTarget ? 'icon-motion' : undefined}
              style={isTarget ? anim('keyPulse', 2.2) : undefined}
            />
          );
        }),
      )}
    </Base>
  );
}

function IconSVP() {
  // 斜向网格(格点)+ 一条最短向量高亮
  const origin: [number, number] = [16, 48];
  const b1: [number, number] = [11, -6];
  const b2: [number, number] = [7, 10];
  const pt = (i: number, j: number): [number, number] => [
    origin[0] + b1[0] * i + b2[0] * j,
    origin[1] + b1[1] * i + b2[1] * j,
  ];
  return (
    <Base>
      {[0, 1, 2, 3].map((j) =>
        [0, 1, 2, 3].map((i) => {
          const [x, y] = pt(i, j);
          if (x < 6 || x > 58 || y < 6 || y > 58) return null;
          return <circle key={`${i}-${j}`} cx={x} cy={y} r={2} fill="currentColor" opacity={0.4} />;
        }),
      )}
      <line x1={origin[0]} y1={origin[1]} x2={origin[0] + b1[0]} y2={origin[1] + b1[1]} stroke="currentColor" strokeWidth={1} opacity={0.35} />
      <line x1={origin[0]} y1={origin[1]} x2={origin[0] + b2[0]} y2={origin[1] + b2[1]} stroke="currentColor" strokeWidth={1} opacity={0.35} />
      <line
        x1={origin[0]}
        y1={origin[1]}
        x2={origin[0] + b1[0] + b2[0]}
        y2={origin[1] + b1[1] + b2[1]}
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        className="icon-motion"
        style={anim('keyPulse', 2)}
      />
      <circle cx={origin[0]} cy={origin[1]} r={3.4} fill="currentColor" />
      <circle cx={origin[0] + b1[0] + b2[0]} cy={origin[1] + b1[1] + b2[1]} r={3.4} fill="currentColor" />
    </Base>
  );
}

function IconSteinerTree() {
  // 三个终端方块 + 汇聚到中心斯坦纳点的连接树
  const terminals: [number, number][] = [
    [13, 14],
    [51, 18],
    [32, 52],
  ];
  const center: [number, number] = [32, 28];
  return (
    <Base>
      {terminals.map(([x, y], i) => (
        <line
          key={i}
          x1={center[0]}
          y1={center[1]}
          x2={x}
          y2={y}
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          opacity={0.85}
          strokeDasharray="46"
          className="icon-motion"
          style={anim('mstProbe', 2, i * 0.4, 'linear')}
        />
      ))}
      <circle cx={center[0]} cy={center[1]} r={3.6} fill="currentColor" opacity={0.7} />
      {terminals.map(([x, y], i) => (
        <rect key={`t${i}`} x={x - 4} y={y - 4} width={8} height={8} rx={1.5} fill="currentColor" />
      ))}
    </Base>
  );
}

function IconJobScheduling() {
  // 迷你甘特图:3 台机器条 + 作业块
  const machines = 3;
  const blocks: [number, number, number][] = [
    [0, 0, 10],
    [0, 10, 9],
    [1, 0, 8],
    [1, 8, 8],
    [1, 16, 5],
    [2, 0, 7],
    [2, 7, 6],
  ];
  return (
    <Base>
      {Array.from({ length: machines }, (_, m) => (
        <rect
          key={`row${m}`}
          x={10}
          y={13 + m * 14}
          width={44}
          height={11}
          rx={1.5}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.9}
          opacity={0.35}
        />
      ))}
      {blocks.map(([m, off, len], i) => (
        <rect
          key={i}
          x={10 + off}
          y={14.5 + m * 14}
          width={len}
          height={8}
          rx={1}
          fill="currentColor"
          fillOpacity={0.5 + 0.3 * ((i % 3) / 2)}
          className={i === blocks.length - 1 ? 'icon-motion' : undefined}
          style={i === blocks.length - 1 ? anim('edCursor', 2.2) : undefined}
        />
      ))}
    </Base>
  );
}

function IconLongestPath() {
  // 图 + 一条蜿蜒长路径(与最短路径图标形成对照:路径更长更绕)
  const pts: [number, number][] = [
    [12, 46],
    [24, 14],
    [40, 44],
    [46, 12],
    [54, 40],
  ];
  return (
    <Base>
      <line x1={12} y1={46} x2={40} y2={44} stroke="currentColor" strokeWidth={1.1} strokeDasharray="3 3" opacity={0.3} />
      <line x1={24} y1={14} x2={54} y2={40} stroke="currentColor" strokeWidth={1.1} strokeDasharray="3 3" opacity={0.3} />
      {/* 蜿蜒长路径 0→1→2→3→4 */}
      <polyline
        points={pts.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        opacity={0.9}
        className="icon-mst-probe"
        style={anim('mstProbe', 2.2, 0, 'linear')}
      />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={4.2} fill="currentColor" opacity={0.95} />
      ))}
    </Base>
  );
}

function IconClosestPair() {
  // 点云 + 两点间最短连线脉冲
  const pts: [number, number][] = [
    [14, 16],
    [30, 26],
    [48, 14],
    [20, 44],
    [36, 50],
    [52, 40],
    [33, 32],
    [34, 38],
  ];
  return (
    <Base>
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 6 || i === 7 ? 4.4 : 3} fill="currentColor" opacity={i === 6 || i === 7 ? 1 : 0.4} />
      ))}
      <line x1={33} y1={32} x2={34} y2={38} stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" className="icon-motion" style={anim('keyPulse', 1.8)} />
    </Base>
  );
}

function IconCoinChange() {
  // 递减高度的硬币柱(DP 条形图缩影) + 目标金额标记
  const bars = [5, 8, 11, 14, 17];
  return (
    <Base>
      {bars.map((h, i) => (
        <rect
          key={i}
          x={11 + i * 9}
          y={50 - h}
          width={7}
          height={h}
          rx={1.5}
          fill="currentColor"
          fillOpacity={0.3 + 0.14 * i}
          className={i === bars.length - 1 ? 'icon-motion' : undefined}
          style={i === bars.length - 1 ? anim('edCursor', 2) : undefined}
        />
      ))}
      <line x1={9} y1={50} x2={57} y2={50} stroke="currentColor" strokeWidth={1.4} opacity={0.7} />
    </Base>
  );
}

function IconBitonicTSP() {
  // 双链:上链蓝调实线、下链虚线,在两端闭合(简化为单色)
  const upper = [
    [10, 34],
    [22, 18],
    [38, 12],
    [54, 20],
  ];
  const lower = [
    [10, 34],
    [24, 46],
    [42, 48],
    [54, 20],
  ];
  return (
    <Base>
      <polyline
        points={upper.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        opacity={0.9}
        className="icon-mst-probe"
        style={anim('mstProbe', 2.2, 0, 'linear')}
      />
      <polyline
        points={lower.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeDasharray="4 3"
        opacity={0.5}
      />
      {upper.map(([x, y], i) => (
        <circle key={`u${i}`} cx={x} cy={y} r={3.4} fill="currentColor" opacity={0.95} />
      ))}
      {lower.slice(1, 3).map(([x, y], i) => (
        <circle key={`l${i}`} cx={x} cy={y} r={3} fill="currentColor" opacity={0.55} />
      ))}
    </Base>
  );
}

const ICONS: Record<ProjectIconId, () => React.ReactElement> = {
  Game2048: Icon2048,
  Snake: IconSnake,
  DanmakuDodge: IconDanmakuDodge,
  RubiksCube: IconRubiksCube,
  GameOfLife: IconGameOfLife,
  LangtonsAnt: IconLangtonsAnt,
  ParticleLife: IconParticleLife,
  PendulumSim: IconPendulumSim,
  TuringMachine: IconTuringMachine,
  TuringMachine2D: IconTuringMachine2D,
  PowSim: IconPowSim,
  TSPAntColony: IconTSPAntColony,
  SortingVisualizer: IconSortingVisualizer,
  CryptoVisualizer: IconCryptoVisualizer,
  Mandelbrot: IconMandelbrot,
  DigitSumTurtle: IconDigitSumTurtle,
  Collatz: IconCollatz,
  BaseConverter: IconBaseConverter,
  Brainfuck: IconBrainfuck,
  NBody: IconNBody,
  BrownianMotion: IconBrownianMotion,
  Pathfinding: IconPathfinding,
  HuffmanTree: IconHuffmanTree,
  Lissajous: IconLissajous,
  FourierSeries: IconFourierSeries,
  Boids: IconBoids,
  MontyHall: IconMontyHall,
  TopologicalSort: IconTopologicalSort,
  MaxFlow: IconMaxFlow,
  ShortestPath: IconShortestPath,
  ConvexHull: IconConvexHull,
  Eulerian: IconEulerian,
  MST: IconMST,
  EditDistance: IconEditDistance,
  Factoring: IconFactoring,
  DLP: IconDLP,
  GraphIso: IconGraphIso,
  SAT: IconSAT,
  SubsetSum: IconSubsetSum,
  Knapsack: IconKnapsack,
  Sudoku: IconSudoku,
  Hamiltonian: IconHamiltonian,
  VertexCover: IconVertexCover,
  MaxIndependentSet: IconMaxIndependentSet,
  MaxClique: IconMaxClique,
  QR: IconQR,
  SVP: IconSVP,
  SteinerTree: IconSteinerTree,
  JobScheduling: IconJobScheduling,
  LongestPath: IconLongestPath,
  ClosestPair: IconClosestPair,
  CoinChange: IconCoinChange,
  BitonicTSP: IconBitonicTSP,
  SetCover: IconSetCover,
  GraphColoring: IconGraphColoring,
  BinPacking: IconBinPacking,
  TSP: IconTSP,
};

/** 鸟群：三只小鸟呈编队飞行，队形轻微摆动 */
function IconBoids() {
  const bird = (x: number, y: number, s: number, o: number) => (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>
      <path d="M5 0 L-4 3.2 L-2 0 L-4 -3.2 Z" fill="currentColor" />
    </g>
  );
  return (
    <Base>
      {/* 飞行轨迹虚线 */}
      <path d="M10 42 C20 34, 30 40, 42 30" stroke="currentColor" strokeWidth="0.8" opacity="0.25" fill="none" strokeDasharray="2 3" />
      <g className="icon-motion" style={anim('boidsWave', 2.6, 0, 'ease-in-out')}>
        {bird(30, 26, 1.25, 1)}
        {bird(20, 33, 1, 0.8)}
        {bird(22, 20, 1, 0.8)}
      </g>
      <g className="icon-motion" style={anim('boidsWave', 2.6, -0.6, 'ease-in-out')}>
        {bird(42, 31, 0.85, 0.6)}
      </g>
    </Base>
  );
}

/** 三门问题：三扇门，中间那扇缓缓打开露出山羊 */
function IconMontyHall() {
  return (
    <Base>
      {/* 三扇门 */}
      {[10, 27, 44].map((x, i) => (
        <g key={x}>
          <rect
            x={x}
            y={16}
            width={12}
            height={32}
            rx={1.5}
            stroke="currentColor"
            strokeWidth={i === 1 ? 2.4 : 1.6}
            fill={i === 1 ? 'currentColor' : 'none'}
            fillOpacity={i === 1 ? 0.12 : 0}
            className={i === 1 ? 'icon-motion' : undefined}
            style={i === 1 ? anim('doorOpen', 2.4) : undefined}
          />
          <circle cx={x + 9.5} cy={32} r={1} fill="currentColor" opacity={i === 1 ? 0 : 0.7} />
        </g>
      ))}
      {/* 中门后的山羊（简笔：角 + 头） */}
      <g className="icon-motion" style={anim('keyPulse', 2.4, 1.2)}>
        <path d="M28 44 l3 -5 3 5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <circle cx="31" cy="46.5" r="2.2" fill="currentColor" />
      </g>
    </Base>
  );
}

export default function ProjectIcon({ id, className }: { id: string; className?: string }) {
  const Icon = ICONS[id as ProjectIconId];
  return (
    <span
      className={`inline-flex items-center justify-center ${className ?? ''}`}
      style={{ color: 'var(--primary)' }}
    >
      {Icon ? <Icon /> : null}
    </span>
  );
}
