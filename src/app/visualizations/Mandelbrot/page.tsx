'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';

type Mode = 'mandelbrot' | 'julia' | 'newton';
type PaletteId = 'classic' | 'fire' | 'ice' | 'neon';

const DEFAULTS = {
  mandelbrot: { centerX: -0.5, centerY: 0, zoom: 1 },
  julia: { centerX: 0, centerY: 0, zoom: 1, cRe: -0.8, cIm: 0.156 },
};

const QUALITY = [
  { label: 'LOW', value: 0.6 },
  { label: 'MED', value: 0.8 },
  { label: 'HIGH', value: 1 },
];

const PALETTES: { id: PaletteId; label: string }[] = [
  { id: 'classic', label: 'CLASSIC' },
  { id: 'fire', label: 'FIRE' },
  { id: 'ice', label: 'ICE' },
  { id: 'neon', label: 'NEON' },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const hsvToRgb = (hue: number, sat: number, val: number) => {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp01(sat);
  const v = clamp01(val);
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c; g = x; b = 0;
  } else if (h < 120) {
    r = x; g = c; b = 0;
  } else if (h < 180) {
    r = 0; g = c; b = x;
  } else if (h < 240) {
    r = 0; g = x; b = c;
  } else if (h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  return [
    Math.floor((r + m) * 255),
    Math.floor((g + m) * 255),
    Math.floor((b + m) * 255),
  ];
};

export default function MandelbrotPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const renderIdRef = useRef(0);
  const viewRef = useRef({ cssW: 1, cssH: 1, pixelScaleCss: 1 });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, cx: 0, cy: 0 });

  const [mode, setMode] = useState<Mode>('mandelbrot');
  const [centerX, setCenterX] = useState(DEFAULTS.mandelbrot.centerX);
  const [centerY, setCenterY] = useState(DEFAULTS.mandelbrot.centerY);
  const [zoom, setZoom] = useState(DEFAULTS.mandelbrot.zoom);
  const [iterations, setIterations] = useState(300);
  const [cRe, setCRe] = useState(DEFAULTS.julia.cRe);
  const [cIm, setCIm] = useState(DEFAULTS.julia.cIm);
  const [newtonDegree, setNewtonDegree] = useState(3);
  const [newtonRelax, setNewtonRelax] = useState(1);
  const [quality, setQuality] = useState(1);
  const [autoRender, setAutoRender] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [palette, setPalette] = useState<PaletteId>('classic');
  const [dragging, setDragging] = useState(false);

  const scale = useMemo(() => Math.max(0.0000001, zoom), [zoom]);

  const renderFractal = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(rect.width * dpr * quality));
    const h = Math.max(1, Math.floor(rect.height * dpr * quality));
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    // 布局尺寸交给 CSS w-full/h-full，避免 inline px 宽度撑死 flex 项 min-content
    ctx.imageSmoothingEnabled = true;

    const baseScale = 4 / Math.min(w, h);
    const pixelScale = baseScale / scale;
    const baseScaleCss = 4 / Math.min(cssW, cssH);
    const pixelScaleCss = baseScaleCss / scale;
    viewRef.current = { cssW, cssH, pixelScaleCss };
    const maxIter = Math.max(10, Math.floor(iterations));

    const cx = centerX;
    const cy = centerY;
    const juliaRe = cRe;
    const juliaIm = cIm;
    const degree = Math.min(8, Math.max(2, Math.round(newtonDegree)));
    const relax = Math.min(2, Math.max(0.1, newtonRelax));
    const tol = 1e-6;
    const roots =
      mode === 'newton'
        ? Array.from({ length: degree }, (_, i) => {
            const angle = (i / degree) * Math.PI * 2;
            return { re: Math.cos(angle), im: Math.sin(angle) };
          })
        : [];
    const rootColors =
      mode === 'newton'
        ? roots.map((_, i) => hsvToRgb((i / degree) * 360, 0.75, 0.95))
        : [];

    const renderId = ++renderIdRef.current;
    setIsRendering(true);
    setProgress(0);

    const imageData = ctx.createImageData(w, h);
    const data = imageData.data;
    let y = 0;
    const rowsPerChunk = 24;
    const drawChunk = () => {
      if (renderIdRef.current !== renderId) return;
      const yEnd = Math.min(h, y + rowsPerChunk);
      for (let py = y; py < yEnd; py++) {
        const imag = cy + (h / 2 - py) * pixelScale;
        for (let px = 0; px < w; px++) {
          const real = cx + (px - w / 2) * pixelScale;
          let r = 0;
          let g = 0;
          let b = 0;

          if (mode === 'newton') {
            let zr = real;
            let zi = imag;
            let iter = 0;
            let rootIndex = -1;
            for (; iter < maxIter; iter += 1) {
              const r2 = zr * zr + zi * zi;
              if (r2 < 1e-18) break;
              let pr = 1;
              let pi = 0;
              let prN1 = 1;
              let piN1 = 0;
              for (let i = 0; i < degree; i += 1) {
                const nr = pr * zr - pi * zi;
                const ni = pr * zi + pi * zr;
                pr = nr;
                pi = ni;
                if (i === degree - 2) {
                  prN1 = pr;
                  piN1 = pi;
                }
              }
              const fr = pr - 1;
              const fi = pi;
              const dfr = degree * prN1;
              const dfi = degree * piN1;
              const denom = dfr * dfr + dfi * dfi;
              if (denom === 0) break;
              const qr = (fr * dfr + fi * dfi) / denom;
              const qi = (fi * dfr - fr * dfi) / denom;
              zr -= relax * qr;
              zi -= relax * qi;
              for (let k = 0; k < roots.length; k += 1) {
                const dr = zr - roots[k].re;
                const di = zi - roots[k].im;
                if (dr * dr + di * di < tol) {
                  rootIndex = k;
                  break;
                }
              }
              if (rootIndex >= 0) break;
            }
            if (rootIndex >= 0) {
              const base = rootColors[rootIndex];
              const t = iter / maxIter;
              const strength = 0.25 + 0.75 * (1 - t);
              r = Math.floor(base[0] * strength);
              g = Math.floor(base[1] * strength);
              b = Math.floor(base[2] * strength);
            }
          } else {
            let zr = mode === 'julia' ? real : 0;
            let zi = mode === 'julia' ? imag : 0;
            const cr = mode === 'julia' ? juliaRe : real;
            const ci = mode === 'julia' ? juliaIm : imag;
            let iter = 0;
            while (zr * zr + zi * zi <= 4 && iter < maxIter) {
              const xt = zr * zr - zi * zi + cr;
              zi = 2 * zr * zi + ci;
              zr = xt;
              iter += 1;
            }

            if (iter < maxIter) {
              const mag = zr * zr + zi * zi;
              let smooth = iter;
              if (mag > 0) {
                smooth = iter + 1 - Math.log(Math.log(Math.sqrt(mag))) / Math.log(2);
              }
              const t = Math.min(1, Math.max(0, smooth / maxIter));
              if (palette === 'classic') {
                r = Math.floor(9 * (1 - t) * t * t * t * 255);
                g = Math.floor(15 * (1 - t) * (1 - t) * t * t * 255);
                b = Math.floor(8.5 * (1 - t) * (1 - t) * (1 - t) * t * 255);
              } else if (palette === 'fire') {
                r = Math.floor(255 * Math.min(1, t * 1.2));
                g = Math.floor(200 * Math.pow(t, 0.6));
                b = Math.floor(80 * Math.pow(t, 2.2));
              } else if (palette === 'ice') {
                r = Math.floor(40 + 60 * t);
                g = Math.floor(80 + 140 * t);
                b = Math.floor(140 + 115 * t);
              } else {
                const hHue = (280 - 280 * t) / 360;
                const sSat = 0.9;
                const vVal = 0.95;
                const iHue = Math.floor(hHue * 6);
                const fHue = hHue * 6 - iHue;
                const pVal = vVal * (1 - sSat);
                const qVal = vVal * (1 - fHue * sSat);
                const tVal = vVal * (1 - (1 - fHue) * sSat);
                let rr = 0;
                let gg = 0;
                let bb = 0;
                switch (iHue % 6) {
                  case 0:
                    rr = vVal; gg = tVal; bb = pVal; break;
                  case 1:
                    rr = qVal; gg = vVal; bb = pVal; break;
                  case 2:
                    rr = pVal; gg = vVal; bb = tVal; break;
                  case 3:
                    rr = pVal; gg = qVal; bb = vVal; break;
                  case 4:
                    rr = tVal; gg = pVal; bb = vVal; break;
                  case 5:
                    rr = vVal; gg = pVal; bb = qVal; break;
                }
                r = Math.floor(rr * 255);
                g = Math.floor(gg * 255);
                b = Math.floor(bb * 255);
              }
            }
          }

          const idx = (py * w + px) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0, 0, y, w, yEnd - y);
      y = yEnd;
      setProgress(y / h);

      if (y < h) {
        requestAnimationFrame(drawChunk);
      } else {
        setIsRendering(false);
      }
    };

    drawChunk();
  }, [centerX, centerY, scale, iterations, mode, cRe, cIm, quality, palette]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      renderFractal();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [renderFractal]);

  useEffect(() => {
    if (!autoRender) return;
    if (dragRef.current.dragging) return;
    renderFractal();
  }, [autoRender, centerX, centerY, zoom, iterations, cRe, cIm, quality, palette, mode, renderFractal]);

  const resetView = () => {
    if (mode === 'mandelbrot') {
      setCenterX(DEFAULTS.mandelbrot.centerX);
      setCenterY(DEFAULTS.mandelbrot.centerY);
      setZoom(DEFAULTS.mandelbrot.zoom);
    } else if (mode === 'julia') {
      setCenterX(DEFAULTS.julia.centerX);
      setCenterY(DEFAULTS.julia.centerY);
      setZoom(DEFAULTS.julia.zoom);
      setCRe(DEFAULTS.julia.cRe);
      setCIm(DEFAULTS.julia.cIm);
    } else {
      setCenterX(0);
      setCenterY(0);
      setZoom(1);
    }
  };

  const saveImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mode}-${Date.now()}.png`;
    a.click();
  };

  const scaleCanvasAboutPoint = useCallback((factor: number, px: number, py: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cssW = Math.max(1, viewRef.current.cssW);
    const cssH = Math.max(1, viewRef.current.cssH);
    const sx = canvas.width / cssW;
    const sy = canvas.height / cssH;
    const cx = px * sx;
    const cy = py * sy;

    const snapshot = document.createElement('canvas');
    snapshot.width = canvas.width || 1;
    snapshot.height = canvas.height || 1;
    const sctx = snapshot.getContext('2d');
    if (!sctx) return;
    sctx.drawImage(canvas, 0, 0);

    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(cx, cy);
    ctx.scale(factor, factor);
    ctx.drawImage(snapshot, -cx, -cy);
    ctx.restore();
    ctx.imageSmoothingEnabled = prevSmoothing;
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      cx: centerX,
      cy: centerY,
    };
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    const { pixelScaleCss } = viewRef.current;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setCenterX(dragRef.current.cx - dx * pixelScaleCss);
    setCenterY(dragRef.current.cy + dy * pixelScaleCss);
  };

  const handlePointerUp = (e?: React.PointerEvent) => {
    if (e) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    dragRef.current.dragging = false;
    setDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const { cssW, cssH, pixelScaleCss } = viewRef.current;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const real = centerX + (px - cssW / 2) * pixelScaleCss;
    const imag = centerY + (cssH / 2 - py) * pixelScaleCss;
    const zoomFactor = Math.exp(-e.deltaY * 0.0015);
    const nextZoom = Math.min(1e6, Math.max(0.05, zoom * zoomFactor));
    const appliedFactor = nextZoom / zoom;
    if (appliedFactor !== 1) {
      scaleCanvasAboutPoint(appliedFactor, px, py);
    }
    const baseScaleCss = 4 / Math.min(cssW, cssH);
    const nextPixelScale = baseScaleCss / nextZoom;
    setZoom(nextZoom);
    setCenterX(real - (px - cssW / 2) * nextPixelScale);
    setCenterY(imag - (cssH / 2 - py) * nextPixelScale);
  };

  const overlayText = `${
    mode === 'mandelbrot' ? 'Mandelbrot' : mode === 'julia' ? 'Julia' : 'Newton'
  } · iter ${iterations} · zoom ${zoom.toFixed(2)}${isRendering ? ` · ${(progress * 100).toFixed(0)}%` : ''} · ${
    mode === 'newton' ? `deg ${newtonDegree}` : palette.toUpperCase()
  }`;

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 flex flex-col">
      <Navigation title="FRACTAL GEOMETRY" />

      <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
        <div
          ref={wrapRef}
          className={`h-64 shrink-0 lg:h-full lg:flex-1 relative bg-zinc-950 overflow-hidden ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onWheel={handleWheel}
        >
          <canvas ref={canvasRef} className="block w-full h-full" />
          <div className="absolute top-4 left-4 text-[11px] font-mono text-white/70 pointer-events-none">
            {overlayText}
          </div>
          <div className="absolute bottom-4 left-4 text-[10px] font-mono text-white/50 pointer-events-none">
            拖拽平移 · 滚轮缩放
          </div>
        </div>

        <div className="w-full lg:w-96 bg-white border-l border-zinc-200 flex flex-col flex-1 lg:flex-none lg:h-full overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-7">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-600"></span>
                参数面板
              </h2>
              <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase">{'/// FRACTAL GEOMETRY'}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setMode('mandelbrot')}
                className={`px-3 py-2 rounded text-xs font-bold ${
                  mode === 'mandelbrot' ? 'bg-blue-50 text-blue-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                Mandelbrot
              </button>
              <button
                onClick={() => setMode('julia')}
                className={`px-3 py-2 rounded text-xs font-bold ${
                  mode === 'julia' ? 'bg-indigo-50 text-indigo-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                Julia
              </button>
              <button
                onClick={() => setMode('newton')}
                className={`px-3 py-2 rounded text-xs font-bold ${
                  mode === 'newton' ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                Newton
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={renderFractal}
                className="px-3 py-2 bg-zinc-900 text-white rounded text-xs font-bold hover:bg-zinc-800"
              >
                渲染
              </button>
              <button
                onClick={resetView}
                className="px-3 py-2 bg-zinc-100 text-zinc-700 rounded text-xs font-bold hover:bg-zinc-200"
              >
                重置视角
              </button>
              <button
                onClick={saveImage}
                className="px-3 py-2 bg-blue-50 text-blue-700 rounded text-xs font-bold hover:bg-blue-100 col-span-2"
              >
                保存图片
              </button>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-500 uppercase">
                <span>自动渲染</span>
                <button
                  onClick={() => setAutoRender((v) => !v)}
                  className={`px-2 py-1 rounded text-[10px] font-bold ${
                    autoRender ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
                  }`}
                >
                  {autoRender ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {QUALITY.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => setQuality(q.value)}
                    className={`px-2 py-2 rounded text-[10px] font-bold ${
                      quality === q.value ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {PALETTES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPalette(p.id)}
                    className={`px-2 py-2 rounded text-[10px] font-bold ${
                      palette === p.id ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="text-[10px] font-mono text-zinc-400">
                {isRendering ? '渲染中…' : '准备就绪'}
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <NumberField label="中心 X" value={centerX} step={0.0001} onChange={setCenterX} />
              <NumberField label="中心 Y" value={centerY} step={0.0001} onChange={setCenterY} />
              <NumberField label="缩放 (Zoom)" value={zoom} step={0.1} min={0.1} onChange={setZoom} />
              <SliderField label="迭代次数" value={iterations} min={50} max={2000} step={10} onChange={setIterations} />
            </div>

            {mode === 'julia' ? (
              <div className="space-y-4 pt-2 border-t border-zinc-100">
                <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Julia 常数</div>
                <NumberField label="c 实部" value={cRe} step={0.001} onChange={setCRe} />
                <NumberField label="c 虚部" value={cIm} step={0.001} onChange={setCIm} />
              </div>
            ) : null}

            {mode === 'newton' ? (
              <div className="space-y-4 pt-2 border-t border-zinc-100">
                <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Newton 分形</div>
                <SliderField label="多项式次数" value={newtonDegree} min={2} max={8} step={1} onChange={setNewtonDegree} />
                <NumberField label="Relax" value={newtonRelax} step={0.05} min={0.1} max={2} onChange={setNewtonRelax} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-xs font-mono text-zinc-500 uppercase">{label}</div>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const next = parseFloat(e.target.value);
          if (!Number.isFinite(next)) return;
          const clamped = Math.min(max ?? next, Math.max(min ?? next, next));
          onChange(clamped);
        }}
        className="w-32 px-2 py-1 text-xs font-mono text-zinc-700 bg-zinc-50 border border-zinc-200 rounded"
      />
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-mono text-zinc-500 uppercase">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <input
        type="range"
        className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
