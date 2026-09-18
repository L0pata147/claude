const canvas = document.getElementById('house');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const tooltip = document.getElementById('tooltip');
const hostNameEl = document.getElementById('host-name');
const modeBadgeEl = document.getElementById('mode-badge');
const updatedEl = document.getElementById('updated');

const UNIT = 4;
const ROOM_W = 24 * UNIT;
const ROOM_H = 20 * UNIT;
const GAP = 3 * UNIT;
const WALL_PAD = 4 * UNIT;
const ROOF_H = 10 * UNIT;
const DOOR_W = 10 * UNIT;
const DOOR_H = 14 * UNIT;
const ROOM_INSET = UNIT;
const INTERIOR_W = (ROOM_W - 2 * ROOM_INSET) / UNIT;
const INTERIOR_H = (ROOM_H - 2 * ROOM_INSET) / UNIT;

const BRICK_A = '#4b3b34';
const BRICK_B = '#5a463d';
const ROOF_A = '#7a2f2f';
const ROOF_B = '#8f3a3a';
const FRAME = '#2b1d15';
const ALERT = '#ff4d4d';

const SIL = '#232848';
const SIL2 = '#2c3358';
const SIL_WALL = '#161a2c';
const SIL_FLOOR = '#10131f';

function blink(time, period = 400) {
  return Math.floor(time / period) % 2 === 0;
}

function shade(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const clamp255 = v => Math.max(0, Math.min(255, v));
  const r = clamp255(((num >> 16) & 0xff) + Math.round(255 * amount));
  const g = clamp255(((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = clamp255((num & 0xff) + Math.round(255 * amount));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

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

const THEME_RULES = [
  { key: 'media', words: ['jellyfin', 'plex', 'emby', 'kodi', 'media', 'stream'] },
  { key: 'network', words: ['pihole', 'adguard', 'dns', 'router', 'network', 'unbound'] },
  { key: 'smarthome', words: ['homeassistant', 'hass', 'domoticz', 'smarthome'] },
  { key: 'storage', words: ['nextcloud', 'owncloud', 'syncthing', 'storage', 'cloud', 'samba', 'nas'] },
  { key: 'dev', words: ['gitea', 'gitlab', 'git', 'code', 'jenkins', 'forgejo'] },
  { key: 'backup', words: ['backup', 'restic', 'borg', 'duplicati', 'rsync', 'snapshot'] },
  { key: 'database', words: ['postgres', 'mysql', 'mariadb', 'influx', 'database', 'redis', 'mongo'] },
  { key: 'security', words: ['vpn', 'wireguard', 'tailscale', 'security', 'firewall', 'vault'] },
  { key: 'monitoring', words: ['prometheus', 'grafana', 'monitor', 'metrics', 'zabbix', 'uptime'] },
];

function classify(name) {
  const n = name.toLowerCase();
  for (const rule of THEME_RULES) {
    if (rule.words.some(w => n.includes(w))) return rule.key;
  }
  return 'generic';
}

const THEMES = {
  media: {
    label: 'Obývák s TV',
    wall: '#2a2438',
    floor: '#1c1830',
    draw(r, mode, time) {
      r(6, 3, 10, 7, mode === 'dark' ? SIL : '#141018');
      r(7, 4, 8, 5, mode === 'dark' ? SIL2 : '#274b6b');
      if (mode === 'lit') {
        const barX = 7 + Math.floor((time / 250) % 8);
        r(barX, 4, 1, 5, '#bfe3ff');
      }
      r(8, 10, 6, 1, mode === 'dark' ? SIL : '#141018');
      r(9, 11, 1, 1, mode === 'dark' ? SIL : '#141018');
      r(14, 11, 1, 1, mode === 'dark' ? SIL : '#141018');

      r(3, 11, 2, 5, mode === 'dark' ? SIL : '#5c2c2c');
      r(17, 11, 2, 5, mode === 'dark' ? SIL : '#5c2c2c');
      r(5, 11, 12, 2, mode === 'dark' ? SIL : '#5c2c2c');
      r(5, 13, 12, 3, mode === 'dark' ? SIL2 : '#7a3b3b');
      if (mode === 'lit') {
        r(7, 13, 3, 1, '#8f4747');
        r(12, 13, 3, 1, '#8f4747');
      }
      r(5, 16, 12, 1, mode === 'dark' ? SIL : '#4a2f52');
    },
  },
  network: {
    label: 'Síť / DNS',
    wall: '#1c2b2e',
    floor: '#131f21',
    draw(r, mode, time) {
      r(4, 12, 14, 1, mode === 'dark' ? SIL : '#2e3d40');
      r(8, 9, 6, 3, mode === 'dark' ? SIL2 : '#1c2426');
      r(10, 7, 1, 2, mode === 'dark' ? SIL : '#3a4a4d');
      r(13, 7, 1, 2, mode === 'dark' ? SIL : '#3a4a4d');
      [9, 11, 13].forEach((x, i) => {
        r(x, 10, 1, 1, mode === 'dark' ? SIL : (blink(time, 300 + i * 150) ? '#6bffb0' : '#3a6b52'));
      });
    },
  },
  smarthome: {
    label: 'Smart home',
    wall: '#20263a',
    floor: '#161a29',
    draw(r, mode, time) {
      r(5, 4, 12, 6, mode === 'dark' ? SIL : '#141a2c');
      let i = 0;
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          const x = 7 + col * 3;
          const y = 6 + row * 3;
          const cycle = (i + Math.floor(time / 600)) % 3;
          const color = mode === 'dark' ? SIL2 : ['#5bd6c8', '#e0b25b', '#7b8fe0'][cycle];
          r(x, y, 2, 2, color);
          i++;
        }
      }
      r(9, 15, 3, 2, mode === 'dark' ? SIL2 : '#4a5a7a');
    },
  },
  storage: {
    label: 'Úložiště / cloud',
    wall: '#1b2440',
    floor: '#121a33',
    draw(r, mode, time) {
      r(4, 3, 14, 10, mode === 'dark' ? SIL : '#101830');
      [6, 9, 12].forEach(y => r(4, y, 14, 1, mode === 'dark' ? SIL_WALL : '#0c1226'));
      const boxRows = [
        [[5, 3], [9, 4], [14, 3]],
        [[5, 5], [11, 3], [15, 2]],
        [[5, 2], [8, 6], [15, 2]],
      ];
      boxRows.forEach((row, ri) => {
        row.forEach(([x, w]) => {
          const color = mode === 'dark' ? SIL2 : (ri % 2 === 0 ? '#3a6bd6' : '#5a8bf0');
          r(x, 4 + ri * 3, w, 2, color);
        });
      });
      r(16, 3, 1, 1, mode === 'dark' ? SIL2 : (blink(time, 500) ? '#6bd6ff' : '#2a5a7a'));
    },
  },
  dev: {
    label: 'Vývoj / Git',
    wall: '#242030',
    floor: '#181521',
    draw(r, mode, time) {
      r(4, 12, 14, 2, mode === 'dark' ? SIL : '#2e2438');
      r(9, 11, 6, 1, mode === 'dark' ? SIL : '#141018');
      r(9, 7, 6, 4, mode === 'dark' ? SIL : '#141018');
      r(10, 8, 4, 3, mode === 'dark' ? SIL2 : '#173318');
      if (mode === 'lit' && blink(time, 600)) {
        r(10, 8, 2, 1, '#7cff9b');
      }
      r(15, 8, 1, 4, mode === 'dark' ? SIL : '#3a2f22');
      r(14, 7, 3, 2, mode === 'dark' ? SIL2 : '#ffdf8a');
    },
  },
  backup: {
    label: 'Zálohy',
    wall: '#2a2420',
    floor: '#1c1712',
    draw(r, mode) {
      r(4, 10, 6, 4, mode === 'dark' ? SIL : '#5a3d24');
      r(11, 7, 7, 7, mode === 'dark' ? SIL2 : '#4a3120');
      r(6, 14, 5, 4, mode === 'dark' ? SIL : '#3d2a1a');
      if (mode === 'lit') {
        r(6, 10, 2, 4, '#7a5a34');
        r(14, 7, 1, 7, '#6a4c2c');
        r(8, 14, 1, 4, '#5c4228');
      }
    },
  },
  database: {
    label: 'Databáze',
    wall: '#1a1a2e',
    floor: '#121223',
    draw(r, mode, time) {
      for (let i = 0; i < 4; i++) {
        const x = 5 + i * 4;
        r(x, 4, 3, 10, mode === 'dark' ? SIL : '#232a4a');
        r(x + 1, 5, 1, 1, mode === 'dark' ? SIL2 : (blink(time, 350 + i * 90) ? '#6bffe0' : '#2a5a52'));
      }
    },
  },
  security: {
    label: 'VPN / zabezpečení',
    wall: '#241c24',
    floor: '#181218',
    draw(r, mode) {
      const c = mode === 'dark' ? SIL : '#9fb4c9';
      r(8, 4, 6, 2, c);
      r(7, 6, 8, 2, c);
      r(8, 8, 6, 2, c);
      r(9, 10, 4, 2, c);
      r(10, 12, 2, 1, c);
      r(10, 8, 1, 1, mode === 'dark' ? SIL_WALL : '#241c24');
    },
  },
  monitoring: {
    label: 'Monitoring',
    wall: '#1a2438',
    floor: '#121a2b',
    draw(r, mode, time) {
      [3, 12].forEach((sx, si) => {
        r(sx, 4, 8, 6, mode === 'dark' ? SIL : '#101828');
        [1, 3, 5, 7].forEach((ox, j) => {
          const h = mode === 'dark' ? 2 : clamp(1 + Math.round((Math.sin(time / 500 + j + si) + 1) * 1.5), 1, 4);
          const color = mode === 'dark' ? SIL2 : (si === 0 ? '#6bffb0' : '#ffce6b');
          r(sx + ox, 9 - h, 1, h, color);
        });
      });
    },
  },
  generic: {
    label: 'Místnost',
    wall: '#241f30',
    floor: '#18141f',
    draw(r, mode) {
      r(4, 11, 8, 2, mode === 'dark' ? SIL : '#42355c');
      r(4, 13, 8, 3, mode === 'dark' ? SIL2 : '#5c4a7a');

      r(14, 14, 3, 2, mode === 'dark' ? SIL : '#5a4632');
      r(15, 9, 1, 5, mode === 'dark' ? SIL2 : '#3a7a4a');
      r(14, 8, 1, 3, mode === 'dark' ? SIL2 : '#4a8a5a');
      r(16, 8, 1, 3, mode === 'dark' ? SIL2 : '#4a8a5a');
      r(15, 6, 1, 3, mode === 'dark' ? SIL2 : '#57a066');

      r(18, 12, 1, 4, mode === 'dark' ? SIL : '#3a2f22');
      r(17, 9, 3, 1, mode === 'dark' ? SIL : '#3a2f22');
      if (mode === 'lit') {
        r(17, 6, 3, 3, '#ffdf8a');
      } else {
        r(17, 7, 3, 2, SIL2);
      }
    },
  },
};

let spriteSet = null;

const scratch = document.createElement('canvas');
const scratchCtx = scratch.getContext('2d');

async function loadSprites() {
  try {
    const res = await fetch('data/sprites.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const manifest = await res.json();
    if (!manifest.sheet) return null;

    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error(`nelze načíst ${manifest.sheet}`));
      image.src = manifest.sheet;
    });
    return { image, themes: manifest.themes || {} };
  } catch (err) {
    console.warn('Spritesheet se nepoužije, kreslím vlastní pixel art:', err);
    return null;
  }
}

// Stopped containers reuse the sprite's shape as a flat silhouette so the
// room stays recognisable with the lights off.
function drawSprite(ctx, image, item, dx, dy, dark) {
  const scale = item.scale || 1;
  const dw = item.sw * scale;
  const dh = item.sh * scale;

  if (!dark) {
    ctx.drawImage(image, item.sx, item.sy, item.sw, item.sh, dx, dy, dw, dh);
    return;
  }

  scratch.width = item.sw;
  scratch.height = item.sh;
  scratchCtx.imageSmoothingEnabled = false;
  scratchCtx.clearRect(0, 0, item.sw, item.sh);
  scratchCtx.globalCompositeOperation = 'source-over';
  scratchCtx.drawImage(image, item.sx, item.sy, item.sw, item.sh, 0, 0, item.sw, item.sh);
  scratchCtx.globalCompositeOperation = 'source-atop';
  scratchCtx.fillStyle = SIL;
  scratchCtx.fillRect(0, 0, item.sw, item.sh);
  ctx.drawImage(scratch, 0, 0, item.sw, item.sh, dx, dy, dw, dh);
}

function renderRoom(ctx, ox, oy, container, time) {
  const themeKey = classify(container.name);
  const theme = THEMES[themeKey];
  const sprites = spriteSet && spriteSet.themes[themeKey];
  const running = container.status === 'running';
  const mode = running ? 'lit' : 'dark';

  const fill = (gx, gy, gw, gh, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(ox + gx * UNIT, oy + gy * UNIT, gw * UNIT, gh * UNIT);
  };

  // Beveled block: flat fill for tiny/dark pieces, a light/dark edge on
  // bigger lit ones so furniture reads as solid rather than a flat swatch.
  const r = (gx, gy, gw, gh, color) => {
    fill(gx, gy, gw, gh, color);
    if (mode === 'dark' || gw < 2 || gh < 2) return;
    ctx.fillStyle = shade(color, 0.22);
    ctx.fillRect(ox + gx * UNIT, oy + gy * UNIT, gw * UNIT, UNIT);
    ctx.fillRect(ox + gx * UNIT, oy + gy * UNIT, UNIT, gh * UNIT);
    ctx.fillStyle = shade(color, -0.22);
    ctx.fillRect(ox + gx * UNIT, oy + (gy + gh - 1) * UNIT, gw * UNIT, UNIT);
    ctx.fillRect(ox + (gx + gw - 1) * UNIT, oy + gy * UNIT, UNIT, gh * UNIT);
  };

  const floorH = 4;
  const wallColor = running ? ((sprites && sprites.wall) || theme.wall) : SIL_WALL;
  const floorColor = running ? ((sprites && sprites.floor) || theme.floor) : SIL_FLOOR;
  fill(0, 0, INTERIOR_W, INTERIOR_H - floorH, wallColor);
  fill(0, INTERIOR_H - floorH - 1, INTERIOR_W, 1, shade(wallColor, -0.2));

  for (let ty = 0; ty < floorH; ty += 2) {
    for (let tx = 0; tx < INTERIOR_W; tx += 2) {
      const alt = ((tx / 2) + (ty / 2)) % 2 === 0;
      fill(tx, INTERIOR_H - floorH + ty, 2, 2, alt ? floorColor : shade(floorColor, -0.1));
    }
  }

  if (sprites && sprites.items) {
    sprites.items.forEach(item => {
      drawSprite(ctx, spriteSet.image, item, ox + item.gx * UNIT, oy + item.gy * UNIT, mode === 'dark');
    });
  } else {
    theme.draw(r, mode, time);
  }

  if (running && isAlert(container) && blink(time, 400)) {
    ctx.fillStyle = 'rgba(255, 60, 60, 0.4)';
    ctx.fillRect(ox, oy, INTERIOR_W * UNIT, INTERIOR_H * UNIT);
  }
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

  renderRoom(ctx, rect.x + ROOM_INSET, rect.y + ROOM_INSET, container, time);

  ctx.fillStyle = FRAME;
  ctx.fillRect(rect.x + rect.w / 2 - 1, rect.y, 2, rect.h);
  ctx.fillRect(rect.x, rect.y + rect.h / 2 - 1, rect.w, 2);
}

function render(time) {
  if (!layout || containers.length === 0) return;
  canvas.width = layout.width;
  canvas.height = layout.height;
  ctx.imageSmoothingEnabled = false;

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
  const roomLabel = THEMES[classify(c.name)].label;
  tooltip.innerHTML = `<strong>${c.name}</strong> (CT ${c.id}) — ${roomLabel}<br>
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
  spriteSet = await loadSprites();

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
