const cloudant = require('cloudant')
const WebSocket = require('ws')

let db = null
let wss = null
let server = null

let portwebsocket = 8888
let hostcloudant = null
let dbnamecloudant = null

const init = (config, websocketserver) => {
  let cloudantindex = config.TARGET_CLOUDANT.lastIndexOf('/')
  hostcloudant = config.TARGET_CLOUDANT.substring(0, cloudantindex)
  dbnamecloudant = config.TARGET_CLOUDANT.substring(cloudantindex + 1)
  server = websocketserver

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
          if (server) {
            wss = new WebSocket.Server({ server: server })
          } else {
            wss = new WebSocket.Server({ port: portwebsocket })
          }

          wss
            .on('connection', (ws, req) => {
              console.log('websocket connection:', req ? req.connection.remoteAddress : '')
              ws.on('pong', () => {
                console.log('websocket pong')
              })
              ws.send('connection received')
              resolve(true)
            })
            .on('close', (code, reason) => {
              console.log(`websocket closed: ${reason}`)
              resolve(false)
            })
            .on('listening', () => {
              console.log('websocket listening on', wss)
              resolve(true)
            })
            .on('error', err => {
              console.error(err)
              resolve(false)
            })

          if (server) {
            setTimeout(() => {
              resolve(true)
            }, 1000)
          }
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
        // console.log('sendMessage:', msg)
        let data = null
        msg['ts'] = (new Date()).getTime()
        if (wss) {
          data = JSON.stringify(msg)
          console.log('sending data to websocket')

          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(data)
            }
          })
        }

        if (db) {
          data = msg
          console.log('sending data to cloudant')
          db.insert(data, (err, body) => {
            if (err) {
              console.error(err)
              reject(err)
            } else {
              resolve()
            }
          })
        }

        if (!data || !db) {
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

const numConnections = () => {
  let clients = 0
  if (wss) {
    clients = wss.clients.size
  }
  return clients
}

module.exports = {
  init: init,
  send: sendMessage,
  close: close,
  numClients: numConnections
}
