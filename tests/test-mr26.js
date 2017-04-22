/* eslint-env node, mocha */

const should = require("should");
const MR26 = require("..");
const SerialPort = require("./MockSerialPort").SerialPort;

let serialPort = new SerialPort("/path/to/fake/port");
let mr26 = new MR26(serialPort);

describe("MR26", function () {

    before(function () {
        mr26.listen();
    });

    it("decodes the sampled RF stream into a stream of X10 packets", function (done) {
        mr26.once("data", function (data) {
            should.exist(data);
            data.should.equal("L16off");
            done();
        });
        // open the serial port
        serialPort.emit("open");
        // send A-16 OFF from the fake serial port
        serialPort.emit("data", new Buffer([
            0xd5, 0xaa, 0xd4, 0x78, 0xad
        ]));
    });

    it("decodes up to six repeated samples as just one", function (done) {

        mr26.once("data", function (data) {
            should.exist(data);
            data.should.equal("A1off");
            done();
        });

        // TODO update test to ensure only one data event is emitted in 645ms

        serialPort.emit("open");
        // send A1 OFF from the fake serial port
        // the message is repeated six times (over 645ms)
        // to simulate pressing a button on the palmpad HR12A
        serialPort.emit("data", new Buffer([0xd5, 0xaa, 0x60, 0x20, 0xad]));
        setTimeout(function () {
            serialPort.emit("data", new Buffer([0xd5, 0xaa, 0x60, 0x20, 0xad]));
            setTimeout(function () {
                serialPort.emit("data", new Buffer([0xd5, 0xaa, 0x60, 0x20, 0xad]));
                setTimeout(function () {
                    serialPort.emit("data", new Buffer([0xd5, 0xaa, 0x60, 0x20, 0xad]));
                    setTimeout(function () {
                        serialPort.emit("data", new Buffer([0xd5, 0xaa, 0x60, 0x20, 0xad]));
                        setTimeout(function () {
                            serialPort.emit("data", new Buffer([0xd5, 0xaa, 0x60, 0x20, 0xad]));
                        }, 107.5);
                    }, 107.5);
                }, 107.5);
            }, 107.5);
        }, 107.5);
    });

    // add more tests to ensure the data is decoded correctly
    // based on samples in docs folder

});
