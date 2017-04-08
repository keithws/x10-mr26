var serialport = require('serialport'),
	SerialPort = serialport.SerialPort,
	util = require('util'),
	events = require('events'),
	x10 = require('x10'),
	X10Address = x10.Address,
	X10Command = x10.Command,
	throttle = require("lodash.throttle");


var HANDSHAKE_REQUEST = [0xF0, 0x29],
	HANDSHAKE_RESPONSE = [0x29];

	var dc, rdc, ed;

	dc = rdc = ed = 0;


/*
 * helper functions to reverse bits and swap half words
 */
function flip(x, k) {
	if (k & 1) x = (x & 0x55555555) << 1 | (x & 0xAAAAAAAA) >> 1;
	if (k & 2) x = (x & 0x33333333) << 2 | (x & 0xCCCCCCCC) >> 2;
	if (k & 4) x = (x & 0x0F0F0F0F) << 4 | (x & 0xF0F0F0F0) >> 4;
	if (k & 8) x = (x & 0x00FF00FF) << 8 | (x & 0xFF00FF00) >> 8;
	if (k & 16) x = (x & 0x0000FFFF) << 16 | (x & 0xFFFF0000) >> 16;
	return x;
}
function reverseTheBitsInEachByte(x) {
	return flip(x, 7);
}
function swapHalfWords(x) {
	return flip(x, 16);
}
function reverseTheBitsInEachByteWithStringsAndArrays(x) {
	var b = x.toString(2);
	// pad number to always have eight bits
	while (b.length < 8) {
		b = '0' + b;
	}
	return parseInt(b.split('').reverse().join(''), 2);
}

/**
 * @class The Receiver object represents a member of the W800 family of RF receivers.
 * @augments EventEmitter
 * @param {String} port This is the serial port the cm11a is connected to.
 * @param {function} function A function to be called when the interface is ready to communicate.
 * @property receiveBuffer An array holding the current bytes received from the W800.
 * @property {SerialPort} sp The serial port object used to communicate with the W800.
 */
function Receiver(port, callback) {
	events.EventEmitter.call(this);

	callback = callback || function () {};

	var receiver = this;

	this.isReady = false;
	this.emittedData = false;
	this.receiveBuffer = [];

	if (typeof port === 'object') {
		this.sp = port;
	} else { 
		this.sp = new SerialPort(port, {
			baudRate: 4800,
			parity: 'none',
			dataBits: 8,
			stopBits: 1
		});
	}

	this.timeout;

	this.setTimeout = function () {
		if (receiver.timeout) {
			return;
		}
		// reset emittedData 576ms later
		receiver.timeout = setTimeout(function () {
			rdc += 1;
			console.log("reset emittedData" + rdc);
			receiver.emittedData = false;
			receiver.timeout = undefined;
		}, 576);
	};

	this.sp.on("error", function (string) {
		callback(string);
	});

	// emit a data event after receiving 4 bytes
	// where bytes 1 & 2 are complementary, as are bytes 3 & 4
	// transpose the bits in each byte
	// and move bytes 3 & 4 before bytes 1 & 2
	this.sp.on("data", function (data) {
		var fourBytes, transposed, swapped;


		while (data.length >= 4) {
			receiver.setTimeout();

			bytes = Uint32Array.from(data.slice(0, 4));
			data = data.slice(4);

			if (((bytes[0] ^ bytes[1]) !== 255) || ((bytes[2] ^ bytes[3]) !== 255)) {
				// TODO check if the data is the for the security transmitters
				console.warn("Bad data received. Bytes in half words are not complementary.");
				console.log(bytes);
				receiver.emit("data", new Buffer(0));
				return;
			} else {
				isX10 = true;
			}

			transposed = bytes.map(reverseTheBitsInEachByte);
			swapped = new Buffer([transposed[2], transposed[3], transposed[0], transposed[1]]);

			// decode data from binary to X10 objects
			if (isX10) {
				var houseCode, unitCode, address, command;
				// house code is in the lower nibble of byte 3
				houseCode = swapped[2]&0x0F;

				// unit code is broken up
				// bits 0 and 1 are in byte 0 at position 3 and 4
				// bit 2 is in byte 0 at position 1
				// bit 3 is in byte 2 at position 5
				unitCode = (((swapped[0]&0b11000)>>>3)|((swapped[0]&0b10)<<1)|((swapped[2]&0b100000)>>>2));

				// house code is standard X10 protocol code
				// unit code is the literal unit number but needs a plus one
				address = new X10Address([houseCode, unitCode + 1 + ""]);

				// function code is not represented
				// it appeaars that RF protocol only supports four function
				// codes: ON, OFF, BRIGHT, and DIM
				// bit 0 decides if bit 2 is ON/OFF or BRIGHT/DIM
				if ((swapped[0]&0b1) === 0) {
					if ((swapped[0]&0b100) === 0) {
						command = new X10Command("ON");
					} else {
						command = new X10Command("OFF");
					}
				} else {
					if ((swapped[0]&0b100) === 0) {
						command = new X10Command("BRIGHT");
					} else {
						command = new X10Command("DIM");
					}
				}

				// only emit one data
				// the message is repeated six times when I press a remote button
				if (!receiver.emittedData) {
					ed += 1;
					console.log("data emitted" + ed);
					receiver.emit("data", [address, command], swapped);
					receiver.emittedData = true;
				}
			}
		}
	});

	this.sp.on("open", function () {
		// TODO find out why my device does not appear to respond to the handshake
		receiver.handshake(callback);
	});

	if ( !(this instanceof Receiver) ) {
		return new Receiver( port, callback );
	}

}
util.inherits(Receiver, events.EventEmitter);


/**
 * Initiate a handshake with the W800 and verify the response
 * @param {function} callback A function to be called when the W800 has responded.
 */
Receiver.prototype.handshake = function (callback) {
	var receiver = this;

	this.once("handshake", callback);
	this.sp.once("data", function (data) {

		// expects a 1 byte response
		if (data.length === 1) {

			if (data[0] === HANDSHAKE_RESPONSE[0]) {
				receiver.isReady = true;
				receiver.emit("handshake");
			} else {
				callback(new Error("Invalid response: " + data));
			}

		} else {
			callback(new Error("Invalid response length, " + data.length));
		}
	});
	this.sp.write(HANDSHAKE_REQUEST, function(err, results) {
		if (err) {
			callback(err);
		}
	});
};

module.exports = {
	Receiver: Receiver
};
