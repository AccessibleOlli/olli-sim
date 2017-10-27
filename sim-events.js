const util = require('./util.js')

const open = () => {
  // type: 'door_open'
  return {
    'type': 'door_open'
  }
}

const close = () => {
  // type: 'door_close'
  return {
    'type': 'door_close'
  }
}

const routeInfo = (route, stops) => {
  // type: 'route_info'
  // coordinates: [<coordinates>],
  // stops:  [<stops>],
  // distance: <number>
  let distance = 0
  for (let i = 0; i < route.length - 1; i++) {
    distance += util.computeDistanceKm(route[i], route[i + 1])
  }

  return {
    'type': 'route_info',
    'coordinates': route,
    'stops': stops,
    'distance': distance
  }
}

const start = (route, stops) => {
  // type: 'trip_start'
  // from_coordinates: [<lng>, <lat>],
  // to_coordinates:  [<lng>, <lat>],
  // from_stop: <stop>,
  // to_stop: <stop>,
  // distance: <number>
  let distance = 0
  for (let i = 0; i < route.length - 1; i++) {
    distance += util.computeDistanceKm(route[i], route[i + 1])
  }

  const fromCoord = route[0]
  const toCoord = route[route.length - 1]

  let event = {
    'type': 'trip_start',
    'from_coordinates': fromCoord,
    'to_coordinates': toCoord,
    'distance': distance
  }

  if (stops) {
    const fromStop = stops.filter(stop => {
      return stop.coordinates[0] === fromCoord[0] &&
        stop.coordinates[1] === fromCoord[1]
    })
    const toStop = stops.filter(stop => {
      return stop.coordinates[0] === toCoord[0] &&
        stop.coordinates[1] === toCoord[1]
    })

    event['from_stop'] = fromStop[0]
    event['to_stop'] = toStop[0]
  }

  return event
}

const end = (route, stops) => {
  // type: 'trip_end'
  // from_coordinates: [<lng>, <lat>],
  // to_coordinates:  [<lng>, <lat>],
  // from_stop: <stop>,
  // to_stop: <stop>,
  // distance: <number>
  let event = start(route, stops)
  event.type = 'trip_end'

  return event
}

const position = (lng, lat, route) => {
  // type: 'geo_position'
  // coordinates: [<lng>, <lat>],
  // distance_travelled: <number>,
  // distance_remaining: <number>
  let travelled = -1
  let remaining = -1

  if (route && route.length) {
    travelled = 0
    remaining = 0
    let dest = false

    for (let i = 0; i < route.length - 1; i++) {
      if (route[i][0] === lng && route[i][1] === lat) {
        dest = true
      }
      if (dest) {
        remaining += util.computeDistanceKm(route[i], route[i + 1])
      } else {
        travelled += util.computeDistanceKm(route[i], route[i + 1])
      }
    }
  }

  return {
    'type': 'geo_position',
    'coordinates': [lng, lat],
    'distance_travelled': travelled,
    'distance_remaining': remaining
  }
}

module.exports = {
  tripStart: start,
  tripEnd: end,
  doorOpen: open,
  doorClose: close,
  geoPosition: position,
  routeInfo: routeInfo
}
