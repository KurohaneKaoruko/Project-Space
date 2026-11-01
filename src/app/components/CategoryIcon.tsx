import { anim } from './iconAnim';
import type { CategoryKey } from '../data/projects';

/**
 * 分类图标：首页分类索引使用的大型内联 SVG（64 单位画布）。
 * 与 ProjectIcon 共用 .icon-motion 机制 —— 默认 paused，父级 .group:hover 时运行，
 * 因此静态浏览时零 CPU 消耗；keyframes 统一定义在 globals.css。
 */

const S = 64;

function Base({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${S} ${S}`} fill="none" aria-hidden="true" className="h-full w-full">
      {children}
    </svg>
  );
}

/* ---------------- GAMES：手柄 ---------------- */
function IconGames() {
  return (
    <Base>
      {/* 机身 */}
      <rect x="3" y="16" width="58" height="32" rx="16" stroke="currentColor" strokeWidth="1.8" />
      {/* 十字键 */}
      <path
        d="M12.5 32h13M19 25.5v13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="square"
      />
      {/* 功能键：hover 时交替闪烁 */}
      <circle
        className="icon-motion"
        style={anim('keyPulse', 1.6)}
        cx="44.5"
        cy="28.5"
        r="3.2"
        fill="currentColor"
      />
      <circle
        className="icon-motion"
        style={anim('keyPulse', 1.6, 0.4)}
        cx="51.5"
        cy="35.5"
        r="3.2"
        fill="currentColor"
      />
      {/* 中缝的 start / select */}
      <rect x="30" y="30.5" width="3.4" height="2.2" fill="currentColor" opacity="0.3" />
      <rect x="35" y="30.5" width="3.4" height="2.2" fill="currentColor" opacity="0.3" />
    </Base>
  );
}

/* ---------------- SIMULATIONS：原子轨道 ---------------- */
function IconSimulations() {
  return (
    <Base>
      {/* 三条轨道 + 电子整体缓慢公转 */}
      <g
        className="icon-motion"
        style={{ ...anim('orbit', 16), transformOrigin: '32px 32px' }}
      >
        <g stroke="currentColor" strokeWidth="1.4" opacity="0.7">
          <ellipse cx="32" cy="32" rx="25" ry="9" />
          <ellipse cx="32" cy="32" rx="25" ry="9" transform="rotate(60 32 32)" />
          <ellipse cx="32" cy="32" rx="25" ry="9" transform="rotate(120 32 32)" />
        </g>
        <circle cx="57" cy="32" r="2.6" fill="currentColor" />
        <circle cx="19.5" cy="10.4" r="2.6" fill="currentColor" opacity="0.85" />
        <circle cx="44.5" cy="10.4" r="2.6" fill="currentColor" opacity="0.85" />
      </g>
      {/* 原子核 */}
      <circle
        className="icon-motion"
        style={anim('cellBreathe', 2)}
        cx="32"
        cy="32"
        r="5.5"
        fill="currentColor"
      />
    </Base>
  );
}

/* ---------------- ALGORITHMS：节点图 + 流动边 ---------------- */
function IconAlgorithms() {
  return (
    <Base>
      {/* 边：虚线沿路径流动，暗示遍历 / 松弛 */}
      <path
        className="cat-edge icon-motion"
        style={anim('edgeFlow', 1.8)}
        d="M32 11L16 31M32 11L48 31M16 31L10 51M16 31L26 51M48 31L38 51M48 31L54 51"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.75"
        strokeLinecap="square"
      />
      {/* 节点 */}
      <circle cx="32" cy="11" r="4.6" fill="currentColor" />
      <circle cx="16" cy="31" r="3.6" fill="currentColor" opacity="0.75" />
      <circle cx="48" cy="31" r="3.6" fill="currentColor" opacity="0.75" />
      {[10, 26, 38, 54].map((x, i) => (
        <circle
          key={x}
          className="icon-motion"
          style={anim('keyPulse', 1.8, i * 0.3)}
          cx={x}
          cy="51"
          r="3"
          fill="currentColor"
          opacity="0.6"
        />
      ))}
    </Base>
  );
}

/* ---------------- VISUALIZATIONS：分形嵌套方框 ---------------- */
function IconVisualizations() {
  return (
    <Base>
      {/* 外层基准框 */}
      <rect x="8" y="8" width="48" height="48" stroke="currentColor" strokeWidth="1.6" opacity="0.9" />
      {/* 中层：顺时针自转 */}
      <g className="icon-motion" style={{ ...anim('orbit', 18), transformOrigin: '32px 32px' }}>
        <rect
          x="15"
          y="15"
          width="34"
          height="34"
          transform="rotate(45 32 32)"
          stroke="currentColor"
          strokeWidth="1.3"
          opacity="0.55"
        />
      </g>
      {/* 内层：逆时针自转，形成层层递进的缩放感 */}
      <g
        className="icon-motion"
        style={{
          ...anim('orbit', 11),
          transformOrigin: '32px 32px',
          animationDirection: 'reverse',
        }}
      >
        <rect
          x="22"
          y="22"
          width="20"
          height="20"
          transform="rotate(22.5 32 32)"
          stroke="currentColor"
          strokeWidth="1.3"
          opacity="0.8"
        />
      </g>
      <circle cx="32" cy="32" r="2.8" fill="currentColor" />
    </Base>
  );
}

/* ---------------- TOOLS：齿轮 ---------------- */
function IconTools() {
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Base>
      <g className="icon-motion" style={{ ...anim('orbit', 9), transformOrigin: '32px 32px' }}>
        {teeth.map((a) => (
          <rect
            key={a}
            x="29.5"
            y="6"
            width="5"
            height="8"
            fill="currentColor"
            transform={`rotate(${a} 32 32)`}
          />
        ))}
        <circle cx="32" cy="32" r="18" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="32" cy="32" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      </g>
    </Base>
  );
}

/* ---------------- P & NP：集合包含关系 ---------------- */
function IconComplexity() {
  return (
    <Base>
      {/* 外层集合 NP */}
      <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="1.8" opacity="0.7" />
      {/* 内层集合 P ⊂ NP */}
      <circle
        className="icon-motion"
        style={anim('cellBreathe', 2.6)}
        cx="27"
        cy="32"
        r="12"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="27" cy="32" r="3" fill="currentColor" />
      {/* 环带上的零散元素 */}
      <circle cx="48" cy="22" r="2.2" fill="currentColor" opacity="0.45" />
      <circle cx="50" cy="41" r="2.2" fill="currentColor" opacity="0.45" />
      <circle cx="41" cy="51" r="2.2" fill="currentColor" opacity="0.45" />
    </Base>
  );
}

const ICONS: Record<CategoryKey, () => React.ReactElement> = {
  games: IconGames,
  simulations: IconSimulations,
  algorithms: IconAlgorithms,
  visualizations: IconVisualizations,
  tools: IconTools,
  complexity: IconComplexity,
};

export default function CategoryIcon({ id, className }: { id: CategoryKey; className?: string }) {
  const Icon = ICONS[id];
  return <span className={`inline-flex items-center justify-center ${className ?? ''}`}>{Icon ? <Icon /> : null}</span>;
}
