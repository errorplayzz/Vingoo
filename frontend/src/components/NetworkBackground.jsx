import { useEffect, useRef } from "react";

const COLORS = {
  node:     "rgba(59,130,246,",
  nodeAlt:  "rgba(99,102,241,",
  nodeSky:  "rgba(14,165,233,",
  line:     "rgba(99,102,241,",
  lineBlue: "rgba(59,130,246,",
  pulse:    "rgba(147,197,253,",
  ring:     "rgba(99,102,241,",
};

const MAX_DIST        = 210;
const NODE_COUNT_BASE = 52;
const REPEL_RADIUS    = 130;
const REPEL_FORCE     = 2.8;
const ATTRACT_RADIUS  = 260;

function rand(min, max) { return Math.random() * (max - min) + min; }

function buildNodes(W, H) {
  const count = Math.round(NODE_COUNT_BASE * (W * H) / (1440 * 760));
  const n = Math.max(22, Math.min(count, 80));
  const nodeColors = [COLORS.node, COLORS.nodeAlt, COLORS.nodeSky];
  return Array.from({ length: n }, () => {
    const vx = rand(-0.28, 0.28), vy = rand(-0.28, 0.28);
    return {
      x:  rand(0, W), y:  rand(0, H),
      vx, vy, baseVx: vx, baseVy: vy,
      r:  rand(2.2, 5),
      alpha: rand(0.65, 1),
      color: nodeColors[Math.floor(Math.random() * nodeColors.length)],
      lineColor: Math.random() > 0.5 ? COLORS.line : COLORS.lineBlue,
      ring: null,
      ringTimer: Math.random() * 160,
      hoverScale: 1,
    };
  });
}

function initRing(node) {
  node.ring = { r: node.r + 1, alpha: 0.72 };
}

export default function NetworkBackground({ className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = canvas.offsetWidth;
    let H = canvas.offsetHeight;
    let nodes = buildNodes(W, H);
    let pulses = [];
    let rafId;

    /* ── mouse state ──────────────────────────── */
    const mouse = { x: -9999, y: -9999, active: false };
    let lastMX = -9999, lastMY = -9999, moveTimer = 0;

    function onMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;

      const speed = Math.hypot(mouse.x - lastMX, mouse.y - lastMY);
      if (speed > 14 && moveTimer <= 0) {
        // burst: fire pulses between the 3 closest nodes to cursor
        const nearby = nodes
          .map((n, i) => ({ i, d: Math.hypot(n.x - mouse.x, n.y - mouse.y) }))
          .filter(o => o.d < ATTRACT_RADIUS)
          .sort((a, b) => a.d - b.d)
          .slice(0, 3);
        for (let k = 0; k < nearby.length - 1; k++) {
          const a = nodes[nearby[k].i], b = nodes[nearby[k + 1].i];
          pulses.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y,
            t: 0, speed: rand(0.013, 0.022), alpha: 0.95, burst: true });
        }
        moveTimer = 6;
      }
      if (moveTimer > 0) moveTimer--;
      lastMX = mouse.x; lastMY = mouse.y;
    }

    function onMouseLeave() {
      mouse.active = false; mouse.x = -9999; mouse.y = -9999;
    }

    // listen on the parent section, not canvas (canvas is pointer-events-none)
    const section = canvas.parentElement;
    section.addEventListener("mousemove", onMouseMove, { passive: true });
    section.addEventListener("mouseleave", onMouseLeave);

    /* ── resize ───────────────────────────────── */
    function resize() {
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      canvas.width  = W * window.devicePixelRatio;
      canvas.height = H * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      nodes = buildNodes(W, H);
      pulses = [];
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function spawnPulse(n1, n2, fast = false) {
      pulses.push({ x0: n1.x, y0: n1.y, x1: n2.x, y1: n2.y,
        t: 0, speed: fast ? rand(0.010, 0.016) : rand(0.004, 0.009),
        alpha: rand(0.7, 1), burst: false });
    }

    let frameCount = 0;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      frameCount++;

      /* ── update nodes ─────────────────────────── */
      for (const n of nodes) {
        const mdx   = n.x - mouse.x, mdy = n.y - mouse.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

        if (mouse.active && mdist < REPEL_RADIUS && mdist > 0.5) {
          const force = (REPEL_RADIUS - mdist) / REPEL_RADIUS;
          n.vx += (mdx / mdist) * force * REPEL_FORCE * 0.06;
          n.vy += (mdy / mdist) * force * REPEL_FORCE * 0.06;
          n.hoverScale = 1 + force * 0.65;
          if (force > 0.55 && !n.ring && Math.random() < 0.04) initRing(n);
        } else if (mouse.active && mdist < ATTRACT_RADIUS) {
          const force = 0.008 * (1 - mdist / ATTRACT_RADIUS);
          n.vx -= (mdx / mdist) * force;
          n.vy -= (mdy / mdist) * force;
          n.hoverScale = 1;
        } else {
          n.hoverScale = 1;
        }

        // damping + restore base drift
        n.vx *= 0.97; n.vy *= 0.97;
        if (!mouse.active || mdist > ATTRACT_RADIUS) {
          n.vx += (n.baseVx - n.vx) * 0.012;
          n.vy += (n.baseVy - n.vy) * 0.012;
        }
        // speed cap
        const spd = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        if (spd > 3.5) { n.vx = (n.vx / spd) * 3.5; n.vy = (n.vy / spd) * 3.5; }

        n.x += n.vx; n.y += n.vy;
        if (n.x < -60) n.x = W + 60; if (n.x > W + 60) n.x = -60;
        if (n.y < -60) n.y = H + 60; if (n.y > H + 60) n.y = -60;

        n.ringTimer--;
        if (n.ringTimer <= 0) { initRing(n); n.ringTimer = rand(120, 340); }
      }

      /* ── cursor glow ──────────────────────────── */
      if (mouse.active) {
        const cg = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, REPEL_RADIUS);
        cg.addColorStop(0,   "rgba(99,102,241,0.12)");
        cg.addColorStop(0.5, "rgba(59,130,246,0.05)");
        cg.addColorStop(1,   "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, REPEL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = cg;
        ctx.fill();
      }

      /* ── draw edges ───────────────────────────── */
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > MAX_DIST) continue;
          const t = 1 - dist / MAX_DIST;

          let boost = 1;
          if (mouse.active) {
            const md = Math.hypot((a.x + b.x) / 2 - mouse.x, (a.y + b.y) / 2 - mouse.y);
            if (md < REPEL_RADIUS) boost = 1 + (1 - md / REPEL_RADIUS) * 2.8;
          }

          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `${a.lineColor}${Math.min(t * 0.36 * boost, 0.88)})`;
          ctx.lineWidth   = t * 1.4 * Math.min(boost, 2.2);
          ctx.stroke();

          if (frameCount % 75 === 0 && Math.random() < 0.10) spawnPulse(a, b);
          if (mouse.active && boost > 2.0 && frameCount % 18 === 0 && Math.random() < 0.20)
            spawnPulse(a, b, true);
        }
      }

      /* ── draw pulses ──────────────────────────── */
      pulses = pulses.filter(p => p.t <= 1);
      for (const p of pulses) {
        p.t += p.speed;
        const px = p.x0 + (p.x1 - p.x0) * p.t;
        const py = p.y0 + (p.y1 - p.y0) * p.t;
        const sz = p.burst ? 18 : 14;

        const grd = ctx.createRadialGradient(px, py, 0, px, py, sz);
        grd.addColorStop(0,   `${COLORS.pulse}${p.alpha})`);
        grd.addColorStop(0.4, `${COLORS.pulse}${p.alpha * 0.5})`);
        grd.addColorStop(1,   `${COLORS.pulse}0)`);
        ctx.beginPath(); ctx.arc(px, py, sz, 0, Math.PI * 2);
        ctx.fillStyle = grd; ctx.fill();

        ctx.beginPath(); ctx.arc(px, py, p.burst ? 5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99,102,241,${p.alpha * 0.6})`; ctx.fill();

        ctx.beginPath(); ctx.arc(px, py, p.burst ? 2.4 : 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`; ctx.fill();
      }

      /* ── draw nodes ───────────────────────────── */
      for (const n of nodes) {
        const r   = n.r * (n.hoverScale || 1);
        const alp = n.alpha;

        if (n.ring) {
          ctx.beginPath(); ctx.arc(n.x, n.y, n.ring.r, 0, Math.PI * 2);
          ctx.strokeStyle = `${COLORS.ring}${n.ring.alpha})`; ctx.lineWidth = 1.2; ctx.stroke();
          n.ring.r += 0.45; n.ring.alpha -= 0.010;
          if (n.ring.alpha <= 0) n.ring = null;
        }

        // halo — bigger + brighter when hovering nearby
        const haloR = r * (n.hoverScale > 1 ? 6 : 4);
        const hg = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, haloR);
        hg.addColorStop(0,   `${n.color}${alp * (n.hoverScale > 1 ? 0.65 : 0.42)})`);
        hg.addColorStop(1,   `${n.color}0)`);
        ctx.beginPath(); ctx.arc(n.x, n.y, haloR, 0, Math.PI * 2);
        ctx.fillStyle = hg; ctx.fill();

        // core
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `${n.color}${alp})`; ctx.fill();

        // white highlight when repelled
        if (n.hoverScale > 1.15) {
          ctx.beginPath(); ctx.arc(n.x, n.y, r * 0.42, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${(n.hoverScale - 1) * 1.3})`; ctx.fill();
        }
      }

      rafId = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      section.removeEventListener("mousemove", onMouseMove);
      section.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none select-none ${className}`}
      style={{ display: "block" }}
    />
  );
}
