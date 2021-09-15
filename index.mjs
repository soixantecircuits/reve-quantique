import internalIp from 'internal-ip'
import address from 'address'
import osc from 'osc'
import { map } from 'map-number'
import Koa from 'koa'
import Router from '@koa/router'
import { createServer } from 'http'
import { Server } from 'socket.io'
import serve from 'koa-static-server'
import path from 'path'

import MotorHat from 'motor-hat'
const motorHat = MotorHat({ address: 0x60, dcs: ['M1'] })
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

io.on('connection', socket => { 
  console.log('a connection occured')
  socket.on('speed', (arg) => {
    adjustSpeed(arg)
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

const adjustSpeed = (speed) => {
  console.log(speed)
  // HERE WE SET THE MOTOR SPEED
  // WE CEIL THE VALUE TO 2 number behind the dot : 0.6581954509019852 become 0.66
  //
  let motorSpeed = Number((speed * 10).toFixed(2))
  if (motorHat) {
    if (speed < 0.50) {
      motorSpeed = Number(((0.5 - speed) * 10).toFixed(2))
      motorDirection = 'back'
      motorHat.dcs[0].setSpeedSync(motorSpeed)
      motorHat.dcs[0].runSync(motorDirection)
    } else if (speed > 0.50) {
      motorSpeed = Number(((speed - 0.5) * 10).toFixed(2))
      motorDirection = 'fwd'
      motorHat.dcs[0].setSpeedSync(motorSpeed)
      motorHat.dcs[0].runSync(motorDirection)
    } else if (speed === 0.50) {
      console.log('!! STOP MOTOR !!')
      motorHat.dcs[0].stopSync()
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
    motorHat.init()
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
        const waveValueCutList = waveValueThreshold(waveList, -1, 1)
        const waveValueAverage = average(waveValueCutList)

        console.log(`RAW - ${waveName}: `, waveList)
        console.log(`---`)
        console.log(`CUT - ${waveName}: `, waveValueCutList)
        console.log(`---`)
        console.log(`RAW AVERAGE- ${waveName}: `, average(waveList))
        console.log(`---`)
        console.log(`CUT AVERAGE - ${waveName}: `, waveValueAverage)
        console.log(`---`)
        const mappedValue = map(waveValueAverage, -1, 1, 0, 1)
        console.log(`MAPPED - ${waveName}: `, mappedValue)
        console.log(`---`)
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
    motorHat.dcs[0].stopSync()
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
