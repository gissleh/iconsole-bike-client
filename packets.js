/**
 * Convert a number to the two-byte wire format.
 * 
 * @param {number} n 
 */
function twoBytes(n) {
  return [0x01 + Math.floor(n / 100), 0x01 + (n % 100)];
}

/**
 * Generate a checksum and return the whole packet.
 * 
 * @param {number[]} a 
 */
function withChecksum(a) {
  return new Uint8Array([...a, a.reduce((p,c) => p + c, 0) % 256]);
}

/**
 * Ack CMD. Sent in the beginning to black the screen.
 */
export function ackCmd() {
  return withChecksum([0xf0, 0xa0, 0x01, 0x01])
}

/**
 * Gets some kind of max level? Who knows.
 */
export function getMaxLevel() {
  return withChecksum([0xf0, 0xa1, 0x01, 0x01])
}

/**
 * Evokes a workout state. Should be sent regularly.
 */
export function getWorkoutState() {
  return withChecksum([0xf0, 0xa2, 0x01, 0x01])
}

/**
 * Not yet demystified.
 */
export function setWorkoutMode() {
  return withChecksum([0xf0, 0xa3, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01])
}

export function setWorkoutParams() {
  return withChecksum([0xf0, 0xa4, 0x01, 0x01, 0x02])
}

export function unknown0xa5() {
  return withChecksum([0xf0, 0xa5, 0x01, 0x01, 0x02])
}

/**
 * Sets incline, it looks like. It's uncertain if level is really 1+level, but
 * everything else is one-based.
 * 
 * @param {number} level 
 */
export function setIncline(level) {
  return withChecksum([0xf0, 0xa6, 0x01, 0x01, 0x01+level])
}