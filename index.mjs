import internalIp from 'internal-ip'
import osc from 'osc'
import { map } from 'map-number'
import isPi from 'detect-rpi'
let MotorHat = null
let motorHat = null
;(async () => {
  if (isPi()) {
    MotorHat = await import('motor-hat')
    motorHat = MotorHat({ address: 0x60, dcs: ['M1'] })
  }
})();

const port = 57121
const mainWave = 'delta'

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

;(async () => {
  const localIp = await internalIp.v4()
  var udpPort = new osc.UDPPort({
    localAddress: localIp,
    localPort: port,
    metadata: true
  })
  if (motorHat) {
    console.log('Start Motor control over I2C')
    motorHat.init()
  } else {
    console.log('no motor available')
  }
  // Listen for incoming OSC messages.
  udpPort.on('message', function (oscMsg, timeTag, info) {
    // console.log('An OSC message just arrived!', oscMsg)
    // console.log('Remote info is: ', info)
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
        const motorSpeed = mappedValue * 10
        let direction = 'back'
        if (motorHat) {
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
    console.log(`OSC listening on ${localIp}:${port}`)
  })
  // Open the socket.
  udpPort.open()
})()
