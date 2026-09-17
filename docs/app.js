const canvas = document.getElementById('house');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const tooltip = document.getElementById('tooltip');
const hostNameEl = document.getElementById('host-name');
const modeBadgeEl = document.getElementById('mode-badge');
const updatedEl = document.getElementById('updated');

const UNIT = 4;
const ROOM_W = 20 * UNIT;
const ROOM_H = 16 * UNIT;
const GAP = 3 * UNIT;
const WALL_PAD = 4 * UNIT;
const ROOF_H = 10 * UNIT;
const DOOR_W = 10 * UNIT;
const DOOR_H = 14 * UNIT;

const BRICK_A = '#4b3b34';
const BRICK_B = '#5a463d';
const ROOF_A = '#7a2f2f';
const ROOF_B = '#8f3a3a';
const FRAME = '#2b1d15';
const LIT = '#ffd76b';
const LIT_SHADE = '#f0b429';
const DARK = '#14141f';
const DARK_EDGE = '#2a3550';
const ALERT = '#ff4d4d';

const params = new URLSearchParams(location.search);
const dataUrl = params.get('dataUrl');
const isLive = Boolean(dataUrl);
modeBadgeEl.textContent = isLive ? 'live' : 'simulace';

let containers = [];
let host = '–';
let layout = null;

function computeLayout(count) {
  const columns = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(count))));
  const rows = Math.ceil(count / columns);
  const wallW = columns * ROOM_W + (columns - 1) * GAP + WALL_PAD * 2;
  const wallH = rows * ROOM_H + (rows - 1) * GAP + WALL_PAD * 2;
  const width = wallW;
  const height = ROOF_H + wallH + DOOR_H;
  return { columns, rows, width, height, wallH };
}

function roomRect(index) {
  const col = index % layout.columns;
  const row = Math.floor(index / layout.columns);
  const x = WALL_PAD + col * (ROOM_W + GAP);
  const y = ROOF_H + WALL_PAD + row * (ROOM_H + GAP);
  return { x, y, w: ROOM_W, h: ROOM_H };
}

function isAlert(c) {
  return c.status === 'running' && (c.cpu > 80 || c.ram > 85);
}

function drawBrickWall(width, wallTop, wallH) {
  const brickH = UNIT * 2;
  const brickW = UNIT * 6;
  for (let y = 0; y < wallH; y += brickH) {
    const offset = (Math.floor(y / brickH) % 2) * (brickW / 2);
    for (let x = -brickW; x < width + brickW; x += brickW) {
      ctx.fillStyle = ((Math.floor((x + offset) / brickW) + Math.floor(y / brickH)) % 2 === 0) ? BRICK_A : BRICK_B;
      ctx.fillRect(x + offset, wallTop + y, brickW - UNIT / 2, brickH - UNIT / 2);
    }
  }
}

function drawRoof(width) {
  const steps = ROOF_H / UNIT;
  for (let i = 0; i < steps; i++) {
    const y = i * UNIT;
    const inset = (steps - i - 1) * UNIT;
    ctx.fillStyle = i % 2 === 0 ? ROOF_A : ROOF_B;
    ctx.fillRect(inset, y, width - inset * 2, UNIT);
  }
}

function drawGroundAndDoor(width, groundTop) {
  ctx.fillStyle = '#2f4d2f';
  ctx.fillRect(0, groundTop, width, DOOR_H);

  const x = (width - DOOR_W) / 2;
  ctx.fillStyle = '#3b2a20';
  ctx.fillRect(x, groundTop, DOOR_W, DOOR_H);
  ctx.fillStyle = '#d8c08a';
  ctx.fillRect(x + DOOR_W - UNIT * 2, groundTop + DOOR_H / 2, UNIT, UNIT);
}

function drawWindow(rect, container, time) {
  ctx.fillStyle = FRAME;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  const inset = UNIT;
  const ix = rect.x + inset;
  const iy = rect.y + inset;
  const iw = rect.w - inset * 2;
  const ih = rect.h - inset * 2;

  if (container.status !== 'running') {
    ctx.fillStyle = DARK;
    ctx.fillRect(ix, iy, iw, ih);
    ctx.strokeStyle = DARK_EDGE;
    ctx.lineWidth = 1;
    ctx.strokeRect(ix + 0.5, iy + 0.5, iw - 1, ih - 1);
  } else if (isAlert(container)) {
    const blink = Math.floor(time / 400) % 2 === 0;
    ctx.fillStyle = blink ? ALERT : LIT;
    ctx.fillRect(ix, iy, iw, ih);
  } else {
    ctx.fillStyle = LIT;
    ctx.fillRect(ix, iy, iw, ih / 2);
    ctx.fillStyle = LIT_SHADE;
    ctx.fillRect(ix, iy + ih / 2, iw, ih / 2);
  }

  ctx.fillStyle = FRAME;
  ctx.fillRect(rect.x + rect.w / 2 - 1, rect.y, 2, rect.h);
  ctx.fillRect(rect.x, rect.y + rect.h / 2 - 1, rect.w, 2);
}

function render(time) {
  if (!layout || containers.length === 0) return;
  canvas.width = layout.width;
  canvas.height = layout.height;

  ctx.fillStyle = '#0b0c14';
  ctx.fillRect(0, 0, layout.width, layout.height);

  drawRoof(layout.width);
  drawBrickWall(layout.width, ROOF_H, layout.wallH);
  drawGroundAndDoor(layout.width, ROOF_H + layout.wallH);

  containers.forEach((c, i) => drawWindow(roomRect(i), c, time));

  canvas.style.aspectRatio = `${layout.width} / ${layout.height}`;
  canvas.style.width = `min(95vw, ${layout.width * 3}px)`;
  canvas.style.height = 'auto';
}

function handleMove(evt) {
  if (!layout) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (evt.clientX - rect.left) * scaleX;
  const my = (evt.clientY - rect.top) * scaleY;

  const hit = containers.findIndex((_, i) => {
    const r = roomRect(i);
    return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
  });

  if (hit === -1) {
    tooltip.classList.add('hidden');
    return;
  }

  const c = containers[hit];
  tooltip.innerHTML = `<strong>${c.name}</strong> (CT ${c.id})<br>
    stav: ${c.status}${isAlert(c) ? ' ⚠️' : ''}<br>
    CPU: ${c.cpu}% · RAM: ${c.ram}%`;
  tooltip.style.left = `${evt.clientX + 14}px`;
  tooltip.style.top = `${evt.clientY + 14}px`;
  tooltip.classList.remove('hidden');
}

canvas.addEventListener('mousemove', handleMove);
canvas.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));

function applyState(state) {
  host = state.host;
  containers = state.containers;
  layout = computeLayout(containers.length);
  hostNameEl.textContent = host;
  updatedEl.textContent = new Date(state.updated).toLocaleString('cs-CZ');
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function simulateTick() {
  containers = containers.map(c => {
    const next = { ...c };
    if (Math.random() < 0.02) {
      next.status = next.status === 'running' ? 'stopped' : 'running';
    }
    if (next.status === 'running') {
      next.cpu = clamp(next.cpu + (Math.random() * 20 - 10), 1, 100);
      next.ram = clamp(next.ram + (Math.random() * 10 - 5), 5, 100);
    } else {
      next.cpu = 0;
      next.ram = 0;
    }
    return next;
  });
  updatedEl.textContent = new Date().toLocaleString('cs-CZ');
}

async function fetchLive() {
  try {
    const res = await fetch(dataUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.statusText);
    applyState(await res.json());
  } catch (err) {
    console.error('Nepodařilo se načíst live data, přepínám na simulaci:', err);
    modeBadgeEl.textContent = 'simulace (fallback)';
    setInterval(simulateTick, 4000);
    return false;
  }
  return true;
}

async function init() {
  const res = await fetch('data/state.demo.json', { cache: 'no-store' });
  applyState(await res.json());

  if (isLive) {
    const ok = await fetchLive();
    if (ok) setInterval(fetchLive, 8000);
  } else {
    setInterval(simulateTick, 4000);
  }

  setInterval(() => render(performance.now()), 150);
}

init();
