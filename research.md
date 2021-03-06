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

## Timeline

```
--> 551.921382 0x0053 0001 (notify)

--> 551.931269 0x0055 f0a0010192
--> 551.996666 0x0055 f0a0010192
<-- 552.035246 0x0052 f0b00101a2
<-- 552.229776 0x0052 f0b00101a2

--> 552.247264 0x0055 f0a1010193
<-- 552.416052 0x0052 f0b1010121c4

--> 552.747606 0x0055 f0a0010192
<-- 552.828513 0x0052 f0b00101a2

--> 553.247559 0x0055 f0a1010193
<-- 553.315979 0x0052 f0b1010121c4

--> 553.748664 0x0055 f0a0010192
<-- 553.803449 0x0052 f0b00101a2

--> 554.248962 0x0055 f0a1010193
<-- 554.309830 0x0052 f0b1010121c4

--> 554.750164 0x0055 f0a0010192
<-- 554.797296 0x0052 f0b00101a2

--> 555.263584 0x0055 f0a1010193
<-- 555.397293 0x0052 f0b1010121c4

--> 555.766332 0x0055 f0a0010192
<-- 555.903537 0x0052 f0b00101a2

--> 556.305578 0x0055 f0a1010193
<-- 556.391059 0x0052 f0b1010121c4

--> 556.808407 0x0055 f0a0010192
<-- 556.808407 0x0055 f0b00101a2

<-- repeats -->

--> 561.949569 0x0055 f0a0010192
--> 562.071881 0x0055 f0b00101a2

--> 562.505201 0x0055 f0a301010196
<-- 562.578336 0x0052 f0b3010101a6

--> 563.009801 0x0055 f0a4010101010101010101010101a0
<-- 563.179067 0x0052 f0b4010101010101010101010101b0

--> 563.511366 0x0055 f0a501010299
<-- 563.572150 0x0052 f0b5010102a9

--> 564.012473 0x0055 f0a2010194
<-- 564.098233 0x0052 f0b2010101010101010101010101010101010202
<-- 564.115781 0x0052 b6

--> 564.512334 0x0055 f0a2010194
<-- 564.603351 0x0052 f0b2010101020101010101010101010101010202
<-- 564.604158 0x0052 b7

--> 565.012503 0x0055 f0a2010194
<-- 565.109626 0x0052 f0b2010101020101010101010101010101010202
<-- 565.110533 0x0052 b7 
```