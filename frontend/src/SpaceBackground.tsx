// src/SpaceBackground.tsx
//
// Procedural starfield (canvas) + per-target NASA/ESA still.
// Replaces the old 17 GB video-based background with ~4 MB of assets.
// Image credits: src/assets/backgrounds/ATTRIBUTION.md
import { useEffect, useMemo, useRef } from "react";

import mercuryImg from "./assets/backgrounds/mercury.jpg";
import venusImg from "./assets/backgrounds/venus.jpg";
import moonImg from "./assets/backgrounds/moon.jpg";
import marsImg from "./assets/backgrounds/mars.jpg";
import jupiterImg from "./assets/backgrounds/jupiter.jpg";
import saturnImg from "./assets/backgrounds/saturn.jpg";
import uranusImg from "./assets/backgrounds/uranus.jpg";
import neptuneImg from "./assets/backgrounds/neptune.png";
import orionImg from "./assets/backgrounds/orion.jpg";
import andromedaImg from "./assets/backgrounds/andromeda.jpg";
import pleiadesImg from "./assets/backgrounds/pleiades.jpg";

type Props = {
  targetName?: string | null;
  /** kept for API compatibility with the old video background; the
   *  starfield always animates, so this is currently a no-op */
  cycle?: boolean;
};

type Theme = { image: string | null; tint: string };

const THEMES: Record<string, Theme> = {
  global: { image: null, tint: "#6366f1" },
  mercury: { image: mercuryImg, tint: "#a8a29e" },
  venus: { image: venusImg, tint: "#f59e0b" },
  moon: { image: moonImg, tint: "#cbd5e1" },
  mars: { image: marsImg, tint: "#ea580c" },
  jupiter: { image: jupiterImg, tint: "#d97706" },
  saturn: { image: saturnImg, tint: "#eab308" },
  uranus: { image: uranusImg, tint: "#22d3ee" },
  neptune: { image: neptuneImg, tint: "#3b82f6" },
  orion_nebula: { image: orionImg, tint: "#ec4899" },
  andromeda: { image: andromedaImg, tint: "#8b5cf6" },
  pleiades: { image: pleiadesImg, tint: "#38bdf8" },
};

function targetToKey(targetName?: string | null): string {
  const s = (targetName ?? "").toLowerCase();

  if (s.includes("uranus")) return "uranus";
  if (s.includes("neptune")) return "neptune";
  if (s.includes("saturn")) return "saturn";
  if (s.includes("jupiter")) return "jupiter";
  if (s.includes("mars")) return "mars";
  if (s.includes("mercury")) return "mercury";
  if (s.includes("venus")) return "venus";
  if (s.includes("moon")) return "moon";

  if (s.includes("orion nebula") || s.includes("m42")) return "orion_nebula";
  if (s.includes("andromeda") || s.includes("m31")) return "andromeda";
  if (s.includes("pleiades") || s.includes("m45")) return "pleiades";

  return "global";
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

type StarfieldStar = {
  x: number;
  y: number;
  z: number; // depth 0..1 — drives size, speed, brightness
  phase: number;
  twinkleSpeed: number;
};

type ShootingStar = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // seconds remaining
  maxLife: number;
};

export default function SpaceBackground({ targetName }: Props) {
  const key = useMemo(() => targetToKey(targetName), [targetName]);
  const theme = THEMES[key] ?? THEMES.global;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // The RAF loop reads the tint from a ref so a target change doesn't
  // rebuild the whole starfield — the nebula color just glides over.
  const tintTargetRef = useRef<[number, number, number]>(hexToRgb(theme.tint));

  useEffect(() => {
    tintTargetRef.current = hexToRgb(theme.tint);
  }, [theme.tint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let stars: StarfieldStar[] = [];
    let shooting: ShootingStar[] = [];
    let width = 0;
    let height = 0;
    let raf = 0;
    let last = performance.now();
    let nextShootingIn = 4 + Math.random() * 8;
    const tint: [number, number, number] = [...tintTargetRef.current];

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(Math.round((width * height) / 3800), 420);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        z: 0.15 + Math.random() * 0.85,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.4 + Math.random() * 1.4,
      }));
    }

    function drawNebula(t: number) {
      const [r, g, b] = tint;
      // Two soft glows drifting on slow, independent orbits
      const cx1 = width * (0.28 + 0.1 * Math.sin(t * 0.021));
      const cy1 = height * (0.32 + 0.08 * Math.cos(t * 0.017));
      const cx2 = width * (0.74 + 0.09 * Math.cos(t * 0.013));
      const cy2 = height * (0.7 + 0.1 * Math.sin(t * 0.019));
      const rad = Math.max(width, height) * 0.55;

      for (const [cx, cy, alpha] of [
        [cx1, cy1, 0.16],
        [cx2, cy2, 0.1],
      ] as const) {
        const grad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, rad);
        grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx!.fillStyle = grad;
        ctx!.fillRect(0, 0, width, height);
      }
    }

    function drawStars(t: number, dt: number) {
      for (const s of stars) {
        if (!reducedMotion) {
          s.x -= s.z * 5 * dt; // slow parallax drift
          if (s.x < -2) {
            s.x = width + 2;
            s.y = Math.random() * height;
          }
        }
        const twinkle = reducedMotion
          ? 1
          : 0.72 + 0.28 * Math.sin(t * s.twinkleSpeed + s.phase);
        const alpha = (0.25 + 0.6 * s.z) * twinkle;
        const radius = 0.4 + s.z * 1.1;

        ctx!.beginPath();
        ctx!.arc(s.x, s.y, radius, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(226,232,240,${alpha.toFixed(3)})`;
        ctx!.fill();
      }
    }

    function drawShooting(dt: number) {
      nextShootingIn -= dt;
      if (nextShootingIn <= 0 && shooting.length < 2) {
        const angle = Math.PI * (0.15 + Math.random() * 0.2); // down-right
        const speed = 600 + Math.random() * 500;
        shooting.push({
          x: Math.random() * width * 0.8,
          y: Math.random() * height * 0.35,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.7,
          maxLife: 0.7,
        });
        nextShootingIn = 6 + Math.random() * 10;
      }

      shooting = shooting.filter((m) => m.life > 0);
      for (const m of shooting) {
        m.life -= dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        const fade = Math.max(m.life / m.maxLife, 0);
        const tailX = m.x - m.vx * 0.12;
        const tailY = m.y - m.vy * 0.12;
        const grad = ctx!.createLinearGradient(m.x, m.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255,255,255,${0.85 * fade})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1.6;
        ctx!.beginPath();
        ctx!.moveTo(m.x, m.y);
        ctx!.lineTo(tailX, tailY);
        ctx!.stroke();
      }
    }

    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;

      // Ease the nebula color toward the current target's tint
      const target = tintTargetRef.current;
      for (let i = 0; i < 3; i++) {
        tint[i] += (target[i] - tint[i]) * Math.min(dt * 1.5, 1);
      }

      ctx!.clearRect(0, 0, width, height);
      drawNebula(t);
      drawStars(t, dt);
      if (!reducedMotion) drawShooting(dt);

      if (!reducedMotion) raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        background:
          "radial-gradient(circle at 30% 20%, #0b1120 0%, #020617 55%, #000 100%)",
      }}
    >
      {theme.image && (
        <img
          key={theme.image}
          src={theme.image}
          alt=""
          className="space-bg-img"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}

      {/* readability vignette between the photo and the starfield */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(2,6,23,0.45) 0%, rgba(2,6,23,0.6) 60%, rgba(0,0,0,0.75) 100%)",
        }}
      />

      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
    </div>
  );
}
