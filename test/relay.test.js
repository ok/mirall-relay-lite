const test = require('brittle')
const createTestnet = require('hyperdht/testnet')
const crypto = require('hypercore-crypto')
const { start } = require('../src/relay')

const collect = () => { const out = []; return { out, emit: (e) => out.push(e) } }

test('I1 the relay boots and announces a pasteable key', async (t) => {
  const { bootstrap } = await createTestnet(3, t)
  const { out, emit } = collect()
  const relay = await start({ seed: crypto.randomBytes(32), port: 0, emit, bootstrap })
  t.teardown(() => relay.close())

  t.is(out.length, 1)
  t.is(out[0].event, 'listening')
  t.is(out[0].publicKey.length, 52, 'the string an operator pastes into Mirall')
  t.is(out[0].allowlist, 0, 'open by default')
})

test('I5 the same seed gives the same relay across restarts', async (t) => {
  const { bootstrap } = await createTestnet(3, t)
  const seed = crypto.randomBytes(32)
  const first = await start({ seed, port: 0, emit: () => {}, bootstrap })
  const key = first.publicKey
  await first.close()

  const second = await start({ seed, port: 0, emit: () => {}, bootstrap })
  t.teardown(() => second.close())
  t.is(second.publicKey, key, 'losing this property strands every peer that configured the relay')
})

test('I3 a port it cannot have is refused, not silently substituted', async (t) => {
  const { bootstrap } = await createTestnet(3, t)
  const squatter = await start({ seed: crypto.randomBytes(32), port: 49841, emit: () => {}, bootstrap })
  t.teardown(() => squatter.close())

  // dht-rpc reads `port` as the range [port, port+5] and then falls back to bind(0) — any free
  // port at all — so it would quietly land elsewhere. A relay on a port nobody published looks
  // healthy and is unreachable: peers dial by key, so nothing downstream can tell the operator.
  await t.exception(
    start({ seed: crypto.randomBytes(32), port: 49841, emit: () => {}, bootstrap }),
    /bound udp port \d+, expected 49841/
  )
})
