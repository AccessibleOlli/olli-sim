// require('dotenv').config()
const server = require('http').createServer()
const env = require('cfenv').getAppEnv()
const path = require('path')
const express = require('express')
const app = express()

const simulator = require('./simulator.js')

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/index.html'))
})

app.get('/start', (req, res) => {
  simulator.start(null, server)
    .then(() => {
      res.send('Started simulator')
    })
    .catch(err => {
      console.error(err)
      res.status(500).send(`Error starting Simulator: ${err.message || err}`)
    })
})

app.get('/stop', (req, res) => {
  simulator.stop()
    .then(() => {
      res.send('Stopped simulator')
    })
    .catch(err => {
      console.error(err)
      res.status(500).send(`Error stopping Simulator: ${err.message || err}`)
    })
})

app.get('/pause', (req, res) => {
  simulator.pause()
    .then(() => {
      res.send('Paused simulator')
    })
    .catch(err => {
      console.error(err)
      res.status(500).send(`Error pausing Simulator: ${err.message || err}`)
    })
})

app.get('/continue', (req, res) => {
  simulator.continue()
    .then(() => {
      res.send('Continued simulator')
    })
    .catch(err => {
      console.error(err)
      res.status(500).send(`Error continuing Simulator: ${err.message || err}`)
    })
})

app.get('/info', (req, res) => {
  simulator.info()
    .then(info => {
      res.send(info)
    })
    .catch(err => {
      console.error(err)
      res.status(500).send(`Error getting Simulator info: ${err.message || err}`)
    })
})

server.on('request', app)
server.listen(env.port, () => {
  console.log(`To view your app, open this link in your browser: ${env.url}`)
})
