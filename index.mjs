import internalIp from 'internal-ip'
import address from 'address'
import osc from 'osc'
import { map } from 'map-number'
import Koa from 'koa'
import Router from '@koa/router'
import { ArrayLimited } from 'array-limited'
import smoothish from 'smoothish'
import { createServer } from 'http'
import { Server } from 'socket.io'
import serve from 'koa-static-server'
import path from 'path'

const windowSize = 30

const paintings = [{
  name: 'reve-1',
  min: -1, 
  max: -0.8,
  speed: -20
}, {
  name: 'reve-2',
  min: -0.79, 
  max: -0.4,
  speed: -15
}, {
  name: 'reve-3',
  min: -0.39, 
  max: -0.2,
  speed: -10
}, {
  name: 'reve-4',
  min: -0.19, 
  max: -0.1,
  speed: -5
}, {
  name: 'reve-5',
  min: -0.09, 
  max: 0.09,
  speed: 0
}, {
  name: 'reve-6',
  min: 0.1, 
  max: 0.19,
  speed: 5
}, {
  name: 'reve-7',
  min: 0.2, 
  max: 0.39,
  speed: 10
}, {
  name: 'reve-8',
  min: 0.4, 
  max: 0.79,
  speed: 15
}, {
  name: 'reve-9',
  min: 0.8, 
  max: 1,
  speed: 20
}]

import MotorHat from 'motor-hat'
//const motorHat = MotorHat({ address: 0x60, dcs: ['M1'] })
const motorHat = {}
const BufferWave = new ArrayLimited(windowSize)
import {initMotor, setFrequency, setRange, setSpeedSync, runSync, runForward, runBackward, stopSync} from './motorpgpio.mjs'
const wlan0Interface = address.interface('IPv4', 'wlan0')
const __dirname = path.resolve()
const publicPath = `${__dirname}/public/`
// const MotorHat = null
// const motorHat = null
const staticOptions = {
  rootDir: publicPath,
  rootPath: '/'
}
let OSCOpen = false
let OSCTimeLastReceive = Date.now()
let OSCLastError = ''
let localIp = ''
let motorSpeed = ''
let motorDirection = ''
const httpPort = 8090
const OSCport = 57121
const mainWave = 'delta'
const app = new Koa()
const router = new Router()

router.get('/status/osc', (ctx, next) => {
  ctx.body = {
    status: OSCOpen,
    receiving: OSCReceiving(),
    lastReceive: OSCTimeLastReceive,
    lastError: OSCLastError
  }
})

router.get('/status/motor', (ctx, next) => {
  ctx.body = {
    motorSpeed,
    motorDirection,
    motorHat
  }
})

app
  .use(router.routes())
  .use(router.allowedMethods())
app.use(serve(staticOptions))
app.use(async (ctx, next) => {
  if (parseInt(ctx.status) === 404) {
    ctx.status = 404
    ctx.body = {
      msg: 'Looks like 404',
      routes: {
        osc: `http://${localIp}:${httpPort}/status/osc`,
        motor: `http://${localIp}:${httpPort}/status/motor`
      },
      conf: {
        localIp,
        OSCport,
        mainWave
      }
    }
  }
})


const httpServer = createServer(app.callback())
const options = {}
const io = new Server(httpServer, options)

// const fakeArray = [1,-3,-6,-9,-10,-100,-10,-8,-5,-1,2,3,4,50,4,2,-1,-4,-8,-10,-11,-12,-13,-12,-8,-6,-1,2,3,4]
// fakeArray.forEach(element => {
//  BufferWave.push(element)  
// })
// console.log('values: ', BufferWave.values)
// console.log('smoothed values: ', smoothish(BufferWave.values))
// console.log('smoothed values - radius 3: ', smoothish(BufferWave.values, { radius: 3 }))

io.on('connection', socket => {
  console.log('⚡️ - A socket.io connection occured')
  socket.on('speed', (arg) => {
    adjustSpeed(arg)
  })
  socket.on('direct-speed', (arg) => {
    setMotorSpeedDirect(arg)
    // for test only
    // BufferWave.push(arg)
    // console.log('values: ', BufferWave.values)
    // console.log('smoothed values: ', smoothish(BufferWave.values))
    // console.log('smoothed values - radius 3: ', smoothish(BufferWave.values, { radius: 3 }))
  })
})

const average = values => {
  if (values.length) {
    return values.reduce(function (previousValue, currentValue) {
      return previousValue + currentValue
    }) / values.length
  } else {
    return 0
  }
}

const wave2Array = waveObject => {
  return waveObject.map(el => {
    return el.value
  })
}

const waveValueThreshold = (listOfData, min, max) => {
  return listOfData.filter(el => (el > min) && (el < max))
}

const OSCReceiving = () => {
  return (Date.now() - OSCTimeLastReceive) < 150
}

const setMotorSpeedDirect = (speed) => {
  console.log(`speed direct: ${speed}`)
  if (speed < 0) {
    runBackward()
  } else {
    runForward()
  }
  speed = Math.abs(speed)
  setSpeedSync(speed)
}

const getSpeedPerRange = (rawData) => {
  let tmpSpeed = 0
  console.log(`⏳ * ${rawData} belongs to :`)
  paintings.forEach(element => {
    if (rawData >= element.min && rawData <= element.max) {
      tmpSpeed = element.speed
      // console.log(`✅ * ${element.min} < ${rawData} < ${element.max}`)
      console.log(`💭 * ${element.name} will play`)
    } else {
      // console.log(`❌ * ${element.min} < ${rawData} < ${element.max}`)
    }
  })
  return tmpSpeed
}

const paintSpeed = (waveValue) => {
  let speed = getSpeedPerRange(waveValue)
  setMotorSpeedDirect(speed)
}

const adjustSpeed = (speed) => {
  console.log(speed)
  // HERE WE SET THE MOTOR SPEED
  // WE CEIL THE VALUE TO 2 number behind the dot : 0.6581954509019852 become 0.66
  //
  let motorSpeed = Number((speed * 10).toFixed(2))
  if (motorHat) {
    if (speed < 0.50) {
      // motorSpeed = Number(((0.5 - speed) * 10).toFixed(2))
      motorSpeed = Number((Math.abs(speed - 0.5)).toFixed(3))
      motorSpeed = map(motorSpeed, 0, 0.5, 5, 12)
      motorDirection = 'back'
      //motorHat.dcs[0].setSpeedSync(motorSpeed)
      //motorHat.dcs[0].runSync(motorDirection)
      runSync(motorDirection)
      console.log(motorSpeed)
      setSpeedSync(Number(motorSpeed.toFixed(0)))
    } else if (speed > 0.50) {
      motorSpeed = Number((speed - 0.5).toFixed(2))
      motorDirection = 'fwd'
      //motorHat.dcs[0].setSpeedSync(motorSpeed)
      //motorHat.dcs[0].runSync(motorDirection)
      motorSpeed = map(motorSpeed, 0, 0.5, 5, 12)
      console.log(motorSpeed)
      runSync(motorDirection)
      setSpeedSync(Number(motorSpeed.toFixed(0)))
    } else if (speed === 0.50) {
      console.log('!! STOP MOTOR !!')
      //motorHat.dcs[0].stopSync()
      stopSync()
    }
    console.log(`controlling motor: ${motorDirection}, speed: ${motorSpeed}`)
  } else {
    // THIS IS FOR DEBUG PURPOSE ONLY
    if (speed < 0.50) {
      motorSpeed = Number(((0.5 - speed) * 10).toFixed(2))
      motorDirection = 'back'
    } else if (speed > 0.50) {
      motorSpeed = Number(((speed - 0.5) * 10).toFixed(2))
      motorDirection = 'fwd'
    } else if (speed === 0.50) {
      motorDirection = 'stop'
    }
    console.log(`Motor not available, should set speed to ${motorSpeed} in ${motorDirection}`)
  }
}

;(async () => {
  if (wlan0Interface) {
    localIp = wlan0Interface.address
  } else {
    localIp = await internalIp.v4()
  }
  var udpPort = new osc.UDPPort({
    localAddress: localIp,
    localPort: OSCport,
    metadata: true
  })
  if (motorHat) {
    console.log('Start Motor control over I2C')
    //motorHat.init()
    // default frequency 100, set to 12500
    initMotor(23, 24, 25, 12500)
  } else {
    console.warn('!! no motor available !!')
  }
  // Listen for incoming OSC messages.
  udpPort.on('message', function (oscMsg, timeTag, info) {
    // console.log('An OSC message just arrived!', oscMsg)
    // console.log('Remote info is: ', info)
    OSCTimeLastReceive = Date.now()
    if (oscMsg.address && oscMsg.address.indexOf('absolute') > 1) {
      const waveName = oscMsg.address.split('/').pop().replace('_absolute', '')
      const waveValue = oscMsg.args
      if (oscMsg.address.indexOf(`${mainWave}_absolute`) > 1) {
        const waveList = wave2Array(waveValue)
        // we remove the value which are inferior to -1 and supperior to 1
        const waveValueCutList = waveValueThreshold(waveList, -1, 1)
        // we compute the average 
        const waveValueAverage = average(waveValueCutList)
        
        // we create a buffer by adding the average value in an special array of a limited window
        BufferWave.push(waveValueAverage)

        const SmoothedWave = smoothish(BufferWave.values)
        const SmoothedWave3 = smoothish(BufferWave.values, {radius: 3})

        const waveValueMovingAverage = average(SmoothedWave)

        //console.log(`RAW - ${waveName}: `, waveList)
        //console.log(`---`)
        //console.log(`CUT - ${waveName}: `, waveValueCutList)
        //console.log(`---`)
        //console.log(`RAW AVERAGE- ${waveName}: `, average(waveList))
        //console.log(`---`)
        //console.log(`CUT AVERAGE - ${waveName}: `, waveValueAverage)
        //console.log(`---`)
        const mappedValue = map(waveValueAverage, -1, 1, 0, 1)
        // const mappedValue = map(waveValueMovingAverage, -1, 1, 0, 1)
        console.log(`MAPPED - ${waveName}: `, mappedValue)
        console.log(`---`)
        // here instead of calling adjustSpeed you can call paintSpeed() which use the paintings
        // paintSpeed(waveValueMovingAverage)
        adjustSpeed(mappedValue)
      }
    }
  })
  udpPort.on('ready', function () {
    console.log(`OSC listening on ${localIp}:${OSCport}`)
    OSCOpen = true
  })
  udpPort.on('error', function (error) {
    console.log('An error occurred: ', error.message)
    OSCLastError = error.message
  })
  // Open the socket.
  udpPort.open()

  // response
  app.use(ctx => {
    ctx.body = {
      msg: 'Hello Reve quantique',
      routes: {
        osc: `http://${localIp}:${httpPort}/status/osc`
      },
      conf: {
        localIp,
        OSCport,
        mainWave
      }
    }
  })
  httpServer.listen(httpPort)
  console.log(`http status running on : http://${localIp}:${httpPort}`)
})()
process.stdin.resume()

function exitHandler (options, exitCode) {
  if (motorHat) {
    console.log('reve quantique stop')
    //motorHat.dcs[0].stopSync()
    stopSync()
  } else {
    console.log('reve quantique stop / no motor')
  }
  process.exit()
}

// do something when app is closing
process.on('exit', exitHandler.bind(null, { cleanup: true }))
// catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }))

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }))
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }))

// catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }))