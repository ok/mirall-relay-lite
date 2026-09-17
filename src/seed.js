'use strict'
const fs = require('fs'); const path = require('path'); const crypto = require('hypercore-crypto')
const SEED_FILE = 'relay.seed'
function parseSeed (hex, origin) {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error(`${origin}: expected 64 hex characters (32 bytes), got ${hex.length}`)
  return Buffer.from(hex, 'hex')
}
function loadOrCreateSeed (storage, envSeed) {
  if (envSeed) return parseSeed(envSeed, 'MIRALL_RELAY_SEED')
  const file = path.join(storage, SEED_FILE)
  if (fs.existsSync(file)) return parseSeed(fs.readFileSync(file, 'utf8').trim(), file)
  fs.mkdirSync(storage, { recursive: true })
  const seed = crypto.randomBytes(32)
  fs.writeFileSync(file, seed.toString('hex') + '\n', { mode: 0o600 })
  return seed
}
module.exports = { loadOrCreateSeed, parseSeed, SEED_FILE }
