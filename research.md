# Research

A lot was tried before we finally found a way to reverse engineer this bike. I share this so you could integrate it into your custom solution.

## Approach

### Datamining
The App can be decompiled, and that was used to put names to the numbers, as well as find out what the
last number is for.

* The clientId and meterId's purpose are still a mystery, but for this project they'll always be 0x01.

### MitM Attack
I tried using `gattacker` to get behind the bike and the app, but that just ended in disappointment as the
connection timed out.

### Snooping
The trick that finally worked was to snoop with an older device (Samsung Note 10.1 2014 edition tablet, Andorid 5) since the bluetooth snoop log is not truncated on that like it is in later versions — hence the MitM attempt.

## Results

### Protocol

The data is written to a writable characterstic, and then responded to in a notifyable characteristic. The protocol consits of packets that has this format.

The commands have codes `0xa0-0xa6` that correspond to responses with code `0xb0-0xb6` respectively. See `packets.js` and `parser.js` for more information about he specific packets.

#### Request
```
magic byte = 0xf0
command byte = 0xa0-0xa6
clientId byte = 0x01
meterId byte = 0x01
parameters []byte
checksum byte = sum of all earlier bytes.
```

#### Response
```
magic byte = 0xf0
code byte = 0xb0-0xb6
clientId byte = 0x01
meterId byte = 0x01
data []byte
```

### Characteristics
* 49535343-fe7d-4ae5-8fa9-9fafd205e455: Service.
  * 49535343-8841-43f4-a8d4-ecbe34729bb3: Comamnd input (write)
  * 49535343-1e4d-4bd9-ba61-23c647249616: Data output (notify)
  * 49535343-4c8a-39b3-2f49-511cff073b7e: Unknown output (notify)
* 49535343-5d82-6099-9348-7aac4d5fbc51: Mysterious second service
  * 49535343-026e-3a9b-954c-97daef17e26e: Unknown output (notify)