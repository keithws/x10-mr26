const EventEmitter = require('events');
const SerialPort = require('serialport');
const x10 = require('x10');
const X10Address = x10.Address;
const X10HouseCode = x10.HouseCode;
const X10Command = x10.Command;


/*
 * helper function to reverse order of bits in 8 bit bytes
 */
const bitReverseTable256 = [
  0x00, 0x80, 0x40, 0xC0, 0x20, 0xA0, 0x60, 0xE0, 0x10, 0x90, 0x50, 0xD0, 0x30, 0xB0, 0x70, 0xF0, 
  0x08, 0x88, 0x48, 0xC8, 0x28, 0xA8, 0x68, 0xE8, 0x18, 0x98, 0x58, 0xD8, 0x38, 0xB8, 0x78, 0xF8, 
  0x04, 0x84, 0x44, 0xC4, 0x24, 0xA4, 0x64, 0xE4, 0x14, 0x94, 0x54, 0xD4, 0x34, 0xB4, 0x74, 0xF4, 
  0x0C, 0x8C, 0x4C, 0xCC, 0x2C, 0xAC, 0x6C, 0xEC, 0x1C, 0x9C, 0x5C, 0xDC, 0x3C, 0xBC, 0x7C, 0xFC, 
  0x02, 0x82, 0x42, 0xC2, 0x22, 0xA2, 0x62, 0xE2, 0x12, 0x92, 0x52, 0xD2, 0x32, 0xB2, 0x72, 0xF2, 
  0x0A, 0x8A, 0x4A, 0xCA, 0x2A, 0xAA, 0x6A, 0xEA, 0x1A, 0x9A, 0x5A, 0xDA, 0x3A, 0xBA, 0x7A, 0xFA,
  0x06, 0x86, 0x46, 0xC6, 0x26, 0xA6, 0x66, 0xE6, 0x16, 0x96, 0x56, 0xD6, 0x36, 0xB6, 0x76, 0xF6, 
  0x0E, 0x8E, 0x4E, 0xCE, 0x2E, 0xAE, 0x6E, 0xEE, 0x1E, 0x9E, 0x5E, 0xDE, 0x3E, 0xBE, 0x7E, 0xFE,
  0x01, 0x81, 0x41, 0xC1, 0x21, 0xA1, 0x61, 0xE1, 0x11, 0x91, 0x51, 0xD1, 0x31, 0xB1, 0x71, 0xF1,
  0x09, 0x89, 0x49, 0xC9, 0x29, 0xA9, 0x69, 0xE9, 0x19, 0x99, 0x59, 0xD9, 0x39, 0xB9, 0x79, 0xF9, 
  0x05, 0x85, 0x45, 0xC5, 0x25, 0xA5, 0x65, 0xE5, 0x15, 0x95, 0x55, 0xD5, 0x35, 0xB5, 0x75, 0xF5,
  0x0D, 0x8D, 0x4D, 0xCD, 0x2D, 0xAD, 0x6D, 0xED, 0x1D, 0x9D, 0x5D, 0xDD, 0x3D, 0xBD, 0x7D, 0xFD,
  0x03, 0x83, 0x43, 0xC3, 0x23, 0xA3, 0x63, 0xE3, 0x13, 0x93, 0x53, 0xD3, 0x33, 0xB3, 0x73, 0xF3, 
  0x0B, 0x8B, 0x4B, 0xCB, 0x2B, 0xAB, 0x6B, 0xEB, 0x1B, 0x9B, 0x5B, 0xDB, 0x3B, 0xBB, 0x7B, 0xFB,
  0x07, 0x87, 0x47, 0xC7, 0x27, 0xA7, 0x67, 0xE7, 0x17, 0x97, 0x57, 0xD7, 0x37, 0xB7, 0x77, 0xF7, 
  0x0F, 0x8F, 0x4F, 0xCF, 0x2F, 0xAF, 0x6F, 0xEF, 0x1F, 0x9F, 0x5F, 0xDF, 0x3F, 0xBF, 0x7F, 0xFF
];

function reverse (x) {

    return bitReverseTable256[x];

}


/**
 * function to help parse data of the serial port from an MR26
 * emit a data event every time 5 bytes of data are recived
 * in the following format d5 aa ?? ?? ad
 * the same command should not be repeated more than every (2 * (67.5ms + 40ms))
 */
function parser () {
    var data = new Buffer(0);
    var prev = new Buffer(0);
    function clear () {
        prev = new Buffer(0);
    }
    return function(emitter, buffer) {
        data = Buffer.concat([data, buffer]);

        // only emit data five bytes at a time
        while (data.length >= 5) {
            var out = data.slice(0, 5);
            data = data.slice(5);

            // only emit data that matches the expected pattern
            if (out[0] == 0xd5 && out[1] == 0xaa && out[4] == 0xad) {

                // and only if it doesn't match the previous output
                // in the last 400ms
                if (!out.equals(prev)) {
                    emitter.emit('data', out);

                    // set previous output data
                    prev = Buffer.from(out);

                    // set a timeout to clear the previous buffer
                    // the hr12a palm pad send the same command six times
                    setTimeout(clear, 6 * (67.5 + 40));
                }

            }
        }
    };
}


/**
 * MR26 - class that emits events when signals are received
 */
class MR26 extends EventEmitter {
    constructor (port) {
        super();
        this.port = port;
        this.sp = new SerialPort(this.port, {
            autoOpen: false,
            baudRate: 9600,
            dataBits: 8,
            stopBits: 1,
            rtscts: true,
            parser: parser()
        });
        let mr26 = this;
        this.sp.on("error", err => {
            mr26.emit("error", err);
        });
    }
    listen (cb) {

        let mr26 = this;

        // each transmission is five bytes
        // the first byte is the "leader" and always the same (0xd5)
        // the second byte is _supposed to be_ the first of two data bytes
        // the third byte is _supposed to be_ the two's complement of the previous byte
        // the fourth byte is the second data byte
        // the fifth byte is _supposed to be_ the two's complement of the previous byte
        // realworld testing revealed:
        // the first and fifth bytes never change
        // the third byte is the first of two data bytes
        this.sp.on("data", data => {

            let func;
            let byte = Buffer.from([reverse(data[2]), reverse(data[3])]);
            const FLAG_HOUSE_CODE = parseInt("00001111", 2);
            const FLAG_OFF = parseInt("00000100", 2);
            let houseCode = byte[0] & FLAG_HOUSE_CODE;
            let isOff = byte[1] & FLAG_OFF;
            let firstTwoBits = (byte[1] & 2) << 1;
            let thirdBit = (byte[1] >> 3) & 3;
            let fourthBit = (byte[0] & parseInt("00100000", 2)) >> 2;
            let unitCodeIndex = firstTwoBits | thirdBit | fourthBit;
            // 2 on     0_0 = 0
            // 3 off    1_0 = 2
            // 4 dim    1_1 = 3
            // 5 bright 0_1 = 1
            if (isOff) {
                // off
                func = 3;
            } else {
                // on
                func = 2;
            }
            switch(byte[1]) {
            case 0x11:
                // bright
                func = 5;
                unitCodeIndex = null;
                break;
            case 0x19:
                // dim
                func = 4;
                unitCodeIndex = null;
                break;
            }

            let address;
            if (unitCodeIndex !== null) {
                address = new X10Address([houseCode, "" + (unitCodeIndex + 1)]);
            } else {
                address = new X10HouseCode(houseCode);
            }
            let command = new X10Command(func);

            mr26.emit("data", address.toString() + command.toString());

        });
        this.sp.open(cb);
    }
}


module.exports = MR26;
