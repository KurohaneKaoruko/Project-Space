'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FACE_COLORS,
  FACE_COLORS_DARK,
  FACE_LIST,
  onFace,
  parseMove,
  type Cubie,
  type Face,
  type Move,
} from '../function/cubeEngine';

const SIZE = 80;
const GAP = 9;
const STEP = SIZE + GAP;

/** 每个面的局部变换：把平面贴到立方体对应的一侧 */
const FACE_TRANSFORM: Record<Face, string> = {
  U: `rotateX(90deg) translateZ(${SIZE / 2}px)`,
  D: `rotateX(-90deg) translateZ(${SIZE / 2}px)`,
  F: `translateZ(${SIZE / 2}px)`,
  B: `rotateY(180deg) translateZ(${SIZE / 2}px)`,
  R: `rotateY(90deg) translateZ(${SIZE / 2}px)`,
  L: `rotateY(-90deg) translateZ(${SIZE / 2}px)`,
};

/** 转动对应的旋转轴与顺时针方向（CSS 坐标系，y 向下） */
const MOVE_AXIS: Record<Face, { axis: 'X' | 'Y' | 'Z'; sign: number }> = {
  U: { axis: 'Y', sign: -1 },
  D: { axis: 'Y', sign: 1 },
  R: { axis: 'X', sign: 1 },
  L: { axis: 'X', sign: -1 },
  F: { axis: 'Z', sign: 1 },
  B: { axis: 'Z', sign: -1 },
};

function moveRotation(move: Move): { axis: 'X' | 'Y' | 'Z'; angle: number } {
  const { face, turns } = parseMove(move);
  const { axis, sign } = MOVE_AXIS[face];
  const quarter = turns === 1 ? 1 : turns === 2 ? 2 : -1;
  return { axis, angle: sign * 90 * quarter };
}

function matrix3d(rot: readonly number[]): string {
  // rot 为行主序 3x3，CSS matrix3d 需要列主序
  return `matrix3d(${rot[0]}, ${rot[3]}, ${rot[6]}, 0, ${rot[1]}, ${rot[4]}, ${rot[7]}, 0, ${rot[2]}, ${rot[5]}, ${rot[8]}, 0, 0, 0, 0, 1)`;
}

interface Cube3DProps {
  cubies: Cubie[];
  anim: { move: Move; seq: number } | null;
  duration: number;
}

export default function Cube3D({ cubies, anim, duration }: Cube3DProps) {
  const [view, setView] = useState({ x: -24, y: -34 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const layerRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const cubiesRef = useRef(cubies);
  cubiesRef.current = cubies;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
      setDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [view.x, view.y],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setView({
        x: Math.max(-82, Math.min(82, d.vx - (e.clientY - d.y) * 0.45)),
        y: d.vy + (e.clientX - d.x) * 0.45,
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);

  // 用 Web Animations API 驱动层旋转：不依赖 transition 重置，连续转动可以无缝衔接
  const seq = anim?.seq ?? 0;
  useEffect(() => {
    if (!anim) return undefined;
    const { axis, angle } = moveRotation(anim.move);
    const face = parseMove(anim.move).face;
    const animations: Animation[] = [];
    for (const cubie of cubiesRef.current) {
      if (!onFace(cubie.pos, face)) continue;
      const el = layerRef.current.get(cubie.id);
      if (!el) continue;
      animations.push(
        el.animate(
          [{ transform: `rotate${axis}(0deg)` }, { transform: `rotate${axis}(${angle}deg)` }],
          {
            duration: Math.max(40, duration * 0.86),
            easing: 'cubic-bezier(.34,.72,.36,1)',
            fill: 'forwards',
          },
        ),
      );
    }
    return () => {
      // 提交后取消动画：元素回落到已更新的静态变换，视觉上与动画终点一致
      for (const a of animations) a.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);

  return (
    <div className="relative w-full h-[350px] xl:h-[400px] flex items-center justify-center select-none scale-[0.84] xl:scale-100 origin-center">
      {/* 地面投影 */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
        style={{
          width: 400,
          height: 400,
          background:
            'radial-gradient(circle, rgba(15,23,42,0.15) 0%, rgba(15,23,42,0.05) 45%, transparent 68%)',
          filter: 'blur(16px)',
          transform: 'translate(-50%, -14%)',
        }}
      />

      <div
        className={dragging ? 'cursor-grabbing' : 'cursor-grab'}
        style={{ perspective: 1600, perspectiveOrigin: '50% 44%', touchAction: 'none' }}
        onPointerDown={onPointerDown}
      >
        <div
          style={{
            width: 0,
            height: 0,
            position: 'relative',
            transformStyle: 'preserve-3d',
            transform: `rotateX(${view.x}deg) rotateY(${view.y}deg)`,
            transition: dragging ? 'none' : 'transform 500ms cubic-bezier(.2,.8,.2,1)',
          }}
        >
          {cubies.map((cubie) => (
            <div
              key={cubie.id}
              ref={(el) => {
                if (el) layerRef.current.set(cubie.id, el);
                else layerRef.current.delete(cubie.id);
              }}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: SIZE,
                height: SIZE,
                marginLeft: -SIZE / 2,
                marginTop: -SIZE / 2,
                transformStyle: 'preserve-3d',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  transformStyle: 'preserve-3d',
                  transform: `translate3d(${cubie.pos[0] * STEP}px, ${cubie.pos[1] * STEP}px, ${
                    cubie.pos[2] * STEP
                  }px) ${matrix3d(cubie.rot)}`,
                }}
              >
                {FACE_LIST.map((face) => {
                  const color = cubie.colors[face];
                  return (
                    <div
                      key={face}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        transform: FACE_TRANSFORM[face],
                        borderRadius: 11,
                        background: '#0d0d11',
                      }}
                    >
                      {color ? (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 3,
                            borderRadius: 9,
                            background: `linear-gradient(155deg, ${FACE_COLORS[face]} 0%, ${FACE_COLORS[face]} 58%, ${FACE_COLORS_DARK[face]} 100%)`,
                            boxShadow:
                              'inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.18)',
                          }}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
