class Studio {
  update(packet) {
    const packetParts = packet.trim().split(':');

    this.latestPacket = {
      type: packetParts[0],
      parts: packetParts,
      raw: packet,
    };

    switch (this.latestPacket.type) {
      default:
        console.error(`lib: unrecognized packet type: ${this.latestPacket.type}`);
        break;
    }
  }
}

module.exports = Studio;
