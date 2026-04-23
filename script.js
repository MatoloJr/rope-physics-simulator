//  VEC2 2D vector utility 
class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }

  setXY(x, y)  { this.x = x; this.y = y; return this; }
  add(v)       { this.x += v.x; this.y += v.y; return this; }
  sub(v)       { this.x -= v.x; this.y -= v.y; return this; }
  mult(s)      { this.x *= s;   this.y *= s;   return this; }
  clone()      { return new Vec2(this.x, this.y); }

  static sub(a, b)  { return new Vec2(a.x - b.x, a.y - b.y); }
  static dist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

//  POINT single Verlet particle
class Point {
  constructor(x, y, pinned = false) {
    this.pos     = new Vec2(x, y);
    this.oldPos  = new Vec2(x, y);
    this.pinned  = pinned;
    this.friction = 0.984;
    this.gravity  = new Vec2(0, 0.36);
  }

  /**
   * Verlet integration step.
   *
   * Force calculation (dimensionless, 0 – 1):
   *   force = max( (R – d) / R, 0 )
   *
   *   where:
   *     R  = mouse.radius  (influence zone in screen pixels)
   *     d  = Euclidean distance from node to pointer (pixels)
   *
   *   Unit interpretation: "px/r" the fraction of the radius
   *   the node sits inside (0 = at boundary, 1 = at centre).
   *   Values above 0.6 trigger a direct snap to the pointer.
   */
  update(mouse, useGravity, useMouseForce, wind) {
    if (this.pinned) return;

    // Velocity derived implicitly from position history
    let vel = Vec2.sub(this.pos, this.oldPos);
    this.oldPos.setXY(this.pos.x, this.pos.y);

    vel.mult(this.friction);
    if (useGravity) vel.add(this.gravity);
    if (wind !== 0) vel.add(new Vec2(wind, 0));

    // Pointer (mouse / touch) attraction
    if (useMouseForce && mouse.active) {
      const dx   = mouse.pos.x - this.pos.x;
      const dy   = mouse.pos.y - this.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

      // Normalised direction vector toward pointer
      const direction = new Vec2(dx / dist, dy / dist);

      // Proximity-based force scalar  (unit: px/r see JSDoc above)
      const force = Math.max((mouse.radius - dist) / mouse.radius, 0);

      if (force > 0.6) {
        // Strong pull: snap node directly to pointer
        this.pos.setXY(mouse.pos.x, mouse.pos.y);
      } else {
        this.pos.add(vel);
        this.pos.add(direction.mult(force * 1.4));
      }
    } else {
      this.pos.add(vel);
    }
  }

  // Keep nodes within canvas bounds
  constrain(w, h) {
    if (this.pos.x < 0) {
      this.pos.x = 0;
      this.oldPos.x = this.pos.x + (this.pos.x - this.oldPos.x) * -0.5;
    }
    if (this.pos.x > w) {
      this.pos.x = w;
      this.oldPos.x = this.pos.x + (this.pos.x - this.oldPos.x) * -0.5;
    }
    if (this.pos.y > h) {
      this.pos.y = h;
      this.oldPos.y = this.pos.y + (this.pos.y - this.oldPos.y) * -0.5;
    }
  }
}

//  STICK rigid distance constraint between two Points
class Stick {
  constructor(p0, p1) {
    this.p0     = p0;
    this.p1     = p1;
    this.length = Vec2.dist(p0.pos, p1.pos);
  }

  solve() {
    const dx   = this.p1.pos.x - this.p0.pos.x;
    const dy   = this.p1.pos.y - this.p0.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    const diff = (dist - this.length) / dist * 0.5;
    const ox   = dx * diff;
    const oy   = dy * diff;

    if (!this.p0.pinned) { this.p0.pos.x += ox; this.p0.pos.y += oy; }
    if (!this.p1.pinned) { this.p1.pos.x -= ox; this.p1.pos.y -= oy; }
  }
}

//  ROPE chain of Points connected by Sticks
class Rope {
  constructor(x, segments, segLen) {
    this.points = [];
    this.sticks = [];

    for (let i = 0; i <= segments; i++) {
      const pinned = i === 0;
      const p = new Point(x, i * segLen, pinned);

      // Slight horizontal jitter so ropes don't stack perfectly
      if (!pinned) {
        const jitter = (Math.random() - 0.5) * 3;
        p.pos.x    += jitter;
        p.oldPos.x += jitter;
      }
      this.points.push(p);
    }

    for (let i = 0; i < segments; i++) {
      this.sticks.push(new Stick(this.points[i], this.points[i + 1]));
    }
  }

  update(mouse, useGravity, useMouseForce, wind, W, H) {
    for (const p of this.points) {
      p.update(mouse, useGravity, useMouseForce, wind);
    }

    // Iterative constraint solving (more iterations = stiffer rope)
    const ITERS = 6;
    for (let i = 0; i < ITERS; i++) {
      for (const s of this.sticks) s.solve();
      for (const p of this.points) p.constrain(W, H);
    }
  }

  draw(ctx) {
    const pts = this.points;

    // Rope line
    ctx.beginPath();
    ctx.moveTo(pts[0].pos.x, pts[0].pos.y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].pos.x, pts[i].pos.y);
    }
    ctx.stroke();

    // Glowing tip node
    const tip = pts[pts.length - 1].pos;
    const grd = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 8);
    grd.addColorStop(0,   'rgba(212,175,106,0.95)');
    grd.addColorStop(0.5, 'rgba(212,175,106,0.30)');
    grd.addColorStop(1,   'rgba(212,175,106,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 8, 0, Math.PI * 2);
    ctx.fill();

    // Solid inner dot
    ctx.fillStyle = '#d4af6a';
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

//  SCENE CONFIG
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');

const ROPE_COUNT_DESKTOP = 34;
const ROPE_COUNT_MOBILE  = 20;
const SEG_COUNT          = 26;   // segments per rope

// Dynamic segment length computed in computeSegLen()
// Target: rope hangs to ~72% of screen height when at rest
// Total rope length = SEG_COUNT * SEG_LEN
// So SEG_LEN = (H * 0.72) / SEG_COUNT
function computeSegLen(screenH) {
  const targetLength = screenH * 0.72;
  return Math.max(12, Math.round(targetLength / SEG_COUNT));
}

let W, H, ropes  = [];
let ROPE_COUNT   = ROPE_COUNT_DESKTOP;
let SEG_LEN      = 28; // will be recalculated on resize

// Pointer state shared between mouse and touch
let pointer = {
  pos:    new Vec2(-9999, -9999),
  radius: 130,
  active: false
};

let useGravity    = true;
let useMouseForce = true;
let wind          = 0;
let windTarget    = 0;
let windEnabled   = false;   // tracks whether wind toggle is on
let windPhase     = 0;       // drives smooth bidirectional oscillation
let windTimer     = 0;       // time accumulator (ms)
let isTouchDevice = false;

//  BUILD / RESIZE
function buildRopes() {
  ropes = [];
  ROPE_COUNT = window.innerWidth <= 768 ? ROPE_COUNT_MOBILE : ROPE_COUNT_DESKTOP;
  SEG_LEN    = computeSegLen(H);

  for (let i = 0; i < ROPE_COUNT; i++) {
    const x = (i / (ROPE_COUNT - 1)) * W;
    ropes.push(new Rope(x, SEG_COUNT, SEG_LEN));
  }
}

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  buildRopes();
}

window.addEventListener('resize', resize);
resize();

//  MOUSE EVENTS
const cursorEl     = document.getElementById('cursor');
const cursorRingEl = document.getElementById('cursor-ring');

window.addEventListener('mousemove', e => {
  if (isTouchDevice) return;

  pointer.pos.setXY(e.clientX, e.clientY);
  pointer.active = true;

  cursorEl.style.left = e.clientX + 'px';
  cursorEl.style.top  = e.clientY + 'px';

  cursorRingEl.style.left   = e.clientX + 'px';
  cursorRingEl.style.top    = e.clientY + 'px';
  cursorRingEl.style.width  = pointer.radius * 2 + 'px';
  cursorRingEl.style.height = pointer.radius * 2 + 'px';
});

window.addEventListener('mouseleave', () => {
  pointer.active = false;
});

// Click = scatter burst
window.addEventListener('click', e => {
  if (isTouchDevice) return;
  scatterBurst(e.clientX, e.clientY);
});

window.addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') buildRopes();
});

//  TOUCH EVENTS
function getTouchPos(touch) {
  return { x: touch.clientX, y: touch.clientY };
}

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  isTouchDevice = true;
  const t = e.touches[0];
  const { x, y } = getTouchPos(t);
  pointer.pos.setXY(x, y);
  pointer.active = true;
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const t = e.touches[0];
  const { x, y } = getTouchPos(t);
  pointer.pos.setXY(x, y);
  pointer.active = true;
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  if (e.touches.length === 0) {
    scatterBurst(pointer.pos.x, pointer.pos.y);
    pointer.active = false;
  }
}, { passive: false });

canvas.addEventListener('touchcancel', () => {
  pointer.active = false;
}, { passive: true });

//  SCATTER BURST (shared by click & tap)
function scatterBurst(cx, cy) {
  const BURST_RADIUS = 220;
  const BURST_FORCE  = 20;

  for (const rope of ropes) {
    for (const p of rope.points) {
      if (p.pinned) continue;
      const dx   = p.pos.x - cx;
      const dy   = p.pos.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist < BURST_RADIUS) {
        const f = (BURST_RADIUS - dist) / BURST_RADIUS * BURST_FORCE;
        p.oldPos.x = p.pos.x + (dx / dist) * -f;
        p.oldPos.y = p.pos.y + (dy / dist) * -f;
      }
    }
  }
}

//  CONTROLS desktop sidebar
document.getElementById('btn-gravity').addEventListener('click', function () {
  useGravity = !useGravity;
  this.classList.toggle('active', useGravity);
  // keep mobile panel in sync
  document.getElementById('mob-btn-gravity').classList.toggle('active', useGravity);
});

document.getElementById('btn-mouse').addEventListener('click', function () {
  useMouseForce = !useMouseForce;
  this.classList.toggle('active', useMouseForce);
  document.getElementById('mob-btn-mouse').classList.toggle('active', useMouseForce);
});

document.getElementById('btn-wind').addEventListener('click', function () {
  windEnabled = !windEnabled;
  if (!windEnabled) { windTarget = 0; }
  this.classList.toggle('active', windEnabled);
  document.getElementById('mob-btn-wind').classList.toggle('active', windEnabled);
});

document.getElementById('btn-reset').addEventListener('click', () => buildRopes());

// Set initial active states on desktop
document.getElementById('btn-gravity').classList.toggle('active', useGravity);
document.getElementById('btn-mouse').classList.toggle('active', useMouseForce);

//  MOBILE PANEL CONTROLS
const mobPanel      = document.getElementById('mob-panel');
const mobToggleBtn  = document.getElementById('mob-toggle');

mobToggleBtn.addEventListener('click', e => {
  e.stopPropagation();
  const open = mobPanel.classList.toggle('open');
  mobToggleBtn.classList.toggle('active', open);
});

// Close panel when tapping outside
document.addEventListener('click', e => {
  if (!mobPanel.contains(e.target) && e.target !== mobToggleBtn) {
    mobPanel.classList.remove('open');
    mobToggleBtn.classList.remove('active');
  }
});

document.getElementById('mob-btn-gravity').addEventListener('click', function () {
  useGravity = !useGravity;
  this.classList.toggle('active', useGravity);
  document.getElementById('btn-gravity').classList.toggle('active', useGravity);
});

document.getElementById('mob-btn-mouse').addEventListener('click', function () {
  useMouseForce = !useMouseForce;
  this.classList.toggle('active', useMouseForce);
  document.getElementById('btn-mouse').classList.toggle('active', useMouseForce);
});

document.getElementById('mob-btn-wind').addEventListener('click', function () {
  windEnabled = !windEnabled;
  if (!windEnabled) { windTarget = 0; }
  this.classList.toggle('active', windEnabled);
  document.getElementById('btn-wind').classList.toggle('active', windEnabled);
});

document.getElementById('mob-btn-reset').addEventListener('click', () => buildRopes());

// Sync initial mobile states
document.getElementById('mob-btn-gravity').classList.toggle('active', useGravity);
document.getElementById('mob-btn-mouse').classList.toggle('active', useMouseForce);

//  RENDER LOOP
let lastTime     = 0;
let fps          = 60;
let currentForce = 0;

function frame(ts) {
  const dt = ts - lastTime || 16;
  lastTime = ts;

  fps = fps * 0.92 + (1000 / dt) * 0.08;

  // Bidirectional wind: smoothly wander target using layered sine waves.
  // Three frequencies combine to produce a natural, never-looping pattern
  // that drifts between ~-0.84 and ~+0.84, crossing zero (reversing direction)
  // organically. Only updates windTarget when wind is enabled; disabling wind
  // fades windTarget back to 0 so ropes settle without a sudden stop.
  if (windEnabled) {
    windTimer += dt;
    windPhase += dt * 0.00018;                               // slow primary drift
    const gust = Math.sin(windPhase) * 0.55                  // broad sweep
               + Math.sin(windPhase * 3.7 + 1.3) * 0.22    // mid gust
               + Math.sin(windPhase * 11.1 + 2.9) * 0.07;  // flutter
    windTarget = gust;
  }

  // Lerp actual wind toward target provides smooth inertia on direction changes
  wind += (windTarget - wind) * 0.018;

  let maxForce = 0;
  if (pointer.active && useMouseForce) {
    for (const rope of ropes) {
      for (const p of rope.points) {
        if (p.pinned) continue;
        const dx   = pointer.pos.x - p.pos.x;
        const dy   = pointer.pos.y - p.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const f    = Math.max((pointer.radius - dist) / pointer.radius, 0);
        if (f > maxForce) maxForce = f;
      }
    }
  }
  currentForce = currentForce * 0.82 + maxForce * 0.18;

  ctx.clearRect(0, 0, W, H);

  const bg = ctx.createLinearGradient(0, 0, 0, H * 0.45);
  bg.addColorStop(0, 'rgba(14,14,18,0.55)');
  bg.addColorStop(1, 'rgba(13,13,15,0)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(220,215,200,0.62)';
  ctx.lineWidth   = 1.15;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  for (const rope of ropes) {
    rope.update(pointer, useGravity, useMouseForce, wind, W, H);
    rope.draw(ctx);
  }

  if (pointer.active) {
    ctx.beginPath();
    ctx.arc(pointer.pos.x, pointer.pos.y, pointer.radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200,168,75,0.11)';
    ctx.lineWidth   = 1;
    ctx.stroke();
  }

  document.getElementById('st-nodes').textContent = ROPE_COUNT * (SEG_COUNT + 1);
  document.getElementById('st-ropes').textContent = ROPE_COUNT;
  document.getElementById('st-fps').textContent   = Math.round(fps);
  document.getElementById('st-force').textContent = currentForce.toFixed(2);

  const pct  = Math.min(currentForce * 100, 100);
  const fill = document.getElementById('force-bar-fill');
  fill.style.width = pct + '%';
  fill.style.background = currentForce > 0.6
    ? 'linear-gradient(90deg, #e05252, #ff8080)'
    : 'linear-gradient(90deg, #c8a84b, #e8c96a)';

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);