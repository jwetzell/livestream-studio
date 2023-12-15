function convertFloatToAudioLevel(float) {
  if (float !== undefined && Number.isFinite(float)) {
    if (float < -60 || float > 10) {
      throw new Error('audio level must be between -60.0 and 10.0');
    }
    const stringLength = float < 0 ? 5 : 4;
    const formattedAudioLevel = `${float * 1000}`.slice(0, stringLength);
    return formattedAudioLevel;
  }
  throw new Error('audio level must be an integer');
}

function convertFloatToGainLevel(float) {
  if (float !== undefined && Number.isFinite(float)) {
    if (float < 0 || float > 10) {
      throw new Error('gain must be between 0.0 and 10.0');
    }
    const stringLength = float < 0 ? 5 : 4;
    const formattedGainLevel = `${float * 1000}`.slice(0, stringLength);
    return formattedGainLevel;
  }
  throw new Error('gain must be an integer');
}

function convertFloatToIncrement(float) {
  if (float !== undefined && Number.isFinite(float)) {
    if (float < -60 || float > 60) {
      throw new Error('increment must be between -60.0 and +60.0');
    }
    const stringLength = float < 0 ? 5 : 4;
    const formattedIncrement = `${float * 1000}`.slice(0, stringLength);
    return formattedIncrement;
  }
  throw new Error('increment must be an integer');
}

module.exports = {
  convertFloatToAudioLevel,
  convertFloatToGainLevel,
  convertFloatToIncrement,
};
