const { Studio } = require('.');

const studio = new Studio('127.0.0.1'); // IP of Livestream Studio

studio.on('connect', () => {
  console.log('studio has connected');
});

studio.on('update', (type) => {
  // type is the type of packet that caused the update
  console.log('studio update received');
  console.log(studio.toJSON());
});

// Send the cut command to the studio instance every 10 seconds
setInterval(() => {
  studio.cut();
}, 10000);
