import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareer, train, rest, advanceDay, bookFight, resolveFight, getOpponents, getRankings, validateSave, TRAININGS, ATTRIBUTES } from '../src/career.js';

const career = () => createCareer({ firstName: 'Zoé', lastName: 'Martin' }, () => 0.5);

test('creation produces all modest skills and individual potential, safe profile defaults', () => {
  const s = career();
  assert.equal(s.profile.firstName, 'Zoé');
  assert.equal(s.rank, 51);
  assert.equal(ATTRIBUTES.length, 12);
  assert.ok(ATTRIBUTES.every(a => s.attributes[a.key] < 50 && s.potential[a.key] >= 83));
  assert.equal(validateSave(s), true);
  assert.equal(createCareer({ shortColor: 'javascript:alert(1)' }).profile.shortColor, '#c9a35e');
  assert.equal(createCareer({ face: 'Ovale' }).profile.face, 'Ovale');
  assert.equal(createCareer({ face: '<script>' }).profile.face, 'Anguleux');
  assert.equal(validateSave(createCareer({ face: 'Rond' })), true);
  const legacy = structuredClone(s);
  delete legacy.profile.face;
  assert.equal(validateSave(legacy), true);
  legacy.profile.face = '<script>';
  assert.equal(validateSave(legacy), false);
});

test('real training consumes a day and energy, rewards performance, never exceeds potential', () => {
  const a = career(), b = career();
  assert.equal(train(a, 'bag', 1).ok, true);
  assert.equal(train(b, 'bag', 0.1).ok, true);
  assert.ok(a.attributes.power > b.attributes.power);
  assert.equal(a.day, 2);
  assert.equal(a.energy, 74);
  a.attributes.power = a.potential.power - 0.1;
  train(a, 'bag', 1);
  assert.equal(a.attributes.power, a.potential.power);
  a.energy = 0;
  const before = JSON.stringify(a);
  assert.equal(train(a, 'bag', 1).ok, false);
  assert.equal(JSON.stringify(a), before);
  assert.equal(rest(a).ok, true);
  assert.equal(a.energy, 34);
  assert.equal(validateSave(a), true);
});

test('every training exercises documented attributes; invalid actions do not mutate', () => {
  for (const t of TRAININGS) {
    const s = career();
    const before = { ...s.attributes };
    const r = train(s, t.id, 0.7);
    assert.equal(r.ok, true);
    assert.ok(t.attributes.every(key => s.attributes[key] > before[key]));
  }
  const s = career();
  const before = JSON.stringify(s);
  assert.equal(train(s, 'unknown').ok, false);
  assert.equal(train(s, 'bag', NaN).ok, false);
  assert.equal(rest(s, -1).ok, false);
  assert.equal(JSON.stringify(s), before);
});

test('opponents are stable, unique, category-matched and worldwide ranking includes player', () => {
  const s = career();
  const opponents = getOpponents(s);
  assert.ok(opponents.length >= 3);
  assert.deepEqual(opponents, getOpponents(s));
  const ranks = getRankings(s);
  assert.equal(ranks.length, 51);
  assert.equal(new Set(ranks.map(f => f.name)).size, 51);
  assert.equal(ranks[50].id, 'player');
  assert.ok(opponents.every(f => f.category === s.profile.category && f.rank < s.rank));
});

test('booking respects match availability and preparation cannot skip fight day', () => {
  const s = career();
  assert.equal(bookFight(s, 'unknown').ok, false);
  assert.equal(bookFight(s, getOpponents(s)[0].id).ok, true);
  assert.equal(s.scheduledFight.day, 4);
  assert.equal(bookFight(s, getOpponents(s)[1].id).ok, false);
  assert.equal(resolveFight(s, { outcome: 'win', method: 'KO', round: 1 }).ok, false);
  rest(s, 7);
  assert.equal(s.day, 4);
  assert.equal(advanceDay(s).ok, false);
  assert.equal(train(s, 'bag').ok, false);
  assert.equal(validateSave(s), true);
});

test('fight resolution updates career exactly once and records purse, KO and ranking', () => {
  const s = career();
  const o = getOpponents(s)[1];
  bookFight(s, o.id);
  rest(s, 3);
  const cash = s.money;
  const res = resolveFight(s, { outcome: 'win', method: 'KO', round: 2 });
  assert.equal(res.ok, true);
  assert.equal(s.rank, o.rank);
  assert.equal(s.record.wins, 1);
  assert.equal(s.record.kos, 1);
  assert.equal(s.money, cash + res.reward);
  assert.equal(s.scheduledFight, null);
  assert.equal(s.history.length, 1);
  assert.ok(s.energy < 100);
  assert.equal(resolveFight(s, { outcome: 'win', method: 'KO', round: 2 }).ok, false);
  assert.equal(validateSave(s), true);
});

test('rank progression leads to four world titles and champion can continue defending', () => {
  const s = career();
  let fights = 0;
  while (s.belts.length < 4 && fights < 20) {
    const opponents = getOpponents(s);
    const o = opponents.reduce((best, f) => f.rank < best.rank ? f : best);
    assert.equal(bookFight(s, o.id).ok, true);
    const rounds = s.scheduledFight.rounds;
    assert.equal(rest(s, 3).ok, true);
    assert.equal(resolveFight(s, { outcome: 'win', method: 'Décision', round: rounds }).ok, true);
    fights++;
    assert.equal(validateSave(s), true);
  }
  assert.equal(s.belts.length, 4);
  assert.equal(s.rank, 1);
  assert.ok(getOpponents(s).length >= 3);
  assert.equal(getRankings(s)[0].id, 'player');
});

test('losses, draws and invalid results preserve appropriate records', () => {
  const s = career();
  for (const outcome of ['loss', 'draw']) {
    bookFight(s, getOpponents(s)[0].id);
    rest(s, 3);
    const before = JSON.stringify(s);
    assert.equal(resolveFight(s, { outcome, method: 'TKO', round: 99 }).ok, false);
    assert.equal(JSON.stringify(s), before);
    resolveFight(s, { outcome, method: 'Décision', round: 3 });
  }
  assert.equal(s.record.losses, 1);
  assert.equal(s.record.draws, 1);
  assert.equal(s.record.wins, 0);
  assert.equal(validateSave(s), true);
});

test('save validation rejects malformed, nonfinite, unsafe and inconsistent data', () => {
  const s = career();
  assert.equal(validateSave(JSON.parse(JSON.stringify(s))), true);
  for (const value of [null, {}, [], { ...s, version: 2 }, { ...s, energy: NaN }, { ...s, rank: 0 }, { ...s, belts: ['WBC', 'WBC'] }, { ...s, profile: { ...s.profile, firstName: '<img onerror=evil>' } }, { ...s, history: [{ message: 'bad' }] }, { ...s, scheduledFight: {} }, { ...s, attributes: { ...s.attributes, power: 101 } }]) assert.equal(validateSave(value), false);
});

test('a realistic camp survives serialization after every training, contract and bout', () => {
  let s = career();
  const checkpoint = () => {
    s = JSON.parse(JSON.stringify(s));
    assert.equal(validateSave(s), true, `invalid save on career day ${s.day}`);
  };
  train(s, 'rope', 0.88);
  checkpoint();
  train(s, 'sparring', 0.62);
  checkpoint();
  rest(s);
  checkpoint();
  const nextOpponent = getOpponents(s)[1];
  bookFight(s, nextOpponent.id);
  checkpoint();
  train(s, 'shadow', 0.94);
  checkpoint();
  train(s, 'bag', 0.81);
  checkpoint();
  rest(s);
  checkpoint();
  assert.equal(s.day, s.scheduledFight.day);
  assert.equal(resolveFight(s, { outcome: 'win', method: 'TKO', round: 2 }).ok, true);
  checkpoint();
  assert.deepEqual(s.record, { wins: 1, losses: 0, draws: 0, kos: 1 });
  assert.equal(s.history[0].opponent, nextOpponent.name);
  assert.equal(s.trainingLog.length, 4);
  assert.equal(s.rank, nextOpponent.rank);
});

test('a title defense at rank one grants another belt; a title loss removes belts without KO credit', () => {
  const s = career();
  // Reach world contention through legal contracts and results, preserving all saves.
  while (s.rank > 5) {
    const o = getOpponents(s).reduce((best, candidate) => candidate.rank < best.rank ? candidate : best);
    bookFight(s, o.id);
    rest(s, 3);
    assert.equal(validateSave(s), true);
    const result = resolveFight(s, { outcome: 'win', method: 'KO', round: 1 });
    assert.equal(result.ok, true);
    assert.equal(validateSave(s), true);
  }
  const contender = getOpponents(s).find(o => o.rank === 1);
  assert.ok(contender);
  bookFight(s, contender.id);
  assert.equal(s.scheduledFight.title, true);
  assert.equal(s.scheduledFight.rounds, 12);
  rest(s, 3);
  resolveFight(s, { outcome: 'win', method: 'Décision', round: 12 });
  assert.equal(s.rank, 1);
  assert.deepEqual(s.belts, ['WBC']);

  const defender = getOpponents(s).find(o => o.rank === 2);
  bookFight(s, defender.id);
  assert.equal(s.scheduledFight.title, true);
  rest(s, 3);
  resolveFight(s, { outcome: 'win', method: 'Décision', round: 12 });
  assert.deepEqual(s.belts, ['WBC', 'WBA']);
  const kosBefore = s.record.kos;
  const winsBefore = s.record.wins;

  bookFight(s, getOpponents(s).find(o => o.rank === 2).id);
  rest(s, 3);
  resolveFight(s, { outcome: 'loss', method: 'TKO', round: 5 });
  assert.deepEqual(s.belts, []);
  assert.equal(s.record.kos, kosBefore);
  assert.equal(s.record.wins, winsBefore);
  assert.equal(s.record.losses, 1);
  assert.equal(validateSave(JSON.parse(JSON.stringify(s))), true);
});
