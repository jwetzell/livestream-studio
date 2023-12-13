class Studio {

    update(packet){
        this.latestPacket = {
            parts: packet.trim().split(':'),
            raw: packet
        }
    }
}

module.exports = Studio;