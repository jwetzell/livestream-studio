const { EventEmitter } = require('node:events');
const { Socket } = require('node:net');

class Studio extends EventEmitter {
  constructor(ip) {
    super();
    this.inputs = [];
    this.ip = ip;
    this.connect();
  }

  update(packet) {
    const packetParts = packet.trim().split(':');

    this.latestPacket = {
      type: packetParts[0],
      parts: packetParts,
      raw: packet,
    };

    switch (this.latestPacket.type) {
      case 'ILCC':
        this.inputCount = Number.parseInt(this.latestPacket.parts[1], 10);
        break;
      case 'ILC':
        this.inputs[this.latestPacket.parts[1]] = {
          number: Number.parseInt(this.latestPacket.parts[1], 10) + 1,
          name: this.latestPacket.parts[2].replaceAll('"', ''),
          audio: {
            level: parseFloat(this.latestPacket.parts[3]) / 1000,
            gain: parseFloat(this.latestPacket.parts[4]) / 1000,
            mute: this.latestPacket.parts[5] === '1',
            monitor: this.latestPacket.parts[6] === '1',
            programLock: this.latestPacket.parts[7] === '1',
          },
          type: this.latestPacket.parts[8],
        };
        break;
      default:
        console.error(`lib: unrecognized packet type: ${this.latestPacket.type}`);
        break;
    }

    this.emit('update');
  }

  #setupSocket() {
    if (this.socket) {
      this.socket.destroy();
      this.socket.removeAllListeners();
    }

    this.socket = new Socket();
    this.socket.on('connect', () => {
      this.connected = true;
      console.log('studio: successfully connected');
      this.emit('connect');
    });

    this.socket.on('error', (error) => {
      this.connected = false;
      console.error(`studio: socket error -> ${error.message}`);
      setTimeout(() => {
        this.connect();
      }, 5000);
      this.emit('error', error);
    });

    this.socket.on('data', (data) => {
      data
        .toString()
        .split('\n')
        .forEach((packet) => {
          if (packet.trim()) {
            this.update(packet);
          }
        });
    });

    this.socket.on('close', (hadError) => {
      this.connected = false;
      console.log(`studio: connection closed ${hadError ? 'with error' : 'normally'}`);
      setTimeout(() => {
        this.connect();
      }, 5000);
      this.emit('close', hadError);
    });
  }

  connect() {
    if (!this.connected && this.ip) {
      this.#setupSocket();
      this.socket.connect(9923, this.ip);
    }
  }
}

module.exports = Studio;
