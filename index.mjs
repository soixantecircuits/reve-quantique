import internalIp from 'internal-ip'
import osc from 'osc'
import { map } from 'map-number'
import isPi from 'detect-rpi'
import Koa from 'koa'
import Router from '@koa/router'

let MotorHat = null
let motorHat = null
;(async () => {
  if (isPi()) {
    MotorHat = await import('motor-hat')
    motorHat = MotorHat({ address: 0x60, dcs: ['M1'] })
  }
})();

let OSCOpen = false
let OSCTimeLastReceive = Date.now()
let OSCLastError = ''
let localIp = ''
let motorSpeed = ''
const httpPort = 8080
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
    motorHat
  }
})

app
  .use(router.routes())
  .use(router.allowedMethods())

app.use(async (ctx, next) => {
  if(parseInt(ctx.status) === 404){
    ctx.status = 404
    ctx.body = {
      msg:'emmmmmmm, seems 404',
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

;(async () => {
  localIp = await internalIp.v4()
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
        // HERE WE SET THE MOTOR SPEED
        // WE CEIL THE VALUE TO 2 number behind the dot : 0.6581954509019852 become 0.66
        //
        motorSpeed = Number((mappedValue * 10).toFixed(2))
        let direction = 'back'
        if (motorHat) {
          console.log('controlling motor')
          motorHat.dcs[0].setSpeedSync(motorSpeed)
          if (mappedValue < 0.50) {
            direction = 'back'
          } else if (mappedValue > 0.50) {
            direction = 'fwd'
          } else if (mappedValue === 0.50) {
            motorHat.dcs[0].stopSync()
          }
          motorHat.dcs[0].runSync(direction)
        } else {
          if (mappedValue < 0.50) {
            direction = 'back'
          } else if (mappedValue > 0.50) {
            direction = 'fwd'
          } else if (mappedValue === 0.50) {
            direction = stop
          }
          console.log(`Motor not available, should set speed to ${motorSpeed} in ${direction}`)
        }
      }
    }
  })
  udpPort.on('ready', function () {
    console.log(`OSC listening on ${localIp}:${OSCport}`)
    OSCOpen = true
  })
  udpPort.on('error', function (error) {
    console.log("An error occurred: ", error.message)
    OSCLastError = error.message
  })
  // Open the socket.
  udpPort.open()

  // response
  app.use(ctx => {
    ctx.body = {
      msg:'Hello Reve quantique',
      routes: {
        osc: `http://${localIp}:${httpPort}/status/osc`,
      },
      conf: {
        localIp,
        OSCport,
        mainWave
      }
    }
  })

  app.listen(httpPort)
  console.log(`http status running on : http://${localIp}:${httpPort}`)
})()
