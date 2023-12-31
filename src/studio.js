const { EventEmitter } = require('node:events');
const { Socket } = require('node:net');
const { convertFloatToAudioLevel, convertFloatToGainLevel, convertFloatToIncrement } = require('./utils');

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

  #updateInputCount(newInputCount) {
    if (this.inputCount !== undefined) {
      // TODO(jwetzell): I think this is all we can safely do as we don't know what happened
      // an input could be moved, added, deleted and input updates always come after an input count "update"
      this.inputs = [];
    }

    this.inputCount = newInputCount;
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
        this.#updateInputCount(Number.parseInt(this.latestPacket.parts[1], 10));
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
      case 'AVC':
        if (this.inputs[[Number.parseInt(this.latestPacket.parts[1], 10)]]) {
          this.inputs[[Number.parseInt(this.latestPacket.parts[1], 10)]].audio.level =
            Number.parseInt(this.latestPacket.parts[2], 10) / 1000;
        }
        break;
      case 'AGC':
        if (this.inputs[[Number.parseInt(this.latestPacket.parts[1], 10)]]) {
          this.inputs[[Number.parseInt(this.latestPacket.parts[1], 10)]].audio.gain =
            Number.parseInt(this.latestPacket.parts[2], 10) / 1000;
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
        console.error(`studio: unrecognized packet type: <${this.latestPacket.type}> please report to maintainer`);
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
      this.emit('connect');
    });

    this.socket.on('error', (error) => {
      this.connected = false;
      this.emit('error', error);
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
      this.emit('close', hadError);
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

  setInputVolumeLevel(inputNum, audioLevel) {
    if (inputNum !== undefined && Number.isInteger(inputNum)) {
      const formattedAudioLevel = convertFloatToAudioLevel(audioLevel);
      this.#sendCommand(`SIVL:${inputNum - 1}:${formattedAudioLevel}`);
    } else {
      throw new Error('input number must be an integer');
    }
  }

  incrementInputAudioLevel(inputNum, increment) {
    if (inputNum !== undefined && Number.isInteger(inputNum)) {
      const formattedIncrement = convertFloatToIncrement(increment);
      this.#sendCommand(`IVL:${inputNum - 1}:${formattedIncrement}`);
    } else {
      throw new Error('input number must be an integer');
    }
  }

  setInputGainLevel(inputNum, gainLevel) {
    if (inputNum !== undefined && Number.isInteger(inputNum)) {
      const formattedGainLevel = convertFloatToGainLevel(gainLevel);
      this.#sendCommand(`SIGL:${inputNum - 1}:${formattedGainLevel}`);
    } else {
      throw new Error('input number must be an integer');
    }
  }

  muteInput(inputNum) {
    if (inputNum !== undefined && Number.isInteger(inputNum)) {
      this.#sendCommand(`IAM:${inputNum - 1}:1`);
    } else {
      throw new Error('input number must be an integer');
    }
  }

  unmuteInput(inputNum) {
    if (inputNum !== undefined && Number.isInteger(inputNum)) {
      this.#sendCommand(`IAM:${inputNum - 1}:0`);
    } else {
      throw new Error('input number must be an integer');
    }
  }

  soloInput(inputNum) {
    if (inputNum !== undefined && Number.isInteger(inputNum)) {
      this.#sendCommand(`IAH:${inputNum - 1}:1`);
    } else {
      throw new Error('input number must be an integer');
    }
  }

  unsoloInput(inputNum) {
    if (inputNum !== undefined && Number.isInteger(inputNum)) {
      this.#sendCommand(`IAH:${inputNum - 1}:0`);
    } else {
      throw new Error('input number must be an integer');
    }
  }

  lockInputAudioToProgram(inputNum) {
    if (inputNum !== undefined && Number.isInteger(inputNum)) {
      this.#sendCommand(`IAP:${inputNum - 1}:1`);
    } else {
      throw new Error('input number must be an integer');
    }
  }

  unlockInputAudioFromProgram(inputNum) {
    if (inputNum !== undefined && Number.isInteger(inputNum)) {
      this.#sendCommand(`IAP:${inputNum - 1}:0`);
    } else {
      throw new Error('input number must be an integer');
    }
  }

  setStreamVolumeLevel(audioLevel) {
    const formattedAudioLevel = convertFloatToAudioLevel(audioLevel);
    this.#sendCommand(`SSVL:${formattedAudioLevel}`);
  }

  incrementStreamAudioLevel(increment) {
    const formattedIncrement = convertFloatToIncrement(increment);
    this.#sendCommand(`SVL:${formattedIncrement}`);
  }

  muteStream() {
    this.#sendCommand(`SM:1`);
  }

  unmuteStream() {
    this.#sendCommand(`SM:0`);
  }

  soloStream() {
    this.#sendCommand(`SH:1`);
  }

  unsoloStream() {
    this.#sendCommand(`SH:0`);
  }

  setRecordVolumeLevel(audioLevel) {
    const formattedAudioLevel = convertFloatToAudioLevel(audioLevel);
    this.#sendCommand(`SRVL:${formattedAudioLevel}`);
  }

  incrementRecordAudioLevel(increment) {
    const formattedIncrement = convertFloatToIncrement(increment);
    this.#sendCommand(`RVL:${formattedIncrement}`);
  }

  muteRecord() {
    this.#sendCommand(`RM:1`);
  }

  unmuteRecord() {
    this.#sendCommand(`RM:0`);
  }

  soloRecord() {
    this.#sendCommand(`RH:1`);
  }

  unsoloRecord() {
    this.#sendCommand(`RH:0`);
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
