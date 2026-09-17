# Pixel Home Lab

Interaktivní pixel art vizualizace domácího Proxmox home labu: host = dům,
jednotlivé LXC kontejnery = místnosti/okna. Světlo v okně = CT běží, tma =
CT zastaveno, blikání červená = vysoké CPU/RAM.

![status](https://img.shields.io/badge/status-mockup-yellow)

## Demo

Otevři [`docs/index.html`](docs/index.html) v prohlížeči (nebo si spusť
libovolný statický server, např. `python3 -m http.server` v `docs/`) — na
GitHub Pages stačí povolit publikování ze složky `/docs`.

Bez parametrů stránka běží v **simulačním režimu**: načte demo data
(`docs/data/state.demo.json`) a dál je náhodně "rozdýchává" (mění CPU/RAM,
občas restartuje/vypne kontejner), aby vizualizace na portfoliu působila
živě i bez připojení na skutečný lab.

Pro napojení na reálná data z vlastního labu:

```
docs/index.html?dataUrl=http://<lab-host>:8085/state.json
```

## Rozsah (rozhodnuto pro MVP)

- **Jen stav CT** (running/stopped, CPU, RAM) — detail jednotlivých Docker
  kontejnerů uvnitř CT zatím není součástí; dá se doplnit později jako
  druhá úroveň (kliknutí na místnost → nábytek/postavičky za kontejnery).
- **Hosting**: frontend je čistě statický (`docs/`), takže jede jak na
  GitHub Pages (demo/portfolio na simulovaných datech), tak lokálně v
  labu ukazující živá data — stejný kód, přepnutí přes `?dataUrl=`.

## Architektura

```
docs/            statický frontend (GitHub Pages)
  index.html     stránka s canvasem
  app.js         vykreslení pixel art domu + simulace/live fetch dat
  style.css
  data/
    state.demo.json   ukázková/demo data pro veřejné demo

backend/         volitelný poller pro reálné nasazení v labu
  poller.py      dotazuje se Proxmox API (`/nodes/<node>/lxc`) na stav a
                 zátěž CT, ukládá/servíruje JSON ve stejném schématu jako
                 docs/data/state.demo.json
  requirements.txt
```

Datové schéma (co frontend očekává):

```json
{
  "host": "neodbornaskola",
  "updated": "2026-09-17T18:00:00Z",
  "containers": [
    { "id": "107", "name": "prometheus", "status": "running", "cpu": 14, "ram": 38 }
  ]
}
```

## Spuštění reálného pollingu

```
cd backend
pip install -r requirements.txt
PROXMOX_URL=https://neodbornaskola.local:8006 \
PROXMOX_NODE=pve \
PROXMOX_TOKEN_ID=root@pam!pixelhomelab \
PROXMOX_TOKEN_SECRET=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
HTTP_PORT=8085 \
python poller.py
```

`poller.py` čte stav a zátěž přímo z Proxmox API (jedno volání vrátí
status i cpu/mem pro všechny CT na node). Pokud preferuješ data z
Prometheus (CT107 v původním layoutu labu), je v souboru připravená
(neimplementovaná) kostra `fetch_from_prometheus()` — je potřeba doplnit
PromQL dotazy podle konkrétních metrik tvého exporteru.

## Další nápady (mimo MVP)

- Docker kontejnery uvnitř CT jako nábytek/postavičky v místnosti.
- Historie stavu (kolik dní CT běželo) jako "opotřebení" místnosti.
- Zvuky/ambient efekty podle celkového zdraví labu.
