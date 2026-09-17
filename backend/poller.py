#!/usr/bin/env python3
"""Polls a Proxmox host for LXC status/usage and serves it as the JSON
schema the Pixel Home Lab frontend (docs/app.js) expects.

Configuration is via environment variables:

  PROXMOX_URL           e.g. https://neodbornaskola.local:8006
  PROXMOX_NODE          Proxmox node name, e.g. pve
  PROXMOX_TOKEN_ID       e.g. root@pam!pixelhomelab
  PROXMOX_TOKEN_SECRET
  PROXMOX_VERIFY_SSL    "true"/"false" (default: false, self-signed certs are common in home labs)
  POLL_INTERVAL         seconds between polls (default: 15)
  OUTPUT_PATH           where to write the JSON snapshot (default: state.json)
  HTTP_PORT             if set, also serve the latest snapshot over HTTP on this port

Run:
  pip install -r requirements.txt
  PROXMOX_URL=... PROXMOX_NODE=... PROXMOX_TOKEN_ID=... PROXMOX_TOKEN_SECRET=... \
    HTTP_PORT=8085 python poller.py

Then point the frontend at it:
  docs/index.html?dataUrl=http://<lab-host>:8085/state.json
"""
import json
import os
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import requests

PROXMOX_URL = os.environ["PROXMOX_URL"].rstrip("/")
PROXMOX_NODE = os.environ["PROXMOX_NODE"]
PROXMOX_TOKEN_ID = os.environ["PROXMOX_TOKEN_ID"]
PROXMOX_TOKEN_SECRET = os.environ["PROXMOX_TOKEN_SECRET"]
VERIFY_SSL = os.environ.get("PROXMOX_VERIFY_SSL", "false").lower() == "true"
POLL_INTERVAL = float(os.environ.get("POLL_INTERVAL", "15"))
OUTPUT_PATH = os.environ.get("OUTPUT_PATH", "state.json")
HTTP_PORT = os.environ.get("HTTP_PORT")

session = requests.Session()
session.headers["Authorization"] = f"PVEAPIToken={PROXMOX_TOKEN_ID}={PROXMOX_TOKEN_SECRET}"
session.verify = VERIFY_SSL

state_lock = threading.Lock()
latest_state = {"host": PROXMOX_NODE, "updated": None, "containers": []}


def fetch_containers():
    """Single Proxmox API call returns status + live cpu/mem for every LXC."""
    resp = session.get(f"{PROXMOX_URL}/api2/json/nodes/{PROXMOX_NODE}/lxc", timeout=10)
    resp.raise_for_status()
    containers = []
    for ct in resp.json()["data"]:
        maxmem = ct.get("maxmem") or 1
        containers.append({
            "id": str(ct["vmid"]),
            "name": ct.get("name", ct["vmid"]),
            "status": ct.get("status", "unknown"),
            "cpu": round((ct.get("cpu") or 0) * 100, 1),
            "ram": round((ct.get("mem") or 0) / maxmem * 100, 1),
        })
    return sorted(containers, key=lambda c: c["id"])


# Optional alternate source: adapt these PromQL queries to your own exporter
# (metric names below match a typical node_exporter/pve-exporter setup) if
# you'd rather read from Prometheus (CT107 in the original home-lab layout)
# than call the Proxmox API directly.
def fetch_from_prometheus(prometheus_url):
    raise NotImplementedError(
        "Adjust the PromQL queries below to your exporter's metric names, "
        "then wire this into build_state() instead of fetch_containers()."
    )
    # cpu = session.get(f"{prometheus_url}/api/v1/query",
    #                   params={"query": "rate(container_cpu_usage_seconds_total[1m]) * 100"})
    # ram = session.get(f"{prometheus_url}/api/v1/query",
    #                   params={"query": "container_memory_usage_bytes / container_spec_memory_limit_bytes * 100"})


def poll_loop():
    while True:
        try:
            containers = fetch_containers()
            with state_lock:
                latest_state["containers"] = containers
                latest_state["updated"] = datetime.now(timezone.utc).isoformat()
            with open(OUTPUT_PATH, "w") as f:
                json.dump(latest_state, f, indent=2)
        except requests.RequestException as exc:
            print(f"[poller] Proxmox request failed: {exc}")
        time.sleep(POLL_INTERVAL)


class StateHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path not in ("/state.json", "/"):
            self.send_response(404)
            self.end_headers()
            return
        with state_lock:
            body = json.dumps(latest_state).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def main():
    threading.Thread(target=poll_loop, daemon=True).start()
    if HTTP_PORT:
        server = ThreadingHTTPServer(("0.0.0.0", int(HTTP_PORT)), StateHandler)
        print(f"[poller] serving {OUTPUT_PATH} on http://0.0.0.0:{HTTP_PORT}/state.json")
        server.serve_forever()
    else:
        print(f"[poller] writing snapshots to {OUTPUT_PATH} every {POLL_INTERVAL}s")
        while True:
            time.sleep(3600)


if __name__ == "__main__":
    main()
