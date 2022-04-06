import pigpio from 'pigpio'
const Gpio = pigpio.Gpio
let frequency = 8000
const HIGH = 1
const LOW = 0
let PWM
let motorUP
let motorDOWN

const initMotor = (in1 = 24, in2 = 23, en = 25, freqParam = 100) => {
  pigpio.configureClock(1, pigpio.CLOCK_PCM)
  motorUP = new Gpio(in1, {mode: Gpio.OUTPUT})
  motorDOWN = new Gpio(in2, {mode: Gpio.OUTPUT})
  PWM = new Gpio(en, {mode: Gpio.OUTPUT})
  PWM.pwmRange(150)
  frequency = freqParam
  motorUP.digitalWrite(LOW)
  motorDOWN.digitalWrite(LOW)
  PWM.pwmFrequency(frequency)
  PWM.pwmWrite(1)
}

const setFrequency = (freqParam) => {
  frequency = freqParam
  PWM.pwmFrequency(frequency)
}

const setRange = (rangeParam) => {
  PWM.pwmRange(rangeParam)
}

const setSpeedSync = speed => {
  PWM.pwmWrite(speed)
}

const runSync = direction => {
  if (direction === 'back') {
    motorUP.digitalWrite(LOW)
    motorDOWN.digitalWrite(HIGH)
  } else if (direction === 'fwd') {
    motorUP.digitalWrite(HIGH)
    motorDOWN.digitalWrite(LOW)
  } else {
    console.warn(`${direction} is not supported by runSync function`)
  }
}

const runForward = () => {
  runSync('fwd')
}

const runBackward = () => {
  runSync('back')
}

const stopSync = () => {
  motorUP.digitalWrite(LOW)
  motorDOWN.digitalWrite(LOW)
}

const terminateGPIO = () => {
  pigpio.terminate()
}

export {initMotor, setFrequency, setRange, setSpeedSync, runSync, runForward, runBackward, stopSync, terminateGPIO}
