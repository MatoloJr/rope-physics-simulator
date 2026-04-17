//  UTILITIES
class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  setXY(x, y) { this.x = x; this.y = y; return this; }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(s) { this.x *= s; this.y *= s; return this; }
  clone() { return new Vec2(this.x, this.y); }
  static sub(a, b) { return new Vec2(a.x - b.x, a.y - b.y); }
  static dist(a, b) { const dx = a.x-b.x, dy = a.y-b.y; return Math.sqrt(dx*dx+dy*dy); }
}

//  POINT (particle)
class Point {
  constructor(x, y, pinned = false) {
    this.pos    = new Vec2(x, y);
    this.oldPos = new Vec2(x, y);
    this.pinned = pinned;
    this.friction = 0.982;
    this.gravity  = new Vec2(0, 0.38);
  }

  update(mouse, useGravity, useMouseForce, wind) {
    if (this.pinned) return;

    // Verlet: derive velocity from displacement
    let vel = Vec2.sub(this.pos, this.oldPos);
    this.oldPos.setXY(this.pos.x, this.pos.y);

    vel.mult(this.friction);
    if (useGravity) vel.add(this.gravity);
    if (wind !== 0) vel.add(new Vec2(wind, 0));

    // Mouse interaction
    if (useMouseForce && mouse.active) {
      let { x: dx, y: dy } = Vec2.sub(mouse.pos, this.pos);
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const direction = new Vec2(dx / dist, dy / dist);
      const force = Math.max((mouse.radius - dist) / mouse.radius, 0);

      if (force > 0.6) {
        this.pos.setXY(mouse.pos.x, mouse.pos.y);
      } else {
        this.pos.add(vel);
        this.pos.add(direction.mult(force * 1.4));
      }
    } else {
      this.pos.add(vel);
    }
  }

  constrain(w, h) {
    if (this.pos.x < 0)  { this.pos.x = 0;  this.oldPos.x = this.pos.x + (this.pos.x - this.oldPos.x) * -0.5; }
    if (this.pos.x > w)  { this.pos.x = w;  this.oldPos.x = this.pos.x + (this.pos.x - this.oldPos.x) * -0.5; }
    if (this.pos.y > h)  { this.pos.y = h;  this.oldPos.y = this.pos.y + (this.pos.y - this.oldPos.y) * -0.5; }
  }
}

//  STICK (distance constraint)
class Stick {
  constructor(p0, p1) {
    this.p0 = p0;
    this.p1 = p1;
    this.length = Vec2.dist(p0.pos, p1.pos);
  }

  solve() {
    const dx = this.p1.pos.x - this.p0.pos.x;
    const dy = this.p1.pos.y - this.p0.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    const diff = (dist - this.length) / dist * 0.5;
    const ox = dx * diff;
    const oy = dy * diff;

    if (!this.p0.pinned) { this.p0.pos.x += ox; this.p0.pos.y += oy; }
    if (!this.p1.pinned) { this.p1.pos.x -= ox; this.p1.pos.y -= oy; }
  }
}

//  ROPE
class Rope {
  constructor(x, canvasH, segments, segLen) {
    this.points = [];
    this.sticks = [];

    for (let i = 0; i <= segments; i++) {
      const pinned = i === 0;
      const p = new Point(x, i * segLen, pinned);
      // slight random offset so ropes don't overlap perfectly
      if (!pinned) {
        p.oldPos.x += (Math.random() - 0.5) * 2;
        p.pos.x    += (Math.random() - 0.5) * 2;
      }
      this.points.push(p);
    }

    for (let i = 0; i < segments; i++) {
      this.sticks.push(new Stick(this.points[i], this.points[i + 1]));
    }
  }

  update(mouse, useGravity, useMouseForce, wind, W, H) {
    for (const p of this.points) p.update(mouse, useGravity, useMouseForce, wind);
    const ITERS = 5;
    for (let i = 0; i < ITERS; i++) {
      for (const s of this.sticks) s.solve();
      for (const p of this.points) p.constrain(W, H);
    }
  }

  draw(ctx) {
    const pts = this.points;
    // rope line
    ctx.beginPath();
    ctx.moveTo(pts[0].pos.x, pts[0].pos.y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].pos.x, pts[i].pos.y);
    }
    ctx.stroke();

    // end node glow
    const tip = pts[pts.length - 1].pos;
    const grd = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 7);
    grd.addColorStop(0, 'rgba(212,175,106,0.95)');
    grd.addColorStop(0.5, 'rgba(212,175,106,0.35)');
    grd.addColorStop(1, 'rgba(212,175,106,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 7, 0, Math.PI * 2);
    ctx.fill();

    // solid dot
    ctx.fillStyle = '#d4af6a';
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

//  SCENE SETUP
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');

let W, H, simH, ropes = [];
const ROPE_COUNT   = 34;
const SEG_LEN      = 18;
const SEG_COUNT    = 14;

let mouse = { pos: new Vec2(-999, -999), radius: 120, active: false };
let useGravity    = true;
let useMouseForce = true;
let wind = 0, windTarget = 0;

function buildRopes() {
  ropes = [];
  for (let i = 0; i < ROPE_COUNT; i++) {
    const x = (i / (ROPE_COUNT - 1)) * W;
    ropes.push(new Rope(x, simH, SEG_COUNT, SEG_LEN));
  }
}

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  simH = H;
  buildRopes();
}

window.addEventListener('resize', resize);
resize();

// Mouse / touch
function updateMouse(x, y) {
  // only canvas area
  const active = y < simH;
  mouse.pos.setXY(x, y);
  mouse.active = active;
}

window.addEventListener('mousemove', e => {
  updateMouse(e.clientX, e.clientY);
  document.getElementById('cursor').style.left = e.clientX + 'px';
  document.getElementById('cursor').style.top  = e.clientY + 'px';
  document.getElementById('cursor-ring').style.left = e.clientX + 'px';
  document.getElementById('cursor-ring').style.top  = e.clientY + 'px';
  // scale ring to match mouse radius
  const r = mouse.radius;
  document.getElementById('cursor-ring').style.width  = r * 2 + 'px';
  document.getElementById('cursor-ring').style.height = r * 2 + 'px';
});

window.addEventListener('click', e => {
  // scatter burst on click
  const cx = e.clientX, cy = e.clientY;
  for (const rope of ropes) {
    for (const p of rope.points) {
      if (p.pinned) continue;
      const dx = p.pos.x - cx, dy = p.pos.y - cy;
      const dist = Math.sqrt(dx*dx+dy*dy) || 1;
      if (dist < 200) {
        const f = (200 - dist) / 200 * 18;
        p.oldPos.x = p.pos.x + (dx/dist) * -f;
        p.oldPos.y = p.pos.y + (dy/dist) * -f;
      }
    }
  }
});

window.addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') buildRopes();
});

// Controls
document.getElementById('btn-gravity').addEventListener('click', function() {
  useGravity = !useGravity;
  this.classList.toggle('active', useGravity);
});
document.getElementById('btn-mouse').addEventListener('click', function() {
  useMouseForce = !useMouseForce;
  this.classList.toggle('active', useMouseForce);
});
document.getElementById('btn-wind').addEventListener('click', function() {
  windTarget = windTarget === 0 ? 0.6 : 0;
  this.classList.toggle('active', windTarget !== 0);
});
document.getElementById('btn-reset').addEventListener('click', () => buildRopes());

// initial active state
document.getElementById('btn-gravity').classList.toggle('active', useGravity);

//  DRAW LOOP
let lastTime = 0, fps = 60, currentForce = 0;
function frame(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  fps = fps * 0.9 + (1000 / dt) * 0.1;

  wind += (windTarget - wind) * 0.02;

  // compute current mouse force on nearest node
  let maxForce = 0;
  if (mouse.active && useMouseForce) {
    for (const rope of ropes) {
      for (const p of rope.points) {
        if (p.pinned) continue;
        const dx = mouse.pos.x - p.pos.x;
        const dy = mouse.pos.y - p.pos.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 0.001;
        const f = Math.max((mouse.radius - dist) / mouse.radius, 0);
        if (f > maxForce) maxForce = f;
      }
    }
  }
  currentForce = currentForce * 0.85 + maxForce * 0.15;

  ctx.clearRect(0, 0, W, H);

  // subtle top gradient
  const bg = ctx.createLinearGradient(0, 0, 0, simH);
  bg.addColorStop(0, 'rgba(15,15,20,0.6)');
  bg.addColorStop(1, 'rgba(13,13,15,0)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, simH);

  // rope style
  ctx.strokeStyle = 'rgba(220,215,200,0.6)';
  ctx.lineWidth   = 1.1;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  for (const rope of ropes) {
    rope.update(mouse, useGravity, useMouseForce, wind, W, simH);
    rope.draw(ctx);
  }

  // mouse circle hint (only in sim area)
  if (mouse.active) {
    ctx.beginPath();
    ctx.arc(mouse.pos.x, mouse.pos.y, mouse.radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200,168,75,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // stats
  document.getElementById('st-nodes').textContent = ROPE_COUNT * (SEG_COUNT + 1);
  document.getElementById('st-ropes').textContent = ROPE_COUNT;
  document.getElementById('st-fps').textContent   = Math.round(fps);
  document.getElementById('st-force').textContent = currentForce.toFixed(2);
  const pct = Math.min(currentForce * 100, 100);
  const fill = document.getElementById('force-bar-fill');
  fill.style.width = pct + '%';
  fill.style.background = currentForce > 0.6
    ? 'linear-gradient(90deg,#e05252,#ff7a7a)'
    : 'linear-gradient(90deg,#c8a84b,#e8c96a)';

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);