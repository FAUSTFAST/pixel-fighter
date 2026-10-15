'use strict';
const path = require('node:path');
const ORIGIN = 'pf-game://game';
const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob: data:; font-src 'self' data:; base-uri 'none'; object-src 'none'; frame-src 'none'; form-action 'none'";

// This protocol can only address the staged public directory, never source or OS files.
function resolveRequest(input, publicRoot) {
  const url = new URL(input);
  if (url.protocol !== 'pf-game:' || url.hostname !== 'game' || url.port || url.username || url.password) return null;
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.includes('\\') || pathname.includes('\0')) return null;
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const resolved = path.resolve(publicRoot, relative);
  return resolved.startsWith(path.resolve(publicRoot) + path.sep) ? resolved : null;
}
module.exports = { ORIGIN, CSP, resolveRequest };
