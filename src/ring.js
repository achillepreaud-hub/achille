/** Canvas presentation only. The simulation remains independent in combat.js. */
const TAU = Math.PI * 2;
const SKINS = { light: '#e3ad87', tan: '#bf8159', dark: '#794b37' };
const skinColor = (skin) => SKINS[skin] || (/^#[0-9a-f]{3,8}$/i.test(skin || '') ? skin : SKINS.tan);
const color = (value, fallback) => /^#[0-9a-f]{3,8}$/i.test(value || '') ? value : fallback;
const appearance = (value) => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function contextFor(canvas, width, height) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  const displayWidth = rect.width || width;
  const displayHeight = rect.height || displayWidth * height / width;
  const pixelWidth = Math.round(displayWidth * dpr);
  const pixelHeight = Math.round(displayHeight * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return ctx;
}

function ellipse(ctx, x, y, rx, ry, fill, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

function line(ctx, points, stroke, width) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function roundedRect(ctx, x, y, w, h, radius, fill) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawArena(ctx) {
  const backdrop = ctx.createLinearGradient(0, 0, 0, 600);
  backdrop.addColorStop(0, '#070d15');
  backdrop.addColorStop(0.6, '#111a24');
  backdrop.addColorStop(1, '#070c13');
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, 1000, 600);

  // Repeated silhouettes are deterministic, keeping the audience still between frames.
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i < 53; i++) {
      const x = 10 + i * 19 + (row % 2) * 8;
      const y = 8 + row * 10;
      const shade = (i * 17 + row * 7) % 4;
      const tone = ['#25303b', '#1a2530', '#41413e', '#18212b'][shade];
      ellipse(ctx, x, y, 3.8, 4.5, tone);
      roundedRect(ctx, x - 5, y + 4, 10, 7, 3, '#17212c');
      ellipse(ctx, x + 2, 593 - y, 4, 4, tone);
    }
  }

  for (const x of [160, 840]) {
    const beam = ctx.createLinearGradient(x, 0, 500, 440);
    beam.addColorStop(0, 'rgba(227,193,136,.14)');
    beam.addColorStop(1, 'rgba(227,193,136,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x - 12, 0);
    ctx.lineTo(x + 12, 0);
    ctx.lineTo(x + (x < 500 ? 640 : -350), 560);
    ctx.lineTo(x + (x < 500 ? 210 : -640), 560);
    ctx.closePath();
    ctx.fill();
  }

  ctx.save();
  ctx.translate(65, 30);
  ctx.scale(.87, .9);
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 35;
  ctx.shadowOffsetY = 16;
  roundedRect(ctx, 15, 15, 970, 570, 8, '#080d13');
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const floor = ctx.createRadialGradient(470, 250, 40, 500, 300, 600);
  floor.addColorStop(0, '#354451');
  floor.addColorStop(.7, '#293743');
  floor.addColorStop(1, '#1b2834');
  ctx.fillStyle = floor;
  ctx.fillRect(35, 35, 930, 530);

  // Stitched canvas panels and worn center lettering.
  ctx.strokeStyle = 'rgba(215,226,228,.035)';
  ctx.lineWidth = 1;
  for (let x = 65; x < 970; x += 110) {
    ctx.beginPath(); ctx.moveTo(x, 35); ctx.lineTo(x, 565); ctx.stroke();
  }
  for (let y = 55; y < 565; y += 85) {
    ctx.beginPath(); ctx.moveTo(35, y); ctx.lineTo(965, y); ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(229,216,186,.13)';
  ctx.font = '900 116px Arial, sans-serif';
  ctx.fillText('RTU', 500, 327);
  ctx.font = '600 13px Arial, sans-serif';
  ctx.letterSpacing = '6px';
  ctx.fillText('ROAD TO UNDISPUTED', 500, 360);
  ctx.letterSpacing = '0px';
  ctx.strokeStyle = 'rgba(229,216,186,.1)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(500, 300, 153, 0, TAU); ctx.stroke();

  for (const [x, y, tone] of [[35,35,'#597e9b'], [965,565,'#a34e4a'], [965,35,'#bdaf94'], [35,565,'#bdaf94']]) {
    roundedRect(ctx, x - 11, y - 11, 22, 22, 5, '#151e28');
    roundedRect(ctx, x - 6, y - 28, 12, 56, 5, tone);
    ellipse(ctx, x, y - 23, 6, 3, 'rgba(255,255,255,.2)');
  }
  // Three parallel ropes, the warm upper rope picks up the overhead lights.
  for (let i = 0; i < 3; i++) {
    const inset = i * 8;
    ctx.strokeStyle = ['#c6bba6', '#667481', '#bdaf98'][i];
    ctx.lineWidth = i === 0 ? 4 : 3;
    ctx.strokeRect(35 + inset, 35 + inset, 930 - inset * 2, 530 - inset * 2);
  }
  ctx.restore();
}

function drawMarseilleSupporter(ctx, now) {
  // The front row sits below the ropes, outside the playable ring.
  ctx.save();
  ctx.translate(753, 570);

  // White and sky-blue shirt, scarf and a raised fist.
  roundedRect(ctx, -18, 8, 36, 28, 7, '#f4fbff');
  roundedRect(ctx, -7, 8, 6, 28, 2, '#27b5e3');
  roundedRect(ctx, 6, 8, 5, 28, 2, '#27b5e3');
  line(ctx, [[-15, 13], [-34, -1], [-40, -11]], '#d7a17b', 8);
  const cheer = Math.sin(now * 4) * 2;
  line(ctx, [[16, 13], [29, -1], [28, -25 + cheer]], '#d7a17b', 8);
  roundedRect(ctx, 23, -31 + cheer, 11, 12, 4, '#e6b38c');

  ellipse(ctx, 0, -8, 12, 13, '#e6b38c');
  ellipse(ctx, 0, -18, 10, 5, '#392b25');
  ellipse(ctx, -4, -10, 1.4, 1.5, '#30251f');
  ellipse(ctx, 4, -10, 1.4, 1.5, '#30251f');
  ellipse(ctx, 0, -1, 3, 4, '#683d30');
  line(ctx, [[-13, 7], [0, 12], [13, 7]], '#19a9df', 5);
  line(ctx, [[9, 10], [14, 24]], '#19a9df', 5);

  // Keep the board bright and large enough to read on a phone.
  ctx.shadowColor = 'rgba(0,0,0,.5)';
  ctx.shadowBlur = 10;
  roundedRect(ctx, -320, -25, 280, 42, 5, '#f2fbff');
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#26b4e1';
  ctx.lineWidth = 3;
  ctx.strokeRect(-315, -20, 270, 32);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '1px';
  ctx.font = '900 28px Arial, sans-serif';
  ctx.fillStyle = '#007faa';
  ctx.fillText('ALLEZ L’OM', -180, -3);
  ellipse(ctx, -41, -10, 5, 6, '#e6b38c');
  ctx.restore();
}

function drawFighter(ctx, fighter, other, identity, now) {
  const profile = fighter.profile || fighter;
  const skin = skinColor(profile.skin);
  const shorts = color(profile.shortColor, identity === 'player' ? '#d2b270' : '#a94c49');
  const gloves = color(profile.gloveColor, identity === 'player' ? '#ba9b59' : '#ad393b');
  const shoes = color(profile.shoeColor, '#20242b');
  const angle = Math.atan2(other.y - fighter.y, other.x - fighter.x);
  const moving = fighter.moving || Math.hypot(fighter.vx || 0, fighter.vy || 0) > 1;
  const stride = moving ? Math.sin(now * 13) * 5 : Math.sin(now * 2.7) * .7;
  const action = fighter.action || 'idle';
  const duration = fighter.actionDuration || .35;
  const progress = Math.min(1, Math.max(0, (fighter.actionTime || 0) / duration));
  const extension = Math.sin(progress * Math.PI);
  const down = action === 'knockdown';

  ctx.save();
  ctx.translate(fighter.x, fighter.y);
  if (!down) {
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, TAU);
    ctx.strokeStyle = identity === 'player' ? 'rgba(124,192,217,.7)' : 'rgba(218,108,101,.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.rotate(angle + (down ? Math.PI / 2 : 0));
  if (action === 'dodge') ctx.translate(0, -17 * extension);
  ellipse(ctx, -2, 6, down ? 50 : 35, down ? 23 : 29, 'rgba(0,0,0,.32)');

  // Boots, thighs, shorts and torso establish an anatomical overhead silhouette.
  ellipse(ctx, -26 + stride, -13, 13, 7, shoes, -.12);
  ellipse(ctx, -27 - stride, 13, 13, 7, shoes, .12);
  line(ctx, [[-22 + stride, -12], [-12, -10]], skin, 12);
  line(ctx, [[-23 - stride, 12], [-12, 10]], skin, 12);
  roundedRect(ctx, -24, -21, 23, 42, 8, shorts);
  line(ctx, [[-6, -20], [-6, 20]], '#e0d6bf', 4);

  const body = ctx.createLinearGradient(-8, -21, 15, 21);
  body.addColorStop(0, skin);
  body.addColorStop(1, '#704b3a');
  ellipse(ctx, 3, 0, 23, 24, body);
  line(ctx, [[1, -16], [8, -7], [11, 0]], 'rgba(255,233,209,.14)', 2);
  line(ctx, [[1, 16], [8, 7], [11, 0]], 'rgba(255,233,209,.1)', 2);

  let left = [33, -27];
  let right = [31, 25];
  if (fighter.guard) {
    left = [35, -14];
    right = [35, 14];
  }
  if (action === 'jab') left = [34 + extension * 51, -25 + extension * 17];
  if (action === 'cross') right = [31 + extension * 66, 23 - extension * 20];
  if (action === 'hook') left = [34 + extension * 37, -27 + extension * 51];
  if (action === 'uppercut') right = [30 + extension * 38, 25 - extension * 25];
  if (down) { left = [7, -50]; right = [0, 46]; }
  for (const [hand, sign] of [[left, -1], [right, 1]]) {
    const elbow = [14 + (hand[0] - 32) * .48, sign * (32 - extension * 3)];
    line(ctx, [[2, sign * 19], elbow, hand], 'rgba(0,0,0,.22)', 15);
    line(ctx, [[2, sign * 19], elbow, hand], skin, 12);
    line(ctx, [[hand[0] - 7, hand[1]], hand], '#d7d3c5', 10);
    ellipse(ctx, hand[0], hand[1], 12, 10, gloves, sign * -.2);
    ellipse(ctx, hand[0] + 2, hand[1] - 3, 6, 3, 'rgba(255,255,255,.15)');
  }
  ellipse(ctx, 15, 0, 13, 12, '#453329');
  ellipse(ctx, 17, 0, 12, 11, skin);
  ellipse(ctx, 27, 0, 3.5, 4.5, skin);
  const hair = appearance(profile.hair || 'Court');
  if (!['bald', 'chauve', 'rase', 'aucun'].includes(hair)) {
    ellipse(ctx, 12, 0, 9, hair === 'crete' ? 4 : 10.5, '#241e1c');
    if (['curly', 'boucle', 'boucles'].includes(hair)) {
      for (let i = 0; i < 7; i++) ellipse(ctx, 11 + Math.cos(i) * 7, Math.sin(i) * 8, 4, 4, '#1b1918');
    }
  }
  if ((fighter.hitFlash || 0) > 0) {
    ellipse(ctx, 19, 0, 14, 12, `rgba(255,225,193,${Math.min(.65, fighter.hitFlash * 3)})`);
  }
  ctx.restore();
}

/** World coordinates are 1000 × 600; profiles are available on fighter.profile. */
export function drawRing(canvas, bout, options = {}) {
  const ctx = contextFor(canvas, 1000, 600);
  drawArena(ctx);
  if (!bout?.player || !bout?.opponent) return;
  const now = bout.elapsed ?? options.time ?? 0;
  ctx.save();
  ctx.translate(65, 30);
  ctx.scale(.87, .9);
  const fighters = [
    { fighter: bout.player, other: bout.opponent, id: 'player' },
    { fighter: bout.opponent, other: bout.player, id: 'opponent' },
  ].sort((a, b) => a.fighter.y - b.fighter.y);
  for (const { fighter, other, id } of fighters) drawFighter(ctx, fighter, other, id, now);
  // Damage text follows simulation time, so it freezes with a paused fight.
  for (const event of (bout.events || []).slice(-10)) {
    const age = now - (event.time || 0);
    if (event.type !== 'hit' || age < 0 || age > .8) continue;
    ctx.globalAlpha = 1 - age / .8;
    ctx.textAlign = 'center';
    ctx.font = '700 17px Arial, sans-serif';
    ctx.fillStyle = event.target === 'player' ? '#f08a7c' : '#efe3bb';
    ctx.fillText(`−${Math.round(event.amount || 0)}`, event.x || 500, (event.y || 300) - 47 - age * 32);
  }
  ctx.restore();
  const vignette = ctx.createRadialGradient(500, 300, 200, 500, 300, 570);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,.37)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 1000, 600);
  drawMarseilleSupporter(ctx, now);
}

/** Front-facing creation preview, drawn without external assets. */
export function drawBoxerPreview(canvas, profile = {}) {
  const ctx = contextFor(canvas, 400, 500);
  const skin = skinColor(profile.skin);
  const shorts = color(profile.shortColor, '#c3a05b');
  const gloves = color(profile.gloveColor, '#a43b36');
  const shoes = color(profile.shoeColor, '#e3ded0');
  const build = appearance(profile.build);
  const broad = ['heavy', 'large', 'muscular', 'puissant', 'massif'].includes(build) ? 1.15 : ['slim', 'fin', 'elance'].includes(build) ? .9 : 1;
  const backdrop = ctx.createRadialGradient(200, 160, 5, 200, 230, 290);
  backdrop.addColorStop(0, '#34404a');
  backdrop.addColorStop(1, '#0c141e');
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, 400, 500);
  ctx.strokeStyle = 'rgba(206,180,123,.09)';
  ctx.lineWidth = 1;
  for (let x = -100; x < 500; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 220, 500); ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(225,213,187,.045)';
  ctx.font = '900 160px Arial, sans-serif';
  ctx.fillText('RTU', 200, 275);
  ellipse(ctx, 200, 456, 95, 15, 'rgba(0,0,0,.45)');
  ctx.save();
  ctx.translate(200, 45);
  ctx.scale(broad, 1);

  // Long boots and legs, outlined by a subtle warm rim light.
  line(ctx, [[-30, 267], [-35, 348]], '#654736', 32);
  line(ctx, [[30, 267], [35, 348]], '#654736', 32);
  line(ctx, [[-31, 269], [-35, 343]], skin, 27);
  line(ctx, [[31, 269], [35, 343]], skin, 27);
  roundedRect(ctx, -52, 333, 34, 69, 9, shoes);
  roundedRect(ctx, 18, 333, 34, 69, 9, shoes);
  roundedRect(ctx, -59, 388, 43, 16, 6, shoes);
  roundedRect(ctx, 16, 388, 43, 16, 6, shoes);
  for (let i = 0; i < 5; i++) {
    line(ctx, [[-43, 347 + i * 8], [-27, 347 + i * 8]], '#444342', 1.8);
    line(ctx, [[27, 347 + i * 8], [43, 347 + i * 8]], '#444342', 1.8);
  }

  // Arms curve toward raised gloves and contain visible forearms.
  for (const side of [-1, 1]) {
    line(ctx, [[side * 45, 103], [side * 75, 156], [side * 83, 111]], '#49342b', 30);
    line(ctx, [[side * 45, 103], [side * 75, 156], [side * 83, 111]], skin, 26);
    line(ctx, [[side * 80, 122], [side * 84, 103]], '#d9d2bd', 20);
    ellipse(ctx, side * 85, 92, 23, 29, gloves, side * .18);
    ellipse(ctx, side * 79, 84, 9, 13, 'rgba(255,255,255,.12)', side * .18);
    line(ctx, [[side * 73, 108], [side * 96, 112]], 'rgba(17,19,22,.35)', 4);
  }

  const body = ctx.createLinearGradient(-55, 100, 55, 205);
  body.addColorStop(0, skin);
  body.addColorStop(.45, skin);
  body.addColorStop(1, '#78513d');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-15, 75);
  ctx.bezierCurveTo(-35, 79, -62, 84, -57, 119);
  ctx.bezierCurveTo(-52, 148, -42, 175, -40, 213);
  ctx.lineTo(40, 213);
  ctx.bezierCurveTo(42, 175, 52, 148, 57, 119);
  ctx.bezierCurveTo(62, 84, 35, 79, 15, 75);
  ctx.closePath(); ctx.fill();
  line(ctx, [[0, 109], [0, 145]], 'rgba(63,39,28,.25)', 2);
  for (const side of [-1, 1]) {
    line(ctx, [[side * 7, 126], [side * 30, 129], [side * 41, 121]], 'rgba(59,36,24,.2)', 2);
    line(ctx, [[side * 4, 151], [side * 19, 153]], 'rgba(59,36,24,.16)', 2);
    line(ctx, [[side * 4, 172], [side * 17, 174]], 'rgba(59,36,24,.16)', 2);
  }
  line(ctx, [[0, 188], [0, 190]], '#684632', 2);
  roundedRect(ctx, -15, 59, 30, 32, 10, skin);

  // Split boxing shorts with a pale waistband and bespoke initials.
  ctx.fillStyle = shorts;
  ctx.beginPath(); ctx.moveTo(-41, 207); ctx.lineTo(41, 207); ctx.lineTo(51, 286);
  ctx.lineTo(8, 290); ctx.lineTo(0, 267); ctx.lineTo(-8, 290); ctx.lineTo(-51, 286); ctx.closePath(); ctx.fill();
  roundedRect(ctx, -42, 205, 84, 17, 3, '#e4ddc7');
  line(ctx, [[-42, 224], [-50, 283]], 'rgba(255,255,255,.24)', 4);
  line(ctx, [[42, 224], [50, 283]], 'rgba(0,0,0,.22)', 4);
  ctx.fillStyle = '#33322d';
  ctx.font = '900 10px Arial, sans-serif';
  ctx.fillText('RTU', 0, 217);

  const face = appearance(profile.face || 'Anguleux');
  const headWidth = face === 'rond' ? 31 : face === 'ovale' ? 25 : 28;
  ellipse(ctx, -headWidth + 1, 39, 5, 10, skin);
  ellipse(ctx, headWidth - 1, 39, 5, 10, skin);
  ctx.fillStyle = skin;
  ctx.beginPath();
  if (face === 'rond') {
    ctx.ellipse(0, 35, headWidth, 34, 0, 0, TAU);
  } else if (face === 'ovale') {
    ctx.ellipse(0, 34, headWidth, 40, 0, 0, TAU);
  } else {
    ctx.moveTo(-26, 15);
    ctx.bezierCurveTo(-21, -7, 21, -7, 26, 15);
    ctx.lineTo(27, 43); ctx.lineTo(21, 64); ctx.lineTo(11, 72);
    ctx.lineTo(-11, 72); ctx.lineTo(-21, 64); ctx.lineTo(-27, 43);
    ctx.closePath();
  }
  ctx.fill();
  const hair = appearance(profile.hair || 'Court');
  if (!['bald', 'chauve', 'rase', 'aucun'].includes(hair)) {
    ctx.fillStyle = '#241e1c';
    if (hair === 'crete') {
      // Narrow tall crest with shaved sides, visibly distinct from a short cut.
      ctx.beginPath(); ctx.moveTo(-10, 20); ctx.lineTo(-12, -7); ctx.lineTo(-7, -21);
      ctx.lineTo(-2, -14); ctx.lineTo(3, -24); ctx.lineTo(8, -16);
      ctx.lineTo(12, -7); ctx.lineTo(10, 21); ctx.quadraticCurveTo(0, 27, -10, 20);
      ctx.fill();
      line(ctx, [[-3, -12], [-3, 14]], 'rgba(143,123,103,.2)', 2);
    } else {
      ctx.beginPath(); ctx.moveTo(-headWidth + 1, 37);
      ctx.bezierCurveTo(-headWidth - 6, -11, headWidth + 6, -13, headWidth, 35);
      ctx.lineTo(headWidth - 5, 14); ctx.bezierCurveTo(8, 19, -6, 7, -headWidth + 6, 16);
      ctx.closePath(); ctx.fill();
      if (['curly', 'boucle', 'boucles'].includes(hair)) {
        for (let i = 0; i < 8; i++) ellipse(ctx, -headWidth + 5 + i * (headWidth * 2 - 10) / 7, 4 + Math.sin(i) * 4, 7, 8, '#241e1c');
      }
    }
  }
  const beard = appearance(profile.beard);
  if (beard && !['none', 'aucune', 'rase', 'non'].includes(beard)) {
    const full = beard === 'complete';
    const jaw = headWidth - 3;
    ctx.fillStyle = full ? '#30251f' : 'rgba(43,31,24,.46)';
    ctx.beginPath(); ctx.moveTo(-jaw, full ? 36 : 44);
    ctx.lineTo(-jaw + 3, 62);
    ctx.quadraticCurveTo(-12, full ? 82 : 73, 0, full ? 87 : 73);
    ctx.quadraticCurveTo(12, full ? 82 : 73, jaw - 3, 62);
    ctx.lineTo(jaw, full ? 36 : 44);
    ctx.lineTo(jaw - 6, 53); ctx.quadraticCurveTo(0, 62, -jaw + 6, 53);
    ctx.closePath(); ctx.fill();
    if (full) {
      line(ctx, [[-7, 52], [0, 50], [7, 52]], '#30251f', 4);
      line(ctx, [[-6, 68], [-3, 76]], 'rgba(177,150,117,.14)', 1);
      line(ctx, [[7, 67], [3, 78]], 'rgba(177,150,117,.14)', 1);
    }
  }
  line(ctx, [[-18, 29], [-8, 28]], '#342922', 2.2);
  line(ctx, [[8, 28], [18, 29]], '#342922', 2.2);
  ellipse(ctx, -12, 34, 2, 1.8, '#201e1a');
  ellipse(ctx, 12, 34, 2, 1.8, '#201e1a');
  line(ctx, [[1, 36], [-2, 45], [3, 46]], 'rgba(89,52,34,.45)', 1.5);
  line(ctx, [[-8, 55], [8, 55]], '#694635', 1.5);
  ctx.restore();
  const vignette = ctx.createLinearGradient(0, 410, 0, 500);
  vignette.addColorStop(0, 'rgba(12,20,30,0)');
  vignette.addColorStop(1, '#0c141e');
  ctx.fillStyle = vignette; ctx.fillRect(0, 410, 400, 90);
}
