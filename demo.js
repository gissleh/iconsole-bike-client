const Client = require(".");

/**
 * @param {Client} client 
 */
function setupListeners(client) {
  function hex(n) {
    return `0x${n > 16 ? n.toString(16) : "0"+n.toString(16)}`
  }
  
  client.events.on("data", data => console.log("DATA", data));
  client.events.on("send", data => console.log("SEND", [...data].map(n => hex(n)).join(" ")));
  client.events.on("error", err => console.log("ERROR", err));
}

(async () => {
  try {
    console.error("Scanning...");
    const client = await Client.scan(process.argv[2], 10000);
    setupListeners(client);
    console.error("Connecting...");
    await client.connect();
    console.error("Connected...");
    await new Promise(resolve => setTimeout(resolve, 3000))
    console.error("Starting...");
    await client.start();
    await new Promise(resolve => setTimeout(resolve, 2000))    
    console.error("Setting level to 18...");
    await client.setLevel(18);
    await new Promise(resolve => setTimeout(resolve, 3000))    
    console.error("Setting level to 14...");
    await client.setLevel(14);
    await new Promise(resolve => setTimeout(resolve, 5000))    
    console.error("Pausing...");
    await client.pause();
    await new Promise(resolve => setTimeout(resolve, 10000))    
    console.error("Resuming...");
    await client.resume();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();