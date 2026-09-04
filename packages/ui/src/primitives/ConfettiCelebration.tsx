"use client";

import { useEffect, useRef, useCallback } from "react";

interface ConfettiPiece {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  color: string;
  alpha: number;
  decay: number;
  shape: "ribbon" | "star" | "circle";
  oscillationSpeed: number;
  oscillationDistance: number;
  phase: number;
}

export function ConfettiCelebration({ onComplete }: { onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Rich Cyber Quranic Palette
    const colors = [
      "#34d399", "#10b981", // Emerald
      "#fbbf24", "#f59e0b", // Gold
      "#38bdf8", "#0ea5e9", // Plasma Cyan
      "#c084fc", "#a855f7", // Purple
      "#f472b6",            // Rose
      "#ffffff",            // White
    ];

    const pieces: ConfettiPiece[] = [];
    const count = 110; // Optimized count for clean 60fps single-burst performance

    // Dual-Cannon Fountain: Fires ONCE simultaneously from left & right corners
    for (let i = 0; i < count; i++) {
      const isLeft = i % 2 === 0;
      const startX = isLeft ? canvas.width * 0.15 : canvas.width * 0.85;
      const startY = canvas.height * 0.9;
      const vx = isLeft ? 5 + Math.random() * 11 : -(5 + Math.random() * 11);
      const vy = -(13 + Math.random() * 12);

      const shapes: ("ribbon" | "star" | "circle")[] = ["ribbon", "ribbon", "star", "circle"];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];

      pieces.push({
        x: startX,
        y: startY,
        w: shape === "ribbon" ? 7 + Math.random() * 7 : 6 + Math.random() * 5,
        h: shape === "ribbon" ? 14 + Math.random() * 8 : 6 + Math.random() * 5,
        vx,
        vy,
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 0.0055 + Math.random() * 0.005, // Crisp 2.5 second single burst
        shape,
        oscillationSpeed: 0.04 + Math.random() * 0.04,
        oscillationDistance: 1 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
      });
    }

    let animId: number;
    let frame = 0;
    let finished = false;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;
      let anyAlive = false;

      for (const p of pieces) {
        if (p.alpha <= 0) continue;
        anyAlive = true;

        // Smooth physics: Natural gravity and fluttering air resistance
        p.x += p.vx + Math.sin(frame * p.oscillationSpeed + p.phase) * p.oscillationDistance;
        p.y += p.vy;
        p.vx *= 0.982;
        p.vy += 0.32; // Gravity
        p.rotation += p.vRot;
        p.alpha -= p.decay;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;

        if (p.shape === "ribbon") {
          // 3D perspective tumbling ribbon
          const scaleY = Math.cos((p.rotation * Math.PI) / 90);
          ctx.fillRect(-p.w / 2, (-p.h / 2) * scaleY, p.w, p.h * scaleY);
        } else if (p.shape === "star") {
          // 4-point star glint
          ctx.beginPath();
          ctx.moveTo(0, -p.w);
          ctx.quadraticCurveTo(0, 0, p.w, 0);
          ctx.quadraticCurveTo(0, 0, 0, p.w);
          ctx.quadraticCurveTo(0, 0, -p.w, 0);
          ctx.quadraticCurveTo(0, 0, 0, -p.w);
          ctx.fill();
        } else {
          // Circular spangle
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      if (anyAlive) {
        animId = requestAnimationFrame(animate);
      } else if (!finished) {
        finished = true;
        onCompleteRef.current?.();
      }
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []); // Run ONLY once per mount!

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[9999] pointer-events-none"
    />
  );
}
