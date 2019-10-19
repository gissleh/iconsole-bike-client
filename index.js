const EventEmitter = require("events");
const noble = require("noble");

const { 
  S1_SERVICE, S1_CHAR_DATA_OUTPUT, S1_CHAR_COMMAND_INPUT, S1_CHAR_MYSTERY_OUTPUT, 
  S2_SERVICE, S2_CHAR_MYSTERY_OUTPUT, 
} = require("./uuids");
const { 
  ackCmd, getMaxLevel, setWorkoutMode, setWorkoutParams, setIncline, 
  getWorkoutState, setWorkoutControlState 
} = require("./packets");
const { Response } = require("./response");

class Client {
  /**
   * @param {noble.Peripheral} peripheral noble peripheral.
   */
  constructor(peripheral) {
    this.peripheral = peripheral;
    
    /** @type {noble.Characteristic} */
    this.commandInput = null;
    /** @type {noble.Characteristic} */
    this.dataOutput = null;

    this.connected = false;
    this.started = false;

    this.events = new EventEmitter();
  }

  /**
   * 
   */
  connect() {
    if (this.connected) {
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

                    this.connected = true;
                    this.starting = false;
                    this.started = false;
        
                    this.pollData();
        
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
    this.peripheral.disconnect();
    this.events.removeAllListeners();
    this.connected = false;
    this.started = false;
    this.starting = false;
    noble.stopScanning();
  }

  /**
   * Start starts the workout. Paramters will be added once the protocol is understood better.
   */
  async start() {
    this.starting = true;
    await wait(500);
    await this.writeCommand(ackCmd());
    await wait(500);
    await this.writeCommand(setWorkoutParams());
    await wait(500);
    await this.writeCommand(setWorkoutMode());
    await wait(500);
    await this.writeCommand(setWorkoutControlState(1));
 
    await wait(100);
    this.started = true;

    await wait(1800);
    await this.writeCommand(setIncline(18));
 
  }

  /**
   * Write a command. This does not listen to its specific response, however.
   * 
   * @param {number[] | Buffer | Uint8Array} data Data to write.
   */
  writeCommand(data) {
    console.error("Send", [...data].map(n => "0x"+n.toString(16)).join(" "))

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
   * @param {Buffer} data 
   */
  handleData(uuid, data) {
    if (uuid === S1_CHAR_DATA_OUTPUT) {
      const resp = new Response(data);

      console.log(resp.parse());
    }
  }

  async pollData() {
    try {
      await this.writeCommand(ackCmd());

      while (this.connected) {
        if (this.started) {
          await this.writeCommand(getWorkoutState());
          await wait(500);
        } else if (!this.starting) {
          await this.writeCommand(ackCmd());
          await wait(300);
          await this.writeCommand(getMaxLevel());
          await wait(300);
        } else {
          await wait(100);
        }
      }
    } catch (err) {
      if (this.connected) {
        console.error("Got error while polling:", err);
        this.disconnect();
      }
    }
  }

  /**
   * Scan for a peripheral. It will return a client you can call connect on if it
   * finds it.
   * 
   * @param {string} uuid The uuid of the peripheral
   * @param {number} timeout How many milliseconds to scan for
   * @returns {Client}
   */
  static scan(uuid, timeout = 30000) {
    let done = false;

    return new Promise((resolve, reject) => {
      noble.startScanning([]);

      noble.on('discover', (peripheral) => {
        console.error("Device", peripheral.uuid);
        if (peripheral.uuid !== uuid) {
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
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = Client;
