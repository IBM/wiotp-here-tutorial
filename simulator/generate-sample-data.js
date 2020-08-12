require('dotenv').config({silent: true})

const fs = require('fs')
const fetch = require('node-fetch')
const fp = require('./lib/flexible-polyline')

const HERE_API_KEY = process.env.HERE_API_KEY

const geocodeBaseUrl = 'https://geocode.search.hereapi.com/v1/geocode'
const routeBaseUrl = 'https://router.hereapi.com/v8/routes?transportMode=car&return=polyline'

const coordinatesRegex = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/

const handleError = function (err) {
  const msg = err.statusText || err.message || err.status
  return Promise.reject(`Request failed: ${msg}`)
}

const handleGeocodeResponse = function (response) {
  return response.json().then(jsonResponse => {
    const position = jsonResponse.items[0].position
    return [position.lat, position.lng]
  })
}

const handleRouteResponse = function (response) {
  return response.json().then(jsonResponse => {
    console.log(`returned ${jsonResponse.routes.length} route(s)`)
    const polylines = jsonResponse.routes[0].sections.map(section => {
      return section.polyline
    })
    return polylines
  })
}

const toGeocode = function (location) {
  let geocode = null

  if (typeof location === 'string' && location.split(',').length === 2) {
    geocode = location
  } else if (Array.isArray(location) && location.length == 2) {
    geocode = location.join(',')
  }

  if (geocode && coordinatesRegex.test(geocode)) {
    return geocode
  } else {
    return null
  }
}

const getAddressGeocode = function (address, options = {}) {
  const location = address && address.trim() ? address.trim() : null
  const apikey = options.hereapikey || HERE_API_KEY

  if (!apikey) {
    return Promise.reject('A HERE Location Services API key is required')
  } else if (!location) {
    return Promise.reject('A valid address is required for geocoding')
  } else {
    console.log(`getting geocode for ${location}`)

    const endpoint = `${geocodeBaseUrl}?q=${encodeURIComponent(location)}&apiKey=${apikey}`
  
    return fetch(endpoint, {
        method: 'get',
        headers: {'Content-Type': 'application/json'}
      })
      .then(response => {
        if (!response.ok) {
          return handleError(response)
        } else {
          return handleGeocodeResponse(response)
        }
      })
  }
}

const getRoutePolyline = function (origin, destination, options = {}) {
  const start = toGeocode(origin)
  const end = toGeocode(destination)
  const apikey = options.hereapikey || HERE_API_KEY

  if (!apikey) {
    return Promise.reject('A HERE Location Services API kei is required')
  } else if (!start || !end) {
    return Promise.reject('A valid origin & destination address is required')
  } else {
    console.log(`getting route from ${start} to ${end}`)

    const endpoint = `${routeBaseUrl}&origin=${start}&destination=${end}&apiKey=${apikey}`
  
    return fetch(endpoint, {
        method: 'get',
        headers: {'Content-Type': 'application/json'}
      })
      .then(response => {
        if (!response.ok) {
          return handleError(response)
        } else {
          return handleRouteResponse(response)
        }
      })
  }
}

const decodePolylines = function (polylines) {
  const coordinates = []

  for (const p of polylines) {
    coordinates.push(...fp.decode(p).polyline.map(l => {
      return {
        lat: l[0],
        lon: l[1]
      }
    }))
  }

  console.log(`routes contains ${coordinates.length} points`)
  return coordinates
}

const writeToFile = function (name, jsonData) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(jsonData, null, 2)
    const fileName = `${name}.json`
    // write JSON string to a file
    fs.writeFile(fileName, data, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve(fileName)
        }
    })
  })
}

// parse command line

const argv = require('yargs')
  .option('origin', {
      alias: 'o',
      description: 'start address'
  })
  .option('destination', {
      alias: 'd',
      description: 'end address'
  })
  .option('file', {
      alias: 'f',
      description: 'output file name'
  })
  .help()
  .alias('help', 'h')
  .argv

// generate sample data

if (argv.origin && argv.destination) {
  let origin = []
  let destination = []
  let fileName = argv.file || 'sample-data'

  Promise.all([getAddressGeocode(argv.origin), getAddressGeocode(argv.destination)])
    .then(geocodes => {
      origin = geocodes[0]
      destination = geocodes[1]
      return getRoutePolyline(origin, destination)
    })
    .then(decodePolylines)
    .then(coordinates => {
      return writeToFile(fileName, coordinates)
    })
    .then(console.log)
    .then(process.exit)
}
