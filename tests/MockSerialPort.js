var util = require("util"), events = require("events");
var MockSerialPort = function(){
    this.isClosed = true;
};
util.inherits(MockSerialPort,events.EventEmitter);
MockSerialPort.prototype.write = function(buffer){
    this.lastWrite = buffer;
};
MockSerialPort.prototype.close = function(){
    this.isClosed = true;
};
MockSerialPort.prototype.open = function(){
    this.isClosed = false;
};
module.exports.SerialPort = MockSerialPort;