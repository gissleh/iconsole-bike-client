/**
 * @param {number} n
 * @param {boolean} addOne
 * @returns {number}
 */
function oneByte(n, addOne = true) {
  return (addOne ? 0x01 : 0x00) + (n % 256);
}

/**
 * Convert a number to the two-byte wire format.
 *
 * @param {number} n
 * @returns {number[]}
 */
function twoBytes(n) {
  return [oneByte(Math.floor(n / 100)), oneByte(n % 100)];
}

/**
 * Generate a checksum and return the whole packet.
 *
 * @param {number[]} a
 */
function withChecksum(a) {
  return new Uint8Array([...a, oneByte(a.reduce((p, c) => p + c, 0), false)]);
}

function action(actionId, clientId = 0, meterId = 0) {
  return [oneByte(0xf0, false), oneByte(actionId, false), oneByte(clientId), oneByte(meterId)];
}

/**
 * Ack CMD. Sent in the beginning to black the screen.
 */
function ackCmd() {
  return withChecksum(action(0xa0))
}

/**
 * Gets some kind of max level? Who knows.
 */
function getMaxLevel() {
  return withChecksum(action(0xa1))
}

/**
 * Returns a workout state. Should be sent regularly.
 */
function getWorkoutState() {
  return withChecksum(action(0xa2))
}

/**
 * Not yet demystified.
 */
function setWorkoutMode(mode) {
  return withChecksum([...action(0xa3), oneByte(mode)])
}

/**
 * @param {number} timeInMinute
 * @param {number} distanceInKM
 * @param {number} calories
 * @param {number} pulse
 * @param {number} watt
 * @param {number} unit
 * @return {Uint8Array}
 */
function setWorkoutParams(timeInMinute, distanceInKM, calories, pulse, watt, unit) {
  return withChecksum([
    ...action(0xa4),
    oneByte(timeInMinute),
    ...twoBytes(distanceInKM * 10.0),
    ...twoBytes(calories),
    ...twoBytes(pulse),
    ...twoBytes(watt * 10.0),
    oneByte(unit),
  ]);
}

/**
 *
 * @param {*} state
 */
function setWorkoutControlState(state = 1) {
  return withChecksum([0xf0, 0xa5, 0x01, 0x01, 0x01 + state])
}

/**
 * Sets resistance level.
 *
 * @param {number} level
 */
function setResistanceLevel(level) {
  return withChecksum([0xf0, 0xa6, 0x01, 0x01, oneByte(level)])
}

module.exports = {
  ackCmd,
  getMaxLevel,
  getWorkoutState,
  setWorkoutMode,
  setWorkoutParams,
  setWorkoutControlState,
  setResistanceLevel,
};