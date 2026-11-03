import test from 'node:test';
import assert from 'node:assert/strict';
import { createBout, stepBout, getBoutResult } from '../src/combat.js';

const keys = ['power', 'speed', 'accuracy', 'reflexes', 'stamina', 'cardio', 'chin', 'defense', 'footwork', 'technique', 'mental', 'iq'];
const boxer = (name = 'Test', value = 50) => ({ name, attributes: Object.fromEntries(keys.map(key => [key, value])) });
const advance = (bout, seconds, input = {}) => {
  for (let n = 0; n < Math.ceil(seconds * 60); n++) stepBout(bout, 1 / 60, input);
  return bout;
};
const closeDistance = bout => { bout.player.x = 450; bout.opponent.x = 550; };

test('punches miss outside reach and land when the boxer closes distance', () => {
  const b = createBout(boxer(), boxer(), { ai: false, rng: () => 0.1 });
  advance(b, 0.6, { jab: true });
  assert.equal(b.opponent.hp, 100);
  assert.ok(b.events.some(e => e.type === 'miss'));
  const original = b.player.x;
  advance(b, 0.8, { moveX: 1 });
  assert.ok(b.player.x > original);
  closeDistance(b);
  advance(b, 0.6, { jab: true });
  assert.ok(b.opponent.hp < 100);
  assert.ok(b.player.landed >= 1);
});

test('ring bounds and collision keep boxers inside the ropes and apart', () => {
  const b = createBout(boxer(), boxer(), { ai: false });
  advance(b, 10, { moveX: -1, moveY: -1 });
  assert.equal(b.player.x, 65);
  assert.equal(b.player.y, 65);
  b.player.x = 500; b.player.y = 300; b.opponent.x = 550;
  advance(b, 2, { moveX: 1 });
  assert.ok(Math.hypot(b.player.x - b.opponent.x, b.player.y - b.opponent.y) >= 71.99);
});

test('repeated power punches consume stamina and rest restores it', () => {
  const b = createBout(boxer(), boxer(), { ai: false, rng: () => 0.1 });
  advance(b, 5, { uppercut: true });
  const tired = b.player.stamina;
  assert.ok(tired < 50);
  advance(b, 4);
  assert.ok(b.player.stamina > tired + 20);
  assert.ok(b.player.stamina <= 100);
});

test('guard reduces incoming damage while consuming stamina', () => {
  const open = createBout(boxer(), boxer(), { rng: () => 0.1 });
  const guard = createBout(boxer(), boxer(), { rng: () => 0.1 });
  closeDistance(open); closeDistance(guard);
  advance(open, 3);
  advance(guard, 3, { block: true });
  assert.ok(open.player.hp < guard.player.hp);
  assert.ok(guard.events.some(e => e.type === 'hit' && e.blocked));
  assert.ok(guard.player.stamina < 100);
});

test('dodge has a cost, avoids an impact, and cannot be held to dodge forever', () => {
  const b = createBout(boxer(), boxer(), { rng: () => 0.1 });
  closeDistance(b);
  stepBout(b, 1 / 60, { dodge: true });
  assert.equal(b.player.action, 'dodge');
  assert.ok(b.player.stamina < 100);
  advance(b, 0.3, { dodge: true });
  assert.equal(b.player.hp, 100);
  advance(b, 2, { dodge: true });
  assert.notEqual(b.player.action, 'dodge');
});

test('round timer, break and scorecards produce a final decision', () => {
  const b = createBout(boxer(), boxer(), { rounds: 2, roundSeconds: 3, ai: false });
  advance(b, 3);
  assert.equal(b.phase, 'break');
  assert.equal(b.scorecards.length, 1);
  advance(b, 5);
  assert.equal(b.round, 2);
  advance(b, 3.1);
  const result = getBoutResult(b);
  assert.equal(b.phase, 'finished');
  assert.equal(result.outcome, 'draw');
  assert.equal(result.method, 'Décision');
  assert.equal(result.scorecards.length, 2);
  assert.deepEqual(result.totals, { player: 20, opponent: 20 });
});

test('clean punches win a decision and damage decides the 10-point score', () => {
  const b = createBout(boxer(), boxer(), { rounds: 1, roundSeconds: 3, ai: false, rng: () => 0.1 });
  closeDistance(b);
  advance(b, 3.1, { jab: true });
  const result = getBoutResult(b);
  assert.equal(result.outcome, 'win');
  assert.deepEqual(result.totals, { player: 10, opponent: 9 });
});

test('successive knockdowns end a bout and finished state remains unchanged', () => {
  const b = createBout(boxer('Fort', 100), boxer('Faible', 5), { rounds: 3, roundSeconds: 180, ai: false, rng: () => 0.1 });
  for (let n = 0; n < 60 * 60 && b.phase !== 'finished'; n++) {
    closeDistance(b);
    stepBout(b, 1 / 60, { hook: true });
  }
  assert.equal(b.phase, 'finished');
  assert.equal(b.winner, 'player');
  assert.ok(['KO', 'TKO'].includes(b.method));
  assert.ok(b.opponent.knockdowns >= 2);
  const result = getBoutResult(b);
  const elapsed = b.elapsed;
  advance(b, 3, { jab: true });
  assert.deepEqual(getBoutResult(b), result);
  assert.equal(b.elapsed, elapsed);
  assert.ok(b.events.length <= 20);
});

test('AI moves into range and actively attacks an idle player', () => {
  const b = createBout(boxer(), boxer(), { rng: () => 0.1 });
  advance(b, 8);
  assert.ok(b.opponent.thrown > 0);
  assert.ok(b.player.hp < 100);
  assert.ok(b.opponent.x < 650);
});
