# Rope Physics Simulation (Verlet Integration)

An interactive browser-based rope simulation built with vanilla JavaScript and HTML5 Canvas.

This project renders multiple rope strands in real time using **Verlet integration** and **distance constraints**. You can influence the simulation with your mouse, trigger impulse bursts, and toggle environment forces like gravity and wind.

## Overview

This simulation models ropes as chains of particles connected by fixed-length constraints:

- Each rope is a sequence of `Point` particles.
- Neighboring particles are connected by `Stick` constraints.
- The first particle of each rope is pinned to the top (anchored).
- Particle motion uses Verlet integration (`current position - previous position`) instead of explicit velocity storage.
- Constraint solving runs multiple iterations per frame to keep ropes stable and length-preserving.

The result is a smooth, lightweight, and visually rich rope system that reacts naturally to user interaction.

## Features

- Real-time multi-rope simulation on full-screen canvas
- Verlet integration for stable particle motion
- Distance constraint solving for rope segment rigidity
- Mouse attraction field with variable force
- Click-based radial scatter burst (impulse)
- Toggleable gravity and wind controls
- Runtime simulation stats:
  - rope count
  - total node count
  - FPS estimate
  - current interaction force
- Custom animated cursor + force radius ring
- Keyboard reset shortcut (`R`)
- Responsive rebuild on window resize

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript (ES6+)
- Canvas 2D API
- Google Fonts (`JetBrains Mono`, `Space Mono`)

No external JS frameworks or build tools are required.

## Project Structure

- `index.html`
  - App layout
  - Canvas mount point
  - UI overlays (label, tip, controls, stats)
- `styles.css`
  - Visual theme variables
  - Full-screen canvas and overlays
  - Custom cursor and ring styling
  - Controls and stats bar styling
- `script.js`
  - Physics data structures and solver
  - Input handling (mouse, click, keyboard)
  - Simulation loop and rendering

## How to Run

### Option 1: Open directly

1. Open `index.html` in a browser.
2. Move your mouse over the canvas to interact.

### Option 2: Use a local server (recommended)

Using a local server avoids potential browser restrictions and better mimics deployment:

```bash
# Python 3
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Controls

### Mouse

- Move mouse: attracts rope particles within the interaction radius
- Click: emits a scatter burst that pushes nearby particles away from click center

### Keyboard

- `R`: reset and rebuild all ropes

### UI Buttons (right side)

- `↓` Gravity toggle
- `⊙` Mouse force toggle
- `≋` Wind toggle
- `↺` Reset simulation

## Simulation Internals

### 1) Vector Utility (`Vec2`)

A minimal 2D vector helper class for common operations:

- `setXY`, `add`, `sub`, `mult`, `clone`
- static operations: `sub(a, b)`, `dist(a, b)`

This keeps math expressions concise throughout the solver.

### 2) Particle Model (`Point`)

Each point stores:

- `pos`: current position
- `oldPos`: previous frame position
- `pinned`: whether the particle is fixed
- `friction`: damping on implicit velocity
- `gravity`: acceleration vector

Update step logic:

1. Compute implicit velocity: `vel = pos - oldPos`
2. Move `oldPos` to current `pos`
3. Apply damping (`friction`)
4. Add optional gravity and wind
5. Apply mouse interaction when active
6. Integrate by adding velocity/forces to `pos`

Boundary constraint:

- Horizontal clamping at `x = [0, W]`
- Bottom clamping at `y <= H`
- Bounce-like response by adjusting `oldPos`

### 3) Distance Constraint (`Stick`)

A stick enforces fixed distance between two points:

- `length` initialized from initial spacing
- Each solve pass computes current distance error
- Correction offset is split between both endpoints
- Pinned points are excluded from movement

This is the core mechanism that preserves rope shape.

### 4) Rope Composition (`Rope`)

A rope creates:

- `segments + 1` points
- `segments` sticks between neighbors

Design details:

- First point is pinned (anchor)
- Non-pinned points receive slight random x-offset at spawn
  - prevents perfect overlap among ropes

Per-frame rope update:

1. Update all points
2. Run solver iterations (`ITERS = 5`)
3. Each iteration:
   - solve all sticks
   - apply point boundary constraints

### 5) Main Loop

`requestAnimationFrame(frame)` drives render/update.

Each frame:

1. Compute smoothed FPS
2. Smooth wind toward `windTarget`
3. Estimate strongest current mouse force over all nodes
4. Clear and paint subtle background gradient
5. Update and draw every rope
6. Draw interaction radius hint circle
7. Update stats UI and force meter

## Visual Design Notes

The UI and rendering style intentionally use a low-light technical aesthetic:

- dark background and translucent panels
- soft gold accent for active dynamics and highlights
- monospaced typography for instrumentation feel
- glowing rope tips for motion readability

## Tunable Parameters

These constants in `script.js` control simulation behavior:

- `ROPE_COUNT = 34`
  - number of rope strands
- `SEG_COUNT = 14`
  - segments per rope
- `SEG_LEN = 18`
  - distance between points at rest
- `Point.friction = 0.982`
  - velocity damping (lower = more damping)
- `Point.gravity = (0, 0.38)`
  - gravity strength
- `mouse.radius = 120`
  - interaction radius
- `ITERS = 5`
  - constraint solve iterations per frame
- click burst radius/strength in click handler (`200`, `18`)

### Practical tuning guidance

- For stiffer, more stable ropes:
  - increase `ITERS`
- For softer, stretchier feel:
  - reduce `ITERS` or increase `SEG_LEN`
- For heavier motion:
  - increase gravity and/or reduce friction
- For better performance on weaker devices:
  - reduce `ROPE_COUNT` and `SEG_COUNT`

## Performance Characteristics

Runtime cost scales primarily with:

- total points: `ROPE_COUNT * (SEG_COUNT + 1)`
- total sticks: `ROPE_COUNT * SEG_COUNT`
- solver iterations per frame

Approximate complexity per frame is proportional to:

```text
O(ropes * segments * iterations)
```

Current defaults target a good balance of smoothness and visual density for modern desktop browsers.

## Browser Compatibility

Expected to work in current versions of:

- Chrome / Edge (Chromium)
- Firefox
- Safari

Requires support for:

- ES6 classes
- `requestAnimationFrame`
- Canvas 2D API

## Troubleshooting

- Simulation feels slow:
  - lower `ROPE_COUNT` and/or `SEG_COUNT`
  - reduce display resolution or close heavy tabs
- Ropes appear too jittery:
  - increase `ITERS`
  - slightly increase friction toward `1.0`
- Mouse interaction feels too strong:
  - lower interaction multiplier in `Point.update()`
  - reduce `mouse.radius`

## Possible Extensions

- Pin/unpin points dynamically by click
- Add rope cutting/splitting
- Add collision with scene objects
- Add touch gestures and mobile-specific controls
- Add color modes and per-rope parameter variance
- Add pause/step simulation debugging tools
- Add preset profiles (calm, storm, chaotic)

## License

No license file is currently included in this repository.
If you plan to share or reuse this project publicly, consider adding a license such as MIT.

## Credits

Built as a lightweight physics visualization demonstrating rope behavior via Verlet integration and iterative constraints in pure browser tech.
