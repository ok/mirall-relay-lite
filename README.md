# mirall-relay-lite

A minimal **blind relay** for [Mirall](https://mirall.app). It helps two devices connect when
their networks block a direct link. It forwards encrypted bytes it cannot read.

What a relay is and what its operator can see is documented once, on the website:
[Relays, and what they can see](https://mirall.app/docs/explanation#relays). This README is the
operator half. The person pasting the key wants
[Connect through a relay](https://mirall.app/docs/guides#use-a-relay) instead.

## Before you start

**Your relay needs a real public IP and inbound UDP.** A VPS, or a home server behind a router you
can port-forward. Behind CGNAT — most mobile networks and many fibre ISPs — this cannot work, and
a relay on the same network as the people using it defeats the point: they are trying to escape
that network.

You need **inbound UDP on your relay's port** — 49737 by default, `MIRALL_RELAY_PORT` to change
it — and **outbound UDP 49737** to `node1/2/3.hyperdht.org`. The two numbers match by
coincidence and mean different things: the second is the fixed port of Holepunch's public
bootstrap servers, the first is only a default.

Peers find a relay by its **key**, never by its address. Nothing you hand out carries a host or a
port, so you can move the relay or change its port and every key and invite already issued stays
valid. The port matters solely for your own firewall and port-forward — which is why it has to be
the one you chose, and not one silently substituted underneath you.

There is no HTTP, no TCP and no TLS here, so there is nothing to put behind nginx or Caddy.

## Install it

You need **Docker** on the host. If it is not there yet:

```sh
# Debian/Ubuntu and most other Linux distributions
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # then log out and back in
```

Other platforms, and the manual package instructions, are at
[docs.docker.com/engine/install](https://docs.docker.com/engine/install/). On macOS or Windows
install [Docker Desktop](https://docs.docker.com/desktop/) instead — useful for trying this out,
but not a host to run a real relay on, for the reasons above.

Then bring the relay up from a checkout:

```sh
git clone https://github.com/ok/mirall-relay-lite
cd mirall-relay-lite
docker compose up -d --build
docker compose logs relay
```

`--build` is doing real work: **no image has been published for this repository yet**, so
`docker compose up -d` on its own fails with `manifest unknown`. Building from the checkout needs
no registry access and is the supported path today.

`docker-compose.yml` already points at `ghcr.io/ok/mirall-relay-lite:latest`, and CI publishes
there on a `v*` tag — see [The image](#the-image). Once a release is cut, `docker compose pull && docker compose up -d`
is enough and `--build` can go.

If you want a ready-made image right now, run the full relay instead:
[mirall-relay](https://github.com/ok/mirall-relay) publishes
[ghcr.io/ok/mirall-relay](https://github.com/ok/mirall-relay/pkgs/container/mirall-relay), so
`docker run ghcr.io/ok/mirall-relay:latest` works without a checkout. It is a larger program —
invites, a status page, caps, metrics — but it is one pull away.

## Hand out the key

`docker compose logs relay` prints it:

```
relay listening on udp/49737

  <your relay key: 52 characters of z-base-32>

Paste that key into Mirall: Settings > Network > Relay > Add relay.
Open relay: anyone with this key can use it.
```

That key is the entire configuration. In Mirall: **Settings ▸ Network ▸ Relay ▸ Add relay**,
paste, **Continue**, then **Add relay**. Mirall probes it on its own; the row should settle on
**Reachable**, and **Test** in its menu re-runs that.

Do this on **both** devices where you can. One side supplying a relay is enough for a connection
to be made, but if the side without one is the side behind the restrictive network, the
connection only recovers after the other side's direct attempt times out.

## Back up `relay.seed`

`/data/relay.seed` is your relay's identity. Its public key is derived from it, so if you lose the
file the relay comes back as a stranger and everyone who configured it is silently pointing at a
key nobody answers on. Back it up; it is 64 characters.

To move a relay to a new host, copy that one file.

## What the operator can and cannot see

A relay **cannot read your files**. Connections are end-to-end encrypted between the two peers;
the relay forwards opaque framed messages and terminates nothing.

It **can** see which keys are talking to each other, their IP addresses, and how much and when.
Blind to content is not blind to metadata. Run relays for people who have reason to trust you.

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
