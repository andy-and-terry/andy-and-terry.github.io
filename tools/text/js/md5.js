/* Minimal, dependency-free MD5 (RFC 1321) implementation operating on a
 * Uint8Array and returning a lowercase hex digest. SubtleCrypto has no MD5
 * support, so this fills that gap for the hash generator tool.
 * Based on the well-known public-domain reference algorithm.
 */
function md5(bytes) {
  function rotl(x, c) {
    return (x << c) | (x >>> (32 - c));
  }

  function toHex(word) {
    var hex = "";
    for (var i = 0; i < 4; i++) {
      hex += ((word >>> (i * 8)) & 0xff).toString(16).padStart(2, "0");
    }
    return hex;
  }

  var K = new Int32Array(64);
  for (var i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
  }

  var S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];

  var origLenBits = bytes.length * 8;

  // Pad: append 0x80, then zeros until length % 64 == 56, then 8 bytes of length.
  var paddedLen = bytes.length + 1;
  while (paddedLen % 64 !== 56) paddedLen++;
  paddedLen += 8;

  var msg = new Uint8Array(paddedLen);
  msg.set(bytes);
  msg[bytes.length] = 0x80;

  // Length in bits, little-endian 64-bit (we only support up to 2^53 bits safely, ample for browser use).
  var lenLow = origLenBits >>> 0;
  var lenHigh = Math.floor(origLenBits / 4294967296) >>> 0;
  var lenOffset = paddedLen - 8;
  for (i = 0; i < 4; i++) {
    msg[lenOffset + i] = (lenLow >>> (i * 8)) & 0xff;
    msg[lenOffset + 4 + i] = (lenHigh >>> (i * 8)) & 0xff;
  }

  var a0 = 0x67452301,
    b0 = 0xefcdab89,
    c0 = 0x98badcfe,
    d0 = 0x10325476;

  var M = new Int32Array(16);

  for (var chunkStart = 0; chunkStart < msg.length; chunkStart += 64) {
    for (var j = 0; j < 16; j++) {
      var off = chunkStart + j * 4;
      M[j] = msg[off] | (msg[off + 1] << 8) | (msg[off + 2] << 16) | (msg[off + 3] << 24);
    }

    var A = a0,
      B = b0,
      C = c0,
      D = d0;

    for (var k = 0; k < 64; k++) {
      var F, g;
      if (k < 16) {
        F = (B & C) | (~B & D);
        g = k;
      } else if (k < 32) {
        F = (D & B) | (~D & C);
        g = (5 * k + 1) % 16;
      } else if (k < 48) {
        F = B ^ C ^ D;
        g = (3 * k + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * k) % 16;
      }
      F = (F + A + K[k] + M[g]) | 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl(F, S[k])) | 0;
    }

    a0 = (a0 + A) | 0;
    b0 = (b0 + B) | 0;
    c0 = (c0 + C) | 0;
    d0 = (d0 + D) | 0;
  }

  return toHex(a0) + toHex(b0) + toHex(c0) + toHex(d0);
}
