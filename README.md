<p align="center">
  <a href="https://mirall.app">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/media/logo-dark.svg">
      <img src="docs/media/logo-light.svg" width="240" alt="Mirall">
    </picture>
  </a>
</p>

---

# Mirall Relay Lite

A minimal **blind relay** for [Mirall](https://mirall.app). It connects two peers whose networks
block a direct link — office Wi-Fi, mobile hotspots, symmetric NAT, UDP-filtered networks — and
forwards encrypted bytes it cannot read.

Anyone can run one. Start it, take the key out of the log, and paste that key into Mirall under
**Settings ▸ Network**. That key is the entire configuration.

This README is the operator half. The person pasting the key wants
[Connect through a relay](https://mirall.app/docs/guides#use-a-relay) instead.

---

## What "blind" means here

The relay bridges two encrypted streams. The peers run their own Noise handshake **over** the
relayed connection, so the relay holds no session key and there is no API through which it could
produce plaintext. It forwards opaque framed messages and terminates nothing.

The relay **cannot** see:

- who the peers are (their Mirall identities)
- which spaces they share
- file names, folder structure, or file contents

The relay **can** see, unavoidably, what any middlebox sees:

- the IP addresses of both peers, and that they are talking to each other
- when they talk, and how many bytes cross

Blind to content is not blind to metadata. If that metadata matters to you, run your own relay
rather than using someone else's. That is the point of this repository being public.

---

## Quick start (Docker)

```sh
# 1. Get the image. Published to the GitHub Container Registry on every release,
#    for linux/amd64 and linux/arm64. No account or login needed — it is public.
docker pull ghcr.io/ok/mirall-relay-lite:latest

# 2. Run it. The named volume is what keeps the identity stable across restarts;
#    --network host is the right choice on Linux (see Networking notes).
docker run -d --name mirall-relay-lite --restart unless-stopped \
  --network host \
  -v mirall-relay-data:/data \
  ghcr.io/ok/mirall-relay-lite:latest

# 3. Take the key out of the log. It is created on first boot — there is no
#    keygen step and no identity to generate up front.
docker logs mirall-relay-lite
```

```
relay listening on udp/49737

  <your relay key: 52 characters of z-base-32>

Paste that key into Mirall: Settings > Network > Relay > Add relay.
Open relay: anyone with this key can use it.
```

Prefer Compose? The repository's `docker-compose.yml` does exactly the above — same image, same
volume, same networking — so `docker compose up -d` and `docker compose logs relay` replace steps
2 and 3. That one file is all you need on the host; nothing is built locally. To run from source
instead, clone the repository and `docker compose up -d --build`.

`:latest` is the moving tag. [The image](#the-image) covers pinning to `0.1` or a digest.

**This relay has no status page and no HTTP at all.** There is nothing to open in a browser and
nothing to curl: it speaks UDP to the DHT and nothing else. You confirm it is reachable from
Mirall, which probes it for you — see below.

## Hand out the key

In Mirall: **Settings ▸ Network ▸ Relay ▸ Add relay**, paste, **Continue**, then **Add relay**.
Mirall probes it on its own; the row should settle on **Reachable**, and **Test** in its menu
re-runs that.

Do this on **both** devices where you can. One side supplying a relay is enough for a connection
to be made, but if the side without one is the side behind the restrictive network, the
connection only recovers after the other side's direct attempt times out.

### Running it locally (Docker Desktop) — smoke test only

```sh
docker build -t mirall-relay-lite:local .
docker volume create mirall-relay-data

docker run -d --name mirall-relay-lite \
  -p 49737:49737/udp \
  -v mirall-relay-data:/data \
  mirall-relay-lite:local

docker logs mirall-relay-lite            # the key
docker restart mirall-relay-lite         # same key again: the seed persisted
```

`network_mode: host` in `docker-compose.yml` is a **Linux** setting. On Docker Desktop it does not
attach to your machine's network, so comment it out and use a `ports:` block — or use
`docker run -p` as above.

On a laptop this will start, print a key and look entirely healthy, and it still **is not a usable
relay**: your machine is behind NAT, and on macOS/Windows Docker Desktop adds a Linux VM in
between, so no peer can hole-punch to it. Unlike the full relay, this one has no reachability
check of its own — nothing in the log will tell you. **Test** in Mirall is what tells you, and on
a laptop it will say unreachable. Use this to check the image, the log output and that the seed
survives a restart; use a host with a public IP for anything real.

## Quick start (Node, no Docker)

```sh
npm ci --omit=dev
MIRALL_RELAY_STORAGE=./data npm start
```

The seed is created at `./data/relay.seed` on first run. `MIRALL_RELAY_SEED` supplies one directly
instead, and writes nothing to disk — which is what you want under a secrets manager or systemd's
`LoadCredential=`. No unit file ships with this repository; it is one `ExecStart=` line.

## Requirements

- **Node.js 20+**, if you are not using Docker. The published images are built on Node 22.
- **A real public IP with unfiltered inbound UDP.** A VPS, or a home server behind a router you can
  port-forward. Behind CGNAT — most mobile networks and many fibre ISPs — this cannot work, and a
  relay on the same network as the people using it defeats the point: they are trying to escape
  that network.
- **Bandwidth.** Every relayed byte enters and leaves this host. Bandwidth, not CPU, is the cost of
  running a relay — pick a host that bills egress kindly.
- **Docker**, for the quick start above. On a fresh Linux box:
  `curl -fsSL https://get.docker.com | sh`, then `sudo usermod -aG docker "$USER"` and log back in.
  Other platforms are at [docs.docker.com/engine/install](https://docs.docker.com/engine/install/).

You need **inbound UDP on your relay's port** — 49737 by default, `MIRALL_RELAY_PORT` to change
it — and **outbound UDP 49737** to `node1/2/3.hyperdht.org`. The two numbers match by
coincidence and mean different things: the second is the fixed port of Holepunch's public
bootstrap servers, the first is only a default.

Peers find a relay by its **key**, never by its address. Nothing you hand out carries a host or a
port, so you can move the relay or change its port and every key and invite already issued stays
valid. The port matters solely for your own firewall and port-forward — which is why it has to be
the one you chose, and not one silently substituted underneath you.

There is no HTTP, no TCP and no TLS here, so there is nothing to put behind nginx or Caddy.

## Back up `relay.seed`

`/data/relay.seed` is your relay's identity. Its public key is derived from it, so if you lose the
file the relay comes back as a stranger and everyone who configured it is silently pointing at a
key nobody answers on. Back it up; it is 64 characters.

To move a relay to a new host, copy that one file.

## Open by default

Anyone with the key can use your bandwidth, and they can pass the key on. For a fixed group, set
an allowlist of peer keys:

```yaml
environment:
  MIRALL_RELAY_ALLOW: "<peer-key> <peer-key>"
```

For anything larger — invites you can mint and revoke per person, membership that changes, an
operator status page, caps and metering — you want
[mirall-relay](https://github.com/ok/mirall-relay), the full relay, rather than this one.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `MIRALL_RELAY_PORT` | `49737` | UDP port to bind. Refuses to start if it cannot have it. |
| `MIRALL_RELAY_STORAGE` | `/data` | Where `relay.seed` lives. |
| `MIRALL_RELAY_SEED` | — | 64 hex chars. Supplies the identity directly; nothing is written to disk. |
| `MIRALL_RELAY_ALLOW` | — | Space/comma separated peer keys. Empty means open. |
| `MIRALL_RELAY_STATS_INTERVAL` | off | Milliseconds between counter log lines. |
| `MIRALL_RELAY_JSON` | off | `1` for one JSON object per line. |

## Is it working?

With `MIRALL_RELAY_STATS_INTERVAL` set you get the counters. The one that matters is
**`pairings.matched`** — two peers actually introduced to each other. `sessions.accepted` only
means someone dialled you, and stays at zero traffic. Both peers being on one LAN will show
`matched: 0` however healthy the relay is: they connect directly and never need it.

## Other ways to run a blind relay

Nothing here is reimplemented — `src/relay.js` is a few lines of glue over Holepunch's
[`blind-relay`](https://github.com/holepunchto/blind-relay) and
[`hyperdht`](https://github.com/holepunchto/hyperdht), the same libraries the two programs below
use. What this repo adds is a port you can publish, an allowlist, and an identity you can back up.
If you don't need those, run one of these instead.

### `pear blind-relay start`

Pear ships a blind relay, and on a machine that already has Pear it is a fine thing to run. Its
key is stable, derived from the platform corestore — persist `~/.config/pear`.

It is not shaped like a server, though. The relay runs inside the shared Pear sidecar, so the UDP
sockets belong to *that* process, not the one you started: there is no port to publish or
firewall, and the process your supervisor restarts is not the one doing the work. There is no
allowlist. Good for a laptop, wrong shape for a VPS.

### `blind-relay-service`

Holepunch's [`blind-relay-service`](https://github.com/holepunchto/blind-relay-service) is the
same core as this one, packaged for Holepunch's own fleet. Worth knowing before you reach for it:

- **It does not check the port it got.** dht-rpc reads `--port` as the range `[port, port+5]`
  and then falls back to binding *any* free port, so asking is not getting. It logs a healthy
  `listening` line with a valid key either way, and since peers dial by key there is nothing
  downstream to notice. This program refuses to start instead (see `src/relay.js`).
- **No allowlist.** Every relay is open.
- **Its identity is a corestore directory**, not a file — so backing it up means copying a store
  rather than 64 characters, and there is no equivalent of `MIRALL_RELAY_SEED`. That one keypair
  costs a 160 MB RocksDB build: `corestore` → `hypercore` → `hypercore-storage` →
  `rocksdb-native`, with prebuilds for thirteen platforms.
- **Monitoring is Prometheus over the DHT**, which needs a `dht-prometheus` scraper with a public
  key and a secret. There is no plain counter log.

It also ships no Dockerfile or compose file, so the operational half of this repo would still
have to exist.

## Networking notes

`network_mode: host` is the default in `docker-compose.yml` and is the reliable choice on Linux.
A hyperdht node binds **two** UDP sockets — a fixed server socket and a random outbound one — and
bridge NAT can rewrite the source port out from under the DHT's own view of its address. If you
must use bridge networking, publish `49737:49737/udp` and verify with **Test** in the app.

## The image

Published to the GitHub Container Registry on every `v*` tag, built for **linux/amd64** and
**linux/arm64**:

```
ghcr.io/ok/mirall-relay-lite
```

One tag push produces three tags — `0.1.0`, `0.1` and `latest` — so you choose how much drift you
accept:

| Reference | Moves when |
|---|---|
| `:latest` | every release, including a breaking one |
| `:0.1` | a patch release within 0.1 |
| `:0.1.0` | never |
| `@sha256:…` | never — the digest names one specific build |

`docker-compose.yml` ships `:latest`, which is right for a relay you re-pull on purpose. **Pin the
digest in production.** Every publish prints its digest to the workflow summary, and the
[package page](https://github.com/ok/mirall-relay-lite/pkgs/container/mirall-relay-lite) lists
them all.

A tag only publishes if the tests, the multi-arch build, the size budget and the live-DHT smoke
test all pass first — `publish` needs them, so a broken tag pushes nothing.

## Development

```sh
npm install
npm test          # unit + integration, no network required
docker build -t mirall-relay-lite:local .
```

## Licence

Apache-2.0. Builds on Holepunch's [`blind-relay`](https://github.com/holepunchto/blind-relay)
and [`hyperdht`](https://github.com/holepunchto/hyperdht).
