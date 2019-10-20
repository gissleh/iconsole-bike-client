const EventEmitter = require("events");
const noble = require("noble");

const { 
  S1_SERVICE, S1_CHAR_DATA_OUTPUT, S1_CHAR_COMMAND_INPUT, S1_CHAR_MYSTERY_OUTPUT, 
  S2_SERVICE, S2_CHAR_MYSTERY_OUTPUT, 
} = require("./uuids");
const { 
  ackCmd, getMaxLevel, setWorkoutMode, setWorkoutParams, setResistanceLevel,
  getWorkoutState, setWorkoutControlState 
} = require("./packets");
const { Response } = require("./response");

const DEFAULT_QUEUES = {
  disconnected: [],
  connected: [ackCmd(), getMaxLevel()],
  starting: [],
  started: [getWorkoutState()],
}

/**
 * Client is a bluetooth client for iConsole-based bluetooth-enabled exercise bike.
 */
class Client {
  /**
   * Construct the client. You should use scan instead unless you manually
   * did something with `noble` to get the peripheral object.
   * 
   * **WARNING**: Unstable API, will change once refactored to sblendid. You
   * should pin the version if you use this.
   * 
   * @param {noble.Peripheral} peripheral noble peripheral.
   */
  constructor(peripheral) {
    this.peripheral = peripheral;
    
    /** @type {Characteristic} */
    this.commandInput = null;
    /** @type {Characteristic} */
    this.dataOutput = null;

    this.state = "disconnected";
    this.queue = [];
    this.defaultQueuePos = 0;

    this.events = new EventEmitter();
  }

  /**
   * Connect to the bike.
   * 
   * @returns {Promise<void>}
   */
  connect() {
    if (this.state !== "disconnected") {
      throw new Error("Already connected!")
    }

    return new Promise((resolve, reject) => {
      this.peripheral.connect(err => {
        if (err != null) {
          this.disconnect();
          return reject(err);
        }

        this.peripheral.discoverServices([], (err, services) => {
          if (err != null) {
            this.disconnect();
            return reject(err);
          }

          const s1 = services.find(s => s.uuid === S1_SERVICE);
          const s2 = services.find(s => s.uuid === S2_SERVICE);

          s1.discoverCharacteristics([], (err, characteristics) => {
            if (err != null) {
              this.disconnect();
              return reject(err);
            }

            this.commandInput = characteristics.find(c => c.uuid === S1_CHAR_COMMAND_INPUT);
            this.dataOutput = characteristics.find(c => c.uuid === S1_CHAR_DATA_OUTPUT);
            this.mysterousOutput = characteristics.find(c => c.uuid === S1_CHAR_MYSTERY_OUTPUT);

            this.dataOutput.subscribe(err => {
              if (err != null) {
                this.disconnect();
                return reject(err);
              }

              this.dataOutput.on("data", (data) => {
                this.handleData(this.dataOutput.uuid, data);
              })

              this.mysterousOutput.subscribe(err => {
                if (err != null) {
                  this.disconnect();
                  return reject(err);
                }

                this.mysterousOutput.on("data", (data) => {
                  this.handleData(this.mysterousOutput, data);
                })

                s2.discoverCharacteristics([], (err, characteristics) => {
                  if (err != null) {
                    this.disconnect();
                    return reject(err);
                  }
          
                  this.mysterousOutput2 = characteristics.find(c => c.uuid === S2_CHAR_MYSTERY_OUTPUT);
                  this.mysterousOutput2.subscribe(err => {
                    if (err != null) {
                      this.disconnect();
                      return reject(err);
                    }

                    this.mysterousOutput2.on("data", (data) => {
                      this.handleData(this.mysterousOutput2.uuid, data);
                    })

                    this.state = "connected";
                    this.defaultQueuePos = 0;
                    this.queue = [
                      ackCmd(),
                      getMaxLevel(),
                    ];

                    this.sendLoop();

                    resolve();
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  /**
   * Teardown and clean up everything.
   */
  disconnect() {
    if (this.state === "disconnected") {
      return
    }

    this.peripheral.disconnect();
    noble.stopScanning();
    
    this.events.emit("disconnect");

    this.state = "disconnected";
    this.defaultQueuePos = 0;

    const queue = this.queue.splice(0);
    for (const {reject} of queue) {
      reject(new Error("Disconnected"))
    }
  }

  /**
   * Disconnect (if connected), and remove all event listeners.
   */
  destroy() {
    this.disconnect();
    this.events.removeAllListeners();
  }

  /**
   * Start starts the workout. Paramters will be added once the protocol is understood better.
   * 
   * @param {*} opts
   * @param {number} opts.timeInMinute Minute goal, will stop once timer runs down.
   * @param {number} opts.distanceInKM Distance goal, will stop once distance is reached.
   * @param {number} opts.calories Calorie goal, will stop once it counts down.
   * @param {number} opts.pulse Not yet understood, set if you're feeling adventurous.
   * @param {number} opts.watt Not yet understood, set if you're feeling adventurous.
   * @param {number} opts.workoutMode Not yet understood, set if you're feeling adventurous.
   * @param {number} opts.unit Not yet understood, set if you're feeling adventurous.
   * @param {number} opts.level Start at resistance level. Equialent to calling `setLevel` after start.
   */
  async start({
    timeInMinute = 0, 
    distanceInKM = 0, 
    calories = 0, 
    pulse = 0, 
    watt = 0,
    workoutMode = 0,
    unit = 0,
    level = 0,
  } = {}) {
    this.state = "starting";
    this.defaultQueuePos = 0;

    await Promise.all([
      this.queueCommand(ackCmd()),
      this.queueCommand(setWorkoutMode(workoutMode)),
      this.queueCommand(setWorkoutParams(timeInMinute, distanceInKM, calories, pulse, watt, unit)),
      this.queueCommand(setWorkoutControlState(1)),
      this.queueCommand(setResistanceLevel(level)),
    ]);

    this.state = "started";
    this.defaultQueuePos = 0;
  }

  /**
   * Set resistance level. You should listen to `maxLevel` event to get the max value for this.
   * 
   * @param {number} level 
   */
  async setLevel(level) {
    return await this.queueCommand(setResistanceLevel(level));
  }

  /**
   * Resume the exercise.
   */
  async resume() {
    return await this.queueCommand(setWorkoutControlState(1));
  }

  /**
   * Pause the exercise.
   */
  async pause() {
    return await this.queueCommand(setWorkoutControlState(2));
  }

  /**
   * Queue a command for writing. The promise will resolve if the command
   * is sent, or reject if the bike disconnects before it's sent. This allows
   * for commands to be written such that they don't interfere with one another.
   * 
   * The queue will be advanced after 500ms without a response, so invalid messages
   * will not do any harm.
   * 
   * @param {number[] | Buffer | Uint8Array} data Data to write.
   */
  queueCommand(data) {
    return new Promise((resolve, reject) => {
      const message = Buffer.from(data);
      this.queue.push({message, resolve, reject})
    })
  }

  /**
   * Write a command. Use `queueCommand` or the helper methods instead.
   * 
   * @param {number[] | Buffer | Uint8Array} data Data to write.
   */
  writeCommand(data) {
    this.events.emit("send", data);

    return new Promise((resolve, reject) => {
      this.commandInput.write(Buffer.from(data), true, (err) => {
        if (err != null) {
          reject(err);
        } else {
          resolve();
        }
      })
    })
  }

  /**
   * This is a handler for the event data. Should not be called from outside.
   * 
   * @param {Buffer} data 
   */
  handleData(uuid, data) {
    if (uuid === S1_CHAR_DATA_OUTPUT) {
      const resp = new Response(data);
      const respData = resp.parse();

      this.events.emit(data.kind, respData);
      this.events.emit("data", respData);

      if (this.lastCommand === resp.kind - 0x10) {
        this.lastCommandResolve();
      }
    } else {
      this.events.emit("mysteryData", data, uuid)
    }
  }

  /**
   * Loop over the send queue, or send default messages..
   */
  async sendLoop() {
    try {
      while (this.state !== "disconnected") {
        let {message, resolve} = (this.queue[0] || {});
        if (message != null) {
          this.queue.splice(0, 1);
        } else {
          const defaultQueue = DEFAULT_QUEUES[this.state];

          message = defaultQueue[this.defaultQueuePos];
          this.defaultQueuePos = (this.defaultQueuePos + 1) % defaultQueue.length;

          if (message == null) {
            await this.wait(100);
            continue;
          }
        }

        await this.writeCommand(message);
        await this.wait(500, message[1]);

        if (resolve != null) {
          resolve();
        }
      }
    } catch (err) {
      if (this.state !== "disconnected") {
        this.events.emit("error", err);
        this.disconnect();
      }
    }
  }

  /**
   * Scan for a peripheral. It will return a client you can call connect on if it
   * finds it. Or a timeout error if the timeout is reached..
   * 
   * @param {string} addr The uuid of the peripheral
   * @param {number} timeout How many milliseconds to scan for
   * @returns {Client}
   */
  static scan(addr, timeout = 30000) {
    let done = false;

    return new Promise((resolve, reject) => {
      noble.startScanning([]);

      noble.on('discover', (peripheral) => {
        if (peripheral.address !== addr) {
          return
        }

        if (!done) {
          noble.stopScanning();
          done = true;

          resolve(new Client(peripheral));
        }
      });
  
      setTimeout(() => {
        if (!done) {
          noble.stopScanning();
          done = true;
          
          reject(new Error(`Timeout exceeded (${(timeout / 1000).toFixed(2)}s)`))
        }
      }, timeout)
    })
  }

  /**
   * This waits for `ms` or command arriving + 200ms, whichever comes
   * first.
   * 
   * @param {number} ms Amount of time to wait.
   * @param {number} command Command whose response to wait for.
   */
  wait(ms, command) {
    return new Promise(resolve => {
      let done = false;
      let resolve2 = () => {
        if (!done) {
          done = true;
          resolve();
        }
      }
      
      if (command != null) {
        this.lastCommand = command;
        this.lastCommandResolve = () => setTimeout(resolve2, 200);
      }

      setTimeout(resolve2, ms)
    })
  }
}

module.exports = Client;
