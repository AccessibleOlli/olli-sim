// require('dotenv').config()
const http = require('http')
const env = require('cfenv').getAppEnv()
const path = require('path')
const express = require('express')
const app = express()
const request = require('request')

const simulator = require('./simulator.js')
const server = http.createServer((req,res) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Request-Method', '*');
	res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
	res.setHeader('Access-Control-Allow-Headers', '*');
	if ( req.method === 'OPTIONS' ) {
		res.writeHead(200);
		res.end();
		return;
	}
})

// weather_url should be format of https://username:password@twcservice.mybluemix.net
const weatherURL = process.env['simulator_weather_url'];

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

app.get('/weather/:lat/:lon', (req, res) => {
  if (weatherURL) {
    const url = weatherURL + `/api/weather/v1/geocode/${req.params.lat}/${req.params.lon}/observations.json?units=e&language=en-US`
    request(url, (err, response, body) => {
      console.log(body)
      res.send(body)
    })
  } else {
    res.status(500).send('Weather Service not configured')
  }
})

server.on('request', app)
server.listen(env.port, () => {
  console.log(`To view your app, open this link in your browser: ${env.url}`)
})
