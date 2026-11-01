export class GameOfLife {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number = 0;
  private height: number = 0;
  private cols: number = 0;
  private rows: number = 0;
  private cellSize: number = 5;
  
  private grid: Uint8Array;
  private nextGrid: Uint8Array;
  
  private isRunning: boolean = false;
  private animationId: number = 0;
  private lastFrameTime: number = 0;
  private fps: number = 60;
  private interval: number = 1000 / 60;

  // Colors
  private cellColor: string = '#000000';
  private bgColor: string = '#FFFFFF';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not get 2D context');
    this.ctx = context;
    
    // Initialize with dummy data
    this.grid = new Uint8Array(0);
    this.nextGrid = new Uint8Array(0);
  }

  resize(width: number, height: number, cellSize: number) {
    const oldCols = this.cols;
    const oldRows = this.rows;
    const oldGrid = this.grid;

    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);

    this.canvas.width = width;
    this.canvas.height = height;

    // Re-allocate grids
    const size = this.cols * this.rows;
    const newGrid = new Uint8Array(size);
    const newNextGrid = new Uint8Array(size);

    if (oldGrid.length === 0) {
      // 首次初始化：随机铺一批活细胞
      for (let i = 0; i < size; i++) {
        newGrid[i] = Math.random() > 0.85 ? 1 : 0;
      }
    } else {
      // 尺寸变化时保留重叠区域，避免重排/缩放把整块棋盘清空
      const copyCols = Math.min(oldCols, this.cols);
      const copyRows = Math.min(oldRows, this.rows);
      for (let y = 0; y < copyRows; y++) {
        for (let x = 0; x < copyCols; x++) {
          newGrid[y * this.cols + x] = oldGrid[y * oldCols + x];
        }
      }
    }

    this.grid = newGrid;
    this.nextGrid = newNextGrid;

    this.draw();
  }

  setSpeed(fps: number) {
    this.fps = fps;
    this.interval = 1000 / fps;
  }
  
  setColors(cell: string, bg: string) {
    this.cellColor = cell;
    this.bgColor = bg;
    this.draw();
  }

  randomize(density: number = 0.2) {
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = Math.random() < density ? 1 : 0;
    }
    this.draw();
  }

  clear() {
    this.grid.fill(0);
    this.draw();
  }

  toggleCell(x: number, y: number) {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      const idx = row * this.cols + col;
      this.grid[idx] = this.grid[idx] ? 0 : 1;
      this.draw();
    }
  }
  
  drawCell(x: number, y: number, state: number) {
     const col = Math.floor(x / this.cellSize);
     const row = Math.floor(y / this.cellSize);
     
     if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
       const idx = row * this.cols + col;
       this.grid[idx] = state ? 1 : 0;
       const x0 = col * this.cellSize;
       const y0 = row * this.cellSize;
       const gap = this.cellSize > 2 ? 1 : 0;
       const drawSize = this.cellSize - gap;
       if (state) {
         this.ctx.fillStyle = this.cellColor;
         this.ctx.fillRect(x0, y0, drawSize, drawSize);
       } else {
         this.ctx.fillStyle = this.bgColor;
         this.ctx.fillRect(x0, y0, this.cellSize, this.cellSize);
       }
     }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.loop();
  }

  stop() {
    this.isRunning = false;
    cancelAnimationFrame(this.animationId);
  }

  step() {
    this.update();
    this.draw();
  }

  private loop = (time: number = performance.now()) => {
    if (!this.isRunning) return;
    
    const delta = time - this.lastFrameTime;
    
    if (delta > this.interval) {
      this.lastFrameTime = time - (delta % this.interval);
      this.update();
      this.draw();
    }
    
    this.animationId = requestAnimationFrame(this.loop);
  };

  private update() {
    const w = this.cols;
    const h = this.rows;
    
    // Core Game of Life Logic
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        
        // Count neighbors
        let neighbors = 0;
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            
            // Wrap around (Toroidal)
            const nx = (x + dx + w) % w;
            const ny = (y + dy + h) % h;
            
            if (this.grid[ny * w + nx]) {
              neighbors++;
            }
          }
        }
        
        const cell = this.grid[idx];
        
        // Rules
        if (cell === 1 && (neighbors < 2 || neighbors > 3)) {
          this.nextGrid[idx] = 0; // Die
        } else if (cell === 0 && neighbors === 3) {
          this.nextGrid[idx] = 1; // Reproduce
        } else {
          this.nextGrid[idx] = cell; // Stasis
        }
      }
    }
    
    // Swap buffers
    const temp = this.grid;
    this.grid = this.nextGrid;
    this.nextGrid = temp;
  }

  private draw() {
    // Clear background
    this.ctx.fillStyle = this.bgColor;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw cells
    this.ctx.fillStyle = this.cellColor;
    
    // Batch drawing? Or simple rects.
    // For 100x100 = 10k rects, might be heavy.
    // Let's optimize by direct pixel manipulation if needed, but fillRect is easiest first.
    
    // Optimization: Draw only live cells
    const w = this.cols;
    const h = this.rows;
    const size = this.cellSize;
    
    // Optional: add gap
    const gap = size > 2 ? 1 : 0;
    const drawSize = size - gap;
    
    this.ctx.beginPath();
    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i]) {
        const x = (i % w) * size;
        const y = Math.floor(i / w) * size;
        this.ctx.rect(x, y, drawSize, drawSize);
      }
    }
    this.ctx.fill();
  }
}
