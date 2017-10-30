require('dotenv').config()

const util = require('./util.js')
const simevents = require('./sim-events.js')
const simtarget = require('./sim-target.js')
const simsource = require('./sim-source.js')

const LAPS = process.env['simulator_number_of_runs'] || -1
const STOPTIME = process.env['simulator_stop_duration'] || 3
const PRECISION = process.env['simulator_route_precision'] || 3
const INTERVAL = (process.env['simulator_event_interval'] || 3) * 100

let olliroute = null
let ollistops = []
let routepath = []
let trippath = []

simsource.init()
  .then(geojson => {
    ollistops = geojson.stops
    olliroute = geojson.route

    return simtarget.init()
  })
  .then(() => {
    let routestops = ollistops.map(stop => stop.coordinates)
    routepath = util.computePath(olliroute)
    routepath = util.adjustForPrecision(routepath, routestops, PRECISION)

    sendMessage(simevents.routeInfo(olliroute, ollistops))
      .then(() => {
        startSimulator()
      })
  })
  .catch(err => {
    console.error(err)
  })

const sendMessage = msg => {
  return simtarget.send(msg)
}

const startSimulator = () => {
  console.log('Simulator started')
  runSimStep(0, 0)
}

const endSimulator = () => {
  simtarget.close()
    .then(() => {
      console.log('Simulator ended')
      process.exit()
    })
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
}

const runSimStep = (step, run) => {
  if (step < routepath.length) {
    let current = routepath[step]
    let next = current
    let stopIndex = -1

    if (ollistops.length) {
      stopIndex = ollistops.findIndex(stop => {
        return stop.coordinates[0] === current[0] && stop.coordinates[1] === current[1]
      })

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
        .then(() => util.sleep(INTERVAL))
        .then(() => runSimStep(++step, run))
    } else if (stopIndex > -1) {
      sendMessage(simevents.geoPosition(current, trippath))
        .then(() => util.sleep(500))
        .then(() => sendMessage(simevents.tripEnd(trippath, ollistops)))
        .then(() => sendMessage(simevents.doorOpen()))
        .then(() => util.sleep(STOPTIME * 1000))
        .then(() => sendMessage(simevents.doorClose()))
        .then(() => util.sleep(2000))
        .then(() => {
          ++step
          if (step < routepath.length) {
            trippath = computeTripPath(current, next)

            sendMessage(simevents.tripStart(trippath, ollistops))
              .then(() => sendMessage(simevents.geoPosition(current, trippath)))
              .then(() => util.sleep(INTERVAL))
              .then(() => runSimStep(step, run))
          } else {
            runSimStep(step, run)
          }
        })
    } else {
      sendMessage(simevents.geoPosition(current, trippath))
      util.sleep(INTERVAL)
        .then(() => runSimStep(++step, run))
    }
  } else if (LAPS < 1 || ++run < LAPS) {
    runSimStep(0, run)
  } else {
    endSimulator()
  }
}

const computeTripPath = (origin, dest) => {
  let originIndex = routepath.findIndex(path => {
    return path[0] === origin[0] && path[1] === origin[1]
  })

  let destIndex = routepath.findIndex(path => {
    return path[0] === dest[0] && path[1] === dest[1]
  })

  let tripPath = []

  if (destIndex <= 0) {
    tripPath = routepath.slice(originIndex)
    tripPath.push(routepath[0])
  } else {
    tripPath = routepath.slice(originIndex, destIndex + 1)
  }

  return tripPath
}
