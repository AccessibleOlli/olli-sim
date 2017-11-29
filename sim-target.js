const cloudant = require('cloudant')
const WebSocket = require('ws')

let db = null
let wss = null

let portwebsocket = null
let hostcloudant = null
let dbnamecloudant = null

const configure = (config) => {
  portwebsocket = isNaN(config.TARGET_WS_PORT) ? 8080 : config.TARGET_WS_PORT

  let cloudantindex = config.TARGET_CLOUDANT.lastIndexOf('/')
  hostcloudant = config.TARGET_CLOUDANT.substring(0, cloudantindex)
  dbnamecloudant = config.TARGET_CLOUDANT.substring(cloudantindex + 1)
}

const init = (config) => {
  configure(config)

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
    .then(() => {
      return new Promise((resolve, reject) => {
        if (!wss) {
          wss = new WebSocket.Server({ port: portwebsocket })

          wss
            .on('connection', (ws, req) => {
              console.log('websocket connection:', req ? req.connection.remoteAddress : '')
            })
            .on('close', (code, reason) => {
              console.log(`websocket closed: ${reason}`)
            })
            .on('listening', () => {
              console.log('websocket listening on', portwebsocket)
              resolve(true)
            })
            .on('error', err => {
              console.error(err)
              resolve(false)
            })
        } else {
          resolve(true)
        }
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
        if (wss) {
          data = JSON.stringify(msg)
          console.log('sendMessage to websocket:', data)

          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(data)
            }
          })
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
      if (wss) {
        wss.close(() => {
          console.log('close: websocket terminated')
          wss = null
          return Promise.resolve()
        })
      } else {
        return Promise.resolve()
      }
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
