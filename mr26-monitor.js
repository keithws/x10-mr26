"use strict";

var W800Receiver = require("./lib/w800").Receiver;

var w800 = new W800Receiver("/dev/tty.usbserial-FTWU3WZ0C", function (err) {
	if (err) {
		console.error(err);
		return;
	}
});

w800.on("handshake", function () {
	console.log("Handshake complete.");
});

w800.on("data", function (data) {
	console.log(data);
});
