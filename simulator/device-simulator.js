require('dotenv').config({silent: true})

const wiotpSdk = require('@wiotp/sdk')

const DeviceClient = wiotpSdk.DeviceClient
const DeviceConfig = wiotpSdk.DeviceConfig

const defaultConfig = {
  identity: {
    orgId: '<org-id>',
    typeId: '<device-type-id>',
    deviceId: '<device-id>'
  },
  auth: {
    token: '<auth-token>'
  },
  options: {
    domain: 'internetofthings.ibmcloud.com',
    logLevel: 'debug',
    mqtt: {
      port: 8883,
      transport: 'tcp',
      cleanStart: true,
      sessionExpiry: 3600,
      keepAlive: 60,
      // caFile: 'myPath'
    }
  }
}

const delay = function (t) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, t)
  })
}

const getDeviceConfig = function (params) {
  const identity = defaultConfig.identity
  const auth = defaultConfig.auth
  const options = defaultConfig.options

  if (params.orgId) {
    identity.orgId = params.orgId
  }
  if (params.typeId) {
    identity.typeId = params.typeId
  }
  if (params.deviceId) {
    identity.deviceId = params.deviceId
  }
  if (params.authToken) {
    auth.token = params.authToken
  }

  return new DeviceConfig(identity, auth, options)
}

const connectDeviceClient = function (client) {
  return new Promise((resolve, reject) => {
    client.on('connect', () => {
      resolve()
    })

    client.on('close', () => {
      process.exit()
    })

    client.connect()
  })
}

const publishSampleData = async function (client, sampleData, delayInSec = 2) {
  const ms = delayInSec * 1000
  const total = sampleData.length

  console.log(`publishSampleData: sample data contains ${total} data points`)
  console.log(`publishSampleData: sending a data point every ${delayInSec} sec`)

  for (let i = 0; i < total; i++) {
    await delay(i ? ms : 1000)
    console.log(`publishing ${i + 1} of ${total}`)

    client.publishEvent(
      'location',
      'json',
      Object.assign(sampleData[i], { timestamp: (new Date()).getTime() })
    )
  }
}

// parse command line

const argv = require('yargs')
  .command('$0 <file>', 'Simulate sending data', (yargs) => {
    yargs.positional('file', { describe: 'File containing sample data to send' })
  })
  .coerce('file', function (arg) {
    return require('fs').readFileSync(arg, 'utf8')
  })
  .env('WIOTP')
  .option('orgId', {
    alias: 'o',
    description: 'Watson IoT organization ID'
  })
  .option('typeId', {
    alias: 't',
    description: 'Device Type ID'
  })
  .option('deviceId', {
    alias: 'd',
    description: 'Device ID'
  })
  .option('authToken', {
    alias: 'a',
    description: 'Device authentication token'
  })
  .option('rate', {
    alias: 'r',
    description: 'Rate (i.e., every X seconds) to send data',
    default: 2
  })
  .help()
  .alias('help', 'h')
  .argv

// run device simulator

const sampleData = JSON.parse(argv.file)
const deviceConfig = getDeviceConfig(argv)
const deviceClient = new DeviceClient(deviceConfig)

connectDeviceClient(deviceClient)
  .then(() => {
    return publishSampleData(deviceClient, sampleData, argv.rate)
  })
  .then(() => {
    deviceClient.disconnect()
  })
  .catch(e => {
    console.error(e)
    process.exit()
  })
