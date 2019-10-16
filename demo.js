const Client = require(".");

(async() => {
  try {
    console.error("Scanning...");
    const client = await Client.scan(process.argv[2], 10000);
    console.error("Connecting...");
    await client.connect();
    console.error("Connected...");
    await new Promise(resolve => setTimeout(resolve, 3000))
    console.error("Starting...");
    await client.start();
  } catch(err) {
    console.error(err)
    process.exit(1);
  }
})()