const EventEmitter = require("events");
const noble = require("noble");

const { S1_SERVICE, S1_CHAR_DATA_OUTPUT, S1_CHAR_COMMAND_INPUT } = require("./uuids");
const { ackCmd, getMaxLevel, setWorkoutMode, setWorkoutParams, setIncline, getWorkoutState } = require("./packets");

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

        this.peripheral.discoverServices([S1_SERVICE], (err, services) => {
          if (err != null) {
            this.disconnect();
            return reject(err);
          }

          services[0].discoverCharacteristics([S1_CHAR_COMMAND_INPUT, S1_CHAR_DATA_OUTPUT], (err, characteristics) => {
            if (err != null) {
              this.disconnect();
              return reject(err);
            }

            characteristics[0].subscribe(err => {
              if (err != null) {
                this.disconnect();
                return reject(err);
              }

              this.commandInput = characteristics[0];
              this.dataOutput = characteristics[1];

              this.dataOutput.on("data", (data, isNotification) => {
                if (!isNotification) {
                  return;
                }

                this.handleData(data);
              })

              this.pollData();

              resolve();
            })
          })
        })
      })
    })
  }

  /**
   * Teardown and clean up everything.
   */
  disconnect() {
    this.peripheral.disconnect();
    this.events.removeAllListeners();
    this.connected = false;
    this.started = false;
    noble.stopScanning();
  }

  /**
   * Start starts the workout. Paramters will be added once the protocol is understood better.
   */
  async start() {
    await wait(300);
    await this.writeCommand(setWorkoutMode());
    await wait(300);
    await this.writeCommand(setWorkoutParams());
    await wait(300);
    await this.writeCommand(setIncline(18));

    this.started = true;
  }

  /**
   * Write a command. This does not listen to its specific response, however.
   * 
   * @param {number[] | Buffer | Uint8Array} data Data to write.
   */
  writeCommand(data) {
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
  handleData(data) {
    console.log("DATA", data);
  }

  async pollData() {
    try {
      while (this.connected) {
        if (this.started) {
          this.writeCommand(getWorkoutState());
          await wait(500);
        } else {
          this.writeCommand(ackCmd());
          await wait(400);
          this.writeCommand(getMaxLevel());
          await wait(400);
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
   * @param {number} timeout How many milliseconds to scan for
   * @returns {Client}
   */
  static scan(timeout = 30000) {
    let done = false;

    return new Promise((resolve, reject) => {
      noble.startScanning([]);

      noble.on('discover', (peripheral) => {
        console.error("Device", peripheral.address, peripheral.advertisement.localName, peripheral.services);

        if (peripheral.services == null) {
          return
        }
        if (peripheral.services.find(s => s.uuid === S1_SERVICE) == null) {
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