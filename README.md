# mirall-relay-lite

A minimal **blind relay** for [Mirall](https://mirall.app). It helps two devices connect when
their networks block a direct link. It forwards encrypted bytes it cannot read.

```sh
docker compose up -d
docker compose logs relay
```

```
relay listening on udp/49737

  3fok381gh3x193tqtg5p3zjnmpafrcnefmucgb87tam9wox3daoo

Paste that key into Mirall: Settings > Network > Relays > Add relay.
Open relay: anyone with this key can use it.
```

That key is the entire configuration. In Mirall: **Settings ▸ Network ▸ Relays ▸ Add relay**,
paste, then **Test** — it should say *Reachable*.

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

For anything larger — invites, membership that changes, metering — you want the full Mirall relay
rather than this one.

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

## Development

```sh
npm install
npm test          # unit + integration, no network required
docker build -t ghcr.io/ok/relay:dev .
```

## Licence

Apache-2.0. Builds on Holepunch's [`blind-relay`](https://github.com/holepunchto/blind-relay)
and [`hyperdht`](https://github.com/holepunchto/hyperdht).
