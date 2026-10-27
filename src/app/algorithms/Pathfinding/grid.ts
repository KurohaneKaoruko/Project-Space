/**
 * 寻路可视化引擎：A* / Dijkstra / BFS / Greedy BFS 四种算法共用一套网格。
 * openSet 用简单数组（网格规模小，O(n) 提取最小值足够快）。
 */
export type AlgoKey = 'astar' | 'dijkstra' | 'bfs' | 'greedy';

export const ALGO_LABELS: Record<AlgoKey, string> = {
  astar: 'A*',
  dijkstra: 'Dijkstra',
  bfs: 'BFS',
  greedy: 'Greedy BFS',
};

export interface Cell {
  wall: boolean;
  /** 访问顺序号（-1 = 未访问），用于着色渐变 */
  order: number;
  /** 是否在最短路径上 */
  onPath: boolean;
}

export interface PathResult {
  found: boolean;
  path: [number, number][];
  visitedCount: number;
  pathCost: number;
}

export class PathfindingGrid {
  cols: number;
  rows: number;
  cells: Cell[];
  start: [number, number];
  goal: [number, number];

  constructor(cols = 46, rows = 28) {
    this.cols = cols;
    this.rows = rows;
    this.cells = Array.from({ length: cols * rows }, () => ({ wall: false, order: -1, onPath: false }));
    this.start = [2, Math.floor(rows / 2)];
    this.goal = [cols - 3, Math.floor(rows / 2)];
  }

  idx(x: number, y: number) {
    return y * this.cols + x;
  }

  inside(x: number, y: number) {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
  }

  get(x: number, y: number): Cell | null {
    return this.inside(x, y) ? this.cells[this.idx(x, y)] : null;
  }

  toggleWall(x: number, y: number) {
    const c = this.get(x, y);
    if (!c) return;
    if (this.isStart(x, y) || this.isGoal(x, y)) return;
    c.wall = !c.wall;
  }

  isStart(x: number, y: number) {
    return this.start[0] === x && this.start[1] === y;
  }

  isGoal(x: number, y: number) {
    return this.goal[0] === x && this.goal[1] === y;
  }

  setStart(x: number, y: number) {
    if (this.inside(x, y) && !this.isGoal(x, y)) {
      this.start = [x, y];
      const c = this.get(x, y);
      if (c) c.wall = false;
    }
  }

  setGoal(x: number, y: number) {
    if (this.inside(x, y) && !this.isStart(x, y)) {
      this.goal = [x, y];
      const c = this.get(x, y);
      if (c) c.wall = false;
    }
  }

  clearWalls() {
    for (const c of this.cells) c.wall = false;
  }

  resetSearch() {
    for (const c of this.cells) {
      c.order = -1;
      c.onPath = false;
    }
  }

  /** 随机迷宫（递归回溯生成，保证连通） */
  maze() {
    this.clearWalls();
    // 全部填墙，再挖通道
    for (const c of this.cells) c.wall = true;
    const stack: [number, number][] = [];
    const startCell: [number, number] = [0, 0];
    const at = (x: number, y: number) => this.cells[this.idx(x, y)];
    at(startCell[0], startCell[1]).wall = false;
    stack.push(startCell);
    const dirs: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    while (stack.length > 0) {
      const [cx, cy] = stack[stack.length - 1];
      const candidates: [number, number][] = [];
      for (const [dx, dy] of dirs) {
        const nx = cx + dx * 2;
        const ny = cy + dy * 2;
        if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows && at(nx, ny).wall) {
          candidates.push([dx, dy]);
        }
      }
      if (candidates.length === 0) {
        stack.pop();
        continue;
      }
      const [dx, dy] = candidates[Math.floor(Math.random() * candidates.length)];
      const mx = cx + dx;
      const my = cy + dy;
      const nx = cx + dx * 2;
      const ny = cy + dy * 2;
      at(mx, my).wall = false;
      at(nx, ny).wall = false;
      stack.push([nx, ny]);
    }
    // 随机打通少量墙，让迷宫多解、更有看头
    let extra = Math.floor(this.cols * this.rows * 0.06);
    while (extra > 0) {
      const x = Math.floor(Math.random() * this.cols);
      const y = Math.floor(Math.random() * this.rows);
      const c = at(x, y);
      if (c.wall) {
        c.wall = false;
        extra -= 1;
      }
    }
    this.start = [0, 0];
    // 终点：从起点洪泛，取可达格中 x+y 最大者（保证连通且路径足够长）
    {
      const seen = new Set<number>([this.idx(0, 0)]);
      const stack: number[] = [this.idx(0, 0)];
      let best = this.idx(0, 0);
      let bestScore = -1;
      while (stack.length > 0) {
        const cur = stack.pop()!;
        const cx = cur % this.cols;
        const cy = Math.floor(cur / this.cols);
        const score = cx + cy;
        if (score > bestScore) {
          bestScore = score;
          best = cur;
        }
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as [number, number][]) {
          if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) continue;
          const ni = this.idx(nx, ny);
          if (seen.has(ni) || at(nx, ny).wall) continue;
          seen.add(ni);
          stack.push(ni);
        }
      }
      this.goal = [best % this.cols, Math.floor(best / this.cols)];
    }
    this.resetSearch();
  }

  /**
   * 运行搜索（一次性算完，返回完整结果；页面据此逐帧回放）。
   * @param weight 启发权重 h×weight；weight=0 退化为 Dijkstra
   */
  search(algo: AlgoKey, weight = 1): PathResult {
    this.resetSearch();
    const [sx, sy] = this.start;
    const [gx, gy] = this.goal;
    const n = this.cells.length;
    const gScore = new Float64Array(n).fill(Infinity);
    const parent = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const inOpen = new Uint8Array(n);
    const sIdx = this.idx(sx, sy);
    const gIdx = this.idx(gx, gy);
    const h = (i: number) => {
      const x = i % this.cols;
      const y = Math.floor(i / this.cols);
      return (Math.abs(x - gx) + Math.abs(y - gy)) * weight;
    };
    gScore[sIdx] = 0;
    const open: number[] = [sIdx];
    inOpen[sIdx] = 1;
    let order = 0;
    let found = false;

    while (open.length > 0) {
      // 取 f 最小（bfs 用队列语义：取 g 最小即先进先出）
      let best = 0;
      let bestF = Infinity;
      for (let k = 0; k < open.length; k += 1) {
        const i = open[k];
        // bfs/dijkstra 用纯 g；greedy 用纯 h；astar 用 g+h（weight=0 即退化为 Dijkstra）
        const f = algo === 'bfs' || algo === 'dijkstra' ? gScore[i] : algo === 'greedy' ? h(i) : gScore[i] + h(i);
        if (f < bestF) {
          bestF = f;
          best = k;
        }
      }
      const cur = open[best];
      open[best] = open[open.length - 1];
      open.pop();
      inOpen[cur] = 0;
      if (closed[cur]) continue;
      closed[cur] = 1;
      order += 1;
      this.cells[cur].order = order;
      if (cur === gIdx) {
        found = true;
        break;
      }
      const cx = cur % this.cols;
      const cy = Math.floor(cur / this.cols);
      // 4 邻域
      const neighbors: [number, number][] = [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ];
      for (const [nx, ny] of neighbors) {
        const nc = this.get(nx, ny);
        if (!nc || nc.wall || closed[this.idx(nx, ny)]) continue;
        const ni = this.idx(nx, ny);
        const tentative = gScore[cur] + 1;
        if (tentative < gScore[ni]) {
          gScore[ni] = tentative;
          parent[ni] = cur;
          if (!inOpen[ni]) {
            open.push(ni);
            inOpen[ni] = 1;
          }
        }
      }
    }

    const path: [number, number][] = [];
    let pathCost = 0;
    if (found) {
      let cur = gIdx;
      while (cur !== -1) {
        path.push([cur % this.cols, Math.floor(cur / this.cols)]);
        this.cells[cur].onPath = true;
        if (cur === sIdx) break;
        cur = parent[cur];
      }
      path.reverse();
      pathCost = gScore[gIdx];
    }
    return { found, path, visitedCount: order, pathCost };
  }
}
