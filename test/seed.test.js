const test = require('brittle')
const fs = require('fs')
const os = require('os')
const path = require('path')
const DHT = require('hyperdht')
const idEnc = require('hypercore-id-encoding')
const { loadOrCreateSeed, SEED_FILE } = require('../src/seed')

const tmp = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-lite-'))
  t.teardown(() => fs.rmSync(dir, { recursive: true, force: true }))
  return dir
}

test('U1 a fresh storage dir gets a 0600 seed file', (t) => {
  const dir = tmp(t)
  const seed = loadOrCreateSeed(dir)
  t.is(seed.byteLength, 32)
  const file = path.join(dir, SEED_FILE)
  t.is(fs.statSync(file).mode & 0o777, 0o600, 'the seed is the relay identity; it is not world-readable')
  t.ok(/^[0-9a-f]{64}\n$/.test(fs.readFileSync(file, 'utf8')))
})

test('U2 a second call returns the same seed and does not rewrite the file', (t) => {
  const dir = tmp(t)
  const first = loadOrCreateSeed(dir)
  const before = fs.statSync(path.join(dir, SEED_FILE)).mtimeMs
  const second = loadOrCreateSeed(dir)
  t.alike(second, first)
  t.is(fs.statSync(path.join(dir, SEED_FILE)).mtimeMs, before)
})

test('U3 a corrupt seed throws and does NOT overwrite', (t) => {
  const dir = tmp(t)
  const file = path.join(dir, SEED_FILE)
  fs.writeFileSync(file, 'hello')
  // Overwriting here would silently mint a new relay identity and strand every configured peer.
  t.exception(() => loadOrCreateSeed(dir), /expected 64 hex characters/)
  t.is(fs.readFileSync(file, 'utf8'), 'hello')
})

test('U4 MIRALL_RELAY_SEED wins and writes nothing', (t) => {
  const dir = tmp(t)
  const hex = 'a'.repeat(64)
  const seed = loadOrCreateSeed(dir, hex)
  t.is(seed.toString('hex'), hex)
  t.absent(fs.existsSync(path.join(dir, SEED_FILE)), 'env-configured relays stay stateless')
})

test('U5 the same seed always yields the same public key', (t) => {
  const hex = '5'.repeat(64)
  const a = idEnc.encode(DHT.keyPair(Buffer.from(hex, 'hex')).publicKey)
  const b = idEnc.encode(DHT.keyPair(Buffer.from(hex, 'hex')).publicKey)
  t.is(a, b)
  t.is(a.length, 52, 'z-base-32: exactly what Mirall accepts as an open relay')
})
