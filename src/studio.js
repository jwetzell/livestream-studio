const { EventEmitter } = require('node:events');
const { Socket } = require('node:net');

class Studio extends EventEmitter {
  constructor(ip) {
    super();
    this.inputs = [];

    this.stream = {
      audio: {},
      status: 'Stopped',
    };
    this.record = {
      audio: {},
      status: 'Stopped',
    };

    this.status = {};
    this.graphics = [];
    this.tBar = {};
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
    let packetDecoded = true;
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
            solo: this.latestPacket.parts[6] === '1',
            programLock: this.latestPacket.parts[7] === '1',
          },
          type: this.latestPacket.parts[8],
        };
        break;
      case 'PmIS':
        this.program = Number.parseInt(this.latestPacket.parts[1], 10);
        break;
      case 'PwIS':
        this.preview = Number.parseInt(this.latestPacket.parts[1], 10);
        break;
      case 'SVC':
        this.stream.audio.level = Number.parseInt(this.latestPacket.parts[1], 10) / 1000;
        break;
      case 'SMC':
        this.stream.audio.mute = this.latestPacket.parts[1] === '1';
        break;
      case 'SSC':
        this.stream.audio.solo = this.latestPacket.parts[1] === '1';
        break;
      case 'RVC':
        this.record.audio.level = Number.parseInt(this.latestPacket.parts[1], 10) / 1000;
        break;
      case 'RMC':
        this.record.audio.mute = this.latestPacket.parts[1] === '1';
        break;
      case 'RSC':
        this.record.audio.solo = this.latestPacket.parts[1] === '1';
        break;
      case 'FIn':
        this.fadeToBlack = false;
        break;
      case 'FOut':
        this.fadeToBlack = true;
        break;
      case 'StrStopped':
      case 'StrStarting':
      case 'StrStarted':
      case 'StrStopping':
        this.stream.status = this.latestPacket.type.slice(3);
        break;
      case 'RecStopped':
      case 'RecStarting':
      case 'RecStarted':
      case 'RecStopping':
        this.record.status = this.latestPacket.type.slice(3);
        break;
      case 'GMOn':
      case 'GMOff':
        if (this.graphics[Number.parseInt(this.latestPacket.parts[1], 10)] === undefined) {
          this.graphics[Number.parseInt(this.latestPacket.parts[1], 10)] = {};
        }
        this.graphics[Number.parseInt(this.latestPacket.parts[1], 10)].status = this.latestPacket.type.slice(2);
        break;
      case 'GMPvH':
      case 'GMPvS':
        if (this.graphics[Number.parseInt(this.latestPacket.parts[1], 10)] === undefined) {
          this.graphics[Number.parseInt(this.latestPacket.parts[1], 10)] = {};
        }
        this.graphics[Number.parseInt(this.latestPacket.parts[1], 10)].preview = this.latestPacket.type === 'GMPvS';
        break;
      case 'GMOH':
      case 'GMOS':
        if (this.graphics[Number.parseInt(this.latestPacket.parts[1], 10)] === undefined) {
          this.graphics[Number.parseInt(this.latestPacket.parts[1], 10)] = {};
        }
        this.graphics[Number.parseInt(this.latestPacket.parts[1], 10)].pushed = this.latestPacket.type === 'GMOS';
        break;
      case 'GPA':
        if (this.graphics[Number.parseInt(this.latestPacket.parts[1], 10)] === undefined) {
          this.graphics[Number.parseInt(this.latestPacket.parts[1], 10)] = {};
        }
        this.graphics[Number.parseInt(this.latestPacket.parts[1], 10)].canPush = this.latestPacket.parts[2] === '1';
        break;
      case 'MPause':
      case 'MFP':
      case 'MIOP':
        if (this.inputs[[Number.parseInt(this.latestPacket.parts[1], 10)]]) {
          if (this.latestPacket.type === 'MPause') {
            this.inputs[[Number.parseInt(this.latestPacket.parts[1], 10)]].mediaStatus = 'paused';
          } else {
            this.inputs[[Number.parseInt(this.latestPacket.parts[1], 10)]].mediaStatus =
              this.latestPacket.type === 'MFP' ? 'playFull' : 'playInOut';
          }
        }
        break;
      case 'TrAStart':
      case 'TrAStop':
        this.tBar.status = this.latestPacket.type.slice(3);
        if (this.latestPacket.type === 'TrAStop') {
          this.tBar.percent = 0;
        }
        break;
      case 'TrASp':
      case 'TrMSp':
        this.tBar.status = this.latestPacket.type === 'TrASp' ? 'Automatic' : 'Manual';
        this.tBar.percent = Number.parseInt(this.latestPacket.parts[1], 10) / 10;
        if (this.tBar.percent === 0) {
          this.tBar.status = 'Stop';
        }
        break;
      case 'AOC':
        if (this.inputs[[Number.parseInt(this.latestPacket.parts[1], 10)]]) {
          this.inputs[[Number.parseInt(this.latestPacket.parts[1], 10)]].audio.program =
            this.latestPacket.parts[2] !== '0';
          this.inputs[[Number.parseInt(this.latestPacket.parts[1], 10)]].audio.programLock =
            this.latestPacket.parts[2] === '1';
        }
        break;
      case 'AMC':
        if (this.inputs[[Number.parseInt(this.latestPacket.parts[1], 10)]]) {
          this.inputs[[Number.parseInt(this.latestPacket.parts[1], 10)]].audio.mute =
            this.latestPacket.parts[2] === '1';
        }
        break;
      case 'ASC':
        if (this.inputs[[Number.parseInt(this.latestPacket.parts[1], 10)]]) {
          this.inputs[[Number.parseInt(this.latestPacket.parts[1], 10)]].audio.solo =
            this.latestPacket.parts[2] === '1';
        }
        break;
      case 'Cut':
        // TODO(jwetzell): should something happen here?
        break;
      default:
        packetDecoded = false;
        console.error(`lib: unrecognized packet type: ${this.latestPacket.type}`);
        break;
    }

    if (packetDecoded) {
      this.emit('update', this.latestPacket.type);
    }
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

  cut() {
    this.#sendCommand('RCut');
  }

  auto() {
    this.#sendCommand('RAuto');
  }

  setFadeToBlack(shouldFTB) {
    this.#sendCommand(`RF${shouldFTB ? 'Out' : 'In'}`);
  }

  setPreview(inputNumber) {
    if (inputNumber !== undefined && Number.isInteger(inputNumber)) {
      this.#sendCommand(`SPrI:${inputNumber - 1}`);
    } else {
      throw new Error('input number must be an integer');
    }
  }

  setProgram(inputNumber) {
    if (inputNumber !== undefined && Number.isInteger(inputNumber)) {
      this.#sendCommand(`SPmI:${inputNumber - 1}`);
    } else {
      throw new Error('input number must be an integer');
    }
  }

  startStream() {
    this.#sendCommand('StrStart');
  }

  stopStream() {
    this.#sendCommand('StrStop');
  }

  startRecord() {
    this.#sendCommand('RecStart');
  }

  stopRecord() {
    this.#sendCommand('RecStop');
  }

  pushGraphic(graphicsNum) {
    if (graphicsNum !== undefined && Number.isInteger(graphicsNum)) {
      this.#sendCommand(`RGMOS:${graphicsNum - 1}`);
    } else {
      throw new Error('graphic number must be an integer');
    }
  }

  pullGraphic(graphicsNum) {
    if (graphicsNum !== undefined && Number.isInteger(graphicsNum)) {
      this.#sendCommand(`RGMOH:${graphicsNum - 1}`);
    } else {
      throw new Error('graphic number must be an integer');
    }
  }

  previewShowGraphic(graphicsNum) {
    if (graphicsNum !== undefined && Number.isInteger(graphicsNum)) {
      this.#sendCommand(`RGPvS:${graphicsNum - 1}`);
    } else {
      throw new Error('graphic number must be an integer');
    }
  }

  previewHideGraphic(graphicsNum) {
    if (graphicsNum !== undefined && Number.isInteger(graphicsNum)) {
      this.#sendCommand(`RGMPvH:${graphicsNum - 1}`);
    } else {
      throw new Error('graphic number must be an integer');
    }
  }

  playMediaFull(inputNum) {
    if (inputNum !== undefined && Number.isInteger(inputNum)) {
      this.#sendCommand(`RMFP:${inputNum - 1}`);
    } else {
      throw new Error('input number must be an integer');
    }
  }

  playMediaInOut(inputNum) {
    if (inputNum !== undefined && Number.isInteger(inputNum)) {
      this.#sendCommand(`RMIOP:${inputNum - 1}`);
    } else {
      throw new Error('input number must be an integer');
    }
  }

  pauseMedia(inputNum) {
    if (inputNum !== undefined && Number.isInteger(inputNum)) {
      this.#sendCommand(`RMPause:${inputNum - 1}`);
    } else {
      throw new Error('input number must be an integer');
    }
  }

  #sendCommand(command) {
    if (this.socket && this.connected) {
      this.socket.write(`${command}\n`);
    }
  }

  connect() {
    if (!this.connected && this.ip) {
      this.#setupSocket();
      this.socket.connect(9923, this.ip);
    }
  }

  toJSON() {
    return {
      inputCount: this.inputCount,
      inputs: this.inputs,
      program: this.program,
      preview: this.preview,
      stream: this.stream,
      record: this.record,
      fadeToBlack: this.fadeToBlack,
      graphics: this.graphics,
      tBar: this.tBar,
    };
  }
}

module.exports = Studio;
