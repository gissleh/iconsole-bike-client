class Response {
  /**
   * @param {Buffer} data
   */
  constructor(data) {
    this.magic = data[0];
    this.kind = data[1];
    this.clientId = data[2];
    this.meterId = data[3];
    this.params = data.slice(4, data.length - 1);
    this.checksum = data[data.length - 1];
  }

  /**
   * Get a one-byte numeric value.
   *
   * @param {number} i index relative to data start.
   */
  getValue8(i) {
    if (i >= this.params.length) {
      return null;
    }

    return this.params[i] - 1;
  }

  /**
   * Don't look at me, that's just how the protocol works.
   *
   * @param {number} i index relative to data start of most significant byte.
   */
  getValue16(i) {
    if (i >= this.params.length - 1) {
      return null;
    }

    return ((this.params[i] - 1) * 100) + (this.params[i + 1] - 1);
  }

  /**
   * Parse the packet's data.
   */
  parse() {
    switch (this.kind) {
      case 0xb0: // AckCmd
        return {
          kind: "ack",
        };

      case 0xb1: // ICSetWorkoutControlStateCmd
        return {
          kind: "maxLevel",
          maxLevel: this.getValue8(0),
        };

      case 0xb2: // ICGetWorkoutStatus
        return {
          kind: "workoutStatus",
          workoutStatus: {
            minutes: this.getValue8(0),
            seconds: this.getValue8(1),
            speed: this.getValue16(2) / 10.0,
            rpm: this.getValue16(4),
            distance: this.getValue16(6) / 10.0,
            calories: this.getValue16(8),
            pulse: this.getValue16(10) || null,
            watt: this.getValue16(12) / 10.0,
            level: this.getValue8(14),
          },
        };

      case 0xb3: // ICSetWorkoutMode
        return {
          kind: "workoutMode",
          workoutMode: this.getValue8(0),
        };

      case 0xb4: // ICSetWorkoutParam
        return {
          kind: "workoutParams",
          workoutParams: {
            // These are just guesses (not tested yet)
            timeInMinute: this.getValue8(0),
            distanceInKM: this.getValue8(1) / 10.0,
            calories: this.getValue16(3),
            pulse: this.getValue16(5),
            watt: this.getValue16(7) / 10.0,
            unit: this.getValue16(8),
          },
        };

      case 0xb5: // ICSetWorkoutControlStateCmd
        return {
          kind: "workoutControlState",
          workoutControlState: this.getValue8(0),
        };

      case 0xb6: // SetResistanceLevelCmd
        return {
          kind: "resistanceLevel",
          resistanceLevel: this.getValue8(0),
        };

      case 0xb7: // ICClientIDNotify
        return {
          kind: "clientIds",
          clientIds: {
            clientId: this.clientId,
            meterId: this.meterId,
          },
        };

      default:
        return {
          kind: "unknown:" + this.kind.toString(16),
          params: [...this.params],
        };
    }
  }
}


module.exports = {
  Response,
};