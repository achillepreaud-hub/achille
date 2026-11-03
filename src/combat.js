/** Small, deterministic boxing simulation. Coordinates use a 1000 × 600 ring. */
const PUNCHES = {
  jab: { duration: 0.32, impact: 0.12, range: 128, cost: 7, damage: 6, accuracy: 0.95 },
  cross: { duration: 0.46, impact: 0.19, range: 142, cost: 11, damage: 10, accuracy: 0.88 },
  hook: { duration: 0.52, impact: 0.23, range: 110, cost: 14, damage: 14, accuracy: 0.83 },
  uppercut: { duration: 0.59, impact: 0.25, range: 98, cost: 17, damage: 17, accuracy: 0.8 },
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const attribute = (profile, key) => clamp(Number(profile?.attributes?.[key]) || 40, 1, 100);
const isPunch = action => Object.hasOwn(PUNCHES, action);

function fighter(profile, side, x) {
  return {
    profile, name: profile.name || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Boxeur',
    attributes: Object.fromEntries(['power', 'speed', 'accuracy', 'reflexes', 'stamina', 'cardio',
      'chin', 'defense', 'footwork', 'technique', 'mental', 'iq'].map(key => [key, attribute(profile, key)])),
    side, x, y: 300, hp: 100, maxHp: 100, stamina: 100, maxStamina: 100,
    guard: false, action: 'idle', actionTime: 0, actionDuration: 0, facing: side === 'player' ? 0 : Math.PI,
    cooldown: 0, dodgeCooldown: 0, dodgeX: 0, dodgeY: 0, impacted: false,
    lastHit: -10, hitFlash: 0, knockdowns: 0, roundKnockdowns: 0,
    damage: 0, roundDamage: 0, landed: 0, thrown: 0, roundLanded: 0,
  };
}

/** Pass options.rng for repeatable bouts and options.ai=false for a practice dummy. */
export function createBout(player, opponent, options = {}) {
  const rounds = clamp(Math.round(Number(options.rounds) || 3), 1, 12);
  const roundSeconds = clamp(Number(options.roundSeconds) || 60, 3, 180);
  return {
    player: fighter(player, 'player', 350), opponent: fighter(opponent, 'opponent', 650),
    phase: 'fighting', round: 1, rounds, roundSeconds, timeLeft: roundSeconds, breakLeft: 0,
    winner: null, method: null, message: 'Round 1 — boxez !', events: [], scorecards: [],
    totals: { player: 0, opponent: 0 }, elapsed: 0, eventId: 0,
    rng: typeof options.rng === 'function' ? options.rng : Math.random,
    sparring: Boolean(options.sparring), ai: options.ai !== false,
    aiThink: 0, aiPlan: {}, previousDodge: false,
  };
}

function event(bout, type, values = {}) {
  bout.events.push({ id: ++bout.eventId, type, time: bout.elapsed, ...values });
  if (bout.events.length > 20) bout.events.splice(0, bout.events.length - 20);
}

function finish(bout, winner, method) {
  if (bout.phase === 'finished') return;
  bout.phase = 'finished';
  bout.winner = winner;
  bout.method = method;
  bout.message = winner === 'draw' ? 'Match nul !' : `${winner === 'player' ? bout.player.name : bout.opponent.name} gagne par ${method}.`;
  event(bout, 'finish', { winner, method });
}

function knockdown(bout, target, attacker) {
  target.hp = 0;
  target.knockdowns++;
  target.roundKnockdowns++;
  target.action = 'knockdown';
  target.actionTime = 0;
  target.actionDuration = 2.6;
  target.guard = false;
  bout.message = `${target.name} est au tapis !`;
  event(bout, 'knockdown', { x: target.x, y: target.y, source: attacker.side, target: target.side, amount: target.knockdowns });
  if (target.roundKnockdowns >= 3) {
    finish(bout, attacker.side, 'TKO');
  } else if (target.knockdowns >= 4 || target.damage >= 205 ||
      (target.knockdowns > 1 && bout.rng() > 0.72 + target.attributes.chin * 0.002)) {
    finish(bout, attacker.side, 'KO');
  }
}

function landPunch(bout, attacker, target) {
  const punch = PUNCHES[attacker.action];
  if (!punch || attacker.impacted) return;
  attacker.impacted = true;
  if (target.action === 'knockdown') return;
  const distance = Math.hypot(target.x - attacker.x, target.y - attacker.y);
  const range = punch.range + (Number(attacker.profile.reach || attacker.profile.profile?.reach) - 180 || 0) * 0.35;
  const dodging = target.action === 'dodge' && target.actionTime < 0.32;
  const precision = punch.accuracy + (attacker.attributes.accuracy - target.attributes.reflexes) * 0.002;
  if (distance > range || dodging || bout.rng() > clamp(precision, 0.55, 0.99)) {
    event(bout, 'miss', { x: target.x, y: target.y, source: attacker.side, target: target.side });
    return;
  }
  const tired = 0.58 + 0.42 * (attacker.stamina / 100);
  let damage = punch.damage * (0.68 + attacker.attributes.power / 95) * tired;
  damage *= 1.12 - target.attributes.chin * 0.003;
  if (bout.sparring) damage *= 0.7;
  const blocked = target.guard && target.stamina > 4;
  if (blocked) {
    target.stamina = Math.max(0, target.stamina - damage * 0.8);
    damage *= 0.39 - target.attributes.defense * 0.0018;
  }
  damage = Math.max(0.5, damage);
  target.hp = Math.max(0, target.hp - damage);
  target.damage += damage;
  target.lastHit = bout.elapsed;
  target.hitFlash = 0.16;
  attacker.landed++;
  attacker.roundLanded++;
  attacker.roundDamage += damage;
  // A little separation makes combinations require footwork.
  const nx = Math.cos(attacker.facing), ny = Math.sin(attacker.facing);
  target.x = clamp(target.x + nx * (blocked ? 2 : 5), 65, 935);
  target.y = clamp(target.y + ny * (blocked ? 2 : 5), 65, 535);
  event(bout, 'hit', { x: target.x, y: target.y, amount: Math.round(damage), blocked,
    punch: attacker.action, source: attacker.side, target: target.side });
  bout.message = blocked ? 'Coup bloqué !' : `${attacker.name} touche avec ${attacker.action === 'jab' ? 'un jab' : attacker.action === 'cross' ? 'un direct' : attacker.action === 'hook' ? 'un crochet' : 'un uppercut'}.`;
  if (target.hp <= 0) knockdown(bout, target, attacker);
}

function tickFighter(f, dt) {
  f.cooldown = Math.max(0, f.cooldown - dt);
  f.dodgeCooldown = Math.max(0, f.dodgeCooldown - dt);
  f.hitFlash = Math.max(0, f.hitFlash - dt);
  f.actionTime += dt;
  if (f.action === 'knockdown') {
    if (f.actionTime >= f.actionDuration) {
      f.hp = Math.max(21, 57 - f.knockdowns * 10 - f.damage * 0.035);
      f.stamina = Math.max(f.stamina, 48);
      f.action = 'idle';
      f.actionTime = 0;
      f.cooldown = 0.25;
    }
    return;
  }
  if (f.action !== 'idle' && f.actionTime >= f.actionDuration) {
    f.action = 'idle';
    f.actionTime = 0;
  }
  const regeneration = 6.5 + f.attributes.cardio * 0.065;
  f.stamina = Math.min(100, f.stamina + regeneration * dt * (isPunch(f.action) ? 0.18 : f.guard ? 0.58 : 1));
}

function controlFighter(f, target, input, dt, dodgePressed) {
  f.facing = Math.atan2(target.y - f.y, target.x - f.x);
  if (f.action === 'knockdown' || target.action === 'knockdown') {
    f.guard = false;
    return;
  }
  f.guard = Boolean(input.block) && f.action === 'idle';
  let mx = clamp(Number(input.moveX) || 0, -1, 1);
  let my = clamp(Number(input.moveY) || 0, -1, 1);
  const length = Math.hypot(mx, my);
  if (length > 1) { mx /= length; my /= length; }
  if (dodgePressed && f.action === 'idle' && f.dodgeCooldown === 0 && f.stamina >= 12) {
    f.action = 'dodge';
    f.actionTime = 0;
    f.actionDuration = 0.38;
    f.dodgeCooldown = 1.5;
    f.stamina -= 12;
    f.guard = false;
    f.dodgeX = length ? mx : -Math.sin(f.facing);
    f.dodgeY = length ? my : Math.cos(f.facing);
  }
  if (f.action === 'idle' && !f.guard && f.cooldown === 0) {
    const action = ['uppercut', 'hook', 'cross', 'jab'].find(key => input[key]);
    if (action && f.stamina >= PUNCHES[action].cost) {
      f.action = action;
      f.actionTime = 0;
      f.actionDuration = PUNCHES[action].duration * (1.17 - f.attributes.speed * 0.0032);
      f.cooldown = f.actionDuration + 0.08;
      f.stamina -= PUNCHES[action].cost;
      f.impacted = false;
      f.thrown++;
    }
  }
  const speed = (126 + f.attributes.footwork * 0.72) * (0.65 + f.stamina * 0.0035);
  const movementFactor = f.action === 'dodge' ? 1.6 : isPunch(f.action) ? 0.38 : f.guard ? 0.55 : 1;
  if (f.action === 'dodge') { mx = f.dodgeX; my = f.dodgeY; }
  f.x = clamp(f.x + mx * speed * movementFactor * dt, 65, 935);
  f.y = clamp(f.y + my * speed * movementFactor * dt, 65, 535);
}

function aiInput(bout, dt) {
  if (!bout.ai) return {};
  const ai = bout.opponent, target = bout.player;
  const dx = target.x - ai.x, dy = target.y - ai.y;
  const distance = Math.hypot(dx, dy) || 1;
  bout.aiThink -= dt;
  if (bout.aiThink <= 0) {
    bout.aiThink = 0.2 + bout.rng() * 0.16;
    const retreat = ai.stamina < 24 || (ai.hp < 25 && bout.rng() < 0.4);
    const reaction = isPunch(target.action) && bout.rng() < 0.15 + ai.attributes.reflexes * 0.004;
    const plan = { retreat, block: reaction && ai.stamina > 10, dodge: false };
    if (!retreat && !reaction && distance < 146 && bout.rng() < 0.7) {
      const roll = bout.rng();
      const punch = distance < 97 && roll > 0.77 ? 'uppercut'
        : distance < 108 && roll > 0.5 ? 'hook' : roll > 0.47 ? 'cross' : 'jab';
      plan[punch] = true;
    }
    if (reaction && ai.stamina > 40 && bout.rng() < 0.12) { plan.dodge = true; plan.block = false; }
    bout.aiPlan = plan;
  }
  const plan = bout.aiPlan;
  const direction = plan.retreat ? -1 : distance > 108 ? 1 : 0;
  const circle = direction === 0 && !isPunch(ai.action) ? 0.24 : 0;
  return { ...plan, moveX: dx / distance * direction - dy / distance * circle,
    moveY: dy / distance * direction + dx / distance * circle };
}

function separate(player, opponent) {
  if (player.action === 'knockdown' || opponent.action === 'knockdown') return;
  const dx = opponent.x - player.x, dy = opponent.y - player.y;
  const distance = Math.hypot(dx, dy) || 0.01;
  if (distance >= 72) return;
  const push = (72 - distance) / 2;
  const nx = dx / distance || 1, ny = dy / distance;
  player.x = clamp(player.x - nx * push, 65, 935);
  player.y = clamp(player.y - ny * push, 65, 535);
  opponent.x = clamp(opponent.x + nx * push, 65, 935);
  opponent.y = clamp(opponent.y + ny * push, 65, 535);
}

function scoreRound(bout) {
  const p = bout.player, o = bout.opponent;
  const difference = p.roundDamage - o.roundDamage + (p.roundLanded - o.roundLanded) * 0.6;
  let player = difference > 2 ? 10 : difference < -2 ? 9 : 10;
  let opponent = difference < -2 ? 10 : difference > 2 ? 9 : 10;
  player = Math.max(6, player - p.roundKnockdowns);
  opponent = Math.max(6, opponent - o.roundKnockdowns);
  const card = { round: bout.round, player, opponent,
    winner: player > opponent ? 'player' : player < opponent ? 'opponent' : 'draw' };
  bout.scorecards.push(card);
  bout.totals.player += player;
  bout.totals.opponent += opponent;
  event(bout, 'round', { ...card });
  if (bout.round >= bout.rounds) {
    finish(bout, bout.totals.player > bout.totals.opponent ? 'player'
      : bout.totals.player < bout.totals.opponent ? 'opponent' : 'draw', 'Décision');
    return;
  }
  bout.phase = 'break';
  bout.breakLeft = 5;
  bout.message = `Fin du round ${bout.round} · ${player}–${opponent}. Reprenez votre souffle.`;
  for (const f of [p, o]) {
    f.action = 'idle';
    f.actionTime = 0;
    f.guard = false;
  }
}

function nextRound(bout) {
  bout.round++;
  bout.timeLeft = bout.roundSeconds;
  bout.phase = 'fighting';
  bout.player.x = 350;
  bout.opponent.x = 650;
  for (const f of [bout.player, bout.opponent]) {
    f.y = 300;
    f.hp = Math.min(100, f.hp + 6 + f.attributes.stamina * 0.035);
    f.stamina = Math.min(100, f.stamina + 32);
    f.roundKnockdowns = 0;
    f.roundDamage = 0;
    f.roundLanded = 0;
    f.cooldown = 0;
    f.action = 'idle';
    f.actionTime = 0;
  }
  bout.aiThink = 0;
  bout.message = `Round ${bout.round} — boxez !`;
}

/** Mutates and returns bout; dt is elapsed seconds. Omit stepping to pause. */
export function stepBout(bout, dt, input = {}) {
  if (!bout || bout.phase === 'finished' || !Number.isFinite(dt) || dt <= 0) return bout;
  let remaining = Math.min(dt, 1);
  let dodgePressed = Boolean(input.dodge) && !bout.previousDodge;
  bout.previousDodge = Boolean(input.dodge);
  while (remaining > 0.000001 && bout.phase !== 'finished') {
    const delta = Math.min(remaining, 1 / 60);
    remaining -= delta;
    bout.elapsed += delta;
    if (bout.phase === 'break') {
      bout.breakLeft = Math.max(0, bout.breakLeft - delta);
      if (bout.breakLeft <= 0.000001) nextRound(bout);
      continue;
    }
    const p = bout.player, o = bout.opponent;
    tickFighter(p, delta);
    tickFighter(o, delta);
    const opponentInput = aiInput(bout, delta);
    controlFighter(p, o, input, delta, dodgePressed);
    controlFighter(o, p, opponentInput, delta, opponentInput.dodge);
    dodgePressed = false;
    separate(p, o);
    for (const [attacker, target] of [[p, o], [o, p]]) {
      if (isPunch(attacker.action)) {
        const impactAt = PUNCHES[attacker.action].impact * attacker.actionDuration / PUNCHES[attacker.action].duration;
        if (attacker.actionTime >= impactAt && !attacker.impacted) landPunch(bout, attacker, target);
      }
      if (bout.phase === 'finished') break;
    }
    // The referee's count pauses the clock; a boxer cannot escape it at the bell.
    if (p.action !== 'knockdown' && o.action !== 'knockdown') bout.timeLeft = Math.max(0, bout.timeLeft - delta);
    if (bout.phase === 'fighting' && bout.timeLeft <= 0.000001) scoreRound(bout);
  }
  return bout;
}

/** Null until the bout ends. outcome is always from the player's perspective. */
export function getBoutResult(bout) {
  if (bout?.phase !== 'finished') return null;
  return {
    outcome: bout.winner === 'player' ? 'win' : bout.winner === 'opponent' ? 'loss' : 'draw',
    method: bout.method, round: bout.round,
    scorecards: bout.scorecards.map(card => ({ ...card })),
    totals: { ...bout.totals },
    stats: { player: { landed: bout.player.landed, thrown: bout.player.thrown, knockdowns: bout.player.knockdowns },
      opponent: { landed: bout.opponent.landed, thrown: bout.opponent.thrown, knockdowns: bout.opponent.knockdowns } },
  };
}
