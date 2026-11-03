import { ATTRIBUTES, STYLES, WEIGHTS, TRAININGS, createCareer, train, rest, getOpponents, bookFight, advanceDay, resolveFight, getRankings, validateSave } from './career.js';
import { createBout, stepBout, getBoutResult } from './combat.js';
import { drawRing, drawBoxerPreview } from './ring.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY = 'rtu.career.v1', BOUT_KEY = 'rtu.bout.v1';
let career = null, screen = 'dashboard', activeFight = null, paused = false, training = null, lastFrame = 0, lastCheckpoint = 0;
let storageWarning = '', toastTimer, modalPreviousFocus;
const keys = new Set(), touch = new Set();
const logicalCode = event => /^[a-z]$/i.test(event.key) ? `Key${event.key.toUpperCase()}` : event.code;
const defaultProfile = { firstName: 'Alex', lastName: 'Martin', nickname: 'Le Phénix', age: 21, nationality: 'France', city: 'Marseille', height: 180, weight: 74, reach: 183, stance: 'Droitier', style: 'Polyvalent', category: 'Poids moyens', skin: '#bd805b', face: 'Anguleux', hair: 'Court', beard: 'Aucune', build: 'Athlétique', shortColor: '#d9ef77', gloveColor: '#d85143', shoeColor: '#e7e9eb' };
let draft = { ...defaultProfile };

try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const saved = JSON.parse(raw);
    if (validateSave(saved)) career = saved;
    else storageWarning = 'La sauvegarde locale est incompatible. Vous pouvez créer une nouvelle carrière ou importer une sauvegarde valide.';
  }
} catch { storageWarning = 'La sauvegarde locale est indisponible ou illisible. Exportez votre carrière pour la conserver.'; }

const money = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const date = (day, opts = { day: 'numeric', month: 'long' }) => new Date(Date.UTC(2026, 10, 2 + day, 12)).toLocaleDateString('fr-FR', { ...opts, timeZone: 'UTC' });
const fullName = p => `${p.firstName} ${p.lastName}`;
const record = r => `${r.wins} V · ${r.losses} D${r.draws ? ` · ${r.draws} N` : ''}`;
const rating = attrs => Math.round(Object.values(attrs).reduce((a, b) => a + b, 0) / Object.keys(attrs).length);
const due = () => career?.scheduledFight && career.day >= career.scheduledFight.day;
const energyBar = (value, klass = '') => `<div class="progress-track ${klass}"><div class="progress-fill" style="width:${Math.max(0, Math.min(100, value))}%"></div></div>`;
const icons = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  gym: '<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/>',
  fights: '<path d="M7 3h10v7a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 4 4M17 5h4v3a4 4 0 0 1-4 4M12 15v6M8 21h8"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
  rankings: '<path d="m12 3 3 6 6 1-4.5 4.5L18 21l-6-3-6 3 1.5-6.5L3 10l6-1z"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  arrow: '<path d="M4 12h16M14 6l6 6-6 6"/>',
};
const icon = name => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.fights}</svg>`;
const button = (text, action, cls = 'primary', extra = '') => `<button class="btn ${cls}" data-action="${action}" ${extra}>${text}</button>`;

function notify(message, error = false) {
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.className = 'toast', 5000);
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(career));
    return true;
  } catch {
    storageWarning = 'Sauvegarde locale impossible. Utilisez « Exporter » pour conserver votre progression.';
    notify(storageWarning, true);
    return false;
  }
}

function removeCheckpoint() {
  try { localStorage.removeItem(BOUT_KEY); } catch { /* Storage may be disabled. */ }
}

function navigate(next) {
  if (activeFight && !activeFight.settled) { notify('Terminez le combat ou abandonnez-le avant de quitter le ring.', true); return; }
  screen = next;
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function render() {
  if (!career) { renderCreation(); return; }
  const nav = [['dashboard', 'Ma carrière'], ['gym', 'La salle'], ['fights', 'Combats'], ['calendar', 'Calendrier'], ['rankings', 'Classement'], ['profile', 'Mon boxeur']];
  const titles = { dashboard: ['Chaque jour compte.', 'Votre route vers le sommet commence ici.'], gym: ['Le travail se voit sur le ring.', 'Entraînez vos qualités. Respectez votre récupération.'], fights: ['Faites parler les gants.', 'Choisissez votre adversaire et préparez votre rendez-vous.'], calendar: ['Un jour. Un objectif.', 'Organisez votre camp et arrivez prêt le soir du combat.'], rankings: ['Une place à prendre.', '50 adversaires. Quatre ceintures. Un seul incontesté.'], profile: ['Votre nom. Votre héritage.', 'Les qualités et les résultats qui font votre boxeur.'], ring: ['Bienvenue dans l’arène.', activeFight?.sparring ? 'Sparring : travaillez vos automatismes sans modifier votre palmarès.' : 'Restez mobile, gérez votre souffle et imposez votre boxe.'] };
  const [title, subtitle] = titles[screen] || titles.dashboard;
  $('#app').innerHTML = `<div class="app-shell${screen === 'ring' ? ' is-fighting' : ''}">
    <aside class="sidebar"><a class="brand" href="#" data-screen="dashboard" aria-label="Accueil Road to Undisputed"><span class="brand-mark">R<span>U</span></span><span><span class="brand-title">ROAD TO<br>UNDISPUTED<span class="accent">.</span></span><span class="brand-subtitle">BOXING CAREER SIMULATOR</span></span></a>
      <div class="eyebrow nav-caption">VOTRE COIN DU RING</div><nav class="nav-list" aria-label="Navigation principale">${nav.map(([id, label]) => `<button class="nav-item ${screen === id ? 'active' : ''}" data-screen="${id}" ${screen === id ? 'aria-current="page"' : ''}><span class="nav-icon">${icon(id)}</span>${label}${id === 'fights' && due() ? '<span class="nav-dot"></span>' : ''}</button>`).join('')}</nav>
      <div class="sidebar-footer"><div class="sidebar-boxer"><span class="mini-avatar" style="--fighter-color:${esc(career.profile.shortColor)}">${esc(career.profile.firstName.slice(0, 1) + career.profile.lastName.slice(0, 1))}</span><div><strong>${esc(fullName(career.profile))}</strong><small>${esc(career.profile.category)}</small></div></div><div class="save-status"><span></span> Sauvegarde automatique</div><div class="sidebar-version">SAISON 01 <span>VERSION 1.0</span></div></div>
    </aside>
    <main class="main-content"><header class="topbar"><div><p class="eyebrow">LA CARRIÈRE · JOUR ${career.day} <span class="topbar-date">/ ${date(career.day)}</span></p><h1 class="page-title">${title}</h1><p class="page-subtitle">${subtitle}</p></div><div class="topbar-actions"><span class="badge gold">${icon('rankings')} ${career.rank <= 50 ? `N° ${career.rank} MONDIAL` : 'NOUVEAU PRO'}</span><button class="icon-btn" data-action="help" aria-label="Comment jouer">?</button></div></header>
      ${storageWarning ? `<div class="notice warning">${esc(storageWarning)}</div>` : ''}
      ${screen === 'dashboard' ? dashboardView() : screen === 'gym' ? gymView() : screen === 'fights' ? fightsView() : screen === 'calendar' ? calendarView() : screen === 'rankings' ? rankingsView() : screen === 'profile' ? profileView() : ringView()}
      <footer class="main-footer"><span>ROAD TO UNDISPUTED</span><span>LE TITRE SE MÉRITE.</span></footer>
    </main></div>`;
  $$('canvas[data-preview]').forEach(c => drawBoxerPreview(c, career.profile));
  if (screen === 'ring' && activeFight) updateFightHud();
}

function section(title, note = '') { return `<div class="section-heading"><h2 class="section-title">${title}</h2>${note ? `<span class="muted">${note}</span>` : ''}</div>`; }
function statsView() {
  return `<div class="grid four stats-grid"><article class="card stat-card"><span class="stat-label">PALMARÈS PROFESSIONNEL</span><strong class="stat-value">${career.record.wins}<span> — </span>${career.record.losses}<span> — </span>${career.record.draws}</strong><span class="stat-note">${career.record.kos} victoire${career.record.kos > 1 ? 's' : ''} par KO</span></article><article class="card stat-card"><span class="stat-label">FORME DU JOUR</span><strong class="stat-value">${Math.round(career.energy)}<small>%</small></strong>${energyBar(career.energy)}<span class="stat-note">${career.energy >= 70 ? 'Prêt à travailler' : career.energy >= 35 ? 'Gérez votre effort' : 'Récupération recommandée'}</span></article><article class="card stat-card"><span class="stat-label">NIVEAU GÉNÉRAL</span><strong class="stat-value">${rating(career.attributes)}<small>/ 100</small></strong><span class="stat-note">12 qualités à développer</span></article><article class="card stat-card"><span class="stat-label">VOTRE BOURSE</span><strong class="stat-value money-value">${money(career.money)}</strong><span class="stat-note">Bourses de vos combats</span></article></div>`;
}

function nextFightCard() {
  const f = career.scheduledFight;
  return `<article class="card next-fight-card"><div class="card-header"><h2 class="card-title">Prochain rendez-vous</h2><span class="badge ${due() ? 'red' : ''}">${f ? (due() ? 'CE SOIR' : `J−${f.day - career.day}`) : 'À ORGANISER'}</span></div>${f ? `<div class="matchup"><div><span class="eyebrow">VOUS</span><h3>${esc(career.profile.lastName)}</h3></div><span class="versus">VS</span><div><span class="eyebrow">N° ${f.opponent.rank}</span><h3>${esc(f.opponent.name)}</h3></div></div><p class="muted">${date(f.day)} · ${f.rounds} rounds${f.title ? ' · Combat pour une ceinture' : ''}</p><div class="actions">${due() ? button('Monter sur le ring ' + icon('arrow'), 'start-fight') : button('Voir mon camp ' + icon('arrow'), 'go-calendar', 'secondary')}</div>` : `<div class="empty-state compact">${icon('fights')}<h3>Votre prochaine victoire vous attend.</h3><p>Choisissez un adversaire et lancez un camp de préparation de trois jours.</p>${button('Trouver un adversaire ' + icon('arrow'), 'go-fights', 'secondary')}</div>`}</article>`;
}

function attributeView() {
  return `<div class="attribute-grid">${ATTRIBUTES.map(a => `<div class="attribute-row"><div class="metric-row"><span class="attribute-name">${esc(a.label)}</span><strong class="attribute-value">${Math.round(career.attributes[a.key])}<small> / ${Math.round(career.potential[a.key])}</small></strong></div>${energyBar(career.attributes[a.key])}</div>`).join('')}</div>`;
}

function dashboardView() {
  return `<section class="hero-card"><div class="hero-copy"><span class="hero-kicker"><span class="live-dot"></span> ${career.belts.length === 4 ? 'CHAMPION INCONTESTÉ' : 'VOTRE HISTOIRE RESTE À ÉCRIRE'}</span><h2 class="hero-title">FROM NOTHING.<br>TO <span>UNDISPUTED.</span></h2><p>${esc(career.profile.firstName)}, le sommet n’attend pas. Un entraînement, un round, une victoire à la fois.</p><div class="actions">${due() ? button('C’est l’heure du combat ' + icon('arrow'), 'start-fight') : button('Entrer dans la salle ' + icon('arrow'), 'go-gym')}${button('Mon classement', 'go-rankings', 'ghost')}</div></div><div class="hero-visual"><span class="hero-watermark">${esc(career.profile.nickname)}</span><canvas data-preview aria-label="Votre boxeur personnalisé"></canvas><span class="hero-fighter-name">${esc(fullName(career.profile))}</span><span class="badge">${esc(career.profile.style)} · ${esc(career.profile.stance)}</span></div></section>
    ${statsView()}<div class="grid two">${nextFightCard()}<article class="card"><div class="card-header"><h2 class="card-title">Le conseil du coin</h2><span class="eyebrow">COACH</span></div><div class="coach-quote">“${career.energy < 40 ? 'Le repos fait partie du travail. Un boxeur épuisé laisse ses réflexes au vestiaire.' : career.rank <= 5 ? 'Vous êtes dans la course au titre. Préparez-vous, puis défiez les meilleurs pour réunir les quatre ceintures.' : 'Ne cherchez pas le KO à chaque coup. Le jab ouvre la garde, les jambes vous sortent du danger.'}”</div><p class="muted">${career.energy < 40 ? 'Une journée de repos rend de l’énergie, sans coût.' : 'Dans le ring : ZQSD ou flèches pour bouger, J/K/L/I pour frapper, Espace pour parer.'}</p><div class="actions">${button('Récupérer une journée', 'rest', 'secondary')}</div></article></div>
    ${section('Le boxeur se construit ici.', 'ATTRIBUTS / POTENTIEL')}<article class="card">${attributeView()}</article>${section('Dernières nouvelles')}<article class="card">${historyView(3)}</article>`;
}

const trainingSymbol = { bag: '◎', shadow: '↝', rope: '⌁', run: '↗', strength: '▰', sparring: '⚔' };
function gymView() {
  return `${statsView()}<div class="notice">Une séance fait avancer d’une journée. Plus votre exécution est précise, plus vous progressez. Le coût en énergie est déduit uniquement à la fin de la séance.</div>${section('Passez à l’action.', '6 ATELIERS · PROGRESSION INTERACTIVE')}<div class="grid three">${TRAININGS.map(t => `<article class="card training-card"><span class="training-icon">${trainingSymbol[t.id] || '◎'}</span><h2 class="card-title">${esc(t.name)}</h2><p class="training-description">${esc(t.description)}</p><div class="training-tags">${t.attributes.map(key => `<span class="badge">${esc(ATTRIBUTES.find(a => a.key === key)?.label || key)}</span>`).join('')}</div><div class="training-meta"><span>${t.cost} énergie</span><span>1 journée · Effort physique</span></div>${button(t.id === 'sparring' ? 'Enfiler les gants' : 'Commencer la séance', 'train', 'secondary', `data-training="${t.id}" ${due() || career.energy < t.cost ? 'disabled' : ''}`)}</article>`).join('')}</div><article class="card recovery-card"><div><h2 class="card-title">Savoir lever le pied.</h2><p class="muted">La récupération rend de l’énergie et fait avancer votre calendrier. Aucun combat programmé ne sera sauté.</p></div><div class="actions">${button('Repos · 1 jour', 'rest', 'secondary', due() ? 'disabled' : '')}${button('Repos · 3 jours', 'rest-three', 'ghost', due() ? 'disabled' : '')}</div></article>`;
}

function fightsView() {
  return `${career.scheduledFight ? nextFightCard() : `<div class="notice">Un contrat programme le combat dans trois jours. Utilisez ce temps pour vous entraîner et récupérer. Chaque round dure 60 secondes.</div>`}${section('Les contrats sur la table.', 'ADVERSAIRES DE VOTRE CATÉGORIE')}<div class="grid three opponents-grid">${getOpponents(career).map(o => `<article class="card opponent-card"><div class="card-header"><span class="badge">N° ${o.rank} MONDIAL</span><span class="opponent-rating">${o.rating}<small> GEN</small></span></div><div class="opponent-monogram" style="--opponent-color:${esc(o.shortColor || '#b2bcd0')}">${esc(o.name.split(' ').map(w => w[0]).slice(0, 2).join(''))}</div><h2 class="fighter-name">${esc(o.name)}</h2><span class="nickname">“${esc(o.nickname)}”</span><p class="muted">${esc(o.nationality)} · ${esc(o.style)}</p><div class="record">${record(o.record)} <small> / ${o.record.kos} KO</small></div>${button(career.scheduledFight ? 'Contrat déjà signé' : career.rank <= 5 && o.rank <= 2 ? 'Signer · Combat pour le titre' : 'Signer le contrat ' + icon('arrow'), 'book', 'secondary', `data-opponent="${esc(o.id)}" ${career.scheduledFight ? 'disabled' : ''}`)}</article>`).join('')}</div>${section('Votre palmarès')}<article class="card">${historyView()}</article>`;
}

function calendarView() {
  const start = Math.floor((career.day - 1) / 28) * 28 + 1;
  return `<div class="grid two">${nextFightCard()}<article class="card"><h2 class="card-title">Préparer. Récupérer. Combattre.</h2><p class="muted">Chaque entraînement ou journée de repos avance votre carrière. Le calendrier s’arrête toujours au jour de votre combat.</p><div class="metric-row"><span>Énergie disponible</span><strong>${Math.round(career.energy)}%</strong></div>${energyBar(career.energy)}<div class="actions">${button('Repos · 1 jour', 'rest', 'secondary', due() ? 'disabled' : '')}${button('Jour suivant', 'advance', 'ghost', due() ? 'disabled' : '')}</div></article></div>${section(`${date(start)} — ${date(start + 27)}`, 'CAMP DE 28 JOURS')}<div class="calendar-grid">${Array.from({ length: 28 }, (_, i) => { const d = start + i, f = career.scheduledFight?.day === d, logs = career.trainingLog.filter(x => x.day === d), past = d < career.day; return `<div class="calendar-day ${d === career.day ? 'today' : ''} ${f ? 'fight-day' : ''} ${past ? 'past-day' : ''}"><span class="calendar-date">${date(d, { weekday: 'short', day: 'numeric' })}</span><span class="calendar-day-number">J${d}</span>${d === career.day ? '<span class="calendar-event">Aujourd’hui</span>' : ''}${f ? '<span class="calendar-event fight-event">SOIR DE COMBAT</span>' : ''}${logs.length ? '<span class="calendar-event">Entraînement effectué</span>' : ''}</div>`; }).join('')}</div>`;
}

function rankingsView() {
  return `<div class="belt-grid">${['WBC', 'WBA', 'IBF', 'WBO'].map(b => `<article class="belt-card ${career.belts.includes(b) ? 'earned' : ''}"><span class="belt-icon">${icon('fights')}</span><strong>${b}</strong><span>${career.belts.includes(b) ? 'CHAMPION' : 'À CONQUÉRIR'}</span></article>`).join('')}</div><div class="notice">Grimpez dans le classement en gagnant vos combats. Dans le top 5, les contrats pour le titre débloquent successivement les quatre ceintures. Les boxeurs et fédérations sont représentés dans un univers fictif.</div>${section(`Classement mondial · ${esc(career.profile.category)}`, `${career.belts.length} / 4 CEINTURES`)}<div class="card table-wrap"><table class="rank-table"><thead><tr><th scope="col">Rang</th><th scope="col">Boxeur</th><th scope="col">Pays</th><th scope="col">Palmarès</th><th scope="col">Niveau</th></tr></thead><tbody>${getRankings(career).map(o => `<tr class="${o.isPlayer ? 'player-row' : ''}"><td><span class="rank-number">${o.rank === 1 ? '♛' : String(o.rank).padStart(2, '0')}</span></td><td><strong>${esc(o.name)}${o.isPlayer ? ' <span class="badge gold">VOUS</span>' : ''}</strong><small>${esc(o.nickname)}</small></td><td>${esc(o.nationality)}</td><td>${record(o.record)}</td><td><strong>${o.rating}</strong><small>/ 100</small></td></tr>`).join('')}</tbody></table></div>`;
}

function historyView(limit = 100) {
  if (!career.history.length) return `<div class="empty-state compact"><h3>Une page blanche. Tout à prouver.</h3><p>Votre premier combat professionnel marquera le début de votre histoire.</p></div>`;
  return `<div class="history-list">${career.history.slice(0, limit).map(h => `<div class="history-item"><span class="badge ${h.outcome === 'win' ? 'green' : h.outcome === 'loss' ? 'red' : ''}">${h.outcome === 'win' ? 'VICTOIRE' : h.outcome === 'loss' ? 'DÉFAITE' : 'NUL'}</span><div><strong>${esc(h.opponent?.name || h.opponentName || h.opponent || 'Adversaire')}</strong><small>${esc(h.method)} · Round ${h.round} · ${date(h.day || career.day)}</small></div>${h.reward ? `<span>${money(h.reward)}</span>` : ''}</div>`).join('')}</div>`;
}

function profileView() {
  const p = career.profile;
  return `<div class="grid two"><article class="card avatar-card profile-avatar"><canvas data-preview aria-label="Apparence de votre boxeur"></canvas><span class="eyebrow">“${esc(p.nickname)}”</span><h2 class="fighter-name">${esc(fullName(p))}</h2><p class="muted">${esc(p.city)}, ${esc(p.nationality)} · ${p.age} ans</p><span class="badge gold">${esc(p.category)}</span></article><article class="card"><h2 class="card-title">La fiche du combattant</h2><dl class="profile-details">${[['Style', p.style], ['Garde', p.stance], ['Taille', `${p.height} cm`], ['Poids', `${p.weight} kg`], ['Allonge', `${p.reach} cm`], ['Morphologie', p.build], ['Classement', career.rank <= 50 ? `N° ${career.rank} mondial` : 'Non classé'], ['Palmarès', record(career.record)]].map(([k, v]) => `<div class="metric-row"><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="muted">Le potentiel propre à votre boxeur fixe la limite de chaque attribut. Le travail régulier vous en rapproche.</p></article></div>${section('Vos qualités.', 'NIVEAU ACTUEL / POTENTIEL')}<article class="card">${attributeView()}</article>${section('Votre carrière, à garder.')}<article class="card"><p class="muted">La progression est sauvegardée dans ce navigateur. Exportez un fichier pour la transférer ou la conserver avant de vider vos données.</p><div class="actions">${button('Exporter la sauvegarde', 'export', 'secondary')}${button('Importer une carrière', 'import', 'ghost')}${button('Nouvelle carrière', 'reset', 'danger')}</div><input type="file" id="import-file" accept="application/json,.json" hidden></article>`;
}

function inputField(label, name, type = 'text', extra = '') { return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(draft[name])}" ${extra}></label>`; }
function selectField(label, name, items) { return `<label class="field"><span>${label}</span><select name="${name}">${items.map(v => `<option ${draft[name] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`; }
function renderCreation() {
  $('#app').innerHTML = `<main class="welcome"><header class="welcome-header"><a class="brand" href="#"><span class="brand-mark">R<span>U</span></span><span class="brand-title">ROAD TO UNDISPUTED<span class="accent">.</span></span></a><span class="badge">VOTRE CARRIÈRE COMMENCE ICI</span></header><div class="welcome-intro"><p class="eyebrow">01 / CRÉEZ VOTRE COMBATTANT</p><h1 class="hero-title">EVERY LEGEND<br>HAS A <span>FIRST ROUND.</span></h1><p class="page-subtitle">De l’anonymat aux quatre ceintures. Entrez dans la peau du prochain champion.</p></div>${storageWarning ? `<div class="notice warning">${esc(storageWarning)}</div>` : ''}<form id="create-form" class="create-layout"><div><section class="card form-section"><div class="card-header"><h2 class="card-title">Une longueur d’avance</h2><span class="eyebrow">AVATARS PRÉDÉFINIS</span></div><div class="preset-list">${[['technician', '01', 'Le Technicien', 'Précision & maîtrise'], ['puncher', '02', 'La Foudre', 'Puissance & pression'], ['counter', '03', 'Le Fantôme', 'Réflexes & anticipation']].map(([id, n, title, desc]) => `<button type="button" class="choice-card" data-action="preset" data-preset="${id}"><span class="eyebrow">${n}</span><strong>${title}</strong><small>${desc}</small></button>`).join('')}</div></section><section class="card form-section"><h2 class="card-title">Un nom à retenir</h2><div class="form-grid">${inputField('Prénom', 'firstName', 'text', 'required maxlength="24" autocomplete="given-name"')}${inputField('Nom', 'lastName', 'text', 'required maxlength="24" autocomplete="family-name"')}${inputField('Surnom de ring', 'nickname', 'text', 'required maxlength="30"')}${inputField('Âge', 'age', 'number', 'required min="18" max="40"')}${inputField('Nationalité', 'nationality', 'text', 'required maxlength="35"')}${inputField('Ville d’origine', 'city', 'text', 'required maxlength="35"')}</div></section><section class="card form-section"><h2 class="card-title">Votre façon de boxer</h2><div class="form-grid">${selectField('Style de boxe', 'style', STYLES)}${selectField('Garde', 'stance', ['Droitier', 'Gaucher'])}${selectField('Catégorie', 'category', WEIGHTS)}${inputField('Poids (kg)', 'weight', 'number', 'required min="48" max="150" step="0.1"')}${inputField('Taille (cm)', 'height', 'number', 'required min="150" max="220"')}${inputField('Allonge (cm)', 'reach', 'number', 'required min="150" max="230"')}</div><p class="muted form-hint">Votre catégorie est ajustée au poids choisi. Votre style oriente vos qualités de départ ; votre potentiel est propre à cette carrière.</p></section><section class="card form-section"><h2 class="card-title">Votre signature visuelle</h2><div class="form-grid">${selectField('Visage', 'face', ['Anguleux', 'Ovale', 'Rond'])}${selectField('Coiffure', 'hair', ['Court', 'Rasé', 'Bouclé', 'Crête'])}${selectField('Barbe', 'beard', ['Aucune', 'Courte', 'Complète'])}${selectField('Morphologie', 'build', ['Athlétique', 'Massif', 'Élancé'])}<label class="field"><span>Teint</span><select name="skin">${[['#edbc96', 'Clair'], ['#bd805b', 'Mat'], ['#754832', 'Foncé'], ['#492e24', 'Ébène']].map(([v, label]) => `<option value="${v}" ${draft.skin === v ? 'selected' : ''}>${label}</option>`).join('')}</select></label>${inputField('Couleur du short', 'shortColor', 'color')}${inputField('Couleur des gants', 'gloveColor', 'color')}${inputField('Couleur des chaussures', 'shoeColor', 'color')}</div></section></div><aside class="card avatar-card creation-preview"><span class="eyebrow">DANS LE COIN BLEU</span><canvas class="avatar-canvas" id="creation-avatar" aria-label="Aperçu personnalisé du boxeur"></canvas><span class="nickname" id="preview-nickname"></span><h2 class="fighter-name" id="preview-name"></h2><p class="muted" id="preview-style"></p><div class="creation-record"><strong>0 — 0 — 0</strong><span>TOUT RESTE À ÉCRIRE.</span></div><button type="submit" class="btn primary">Commencer ma carrière ${icon('arrow')}</button><p class="muted small-text">Sauvegarde automatique · Jeu solo hors ligne après chargement · Sans compte</p><button type="button" class="btn ghost small" data-action="import">Reprendre depuis un fichier</button><input type="file" id="import-file" accept="application/json,.json" hidden></aside></form><footer class="main-footer"><span>ROAD TO UNDISPUTED</span><span>LE TITRE SE MÉRITE.</span></footer></main>`;
  updatePreview();
}

function updatePreview() {
  const form = $('#create-form');
  if (!form) return;
  for (const [key, value] of new FormData(form)) draft[key] = ['age', 'weight', 'height', 'reach'].includes(key) ? Number(value) : value;
  drawBoxerPreview($('#creation-avatar'), draft);
  $('#preview-name').textContent = fullName(draft);
  $('#preview-nickname').textContent = `“${draft.nickname}”`;
  $('#preview-style').textContent = `${draft.style} · ${draft.stance}`;
}

function showModal(content, { dismissible = true } = {}) {
  modalPreviousFocus = document.activeElement;
  $('#modal-root').innerHTML = `<div class="modal-backdrop"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">${dismissible ? '<button class="icon-btn modal-close" data-action="close-modal" aria-label="Fermer">×</button>' : ''}${content}</section></div>`;
  $('#app').inert = true;
  $('#modal-root').dataset.dismissible = String(dismissible);
  const focus = $('#modal-root button, #modal-root input');
  focus?.focus();
}

function closeModal() {
  if (training) return;
  $('#modal-root').innerHTML = '';
  delete $('#modal-root').dataset.dismissible;
  $('#app').inert = false;
  if (modalPreviousFocus?.isConnected) modalPreviousFocus.focus();
}

function processAction(result) {
  if (result.ok) { save(); render(); }
  notify(result.message, !result.ok);
}

function startTraining(id) {
  const t = TRAININGS.find(t => t.id === id);
  if (!t) return;
  if (due()) { notify('Votre combat vous attend aujourd’hui.', true); return; }
  if (career.energy < t.cost) { notify(`Cette séance demande ${t.cost} points d’énergie. Prenez du repos.`, true); return; }
  if (id === 'sparring') {
    const partner = { ...getOpponents(career).at(0), name: 'Partenaire de sparring', shortColor: '#669fbc', attributes: { ...career.attributes } };
    beginBout(partner, { rounds: 1, roundSeconds: 45, sparring: true });
    return;
  }
  const instructions = {
    bag: ['Une combinaison bien placée.', 'Appuyez sur la touche affichée quand le curseur entre dans la zone verte. Les coups changent à chaque répétition.'],
    shadow: ['Bougez avec précision.', 'Suivez la direction affichée au moment où le curseur traverse la zone verte.'],
    rope: ['Trouvez votre rythme.', 'Appuyez sur Espace à chaque passage du curseur dans la zone verte.'],
    run: ['Une foulée après l’autre.', 'Alternez Q et D au bon moment : une touche par passage dans la zone verte.'],
    strength: ['Contrôlez la charge.', 'Maintenez Espace pour soulever la charge, puis relâchez dans la zone verte. Une répétition à la fois.'],
  };
  training = { definition: t, elapsed: 0, position: 0, reps: 0, score: 0, holding: false, charge: 0, lastAttempt: -1, duration: 20, speed: id === 'rope' ? 1.65 : id === 'shadow' ? 1.4 : 1.2 };
  const [title, description] = instructions[id];
  showModal(`<span class="eyebrow">LA SALLE · ${esc(t.name)}</span><h2 id="modal-title">${title}</h2><p class="muted">${description}</p><div class="training-stats"><span><strong id="training-reps">0</strong> / 10 répétitions</span><span id="training-time">20 s</span></div><div class="training-stage" aria-label="Zone de précision"><div class="training-target" style="left:61%;width:19%"></div><div class="training-cursor" id="training-cursor"></div><span class="training-zone-label">ZONE PARFAITE</span></div><div class="training-score" id="training-feedback" aria-live="polite">Prêt ? À vous de jouer.</div><button class="btn primary training-hit" id="training-hit" data-action="training-hit">${trainingKey().label}</button><p class="muted small-text">${t.cost} points d’énergie · 1 journée · La séance se termine après 10 répétitions ou 20 secondes.</p><div class="modal-actions">${button('Arrêter sans progression', 'cancel-training', 'ghost')}</div>`, { dismissible: false });
}

function trainingKey() {
  if (!training) return { code: 'Space', label: 'Espace' };
  const i = training.reps;
  switch (training.definition.id) {
    case 'bag': return [{ code: 'KeyJ', label: 'J · Jab' }, { code: 'KeyK', label: 'K · Direct' }, { code: 'KeyL', label: 'L · Crochet' }, { code: 'KeyI', label: 'I · Uppercut' }][i % 4];
    case 'shadow': return [{ code: 'ArrowLeft', alt: 'KeyQ', label: '← · Esquive à gauche' }, { code: 'ArrowUp', alt: 'KeyZ', label: '↑ · Avancer' }, { code: 'ArrowRight', alt: 'KeyD', label: '→ · Esquive à droite' }, { code: 'ArrowDown', alt: 'KeyS', label: '↓ · Reculer' }][i % 4];
    case 'run': return i % 2 ? { code: 'KeyD', label: 'D · Foulée droite' } : { code: 'KeyQ', label: 'Q · Foulée gauche' };
    default: return { code: 'Space', label: training.definition.id === 'strength' ? 'Maintenir puis relâcher · Espace' : 'Espace · Sauter' };
  }
}

function trainingAttempt(code = trainingKey().code, released = false) {
  if (!training) return;
  const t = training, expected = trainingKey();
  if (t.elapsed - t.lastAttempt < 0.23 || t.reps >= 10) return;
  const correct = code === expected.code || code === expected.alt;
  if (t.definition.id === 'strength') {
    if (!correct) return;
    if (!released) { t.holding = true; return; }
    if (!t.holding) return;
    t.holding = false;
  } else if (released) return;
  const position = t.definition.id === 'strength' ? t.charge : t.position;
  const quality = correct ? Math.max(0, 1 - Math.abs(position - 0.705) / 0.27) : 0;
  t.reps++; t.score += quality; t.lastAttempt = t.elapsed; t.charge = 0;
  $('#training-reps').textContent = t.reps;
  $('#training-feedback').textContent = quality >= 0.85 ? 'Parfait !' : quality >= 0.5 ? 'Bien exécuté.' : correct ? 'Gardez le rythme. Visez la zone verte.' : 'Mauvaise touche. Regardez le prochain mouvement.';
  $('#training-feedback').style.color = quality >= 0.5 ? 'var(--accent)' : 'var(--red)';
  $('#training-hit').textContent = trainingKey().label;
  if (t.reps >= 10) finishTraining();
}

function finishTraining() {
  if (!training) return;
  const t = training; training = null;
  const quality = t.score / 10;
  const result = train(career, t.definition.id, quality);
  if (!result.ok) { closeModal(); notify(result.message, true); return; }
  save(); render();
  showModal(`<span class="eyebrow">SÉANCE TERMINÉE</span><h2 id="modal-title">Le travail paie.</h2><div class="training-result-value">${Math.round(quality * 100)}<small>%</small></div><p class="muted">Précision de la séance · ${t.reps} répétitions effectuées</p><div class="gains-list">${Object.entries(result.gains).map(([k, v]) => `<div class="metric-row"><span>${esc(ATTRIBUTES.find(a => a.key === k)?.label)}</span><strong class="accent">+${v.toFixed(1)}</strong></div>`).join('')}</div><p class="muted">−${t.definition.cost} énergie · Jour ${career.day}</p><div class="modal-actions">${button('Retour à la salle', 'close-modal')}</div>`, { dismissible: true });
}

function beginBout(opponent, options = {}) {
  const player = { ...career.profile, name: fullName(career.profile), attributes: { ...career.attributes } };
  const bout = createBout(player, opponent, options);
  // Fatigue affects the start, never the fighter's permanent attributes.
  bout.player.stamina = Math.max(25, career.energy);
  activeFight = { bout, opponent, options, sparring: !!options.sparring, settled: false, result: null };
  paused = false; keys.clear(); touch.clear(); lastSoundEvent = 0;
  screen = 'ring';
  checkpointBout();
  render(); window.scrollTo({ top: 0, behavior: 'instant' });
}

function checkpointBout() {
  if (!activeFight || activeFight.settled) return;
  try {
    localStorage.setItem(BOUT_KEY, JSON.stringify({ day: career.day, name: fullName(career.profile), fight: activeFight }));
  } catch { /* Career export remains available if local storage is full. */ }
}

function resumeCheckpoint() {
  try {
    const raw = localStorage.getItem(BOUT_KEY);
    if (!career || !raw) return;
    const checkpoint = JSON.parse(raw), f = checkpoint.fight, b = f?.bout;
    const validFighter = x => x && [x.x, x.y, x.hp, x.stamina, x.damage, x.actionTime, x.actionDuration, x.cooldown, x.knockdowns].every(Number.isFinite) && x.x >= 0 && x.x <= 1000 && x.y >= 0 && x.y <= 600 && x.hp >= 0 && x.hp <= 100 && x.stamina >= 0 && x.stamina <= 100 && x.attributes && ATTRIBUTES.every(a => Number.isFinite(x.attributes[a.key]));
    if (checkpoint.day !== career.day || checkpoint.name !== fullName(career.profile) || !f || f.settled || !b || !['fighting', 'break', 'finished'].includes(b.phase) || !validFighter(b.player) || !validFighter(b.opponent) || !Number.isFinite(b.elapsed) || !Number.isFinite(b.timeLeft) || !Array.isArray(b.events) || !Array.isArray(b.scorecards) || (!f.sparring && (!due() || career.scheduledFight.opponent.id !== f.opponent.id))) {
      removeCheckpoint(); return;
    }
    const fresh = createBout(b.player.profile, b.opponent.profile, f.options);
    activeFight = { ...f, bout: Object.assign(fresh, b, { rng: Math.random }) };
    paused = true; screen = 'ring';
  } catch { removeCheckpoint(); }
}

function ringView() {
  if (!activeFight) return '<div class="empty-state">Aucun combat en cours.</div>';
  const f = activeFight;
  return `<section class="fight-layout"><div class="fight-hud"><div class="fighter-hud"><span class="eyebrow">COIN BLEU · VOUS</span><strong>${esc(fullName(career.profile))}</strong><div class="health-track"><div class="health-fill" id="player-hp"></div></div><div class="stamina-track"><div class="stamina-fill" id="player-stamina"></div></div><div class="hud-values"><span id="player-values"></span><span id="player-kd"></span></div></div><div class="round-hud"><span id="round-number">ROUND 1</span><strong id="round-time">1:00</strong><small id="round-phase">BOXEZ</small></div><div class="fighter-hud right"><span class="eyebrow">COIN ROUGE</span><strong>${esc(f.opponent.name)}</strong><div class="health-track"><div class="health-fill" id="opponent-hp"></div></div><div class="stamina-track"><div class="stamina-fill" id="opponent-stamina"></div></div><div class="hud-values"><span id="opponent-values"></span><span id="opponent-kd"></span></div></div></div><div class="ring-wrap"><canvas id="ring" class="ring-canvas" aria-label="Ring de boxe interactif. Utilisez les commandes sous le ring." tabindex="0"></canvas><div class="ring-overlay" id="ring-overlay" hidden><strong>PAUSE</strong><span>Appuyez sur P ou sur Reprendre</span></div></div><div class="fight-status"><p id="fight-message" class="fight-log" aria-live="polite"></p><div class="actions">${button(paused ? 'Reprendre' : 'Pause · P', 'pause', 'secondary small', 'id="pause-button"')}${button('Abandonner', 'forfeit', 'ghost small')}${button(soundEnabled ? 'Son : activé' : 'Son : coupé', 'sound', 'ghost small', 'id="sound-button"')}</div></div><div class="fight-controls"><span><kbd>↑ ↓ ← →</kbd> / <kbd>Z Q S D</kbd> Bouger</span><span><kbd>J</kbd> Jab</span><span><kbd>K</kbd> Direct</span><span><kbd>L</kbd> Crochet</span><span><kbd>I</kbd> Uppercut</span><span><kbd>Espace</kbd> Garde</span><span><kbd>Maj</kbd> Esquive</span></div><div class="touch-controls" aria-label="Commandes tactiles"><div class="touch-pad"><button class="touch-button up" data-control="up" aria-label="Avancer">↑</button><button class="touch-button left" data-control="left" aria-label="Gauche">←</button><button class="touch-button down" data-control="down" aria-label="Reculer">↓</button><button class="touch-button right" data-control="right" aria-label="Droite">→</button></div><div class="touch-attacks">${[['jab', 'Jab'], ['cross', 'Direct'], ['hook', 'Crochet'], ['uppercut', 'Uppercut'], ['block', 'Garde'], ['dodge', 'Esquive']].map(([id, name]) => `<button class="touch-button" data-control="${id}">${name}</button>`).join('')}</div></div><p class="muted small-text ring-tip">Approchez-vous pour toucher. Les coups puissants coûtent plus de souffle. Récupérez à distance, utilisez la garde et variez vos attaques.</p></section>`;
}

function updateFightHud() {
  const b = activeFight?.bout;
  if (!b || !$('#round-time')) return;
  for (const [id, fighter] of [['player', b.player], ['opponent', b.opponent]]) {
    $(`#${id}-hp`).style.width = `${fighter.hp}%`;
    $(`#${id}-stamina`).style.width = `${fighter.stamina}%`;
    $(`#${id}-values`).textContent = `Santé ${Math.ceil(fighter.hp)} · Souffle ${Math.ceil(fighter.stamina)}`;
    $(`#${id}-kd`).textContent = `${fighter.knockdowns} au tapis`;
  }
  const secs = Math.ceil(b.phase === 'break' ? b.breakLeft : b.timeLeft);
  $('#round-number').textContent = `ROUND ${b.round} / ${b.rounds}`;
  $('#round-time').textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  $('#round-phase').textContent = paused ? 'EN PAUSE' : b.phase === 'break' ? 'REPOS' : b.phase === 'finished' ? 'TERMINÉ' : 'BOXEZ';
  const message = $('#fight-message');
  if (message.textContent !== b.message) message.textContent = b.message;
  $('#ring-overlay').hidden = !paused || activeFight.settled;
  $('#pause-button').textContent = paused ? 'Reprendre' : 'Pause · P';
}

function inputState() {
  const has = (...codes) => codes.some(c => keys.has(c));
  return {
    moveX: Number(has('ArrowRight', 'KeyD') || touch.has('right')) - Number(has('ArrowLeft', 'KeyQ', 'KeyA') || touch.has('left')),
    moveY: Number(has('ArrowDown', 'KeyS') || touch.has('down')) - Number(has('ArrowUp', 'KeyZ', 'KeyW') || touch.has('up')),
    block: has('Space') || touch.has('block'), dodge: has('ShiftLeft', 'ShiftRight') || touch.has('dodge'),
    jab: has('KeyJ') || touch.has('jab'), cross: has('KeyK') || touch.has('cross'), hook: has('KeyL') || touch.has('hook'), uppercut: has('KeyI') || touch.has('uppercut'),
  };
}

function settleBout() {
  if (!activeFight || activeFight.settled) return;
  const f = activeFight, result = getBoutResult(f.bout);
  if (!result) return;
  f.settled = true; f.result = result; paused = false; keys.clear(); touch.clear();
  removeCheckpoint();
  let resolution;
  if (f.sparring) {
    const stats = result.stats?.player;
    const precision = stats?.thrown ? stats.landed / stats.thrown : 0;
    resolution = train(career, 'sparring', Math.min(1, 0.2 + precision * 0.4 + (result.outcome === 'win' ? 0.4 : result.outcome === 'draw' ? 0.2 : 0.1)));
  } else resolution = resolveFight(career, result);
  if (!resolution.ok) { notify(resolution.message, true); return; }
  save();
  const won = result.outcome === 'win', drawn = result.outcome === 'draw';
  showModal(`<div class="result-card"><span class="eyebrow">${f.sparring ? 'SPARRING TERMINÉ' : 'RÉSULTAT OFFICIEL'}</span><h2 id="modal-title" class="result-title ${won ? 'accent' : ''}">${drawn ? 'MATCH NUL.' : won ? 'VICTOIRE.' : 'DÉFAITE.'}</h2><p>${esc(fullName(career.profile))} ${won ? 's’impose' : drawn ? 'fait match nul' : 's’incline'} face à ${esc(f.opponent.name)}</p><span class="badge ${won ? 'green' : drawn ? '' : 'red'}">${esc(result.method)} · ROUND ${result.round}</span><p class="muted result-message">${esc(resolution.message)}</p>${result.scorecards?.length ? `<div class="table-wrap"><table class="score-table"><thead><tr><th>Round</th><th>Vous</th><th>Adversaire</th></tr></thead><tbody>${result.scorecards.map(s => `<tr><td>${s.round}</td><td>${s.player}</td><td>${s.opponent}</td></tr>`).join('')}</tbody></table></div>` : ''}<div class="grid two result-stats"><div><strong>${f.bout.player.landed} / ${f.bout.player.thrown}</strong><small>VOS COUPS TOUCHÉS / LANCÉS</small></div><div><strong>${f.bout.opponent.landed} / ${f.bout.opponent.thrown}</strong><small>COUPS ADVERSES TOUCHÉS / LANCÉS</small></div></div><div class="modal-actions">${button(f.sparring ? 'Retour à la salle' : 'Retour à ma carrière', 'finish-bout')}</div></div>`, { dismissible: false });
}

let soundEnabled = false, audioContext, lastSoundEvent = 0;
function playSound(type) {
  if (!soundEnabled || !audioContext) return;
  try {
    const osc = audioContext.createOscillator(), gain = audioContext.createGain(), now = audioContext.currentTime;
    osc.type = type === 'hit' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(type === 'hit' ? 115 : 650, now);
    osc.frequency.exponentialRampToValueAtTime(type === 'hit' ? 35 : 430, now + 0.12);
    gain.gain.setValueAtTime(type === 'hit' ? 0.18 : 0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain); gain.connect(audioContext.destination); osc.start(now); osc.stop(now + 0.2);
  } catch { /* Sound is optional. */ }
}

function frame(now) {
  const dt = Math.min((now - (lastFrame || now)) / 1000, 0.05); lastFrame = now;
  if (training) {
    const t = training; t.elapsed += dt;
    if (t.definition.id === 'strength') { if (t.holding) t.charge = Math.min(1, t.charge + dt * 0.7); t.position = t.charge; }
    else t.position = (Math.sin(t.elapsed * Math.PI * t.speed - Math.PI / 2) + 1) / 2;
    const cursor = $('#training-cursor');
    if (cursor) cursor.style.left = `${t.position * 100}%`;
    const timer = $('#training-time');
    if (timer) timer.textContent = `${Math.max(0, Math.ceil(t.duration - t.elapsed))} s`;
    if (t.elapsed >= t.duration) finishTraining();
  }
  if (activeFight && screen === 'ring') {
    if (!paused && !activeFight.settled && !$('#modal-root').firstElementChild) {
      stepBout(activeFight.bout, dt, inputState());
      for (const e of activeFight.bout.events) {
        if (e.id > lastSoundEvent && ['hit', 'round', 'finish'].includes(e.type)) playSound(e.type);
        lastSoundEvent = Math.max(lastSoundEvent, e.id);
      }
      if (activeFight.bout.phase === 'finished') settleBout();
      else if (now - lastCheckpoint > 2000) { checkpointBout(); lastCheckpoint = now; }
    }
    const canvas = $('#ring');
    if (canvas) drawRing(canvas, activeFight.bout);
    updateFightHud();
  }
  requestAnimationFrame(frame);
}

function exportCareer() {
  const data = new Blob([JSON.stringify(career, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(data), a = document.createElement('a');
  a.href = url; a.download = `road-to-undisputed-jour-${career.day}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('Sauvegarde exportée. Conservez ce fichier pour reprendre votre carrière.');
}

async function importCareer(file) {
  if (!file) return;
  try {
    if (file.size > 500000) throw new Error('Le fichier est trop volumineux.');
    const data = JSON.parse(await file.text());
    if (!validateSave(data)) throw new Error('Ce fichier n’est pas une sauvegarde Road to Undisputed valide.');
    const apply = () => { career = data; activeFight = null; removeCheckpoint(); storageWarning = ''; save(); closeModal(); screen = 'dashboard'; render(); notify('Carrière importée. Bon retour dans votre coin !'); };
    if (career) {
      pendingImport = apply;
      showModal(`<h2 id="modal-title">Reprendre cette carrière ?</h2><p class="muted">La carrière actuelle sera remplacée par celle de ${esc(fullName(data.profile))}, au jour ${data.day}. Exportez d’abord votre carrière actuelle si vous souhaitez la garder.</p><div class="modal-actions">${button('Annuler', 'close-modal', 'secondary')}${button('Importer cette carrière', 'confirm-import')}</div>`);
    } else apply();
  } catch (error) { notify(error instanceof SyntaxError ? 'Le fichier JSON est illisible.' : error.message, true); }
}
let pendingImport = null;

document.addEventListener('click', event => {
  const nav = event.target.closest('[data-screen]');
  if (nav) { event.preventDefault(); navigate(nav.dataset.screen); return; }
  const el = event.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const action = el.dataset.action;
  if (action.startsWith('go-')) { navigate(action.slice(3)); return; }
  if (action === 'close-modal') { closeModal(); return; }
  if (action === 'preset') {
    updatePreview();
    const presets = {
      technician: { firstName: 'Alex', lastName: 'Martin', nickname: 'Le Technicien', style: 'Technicien', skin: '#bd805b', face: 'Anguleux', hair: 'Court', beard: 'Courte', build: 'Élancé', shortColor: '#d9ef77' },
      puncher: { firstName: 'Malik', lastName: 'Diarra', nickname: 'La Foudre', style: 'Puncheur', skin: '#754832', hair: 'Rasé', beard: 'Courte', build: 'Massif', shortColor: '#d85143' },
      counter: { firstName: 'Sacha', lastName: 'Volkov', nickname: 'Le Fantôme', style: 'Contre-attaquant', skin: '#edbc96', hair: 'Bouclé', beard: 'Aucune', build: 'Athlétique', shortColor: '#85b6df' },
    };
    draft = { ...draft, ...presets[el.dataset.preset] }; renderCreation(); return;
  }
  if (action === 'import') { $('#import-file')?.click(); return; }
  if (action === 'confirm-import') { pendingImport?.(); pendingImport = null; return; }
  if (action === 'help') {
    showModal(`<span class="eyebrow">LE MOT DU COACH</span><h2 id="modal-title">Votre route vers le titre.</h2><ol class="help-list"><li><strong>Travaillez à la salle.</strong> Réussissez les exercices pour développer vos 12 qualités.</li><li><strong>Récupérez.</strong> Les séances coûtent de l’énergie. Une journée de repos en rend 34.</li><li><strong>Signez un contrat.</strong> Le combat a lieu trois jours plus tard. Préparez votre camp.</li><li><strong>Boxez.</strong> Flèches ou ZQSD pour bouger ; J, K, L, I pour les coups ; Espace pour la garde ; Maj pour esquiver ; P pour la pause. Commandes tactiles sous le ring.</li><li><strong>Grimpez au classement.</strong> Battez des adversaires mieux classés, atteignez le top 5 et réunissez les quatre ceintures.</li></ol><p class="muted">Rounds de 60 secondes, décision aux points ou KO/TKO. La sauvegarde est automatique, y compris pendant le combat. Exportez-la depuis « Mon boxeur » pour la conserver ailleurs.</p><div class="modal-actions">${button('C’est parti', 'close-modal')}</div>`); return;
  }
  if (action === 'rest') { processAction(rest(career, 1)); return; }
  if (action === 'rest-three') { processAction(rest(career, 3)); return; }
  if (action === 'advance') { processAction(advanceDay(career)); return; }
  if (action === 'book') { processAction(bookFight(career, el.dataset.opponent)); return; }
  if (action === 'train') { startTraining(el.dataset.training); return; }
  if (action === 'training-hit') { if (training?.definition.id !== 'strength') trainingAttempt(); return; }
  if (action === 'cancel-training') { training = null; closeModal(); notify('Séance arrêtée. Aucune progression ni énergie dépensée.'); return; }
  if (action === 'start-fight') {
    if (!due()) { notify('Le combat n’a pas encore lieu.', true); return; }
    beginBout(career.scheduledFight.opponent, { rounds: career.scheduledFight.rounds, roundSeconds: 60 }); return;
  }
  if (action === 'pause') { if (activeFight && !activeFight.settled) { paused = !paused; keys.clear(); touch.clear(); checkpointBout(); updateFightHud(); } return; }
  if (action === 'forfeit') {
    paused = true; keys.clear(); touch.clear();
    showModal(`<h2 id="modal-title">Jeter l’éponge ?</h2><p class="muted">${activeFight.sparring ? 'Le sparring s’arrêtera avec une séance évaluée selon vos coups touchés.' : 'Votre adversaire sera déclaré vainqueur par TKO. La défaite sera inscrite à votre palmarès.'}</p><div class="modal-actions">${button('Rester dans le combat', 'resume-bout', 'secondary')}${button('Abandonner le combat', 'confirm-forfeit', 'danger')}</div>`, { dismissible: false }); return;
  }
  if (action === 'resume-bout') { closeModal(); paused = false; return; }
  if (action === 'confirm-forfeit') {
    closeModal(); const b = activeFight.bout;
    b.phase = 'finished'; b.winner = 'opponent'; b.method = 'TKO'; b.message = 'Votre coin a jeté l’éponge.';
    settleBout(); return;
  }
  if (action === 'finish-bout') { const sparring = activeFight?.sparring; closeModal(); activeFight = null; screen = sparring ? 'gym' : 'dashboard'; render(); return; }
  if (action === 'sound') {
    try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume(); soundEnabled = !soundEnabled; $('#sound-button').textContent = soundEnabled ? 'Son : activé' : 'Son : coupé'; if (soundEnabled) playSound('round'); } catch { notify('Le son n’est pas disponible dans ce navigateur.', true); }
    return;
  }
  if (action === 'export') { exportCareer(); return; }
  if (action === 'reset') {
    showModal(`<h2 id="modal-title">Écrire une nouvelle histoire ?</h2><p class="muted">Cette action remplace votre carrière locale. Exportez-la d’abord si vous souhaitez la conserver.</p><div class="modal-actions">${button('Annuler', 'close-modal', 'secondary')}${button('Créer une nouvelle carrière', 'confirm-reset', 'danger')}</div>`); return;
  }
  if (action === 'confirm-reset') {
    closeModal(); career = null; activeFight = null; removeCheckpoint();
    try { localStorage.removeItem(KEY); } catch { /* New career can still run in memory. */ }
    draft = { ...defaultProfile }; renderCreation(); return;
  }
});

document.addEventListener('submit', event => {
  if (event.target.id !== 'create-form') return;
  event.preventDefault(); updatePreview();
  draft.category = draft.weight <= 61.2 ? WEIGHTS[0] : draft.weight <= 66.7 ? WEIGHTS[1] : draft.weight <= 76.2 ? WEIGHTS[2] : draft.weight <= 79.4 ? WEIGHTS[3] : WEIGHTS[4];
  career = createCareer(draft); storageWarning = ''; removeCheckpoint(); save(); screen = 'dashboard'; render(); window.scrollTo(0, 0);
  notify('Bienvenue chez les pros. Votre histoire commence aujourd’hui.');
});

document.addEventListener('input', event => {
  if (event.target.closest('#create-form')) {
    if (event.target.name === 'category') {
      const weights = [60, 66, 74, 79, 95];
      $('#create-form [name="weight"]').value = weights[WEIGHTS.indexOf(event.target.value)] || 74;
    }
    if (event.target.name === 'weight') {
      const w = Number(event.target.value);
      $('#create-form [name="category"]').value = w <= 61.2 ? WEIGHTS[0] : w <= 66.7 ? WEIGHTS[1] : w <= 76.2 ? WEIGHTS[2] : w <= 79.4 ? WEIGHTS[3] : WEIGHTS[4];
    }
    updatePreview();
  }
});
document.addEventListener('change', event => { if (event.target.id === 'import-file') { importCareer(event.target.files[0]); event.target.value = ''; } });

document.addEventListener('keydown', event => {
  const code = logicalCode(event);
  if (code === 'Tab' && $('#modal-root').firstElementChild) {
    const focusables = $$('#modal-root button:not(:disabled), #modal-root input, #modal-root select, #modal-root a[href]');
    const first = focusables[0], last = focusables.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  if (code === 'Escape' && $('#modal-root').firstElementChild && $('#modal-root').dataset.dismissible === 'true') { closeModal(); return; }
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
  if (training) {
    if (['Space', 'KeyJ', 'KeyK', 'KeyL', 'KeyI', 'KeyQ', 'KeyD', 'KeyZ', 'KeyS', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
      event.preventDefault(); if (!event.repeat) trainingAttempt(code);
    }
    return;
  }
  if (screen !== 'ring' || !activeFight || activeFight.settled || $('#modal-root').firstElementChild) return;
  if (code === 'KeyP' || code === 'Escape') { event.preventDefault(); if (!event.repeat) { paused = !paused; keys.clear(); touch.clear(); checkpointBout(); updateFightHud(); } return; }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyZ', 'KeyW', 'KeyQ', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'KeyK', 'KeyL', 'KeyI'].includes(code)) { event.preventDefault(); keys.add(code); }
});
document.addEventListener('keyup', event => { const code = logicalCode(event); keys.delete(code); if (training?.definition.id === 'strength') trainingAttempt(code, true); });
document.addEventListener('pointerdown', event => {
  const control = event.target.closest('[data-control]');
  if (control) { event.preventDefault(); control.setPointerCapture(event.pointerId); touch.add(control.dataset.control); control.classList.add('pressed'); }
  if (event.target.closest('#training-hit') && training?.definition.id === 'strength') { event.preventDefault(); event.target.setPointerCapture(event.pointerId); trainingAttempt('Space'); }
});
function releasePointer(event) {
  const control = event.target.closest('[data-control]');
  if (control) { touch.delete(control.dataset.control); control.classList.remove('pressed'); }
  if (event.target.closest('#training-hit') && training?.definition.id === 'strength') trainingAttempt('Space', true);
}
document.addEventListener('pointerup', releasePointer);
document.addEventListener('pointercancel', releasePointer);
function pauseOnLeave() {
  keys.clear(); touch.clear();
  if (activeFight && !activeFight.settled) { paused = true; checkpointBout(); updateFightHud(); }
}
window.addEventListener('blur', pauseOnLeave);
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseOnLeave(); });
window.addEventListener('beforeunload', checkpointBout);
window.addEventListener('resize', () => { $$('canvas[data-preview]').forEach(c => drawBoxerPreview(c, career.profile)); if (!career) updatePreview(); });

resumeCheckpoint();
render();
requestAnimationFrame(frame);
