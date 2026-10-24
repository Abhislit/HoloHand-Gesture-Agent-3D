import assert from 'node:assert';
import { CircleDetector, Portal } from './strange.js';

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

// preview grows with the sweep, and resets with the detector
const pv = new CircleDetector();
assert.equal(pv.progress(), 0, 'no path yet');
for (let i = 0; i <= 10; i++) {
  const a = (i / 40) * Math.PI * 2;
  pv.push(200 + Math.cos(a) * 80, 200 + Math.sin(a) * 80, i * 0.03);
}
const p10 = pv.progress();
assert.ok(p10 > 0 && p10 < 1, `quarter turn should be partial, got ${p10}`);
for (let i = 11; i <= 40; i++) {
  const a = (i / 40) * Math.PI * 2;
  pv.push(200 + Math.cos(a) * 80, 200 + Math.sin(a) * 80, i * 0.03);
}
assert.equal(pv.progress(), 1, 'full turn saturates the preview');

// the ring eases toward the hand it is following, and stops previewing
const portal = new Portal({ getContext: () => ({}) });
portal.aim(0, 0, 0.5);
assert.ok(portal.visible, 'preview alone makes the portal visible');
portal.follow(100, 100);
portal.stop();
assert.equal(portal.preview, 0, 'stop clears the preview');
for (let i = 0; i < 20; i++) portal.update(1 / 60);
assert.ok(Math.abs(portal.cx - 100) < 1 && Math.abs(portal.cy - 100) < 1, 'centre tracks the hand');

console.log('strange ok');
