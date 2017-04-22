# x10-mr26

A node module for the [MR26 RF Serial FireCracker Receiver][1] from [X-10][2]. This module includes a library that can be used to create a stream of the X10 signals received by a MR26 unit. It also includes a command-line utility to log the received X10 signals to stdout.

## Install

```shell
    npm install mr26
```

## Usage, Command line

This module includes a command line program that outputs an ASCII byte stream of X10 Addresses and X10 Commands received over the RF Serial FireCracker Receiver. It requires the serial port where the device is connected to be passed as the first (and only) argument.

```shell
    mr26 /dev/tty-usbserial1 # or COM1 for Windows
```

## Usage, API

This module also provides and API to access the MR26 RF Serial FireCracker Receiver. Simply require the library and instantiate a new object and pass the serial port where the device is connect as the first argument to the MR26 class constructor. Then, error and data events will be emitted on the returned object. After binding the event listener callbacks, then tell it to start listening to the serial port.

```javascript
    const MR26 = require("x10-mr26");

    // pass the serial port to the MR26 constructor (COM1 for Windows)
    let mr26 = new MR26("/dev/tty-usbserial1");
    
    // errors will be emitted as an error event
    mr26.on("error", function (err) {
        throw err;
    });
    
    // recieved address and commands will be emitted as a data event
    mr26.on("data", function (data) {
        console.log("> mr26 data received");
        console.log(data);
    });
    
    // start listening on the provided port
    mr26.listen(function () {
        console.log("> mr26 listening");
    });
    
```

## License

x10-mr26 is available under the [MIT License][1].

## Todo

* create tests
* ensure the output stream is compatible with the TI103 ASCII Controller
* sample more devices
    * like a keychain fob and a motion sensor
* consider requiring two valid transmissions to combat noise

## Change Log

*1.0.1 — April 22, 2017*

* improved error handling and message logging
* improved documentation

*1.0.0 — April 10, 2017*

* first implementation

*0.0.1 — April 7, 2017*

* init


  [1]: https://github.com/keithws/x10/blob/master/LICENSE
  [3]: https://www.x10.com/
