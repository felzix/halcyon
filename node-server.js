const express = require('express')

const node = require('./node')


const app = express()

const bodyParser = require('body-parser');
app.use(bodyParser.text()) // for parsing text
// app.use(bodyParser.json()) // for parsing application/json
// app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

app.use(function(request, response, next) {
  response.header("Access-Control-Allow-Origin", "*")
  response.header("Access-Control-Allow-Methods", "GET,PUT")
  response.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
})

// Lists all owners
app.get('/', (request, response) => {
  const nodeMap = node.readJsonFile('nodes.json')
  const dataMap = node.readJsonFile('data.json')

  const keys = node.listNodes(nodeMap, dataMap)
  if (keys.length === 0) {
    response.status(404).send()
  } else {
    console.log(`GET /`)
    response.send({ nodes: keys })
  }
})

// Lists all names
app.get('/:owner', (request, response) => {
  const { owner } = request.params
  const nodeMap = node.readJsonFile('nodes.json')
  const dataMap = node.readJsonFile('data.json')

  const keys = node.listNodes(nodeMap, dataMap, owner)
  if (keys.length === 0) {
    response.status(404).send()
  } else {
    console.log(`GET /${owner}`)
    response.send({ nodes: keys })
  }
})

// Lists all versions
app.get('/:owner/:name', (request, response) => {
  const { owner, name } = request.params
  const nodeMap = node.readJsonFile('nodes.json')
  const dataMap = node.readJsonFile('data.json')

  const keys = node.listNodes(nodeMap, dataMap, owner, name)
  if (keys.length === 0) {
    response.status(404).send()
  } else {
    console.log(`GET /${owner}/${name}`)
    response.send({ nodes: keys })
  }
})

// Returns node
app.get('/:owner/:name/:version', (request, response) => {
  const { owner, name, version } = request.params
  const nodeMap = node.readJsonFile('nodes.json')
  const dataMap = node.readJsonFile('data.json')

  const datum = node.getNode(nodeMap, dataMap, owner, name, version)
  if (typeof datum === 'undefined') {
    response.status(404).send()
  } else {
    console.log(`GET /${owner}/${name}/${version}`)
    response.send(datum)
  }
})

app.put('/:owner/:name/:version', (request, response) => {
  const { owner, name, version } = request.params
  const datum = request.body
  const nodeMap = node.readJsonFile('nodes.json')
  const dataMap = node.readJsonFile('data.json')

  node.setNode(nodeMap, dataMap, owner, name, version, datum)
  node.writeJsonFile('nodes.json', nodeMap)
  node.writeJsonFile('data.json', dataMap)
  console.log(`PUT /${owner}/${name}/${version}`)
  response.status(204).send()
})

app.listen(41814, () => {
  console.log('node server running on port 41814')
})
