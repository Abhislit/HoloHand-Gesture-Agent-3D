import assert from 'node:assert/strict';
import { Portal } from './portal.js';

const dt = 1 / 60;
const hand = (id, x, y, gesture = 'OPEN') => ({
  id,
  palm: { x, y },
  tip: { x, y },
  gesture,
  held: false,
});

function run(p, handsFor, seconds) {
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    p.update(handsFor(i * dt), dt);
  }
}

// 1. Both open hands circling arm the portal.
{
  const p = new Portal();
  const circle = (t) => {
    const a = t * Math.PI * 2;
    return [
      hand('L', 0.35 + Math.cos(a) * 0.12, 0.5 + Math.sin(a) * 0.12),
      hand('R', 0.65 + Math.cos(a) * 0.12, 0.5 + Math.sin(a) * 0.12),
    ];
  };
  run(p, circle, 2);
  assert.ok(p.armed, 'circling should arm');
  assert.ok(p.open > 0.8, `portal should open, got ${p.open}`);
}

// 2. Still open hands never arm.
{
  const p = new Portal();
  run(p, () => [hand('L', 0.35, 0.5), hand('R', 0.65, 0.5)], 3);
  assert.equal(p.armed, false, 'still hands must not arm');
  assert.ok(p.open < 0.01, `portal must stay closed, got ${p.open}`);
}

// 3. A single circling hand is not enough.
{
  const p = new Portal();
  run(p, (t) => [hand('L', 0.5 + Math.cos(t * Math.PI * 2) * 0.12, 0.5 + Math.sin(t * Math.PI * 2) * 0.12)], 3);
  assert.equal(p.armed, false, 'one hand must not arm');
}

// 4. Dropping the hands closes it again.
{
  const p = new Portal();
  const circle = (t) => {
    const a = t * Math.PI * 2;
    return [
      hand('L', 0.35 + Math.cos(a) * 0.12, 0.5 + Math.sin(a) * 0.12),
      hand('R', 0.65 + Math.cos(a) * 0.12, 0.5 + Math.sin(a) * 0.12),
    ];
  };
  run(p, circle, 2);
  run(p, () => [], 2);
  assert.equal(p.armed, false, 'hands gone should disarm');
  assert.ok(p.open < 0.01, `portal should close, got ${p.open}`);
}

console.log('portal ok');
