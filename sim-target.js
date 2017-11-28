const net = require('net')
const cloudant = require('cloudant')

// let config = {
//   TARGET_SOCKET: process.env['simulator_target_websocket'] || '127.0.0.1:8000',
//   TARGET_CLOUDANT: process.env['simulator_target_cloudant'] || 'http://127.0.0.1:5984/ollilocation'
// }

let db = null
let conn = null

let hostwebsocket = null
let portwebsocket = null

let hostcloudant = null
let dbnamecloudant = null

const setConfig = (config) => {
  let websocket = config.TARGET_SOCKET.split(':')
  hostwebsocket = websocket[0]
  portwebsocket = websocket.length > 1 ? Number(websocket[1]) : '8000'

  let cloudantindex = config.TARGET_CLOUDANT.lastIndexOf('/')
  hostcloudant = config.TARGET_CLOUDANT.substring(0, cloudantindex)
  dbnamecloudant = config.TARGET_CLOUDANT.substring(cloudantindex + 1)
}

const init = options => {
  let opts = options || {}

  setConfig(opts)

  return Promise.all([initCloudant(), initSocket()])
    .then(connections => {
      if (!connections[0] && !connections[1]) {
        console.warn('no cloudant or web socket connection established')
      }
      return Promise.resolve()
    })
}

const initCloudant = () => {
  db = null
  return Promise.resolve()
    .then(() => {
      return new Promise((resolve, reject) => {
        console.log(`trying to access db at ${hostcloudant}/${dbnamecloudant}`)
        let c = cloudant(hostcloudant)
        c.db.get(dbnamecloudant, (err, body) => {
          if (err) {
            console.error(err)
            resolve(false)
          } else {
            console.log(`accessed db at ${hostcloudant}/${dbnamecloudant}`)
            console.log(body)
            db = c.db.use(dbnamecloudant)
            resolve(true)
          }
        })
      })
    })
    .catch(err => {
      console.error(err)
      db = null
      return Promise.resolve(false)
    })
}

const initSocket = (retryCount) => {
  return Promise.resolve()
    .then(() => close)
    .then(() => {
      console.log(`trying to establish connection to ${hostwebsocket}:${portwebsocket}`)
      conn = net.createConnection(portwebsocket, hostwebsocket)
      return new Promise((resolve, reject) => {
        conn
          .on('connect', () => {
            console.log(`established connection to ${hostwebsocket}:${portwebsocket}`)
            resolve(true)
          })
          .on('close', hadError => {
            console.log(`connection to ${hostwebsocket}:${portwebsocket} closed`)
            conn = null
            resolve(false)
          })
          .on('error', err => {
            console.error(err)
            resolve(false)
          })
      })
    })
    .catch(err => {
      console.error(err)
      return Promise.resolve(false)
    })
}

const sendMessage = (msg) => {
  return Promise.resolve()
    .then(() => {
      return new Promise((resolve, reject) => {
        let data = null
        msg['ts'] = (new Date()).getTime()
        if (conn) {
          data = JSON.stringify(msg)
          console.log('sendMessage to websocket:', data)
          conn.write(Buffer.from(data))
        }

        if (db) {
          data = msg
          console.log('sendMessage to cloudant: ', JSON.stringify(data))
          db.insert(data, (err, body) => {
            if (err) {
              console.error(err)
              reject(err)
            } else {
              resolve()
            }
          })
        }

        if (!data) {
          console.log('no connection to send message: ', JSON.stringify(msg))
          resolve()
        }
      })
    })
    .catch(err => {
      console.error(err)
      return Promise.reject(err)
    })
}

const close = () => {
  return Promise.resolve()
    .then(() => {
      if (conn) {
        conn.destroy()
        conn = null
      }
      console.log('close: connections terminated')
      return Promise.resolve()
    })
    .catch(err => {
      console.error(err)
      return Promise.reject(err)
    })
}

module.exports = {
  init: init,
  send: sendMessage,
  close: close
}
