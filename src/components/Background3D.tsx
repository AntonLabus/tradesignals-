"use client";
import React, { useEffect, useRef } from 'react';

// Lightweight animated 3D-like background using canvas parallax dots
export default function Background3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>();
  const pointsRef = useRef<Array<{ x: number; y: number; z: number; vx: number; vy: number }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const { innerWidth: w, innerHeight: h } = window;
      canvas.width = Math.floor(w * DPR);
      canvas.height = Math.floor(h * DPR);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    };
    resize();
    window.addEventListener('resize', resize);

    // init points
    const PCOUNT = 120;
    const pts = new Array(PCOUNT).fill(0).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      z: Math.random() * 1 + 0.2,
      vx: (Math.random() * 2 - 1) * 0.2,
      vy: (Math.random() * 2 - 1) * 0.2,
    }));
    pointsRef.current = pts;

    const render = () => {
      const pts = pointsRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // background gradient
      const grad = ctx.createRadialGradient(canvas.width*0.7, canvas.height*0.3, 0, canvas.width*0.7, canvas.height*0.3, Math.max(canvas.width, canvas.height));
      grad.addColorStop(0, 'rgba(0,255,255,0.06)');
      grad.addColorStop(1, 'rgba(138,43,226,0.02)');
      ctx.fillStyle = grad;
      ctx.fillRect(0,0,canvas.width,canvas.height);

      // draw connections
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx*dx + dy*dy;
          if (d2 < 12000) {
            const alpha = 1 - d2 / 12000;
            ctx.strokeStyle = `rgba(0,255,200,${alpha * 0.08})`;
            ctx.lineWidth = 1 * Math.min(a.z, b.z);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // draw points and update
      for (const p of pts) {
        ctx.fillStyle = `rgba(0,255,255,${0.25 * p.z})`;
        ctx.shadowColor = 'rgba(0,255,255,0.4)';
        ctx.shadowBlur = 8 * p.z;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.8 * p.z, 0, Math.PI * 2);
        ctx.fill();

        p.x += p.vx * p.z;
        p.y += p.vy * p.z;
        // wrap
        if (p.x < -20) p.x = canvas.width + 20;
        if (p.x > canvas.width + 20) p.x = -20;
        if (p.y < -20) p.y = canvas.height + 20;
        if (p.y > canvas.height + 20) p.y = -20;
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
    </div>
  );
}
