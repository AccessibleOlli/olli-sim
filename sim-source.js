const request = require('request')
const fs = require('fs')
const path = require('path')

const ROUTE_SRC = process.env['simulator_route_source'] || 'data/route.json'
const STOPS_SRC = process.env['simulator_stops_source'] || 'data/stops.json'

let routeCoordinates = null
// let stopsCoordinates = null
let stops = null

const init = () => {
  const getRoute = ROUTE_SRC.startsWith('http') ? getFromURL : getFromFile
  const getStops = STOPS_SRC.startsWith('http') ? getFromURL : getFromFile

  return Promise.all([getRoute(ROUTE_SRC), getStops(STOPS_SRC)])
    .then(sources => {
      if (!sources[0] && !sources[1]) {
        console.warn('route and stops sources not found')
        return Promise.reject(new Error('route and stops sources not found'))
      } else {
        initRoute(sources[0], sources[1])
        initStops(sources[0], sources[1])
      }

      console.log(`loaded route with ${routeCoordinates.length} coordinates`)
      console.log(`loaded ${stops.length} stops`)

      return Promise.resolve({
        route: routeCoordinates,
        stops: stops
      })
    })
}

const initRoute = (routeJson, stopsJson) => {
  let coordinates = []

  if (routeJson && routeJson.type === 'FeatureCollection') {
    let features = routeJson.features
    features.forEach(f => {
      if (f.geometry) {
        if (f.geometry.type === 'Point') {
          if (f.properties) {
            coordinates.push({
              coordinates: f.geometry.coordinates,
              properties: f.properties
            })
          } else {
            coordinates.push(f.geometry.coordinates)
          }
        } else if (f.geometry.type === 'LineString') {
          coordinates = coordinates.concat(f.geometry.coordinates)
        }
      }
    })
  } else if (stopsJson && stopsJson.routeCoordinates) {
    coordinates = stopsJson.routeCoordinates
  }

  routeCoordinates = coordinates
}

const initStops = (routeJson, stopsJson) => {
  let stopsData = []
  if (stopsJson) {
    if (stopsJson.type === 'FeatureCollection') {
      let features = stopsJson.features
      features.forEach(f => {
        if (f.geometry) {
          let s = f.properties
          s['coordinates'] = f.geometry.coordinates
          stopsData.push(s)
        }
      })
    } else if (stopsJson.stops) {
      const stopsKeys = Object.keys(stopsJson.stops)
      for (let i = 0; i < stopsKeys.length; i++) {
        let s = stopsJson.stops[stopsKeys[i]]
        stopsData.push({
          name: stopsKeys[i],
          description: s.description,
          poi: s.poi,
          coordinates: s.coordinates
        })
      }
    }
  }

  stops = stopsData
  // stopsCoordinates = stops.map(stop => {
  //   return stop.coordinates
  // })
}

const getFromURL = (srcUrl) => {
  return Promise.resolve()
    .then(() => {
      return new Promise((resolve, reject) => {
        request.get({url: srcUrl}, (err, response, body) => {
          if (err) {
            console.error(err)
            resolve(false)
          } else {
            console.log(`${srcUrl} has been retrieved`)
            resolve(JSON.parse(body))
          }
        })
      })
    })
    .catch(err => {
      console.error(err)
      return Promise.resolve(false)
    })
}

const getFromFile = (filePath) => {
  return Promise.resolve()
    .then(() => {
      return new Promise((resolve, reject) => {
        let filepath = filePath
        if (filePath.startsWith('file://')) {
          filepath = filePath.substring(7)
        } else {
          filepath = path.join(__dirname, filePath)
        }
        let body = fs.readFileSync(filepath, 'utf-8')
        console.log(`file ${filepath} has been read`)
        resolve(JSON.parse(body))
      })
    })
    .catch(err => {
      console.error(err)
      return Promise.resolve(false)
    })
}

module.exports = {
  init: init,
  route: routeCoordinates,
  stops: stops
}
