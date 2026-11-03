// Pure career rules. All actions mutate the supplied save and report their result.
export const ATTRIBUTES = [
  { key: 'power', label: 'Puissance' }, { key: 'speed', label: 'Vitesse des mains' },
  { key: 'accuracy', label: 'Précision' }, { key: 'reflexes', label: 'Réflexes' },
  { key: 'stamina', label: 'Endurance' }, { key: 'cardio', label: 'Cardio' },
  { key: 'chin', label: 'Résistance' }, { key: 'defense', label: 'Défense' },
  { key: 'footwork', label: 'Jeu de jambes' }, { key: 'technique', label: 'Technique' },
  { key: 'mental', label: 'Mental' }, { key: 'iq', label: 'Intelligence tactique' },
];
export const STYLES = ['Technicien', 'Puncheur', 'Contre-attaquant', 'Agressif', 'Défensif', 'Polyvalent'];
export const WEIGHTS = ['Poids légers', 'Poids welters', 'Poids moyens', 'Poids mi-lourds', 'Poids lourds'];
export const TRAININGS = [
  { id: 'bag', name: 'Sac de frappe', description: 'Enchaînez les frappes au bon moment.', attributes: ['power', 'speed', 'accuracy'], cost: 26 },
  { id: 'shadow', name: 'Shadow boxing', description: 'Travaillez les déplacements et les esquives.', attributes: ['technique', 'footwork', 'reflexes'], cost: 18 },
  { id: 'rope', name: 'Corde à sauter', description: 'Gardez le rythme pour développer votre cardio.', attributes: ['cardio', 'stamina', 'footwork'], cost: 22 },
  { id: 'run', name: 'Course à pied', description: 'Construisez votre souffle, une foulée après l’autre.', attributes: ['cardio', 'stamina', 'mental'], cost: 20 },
  { id: 'strength', name: 'Musculation', description: 'Maîtrisez chaque répétition pour gagner en force.', attributes: ['power', 'chin', 'stamina'], cost: 30 },
  { id: 'sparring', name: 'Sparring', description: 'Affrontez un partenaire et affûtez votre lecture du combat.', attributes: ['accuracy', 'defense', 'iq', 'mental'], cost: 34 },
];

const BELTS = ['WBC', 'WBA', 'IBF', 'WBO'];
const KEYS = ATTRIBUTES.map(a => a.key);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const rating = attrs => Math.round(KEYS.reduce((n, key) => n + attrs[key], 0) / KEYS.length);
const fail = message => ({ ok: false, message });
const success = (message, extra = {}) => ({ ok: true, message, ...extra });
const text = (value, fallback, max = 50) => typeof value === 'string' ? value.trim().replace(/[<>\u0000-\u001f]/g, '').slice(0, max).trim() || fallback : fallback;
const numeric = (value, fallback, low, high) => Number.isFinite(Number(value)) ? clamp(Number(value), low, high) : fallback;
const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
const DEFAULT_PROFILE = {
  firstName: 'Alex', lastName: 'Martin', nickname: 'Le Challenger', age: 20,
  nationality: 'France', city: 'Paris', height: 180, weight: 75, reach: 182,
  stance: 'Droitier', style: 'Polyvalent', category: 'Poids moyens',
  skin: '#bd8260', face: 'Anguleux', hair: 'Court', beard: 'Aucune', build: 'Athlétique',
  shortColor: '#c9a35e', gloveColor: '#d14e43', shoeColor: '#222733',
};
const STYLE_BONUSES = {
  Technicien: ['technique', 'accuracy', 'iq'], Puncheur: ['power', 'chin', 'mental'],
  'Contre-attaquant': ['reflexes', 'accuracy', 'iq'], Agressif: ['power', 'stamina', 'speed'],
  Défensif: ['defense', 'reflexes', 'footwork'], Polyvalent: ['technique', 'cardio', 'mental'],
};

export function createCareer(profile = {}, rng = Math.random) {
  const p = { ...DEFAULT_PROFILE };
  for (const key of ['firstName', 'lastName', 'nickname', 'nationality', 'city', 'hair', 'beard', 'build']) p[key] = text(profile[key], p[key]);
  for (const [key, min, max] of [['age', 18, 40], ['height', 145, 220], ['weight', 45, 160], ['reach', 145, 230]]) p[key] = numeric(profile[key], p[key], min, max);
  for (const key of ['skin', 'shortColor', 'gloveColor', 'shoeColor']) p[key] = color(profile[key], p[key]);
  if (STYLES.includes(profile.style)) p.style = profile.style;
  if (WEIGHTS.includes(profile.category)) p.category = profile.category;
  if (['Droitier', 'Gaucher'].includes(profile.stance)) p.stance = profile.stance;
  if (['Anguleux', 'Ovale', 'Rond'].includes(profile.face)) p.face = profile.face;
  const attributes = {}, potential = {};
  for (const key of KEYS) {
    attributes[key] = 35 + Math.floor(clamp(rng(), 0, 0.99999) * 8) + (STYLE_BONUSES[p.style].includes(key) ? 5 : 0);
    potential[key] = 83 + Math.floor(clamp(rng(), 0, 0.99999) * 18);
  }
  return {
    version: 1, profile: p, attributes, potential, day: 1, energy: 100, money: 1200,
    record: { wins: 0, losses: 0, draws: 0, kos: 0 }, reputation: 0, rank: 51,
    belts: [], scheduledFight: null, history: [], trainingLog: [],
  };
}

const NAMES = [
  ['Mateo Silva', 'El Rey', 'Brésil'], ['Viktor Sokolov', 'L’Ours', 'Ukraine'],
  ['Jamal Brooks', 'Black Thunder', 'États-Unis'], ['Diego Vargas', 'El Fuego', 'Mexique'],
  ['Ryo Tanaka', 'La Lame', 'Japon'], ['Enzo Ricci', 'Il Maestro', 'Italie'],
  ['Malik Diop', 'Le Lion', 'Sénégal'], ['Liam Murphy', 'Iron Fist', 'Irlande'],
  ['Karim Benali', 'Le Faucon', 'Maroc'], ['Oscar Lind', 'Le Viking', 'Suède'],
  ['Tomas Novak', 'Le Marteau', 'Tchéquie'], ['Gabriel Costa', 'O Trovão', 'Portugal'],
  ['Noah Williams', 'The Ghost', 'Royaume-Uni'], ['Andrei Petrov', 'Le Roc', 'Bulgarie'],
  ['Idrissa Koné', 'Le Guépard', 'Côte d’Ivoire'], ['Javier Mendoza', 'La Tormenta', 'Espagne'],
  ['Samuel Okafor', 'Golden Boy', 'Nigeria'], ['Lucas Moreau', 'Le Renard', 'France'],
  ['Kenji Nakamura', 'Le Samouraï', 'Japon'], ['Carlos Reyes', 'El Toro', 'Mexique'],
  ['Marco Ferrara', 'Il Cobra', 'Italie'], ['Dylan Cooper', 'Lightning', 'Australie'],
  ['Youssef Haddad', 'Le Scorpion', 'Tunisie'], ['Elias Berg', 'North Star', 'Norvège'],
  ['David Mensah', 'The Rock', 'Ghana'], ['Pablo Ortiz', 'El Rayo', 'Argentine'],
  ['Milan Horvat', 'Le Mur', 'Croatie'], ['Aaron Mitchell', 'The Hunter', 'États-Unis'],
  ['Ibrahim Diallo', 'Le Phénix', 'Guinée'], ['Nicolas Laurent', 'Le Stratège', 'France'],
  ['Rafael Santos', 'El Relámpago', 'Colombie'], ['Akira Watanabe', 'Le Dragon', 'Japon'],
  ['Ben O’Connor', 'The Storm', 'Irlande'], ['Amir Khalil', 'Le Prince', 'Égypte'],
  ['Jonas Fischer', 'Stahl', 'Allemagne'], ['Hugo Alvarez', 'El Lobo', 'Espagne'],
  ['Cedric Mbaye', 'Le Colosse', 'Sénégal'], ['Oliver Grant', 'The Hammer', 'Canada'],
  ['Dario Conti', 'Il Falco', 'Italie'], ['Saïd Mansouri', 'Le Tigre', 'Algérie'],
  ['Felix Andersson', 'Ice Man', 'Suède'], ['Eduardo Cruz', 'El Bravo', 'Chili'],
  ['Theo Bernard', 'Le Courageux', 'France'], ['Kwame Asante', 'The Warrior', 'Ghana'],
  ['Adam Nowak', 'Le Bison', 'Pologne'], ['Bruno Ferreira', 'A Fera', 'Brésil'],
  ['Nathan Reed', 'Quick Hands', 'États-Unis'], ['Sofiane Amrani', 'L’Éclair', 'Maroc'],
  ['Louis Dupont', 'Le Battant', 'France'], ['Ethan Walsh', 'The Rookie', 'Royaume-Uni'],
];

function worldFighter(index, category) {
  const [name, nickname, nationality] = NAMES[index];
  const base = 36 + Math.round((49 - index) * 0.86);
  const style = STYLES[index % STYLES.length];
  const attributes = Object.fromEntries(KEYS.map((key, k) => [key, clamp(base + ((index * 7 + k * 3) % 9) - 4 + (STYLE_BONUSES[style].includes(key) ? 4 : 0), 25, 95)]));
  return {
    id: `world-${index + 1}`, name, nickname, nationality, rank: index + 1,
    record: { wins: 5 + Math.floor((50 - index) / 2), losses: index % 5, draws: index % 3 === 0 ? 1 : 0, kos: 2 + Math.floor((50 - index) / 3) },
    rating: rating(attributes), attributes, style, stance: index % 4 === 0 ? 'Gaucher' : 'Droitier', category,
    skin: ['#a86b48', '#d49a75', '#764b34', '#e1b595', '#ba815d'][index % 5],
    shortColor: ['#b94543', '#3c639c', '#8a65ac', '#418474', '#a5753f'][index % 5],
    gloveColor: '#b94543',
  };
}

export function getRankings(state) {
  const world = NAMES.map((_, i) => worldFighter(i, state.profile.category));
  world.splice(state.rank - 1, 0, {
    id: 'player', isPlayer: true, name: `${state.profile.firstName} ${state.profile.lastName}`,
    nickname: state.profile.nickname, nationality: state.profile.nationality, record: { ...state.record },
    rating: rating(state.attributes), attributes: { ...state.attributes }, style: state.profile.style,
    stance: state.profile.stance, category: state.profile.category, skin: state.profile.skin,
    shortColor: state.profile.shortColor, gloveColor: state.profile.gloveColor,
  });
  return world.map((fighter, i) => ({ ...fighter, rank: i + 1 }));
}

export function getOpponents(state) {
  const rankings = getRankings(state).filter(f => !f.isPlayer);
  const targetRanks = state.rank <= 5 ? [1, 2, 4, 6] : [state.rank - 1, state.rank - 4, state.rank - 7, state.rank + 2];
  const result = [];
  for (const target of targetRanks) {
    const fighter = rankings.find(f => f.rank === clamp(target, 1, 51));
    if (fighter && !result.some(f => f.id === fighter.id)) result.push(fighter);
  }
  // A champion must still have challengers, even when rank 1 belongs to the player.
  for (const fighter of rankings) {
    if (result.length >= 4) break;
    if (state.rank <= 5 && !result.some(f => f.id === fighter.id)) result.push(fighter);
  }
  return result;
}

export function bookFight(state, opponentId) {
  if (state.scheduledFight) return fail('Un combat est déjà prévu. Préparez-vous pour le jour J.');
  const opponent = getOpponents(state).find(fighter => fighter.id === opponentId);
  if (!opponent) return fail('Cet adversaire n’est pas disponible.');
  const title = state.rank <= 5 && opponent.rank <= 2;
  const rounds = title ? 12 : state.rank <= 15 ? 8 : state.rank <= 30 ? 5 : 3;
  state.scheduledFight = { opponent, day: state.day + 3, rounds, title };
  return success(`Combat signé contre ${opponent.name}, au jour ${state.scheduledFight.day}${title ? ' : championnat du monde !' : '.'}`);
}

export function train(state, trainingId, performance = 0.7) {
  const training = TRAININGS.find(t => t.id === trainingId);
  if (!training) return fail('Entraînement inconnu.');
  if (state.scheduledFight && state.day >= state.scheduledFight.day) return fail('C’est le jour du combat. Rendez-vous sur le ring !');
  if (state.energy < training.cost) return fail('Vous êtes trop fatigué. Prenez une journée de récupération.');
  if (!Number.isFinite(performance)) return fail('La séance n’a pas pu être évaluée.');
  const quality = clamp(performance, 0, 1);
  const amount = Math.round((0.5 + quality * 1.8) * 10) / 10;
  const gains = {};
  for (const key of training.attributes) {
    const before = state.attributes[key];
    state.attributes[key] = Math.min(state.potential[key], Math.round((before + amount) * 10) / 10);
    gains[key] = Math.round((state.attributes[key] - before) * 10) / 10;
  }
  state.energy = clamp(state.energy - training.cost, 0, 100);
  state.trainingLog.unshift({ day: state.day, id: training.id, performance: quality, gains });
  state.trainingLog = state.trainingLog.slice(0, 60);
  state.day += 1;
  return success(`${training.name} terminé. ${Math.round(quality * 100)} % de réussite ; vos attributs progressent.`, { gains });
}

export function rest(state, days = 1) {
  if (!Number.isInteger(days) || days < 1 || days > 7) return fail('Choisissez entre une et sept journées de repos.');
  if (state.scheduledFight && state.day >= state.scheduledFight.day) return fail('Votre combat vous attend aujourd’hui.');
  const actualDays = state.scheduledFight ? Math.min(days, state.scheduledFight.day - state.day) : days;
  const energyBefore = state.energy;
  state.energy = clamp(state.energy + 34 * actualDays, 0, 100);
  state.day += actualDays;
  return success(`${actualDays} jour${actualDays > 1 ? 's' : ''} de récupération : +${Math.round(state.energy - energyBefore)} énergie.`);
}

export function advanceDay(state) { return rest(state, 1); }

export function resolveFight(state, result) {
  if (!state.scheduledFight) return fail('Aucun combat n’est programmé.');
  if (state.day < state.scheduledFight.day) return fail('Le combat n’a pas encore lieu. Terminez votre préparation.');
  if (!result || !['win', 'loss', 'draw'].includes(result.outcome) || !['KO', 'TKO', 'Décision'].includes(result.method) || !Number.isInteger(result.round) || result.round < 1 || result.round > state.scheduledFight.rounds) return fail('Résultat de combat invalide.');
  const fight = state.scheduledFight;
  const purse = Math.round(350 + (51 - state.rank) * 75 + (fight.title ? 5500 : 0));
  const reward = result.outcome === 'win' ? purse : result.outcome === 'draw' ? Math.round(purse * 0.7) : Math.round(purse * 0.5);
  let belt = null;
  if (result.outcome === 'win') {
    state.record.wins++;
    if (result.method !== 'Décision') state.record.kos++;
    state.rank = Math.min(state.rank, fight.opponent.rank);
    state.reputation = clamp(state.reputation + 4 + (fight.title ? 10 : 0), 0, 100);
    if (fight.title) {
      belt = BELTS.find(b => !state.belts.includes(b)) || null;
      if (belt) state.belts.push(belt);
    }
  } else if (result.outcome === 'loss') {
    state.record.losses++;
    state.rank = Math.min(51, state.rank + 2);
    state.reputation = clamp(state.reputation - 2, 0, 100);
    // A world-title defeat costs the belts: the championship must be earned again.
    if (fight.title) state.belts = [];
  } else {
    state.record.draws++;
    state.reputation = clamp(state.reputation + 1, 0, 100);
  }
  state.money += reward;
  const learned = result.outcome === 'win' ? 0.5 : 0.8;
  for (const key of ['mental', 'iq', 'technique']) state.attributes[key] = Math.min(state.potential[key], Math.round((state.attributes[key] + learned) * 10) / 10);
  const historyEntry = {
    day: state.day, opponent: fight.opponent.name, outcome: result.outcome, method: result.method,
    round: result.round, reward, title: fight.title, belt,
  };
  state.history.unshift(historyEntry);
  state.history = state.history.slice(0, 100);
  state.energy = clamp(state.energy - (result.outcome === 'loss' ? 38 : 28), 0, 100);
  state.scheduledFight = null;
  state.day++;
  const label = result.outcome === 'win' ? 'Victoire' : result.outcome === 'draw' ? 'Match nul' : 'Défaite';
  return success(`${label} par ${result.method}. Bourse : ${reward.toLocaleString('fr-FR')} €.${belt ? ` La ceinture ${belt} est à vous !` : ''}${state.belts.length === 4 ? ' Champion du monde incontesté !' : ''}`, { reward, belt });
}

// Save data comes from the browser or a file; validate every field used by the UI.
export function validateSave(value) {
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const number = (v, low, high) => typeof v === 'number' && Number.isFinite(v) && v >= low && v <= high;
  const integer = (v, low, high) => Number.isInteger(v) && number(v, low, high);
  const string = (v, max = 80) => typeof v === 'string' && v.length > 0 && v.length <= max && !/[<>\u0000-\u001f]/.test(v);
  const attrs = v => object(v) && KEYS.every(key => number(v[key], 0, 100));
  const record = v => object(v) && ['wins', 'losses', 'draws', 'kos'].every(k => integer(v[k], 0, 100000)) && v.kos <= v.wins;
  if (!object(value) || value.version !== 1 || !object(value.profile)) return false;
  const p = value.profile;
  for (const key of ['firstName', 'lastName', 'nickname', 'nationality', 'city', 'hair', 'beard', 'build']) if (!string(p[key], 50)) return false;
  if (p.face !== undefined && !['Anguleux', 'Ovale', 'Rond'].includes(p.face)) return false;
  for (const key of ['skin', 'shortColor', 'gloveColor', 'shoeColor']) if (!/^#[0-9a-f]{6}$/i.test(p[key])) return false;
  if (!number(p.age, 18, 40) || !number(p.height, 145, 220) || !number(p.weight, 45, 160) || !number(p.reach, 145, 230) || !STYLES.includes(p.style) || !WEIGHTS.includes(p.category) || !['Droitier', 'Gaucher'].includes(p.stance)) return false;
  if (!attrs(value.attributes) || !attrs(value.potential) || KEYS.some(key => value.attributes[key] > value.potential[key])) return false;
  if (!integer(value.day, 1, 1000000) || !number(value.energy, 0, 100) || !number(value.money, 0, 1e12) || !record(value.record) || !number(value.reputation, 0, 100) || !integer(value.rank, 1, 51)) return false;
  if (!Array.isArray(value.belts) || value.belts.length > 4 || new Set(value.belts).size !== value.belts.length || value.belts.some(b => !BELTS.includes(b))) return false;
  if (!Array.isArray(value.history) || value.history.length > 100 || !Array.isArray(value.trainingLog) || value.trainingLog.length > 60) return false;
  for (const h of value.history) {
    if (!object(h) || !integer(h.day, 1, value.day) || !string(h.opponent) || !['win', 'loss', 'draw'].includes(h.outcome) || !['KO', 'TKO', 'Décision'].includes(h.method) || !integer(h.round, 1, 12) || !number(h.reward, 0, 1e8) || typeof h.title !== 'boolean' || !(h.belt === null || BELTS.includes(h.belt))) return false;
  }
  for (const t of value.trainingLog) {
    if (!object(t) || !integer(t.day, 1, value.day) || !TRAININGS.some(a => a.id === t.id) || !number(t.performance, 0, 1) || !object(t.gains) || Object.entries(t.gains).some(([k, v]) => !KEYS.includes(k) || !number(v, 0, 3))) return false;
  }
  if (value.scheduledFight !== null) {
    const f = value.scheduledFight;
    if (!object(f) || !object(f.opponent) || !integer(f.day, value.day, value.day + 3) || ![3, 5, 8, 12].includes(f.rounds) || typeof f.title !== 'boolean') return false;
    const o = f.opponent;
    if (!/^world-([1-9]|[1-4][0-9]|50)$/.test(o.id) || !string(o.name) || !string(o.nickname) || !string(o.nationality) || !integer(o.rank, 1, 51) || !record(o.record) || !attrs(o.attributes) || !number(o.rating, 0, 100) || !STYLES.includes(o.style) || !['Droitier', 'Gaucher'].includes(o.stance)) return false;
    if (![o.skin, o.shortColor, o.gloveColor].every(c => /^#[0-9a-f]{6}$/i.test(c))) return false;
  }
  return true;
}
