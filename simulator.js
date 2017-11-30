require('dotenv').config()

const DIRECTRUN = require.main === module

const util = require('./util.js')
const simevents = require('./sim-events.js')
const simsource = require('./sim-source.js')
const simtarget = require('./sim-target.js')

let config = {
  LAPS: process.env['simulator_number_of_runs'] || -1,
  STOPTIME: process.env['simulator_stop_duration'] || 3,
  PRECISION: process.env['simulator_route_precision'] || 3,
  INTERVAL: (process.env['simulator_event_interval'] || 3) * 100,
  TARGET_CLOUDANT: process.env['simulator_target_cloudant'] || 'http://127.0.0.1:5984/ollilocation',
  ROUTE_SRC: process.env['simulator_route_source'] || 'data/route.json',
  STOPS_SRC: process.env['simulator_stops_source'] || 'data/stops.json'
}

let olliroute = null
let ollistops = []
let routepath = []
let trippath = []

let paused = false
let started = false
let currentStep = 0
let currentRun = 0

const info = () => {
  let opts = config || {}
  let params = {}

  for (let o in opts) {
    if (typeof opts[o] === 'string' && opts[o].indexOf('://') > -1) {
      let start = opts[o].indexOf('://')
      let end = opts[o].indexOf('/', start + 3)
      let at = opts[o].indexOf('@', start + 3)
      if (at > start && at < end) {
        params[o] = opts[o].substring(0, start + 3) + 'xxxx:xxxx' + opts[o].substring(at)
      }
    } else if (typeof opts[o] === 'string' && !isNaN(opts[o])) {
      params[o] = +opts[o]
    } else {
      params[o] = opts[o]
    }
  }

  let info = {
    started: started,
    paused: paused,
    step: currentStep,
    run: currentRun,
    config: params
  }

  return Promise.resolve(info)
}

const begin = (options, server) => {
  if (started && !paused) {
    return Promise.reject(new Error('Simulator already running'))
  } else {
    let opts = options || {}
    for (let o in opts) {
      config[o] = opts[o]
    }

    return simsource.init(config)
      .then(geojson => {
        ollistops = geojson.stops
        olliroute = geojson.route

        return simtarget.init(config, server)
      })
      .then(() => {
        let routestops = ollistops.map(stop => stop.coordinates)
        routepath = util.computePath(olliroute)
        routepath = util.adjustForPrecision(routepath, routestops, config.PRECISION)

        sendMessage(simevents.routeInfo(olliroute, ollistops))
          .then(() => {
            startSimulator()
            return Promise.resolve()
          })
      })
      .catch(err => {
        console.error(err)
        return Promise.reject(err)
      })
  }
}

const sendMessage = msg => {
  return simtarget.send(msg)
}

const startSimulator = () => {
  paused = false
  started = true
  console.log('Simulator started')
  runSimStep(0, 0)
}

const endSimulator = () => {
  if (!started) {
    return Promise.reject(new Error('Simulator not running'))
  } else {
    paused = false
    return simtarget.close()
      .then(() => {
        console.log('Simulator ended')
        started = false
        if (require.main === module) {
          process.exit()
        } else {
          return Promise.resolve()
        }
      })
      .catch(err => {
        console.error(err)
        started = false

        if (require.main === module) {
          process.exit(1)
        } else {
          return Promise.reject(err)
        }
      })
  }
}

const pauseSimulator = () => {
  return new Promise((resolve, reject) => {
    if (started) {
      console.log('Pausing Simulator')
      paused = true
      return resolve()
    } else {
      console.log('Simulator not started')
      return reject(new Error('Simulator not started'))
    }
  })
}

const continueSimulator = () => {
  return new Promise((resolve, reject) => {
    if (started) {
      if (paused) {
        console.log('Continuing Simulator')
        paused = false
        runSimStep(currentStep, currentRun)
        return resolve()
      } else {
        console.log('Simulator not paused')
        return reject(new Error('Simulator not paused'))
      }
    } else {
      console.log('Simulator not started')
      return reject(new Error('Simulator not started'))
    }
  })
}

const runSimStep = (step, run) => {
  currentStep = step
  currentRun = run

  if (!started) {
    console.log('Simulator not started')
  } else if (paused) {
    console.log('Simulator paused')
  } else if (step < routepath.length) {
    let current = routepath[step]
    let next = current
    let stopIndex = -1

    if (ollistops.length) {
      stopIndex = getStopIndex(current)

      if (stopIndex > -1) {
        if (stopIndex + 1 >= ollistops.length) {
          next = ollistops[0].coordinates || ollistops[0]
        } else {
          next = ollistops[stopIndex + 1].coordinates || ollistops[stopIndex + 1]
        }
      }
    }

    if (step === 0) {
      trippath = computeTripPath(current, next)

      sendMessage(simevents.tripStart(trippath, ollistops))
        .then(() => sendMessage(simevents.geoPosition(current, trippath)))
        .then(() => util.sleep(config.INTERVAL))
        .then(() => runSimStep(++step, run))
    } else if (stopIndex > -1) {
      sendMessage(simevents.geoPosition(current, trippath))
        .then(() => util.sleep(500))
        .then(() => sendMessage(simevents.tripEnd(trippath, ollistops)))
        .then(() => sendMessage(simevents.doorOpen()))
        .then(() => util.sleep(config.STOPTIME * 1000))
        .then(() => sendMessage(simevents.doorClose()))
        .then(() => util.sleep(2000))
        .then(() => {
          ++step
          if (step < routepath.length) {
            trippath = computeTripPath(current, next)

            sendMessage(simevents.tripStart(trippath, ollistops))
              .then(() => sendMessage(simevents.geoPosition(current, trippath)))
              .then(() => util.sleep(config.INTERVAL))
              .then(() => runSimStep(step, run))
          } else {
            runSimStep(step, run)
          }
        })
    } else {
      sendMessage(simevents.geoPosition(current, trippath))
      util.sleep(config.INTERVAL)
        .then(() => runSimStep(++step, run))
    }
  } else if (!DIRECTRUN && simtarget.numClients() < 1 && config.LAPS < 1) {
    // no connections, no need to run infinitely
    endSimulator()
  } else if (config.LAPS < 1 || ++run < config.LAPS) {
    runSimStep(0, run)
  } else {
    endSimulator()
  }
}

const computeTripPath = (origin, dest) => {
  let originIndex = getRouteIndex(origin)
  let destIndex = getRouteIndex(dest)
  let tripPath = []

  if (destIndex <= 0) {
    tripPath = routepath.slice(originIndex)
    tripPath.push(routepath[0])
  } else {
    tripPath = routepath.slice(originIndex, destIndex + 1)
  }

  return tripPath
}

const getStopIndex = (current) => {
  let stopIndex = -1
  if (ollistops.length) {
    stopIndex = ollistops.findIndex(stop => {
      return stop.coordinates[0] === (current.coordinates || current)[0] && stop.coordinates[1] === (current.coordinates || current)[1]
    })
  }
  return stopIndex
}

const getRouteIndex = (current) => {
  let routeIndex = -1
  if (routepath.length) {
    routeIndex = routepath.findIndex(path => {
      return (path.coordinates || path)[0] === (current.coordinates || current)[0] &&
        (path.coordinates || path)[1] === (current.coordinates || current)[1]
    })
  }
  return routeIndex
}

// file is being run directly, instead of loaded using require()
if (DIRECTRUN) {
  begin()
} else {
  module.exports = {
    start: begin,
    stop: endSimulator,
    pause: pauseSimulator,
    continue: continueSimulator,
    info: info
  }
}
