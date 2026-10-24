import assert from 'node:assert';
import { CircleDetector } from './strange.js';

// a hand drawing a full circle around (200,200) must fire once
const d = new CircleDetector();
let hit = null;
for (let i = 0; i <= 40 && !hit; i++) {
  const a = (i / 40) * Math.PI * 2;
  hit = d.push(200 + Math.cos(a) * 80, 200 + Math.sin(a) * 80, i * 0.03);
}
assert.ok(hit, 'circle should open the portal');
assert.ok(hit.r > 60 && hit.r < 90, 'radius follows the palm path');

// a straight swipe must not
const s = new CircleDetector();
let swipe = null;
for (let i = 0; i <= 40 && !swipe; i++) swipe = s.push(100 + i * 6, 200, i * 0.03);
assert.equal(swipe, null, 'straight line must not fire');

// a tiny wobble must not
const w = new CircleDetector();
let wob = null;
for (let i = 0; i <= 40 && !wob; i++) {
  const a = (i / 40) * Math.PI * 2;
  wob = w.push(200 + Math.cos(a) * 10, 200 + Math.sin(a) * 10, i * 0.03);
}
assert.equal(wob, null, 'too-small circle must not fire');

console.log('strange ok');
