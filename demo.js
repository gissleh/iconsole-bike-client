const Client = require(".");

(async() => {
  try {
    console.error("Scanning...");
    const client = await Client.scan(10000);
    console.error("Connecting...");
    client.connect();
    console.error("Starting...");
  } catch(err) {
    console.error(err)
    process.exit(1);
  }
})()