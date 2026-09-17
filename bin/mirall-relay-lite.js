#!/usr/bin/env node
'use strict'
const idEnc = require('hypercore-id-encoding')
const { start } = require('../src/relay'); const { loadOrCreateSeed } = require('../src/seed')
const env = process.env
const storage = env.MIRALL_RELAY_STORAGE || '/data'
const port = Number(env.MIRALL_RELAY_PORT || 49737)
const json = env.MIRALL_RELAY_JSON === '1' || process.argv.includes('--json')
const statsMs = Number(env.MIRALL_RELAY_STATS_INTERVAL || 0)
function human (l) {
  if (l.event === 'listening') {
    return `relay listening on udp/${l.port}\n\n  ${l.publicKey}\n\n` +
      `Paste that key into Mirall: Settings > Network > Relay > Add relay.` +
      (l.allowlist ? `\nAllowlist: ${l.allowlist} key(s).` : `\nOpen relay: anyone with this key can use it.`)
  }
  return `${l.event} ${JSON.stringify(l)}`
}
const emit = (e) => { const line = { ts: new Date().toISOString(), ...e }; console.log(json ? JSON.stringify(line) : human(line)) }
function allowlist () {
  const raw = (env.MIRALL_RELAY_ALLOW || '').split(/[,\s]+/).filter(Boolean)
  return new Set(raw.map((k) => { try { return idEnc.normalize(k) } catch { throw new Error(`MIRALL_RELAY_ALLOW: not a key: ${k}`) } }))
}
async function main () {
  const relay = await start({ seed: loadOrCreateSeed(storage, env.MIRALL_RELAY_SEED), port, allow: allowlist(), emit })
  if (statsMs > 0) setInterval(() => emit({ event: 'stats', ...relay.stats() }), statsMs).unref()
  for (const sig of ['SIGTERM', 'SIGINT']) process.once(sig, async () => { emit({ event: 'closing', signal: sig }); await relay.close(); process.exit(0) })
}
main().catch((err) => { console.error(err.message); process.exit(1) })
