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
 * @param {Array} from - coordinate of the start point
 * @param {Array} to - coordinate of the end point
 */
const computeDistance = (from, to) => {
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
const getPointsBetween = (from, to, steps) => {
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

      pointsBetween.push([toDegrees(lon3), toDegrees(lat3)])
    }
  }

  return pointsBetween
}

/**
 * Compute full travel path of given route
 *
 * @param {Array} route - array of the coordinates to compute travel path
 * @param {Number} precision - how precise to make the travel path (default: 5)
 * @returns {Array} array of the coordinates of the computed travel path
 */
const computeTravelPath = (route, precision) => {
  let path = [route[0]]
  let current = null
  let next = null
  let steps = null
  let pointsBetween = null

  if (isNaN(precision) || precision < 0) {
    precision = 5
  }

  const stepsFactor = EARTH_RADIUS_KM * (precision * 200)

  for (let i = 0; i < route.length - 1; i++) {
    current = route[i]
    next = route[i + 1]

    steps = computeDistance(current, next) * stepsFactor
    pointsBetween = getPointsBetween(current, next, steps)

    path = path.concat(pointsBetween)
    path.push(next)
  }

  let routePath = [path[0]]
  path.forEach(p => {
    if (p[0] !== routePath[routePath.length - 1][0] || p[1] !== routePath[routePath.length - 1][1]) {
      routePath.push(p)
    }
  })

  return routePath
}

module.exports = {
  sleep: sleepTimer,
  computePath: computeTravelPath,
  computeDistance: computeDistance,
  computeDistanceKm: function (from, to) {
    return computeDistance(from, to) * EARTH_RADIUS_KM
  }
}
