# `iconsole-bike-client`

This is a reversed bluetooth client for exercise bikes that uses the iConsole application.

If your bike is an iConsole bike but doesn't work, please open an issue with a log of the
demo.js output.

Note: node v8 or lower required due to `noble` dependency.

## Try me
First, use `bluetoothctl` to find the mac address of your bike. It should advertize with
the name "iConsole" or similar.

Then, run this. It spams a lot, so I recommend writing to a file.

```sh
sudo node demo.js mac_addr_with_colons | tee demo.log
```

## Example
```javascript
const Client = require("./index.js")

const myBike = "00:00:00:00:00:00"; // Get MAC from config file or something else.

// Connect to client and listen to events.
const client = await Client.scan(myBike, 10000);
client.events.on("data", data => console.log("DATA", data));
client.events.on("send", data => console.log("SEND", [...data].map(n => hex(n)).join(" ")));
client.events.on("error", err => console.log("ERROR", err));

// Connect to the bike.
await client.connect();

// Start the workout with a 50 calorie goal and level 12.
// That means that once the calorie count has counted down,
// the timer will stop.
await client.start({calories: 50, level: 12});

// Pause the bike
await client.pause();

// Resume the bike
await client.resume();

// Set resistance level (same `level` as in start options)
await client.setResistance(18);
```

## Roadmap

* .d.ts files for better intellisense.
* refactor to `sblendid` (when it adds linux support), this will remove root requirement
  and support later version of node.
* Test if it runs on raspberry pi.