# Exploration in interacting with Livestream Studio

* a lot of the API ground work done by [this companion module](https://github.com/bitfocus/companion-module-vimeo-livestreamstudio6).
* mainly generalizing that work here

## Install
- `npm install --save livestream-studio`

## Usage
```
const { Studio } = require('livestream-studio')

const studio = new Studio('127.0.0.1') // IP of Livestream Studio

studio.on('connect',()=>{
    console.log('studio has connected')
})

studio.on('update',(type)=>{
    // type is the type of packet that caused the update
    console.log('studio update received')
    console.log(studio.toJSON())
})

// Send the cut command to the studio instance every 10 seconds
setInterval(()=>{
    studio.cut();
},10000)

```