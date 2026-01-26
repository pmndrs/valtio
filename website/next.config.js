// Prevent crash on Node.js 25+ where SlowBuffer was removed.
// This error originates from a compiled version of jsonwebtoken bundled inside Next.js.
const buffer = require('buffer')
if (!buffer.SlowBuffer) {
  buffer.SlowBuffer = buffer.Buffer
}

/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
}
