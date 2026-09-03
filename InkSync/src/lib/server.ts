const raw = import.meta.env.VITE_SERVER_URL?.trim()

/**
 * Where the realtime server lives.
 *
 * This must be an absolute, publicly reachable URL in any deployment: the
 * browser opens the socket, so "localhost" means *the visitor's own machine*,
 * not the machine serving the app. Set VITE_SERVER_URL at build time — Vite
 * bakes it into the bundle, so changing it later means rebuilding.
 *
 * A bare hostname is accepted and gets a scheme, because Render's blueprint can
 * only pass one service's host to another without the protocol.
 */
export const SERVER_URL = !raw
  ? 'http://localhost:3001'
  : raw.includes('://')
    ? raw
    : /^(localhost|127\.0\.0\.1)/.test(raw)
      ? `http://${raw}`
      : `https://${raw}`
