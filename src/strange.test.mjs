import assert from 'node:assert';
import { CircleDetector, Portal, TwistDetector } from './strange.js';

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

// wrist tilt is clamped and eased, and hand size drives the ring radius
portal.tiltTo(9);
assert.equal(portal.tiltT, 1, 'tilt clamps to +1');
portal.sizeTo(9999);
assert.equal(portal.Rt, Math.min(portal.W, portal.H) * 0.46, 'radius clamps to the max');
for (let i = 0; i < 60; i++) portal.update(1 / 60);
assert.ok(portal.tilt > 0.99 && portal.tilt <= 1, 'tilt eases toward its clamp');

// a wrist rolled 150 degrees in place must fire exactly once
const tw = new TwistDetector();
const hits = [];
for (let i = 0; i < 40; i++) {
  const h = tw.push(0.08, { x: 200, y: 200 }, i / 60);
  if (h) hits.push(h);
}
assert.equal(hits.length, 1, `one in-place twist, got ${hits.length}`);
assert.equal(hits[0].dir, 1, 'roll direction is preserved');

// the opposite roll fires with the opposite sign
const twNeg = new TwistDetector();
let neg = null;
for (let i = 0; i < 40 && !neg; i++) neg = twNeg.push(-0.08, { x: 200, y: 200 }, i / 60);
assert.ok(neg && neg.dir === -1, 'counter-roll fires negative');

// the same roll while the palm slides away must not fire
const twDrift = new TwistDetector();
let drifted = null;
for (let i = 0; i < 40 && !drifted; i++) {
  drifted = twDrift.push(0.08, { x: 200 + i * 6, y: 200 }, i / 60);
}
assert.equal(drifted, null, 'rolling while the hand travels must not open');

// the sigil preview grows with the roll and clamps at 1
const tp = new TwistDetector();
assert.equal(tp.progress(), 0, 'no roll yet');
for (let i = 0; i < 10; i++) tp.push(0.1, { x: 200, y: 200 }, i / 60);
const pRoll = tp.progress();
assert.ok(pRoll > 0 && pRoll < 1, `partial roll should be partial, got ${pRoll}`);
tp.sum = 5;
assert.equal(tp.progress(), 1, 'progress clamps at 1');

console.log('strange ok');
