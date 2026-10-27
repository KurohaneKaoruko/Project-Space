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
  | 'Brainfuck'
  | 'NBody'
  | 'BrownianMotion'
  | 'Pathfinding'
  | 'HuffmanTree'
  | 'Lissajous'
  | 'FourierSeries'
  | 'Boids';

/** 长写动画参数：name + duration，可选 delay / timing */
function anim(name: string, dur: number, delay = 0, timing?: string) {
  return {
    animationName: name,
    animationDuration: `${dur}s`,
    ...(delay ? { animationDelay: `${delay}s` } : {}),
    ...(timing ? { animationTimingFunction: timing } : {}),
  };
}

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
  Brainfuck: IconBrainfuck,
  NBody: IconNBody,
  BrownianMotion: IconBrownianMotion,
  Pathfinding: IconPathfinding,
  HuffmanTree: IconHuffmanTree,
  Lissajous: IconLissajous,
  FourierSeries: IconFourierSeries,
  Boids: IconBoids,
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
