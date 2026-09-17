const test = require('brittle')
const crypto = require('hypercore-crypto')
const idEnc = require('hypercore-id-encoding')
const { firewallFor } = require('../src/relay')

const key = () => crypto.keyPair().publicKey

// hyperdht's createServer firewall DENIES on true (hyperdht/lib/server.js:26,253,260 — the README
// states the opposite and is wrong). Inverting this yields a relay that admits exactly the peers it
// was configured to exclude, while every other test in this repo still passes.
test('U6 an empty allowlist admits everyone', (t) => {
  const fw = firewallFor(new Set())
  t.is(fw(key()), false, 'false means ADMIT')
})

test('U6 a populated allowlist admits only its members', (t) => {
  const allowed = key()
  const stranger = key()
  const fw = firewallFor(new Set([idEnc.normalize(allowed)]))
  t.is(fw(allowed), false, 'listed peer is admitted')
  t.is(fw(stranger), true, 'true means DENY')
})

test('U7 hex and z-base-32 spellings of one key are the same entry', (t) => {
  const k = key()
  const fw = firewallFor(new Set([idEnc.normalize(k.toString('hex'))]))
  t.is(fw(k), false, 'a hex-configured allowlist admits the z32 peer')
})
