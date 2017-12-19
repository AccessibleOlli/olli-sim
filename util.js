const EARTH_RADIUS_KM = 6371.0088

const sleepTimer = (ms) => {
  return new Promise((resolve, reject) => setTimeout(resolve, ms))
}

const toRadians = (degrees) => {
  return degrees * Math.PI / 180
}

const toDegrees = (radians) => {
  return radians * 180 / Math.PI
}

/**
 * Compute distance (in radians) between two coordinates
 *
 * @param {Array|Object} fromPoint - the start point
 * @param {Array|Object} toPoint - the end point
 */
const computeDistance = (fromPoint, toPoint) => {
  const from = Array.isArray(fromPoint) ? fromPoint : fromPoint.coordinates
  const to = Array.isArray(toPoint) ? toPoint : toPoint.coordinates

  const lat1 = toRadians(from[1])
  const lat2 = toRadians(to[1])
  const deltaLat = toRadians(to[1] - from[1])
  const deltaLon = toRadians(to[0] - from[0])

  let a = Math.pow(Math.sin(deltaLat / 2), 2) +
        Math.pow(Math.sin(deltaLon / 2), 2) * Math.cos(lat1) * Math.cos(lat2)

  return (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

/**
 * JavaScript version of the `pointsBetween` method found here:
 *
 *   https://github.com/cammace/mapbox-utils-android/blob/master/lib/src/main/java/com/mapbox/utils/MathUtil.java#L70
 *
 * @param {Array} from - the coordinates of the start point (i.e., [<lng>, <lat>])
 * @param {Array} to - the coordinates of the end point (i.e., [<lng>, <lat>])
 * @param {number} steps - number of points between start and end to compute
 * @returns {Array} array of the coordinates of the computed points
 */
const getPointsBetween = (fromPoint, toPoint, steps) => {
  const from = Array.isArray(fromPoint) ? fromPoint : fromPoint.coordinates
  const to = Array.isArray(toPoint) ? toPoint : toPoint.coordinates
  let pointsBetween = []

  if (from[0] === to[0] && from[1] === to[1]) {
    pointsBetween.push(from)
  } else {
    for (let i = 0; i < steps; i++) {
      let lat1 = toRadians(from[1])
      let lon1 = toRadians(from[0])
      let lat2 = toRadians(to[1])
      let lon2 = toRadians(to[0])

      let f = i * (1 / steps)

      let distance = computeDistance(from, to)

      let a = Math.sin((1 - f) * distance) / Math.sin(distance)
      let b = Math.sin(f * distance) / Math.sin(distance)
      let x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2)
      let y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2)
      let z = a * Math.sin(lat1) + b * Math.sin(lat2)
      let lat3 = Math.atan2(z, Math.sqrt((x * x) + (y * y)))
      let lon3 = Math.atan2(y, x)

      if (from.length > 2) {
        if (fromPoint.properties) {
          pointsBetween.push({
            coordinates: [toDegrees(lon3), toDegrees(lat3), from[2]],
            properties: fromPoint.properties
          })
        } else {
          pointsBetween.push([toDegrees(lon3), toDegrees(lat3), from[2]])
        }
      } else {
        if (fromPoint.properties) {
          pointsBetween.push({
            coordinates: [toDegrees(lon3), toDegrees(lat3)],
            properties: fromPoint.properties
          })
        } else {
          pointsBetween.push([toDegrees(lon3), toDegrees(lat3)])
        }
      }
    }
  }

  return pointsBetween
}

/**
 * Compute full travel path of given route
 *
 * @param {Array} route - array of the coordinates to compute travel path
 * @returns {Array} array of the coordinates of the computed travel path
 */
const computeTravelPath = (route) => {
  let routePath = []
  let path = [route[0]]
  let current = null
  let next = null
  let steps = null
  let pointsBetween = null
  let distance = 0

  for (let i = 0; i < route.length - 1; i++) {
    current = route[i]
    next = route[i + 1]

    distance = computeDistance(current, next) * EARTH_RADIUS_KM * 1000
    steps = Math.round(3 * distance)

    pointsBetween = getPointsBetween(current, next, steps)

    path = path.concat(pointsBetween)
    path.push(next)
  }

  routePath = [path[0]]
  path.forEach(p => {
    let r = (routePath[routePath.length - 1].coordinates || routePath[routePath.length - 1])
    if ((p.coordinates || p)[0] !== r[0] || (p.coordinates || p)[1] !== r[1]) {
      routePath.push(p)
    }
  })

  console.log(`expanded route from ${route.length} to ${routePath.length} coordinates`)
  return routePath
}

/**
 * Adjust the travel path for the given frequency
 *
 * @param {Array} path - array of the coordinates of the travel path
 * @param {Array} stops - array of the stop coordinates
 * @param {Number} precision - the precision factor
 * @returns {Array} array of the coordinates of the adjusted travel path
 */
const computePrecisionPath = (path, stops, precision) => {
  let adjusted = []

  if (isNaN(precision) || precision <= 0) {
    adjusted = path
  } else {
    const last = path.length - 1
    let dist = 0
    adjusted = path.filter((p, i) => {
      if (i === 0 || i === last) {
        return true
      }

      const atStop = stops.some(s => {
        return (s.coordinates || s)[0] === (p.coordinates || p)[0] && (s.coordinates || s)[1] === (p.coordinates || p)[1]
      })

      if (atStop) {
        dist = 0
        return true
      }

      dist += computeDistance(p, path[i + 1]) * EARTH_RADIUS_KM * 1000

      // if (i % (precision * 5) === 0) {
      if (dist >= precision) {
        // console.log(dist)
        dist = 0
        return true
      }

      return false
    })
  }

  console.log(`adjusted route from ${path.length} to ${adjusted.length} coordinates with precision=${precision}`)
  return adjusted
}

const getCoordinatesIndex = (coordsArray, current) => {
  let coordsIndex = -1
  if (coordsArray.length) {
    coordsIndex = coordsArray.findIndex(stop => {
      return stop.coordinates[0] === (current.coordinates || current)[0] && stop.coordinates[1] === (current.coordinates || current)[1]
    })
  }
  return coordsIndex
}

module.exports = {
  sleep: sleepTimer,
  computePath: computeTravelPath,
  adjustForPrecision: computePrecisionPath,
  computeDistance: computeDistance,
  computeDistanceKm: function (from, to) {
    return computeDistance(from, to) * EARTH_RADIUS_KM
  },
  coordinatesIndex: getCoordinatesIndex
}
