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

const start = (route) => {
  // type: 'trip_start'
  // from_coordinates: [<lng>, <lat>],
  // to_coordinates:  [<lng>, <lat>],
  // distance: <number>
  let distance = 0
  for (let i = 0; i < route.length - 1; i++) {
    distance += util.computeDistanceKm(route[i], route[i + 1])
  }

  return {
    'type': 'trip_start',
    'from_coordinates': route[0],
    'to_coordinates': route[route.length - 1],
    'distance': distance
  }
}

const end = (route) => {
  // type: 'trip_end'
  // from_coordinates: [<lng>, <lat>],
  // to_coordinates:  [<lng>, <lat>],
  // distance: <number>
  let distance = 0
  for (let i = 0; i < route.length - 1; i++) {
    distance += util.computeDistanceKm(route[i], route[i + 1])
  }

  return {
    'type': 'trip_end',
    'from_coordinates': route[0],
    'to_coordinates': route[route.length - 1],
    'distance': distance
  }
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
  geoPosition: position
}
