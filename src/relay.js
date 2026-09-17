'use strict'
const DHT = require('hyperdht')
const { Server: RelayServer } = require('blind-relay')
const idEnc = require('hypercore-id-encoding')

function firewallFor (allow) {
  if (allow.size === 0) return () => false
  return (remotePublicKey) => !allow.has(idEnc.normalize(remotePublicKey))
}

async function start ({ seed, port, allow = new Set(), emit, bootstrap = null }) {
  const keyPair = DHT.keyPair(seed)
  const dht = new DHT({ port, ...(bootstrap ? { bootstrap } : {}) })
  const relay = new RelayServer({
    createStream: (o) => dht.createRawStream({ ...o, framed: true })
  })
  const server = dht.createServer({ firewall: firewallFor(allow) }, (socket) => {
    socket.setKeepAlive(5000)
    socket.on('error', () => {})
    const session = relay.accept(socket, { id: socket.remotePublicKey })
    session.on('error', (err) => emit({ event: 'session-error', code: err.code || 'UNKNOWN' }))
  })
  await server.listen(keyPair)

  const teardown = async () => {
    await server.close()
    await relay.close()
    await dht.destroy()
  }
  const bound = dht.io.serverSocket.address().port
  // dht-rpc reads `port` as the range [port, port+5] and then falls back to bind(0) — any free
  // port at all (lib/io.js) — so asking is not getting. Peers reach a relay by key, never by
  // address, so a relay that lands on a port nobody forwarded still logs a healthy `listening`
  // line with a pasteable key and nothing downstream can tell the operator otherwise. This
  // assertion is the one place that mistake can be named.
  //
  // dht-rpc's `anyPort: false` would refuse the substitution at the first bind instead, but a DHT
  // whose bind throws leaks a handle that `destroy()` does not release, and the process then hangs
  // instead of exiting with the error. Asserting after the fact costs one open-then-close and
  // exits cleanly. Do not swap this for the flag without re-checking that.
  //
  // port 0 means "any", so there is nothing to assert against. On a mismatch the sockets are
  // already open: tear them down before throwing, or the process hangs on live handles instead of
  // exiting with the error the operator needs to read.
  if (port !== 0 && bound !== port) {
    await teardown()
    throw new Error(`bound udp port ${bound}, expected ${port}`)
  }
  emit({ event: 'listening', publicKey: idEnc.encode(server.publicKey), port: bound, allowlist: allow.size })
  return { stats: () => relay.stats, publicKey: idEnc.encode(server.publicKey), close: teardown }
}
module.exports = { start, firewallFor }
