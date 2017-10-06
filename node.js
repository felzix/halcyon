/* jshint -W120 */

const crypto = require('crypto')
const {readFileSync, writeFileSync } = require('fs')

module.exports = {}

function sha256(x) {
  return crypto.createHash('sha256').update(x, 'utf8').digest('hex')
}
module.exports.sha256 = sha256

module.exports.readJsonFile = url => {
  const raw = readFileSync(url, 'utf8')
  return JSON.parse(raw)
}

module.exports.writeJsonFile = (url, map) => {
  return writeFileSync(url, JSON.stringify(map), 'utf8')
}

module.exports.setNode = (nodeMap, dataMap, owner, name, version, datum) => {
  const hash = sha256(datum)
  dataMap[hash] = datum

  const names = nodeMap[owner]
  if (typeof names === 'undefined') nodeMap[owner] = {}
  const versions = nodeMap[owner][name]
  if (typeof versions === 'undefined') nodeMap[owner][name] = {}
  nodeMap[owner][name][version] = hash
}

module.exports.getNode = (nodeMap, dataMap, owner, name, version) => {
  const hash = getNodeHash(nodeMap, owner, name, version)
  if (typeof hash !== 'undefined') {
    return dataMap[hash]
  }
}

function getNodeHash(nodeMap, owner, name, version) {
  try {
    return nodeMap[owner][name][version]
  } catch (err) {
    if (err instanceof TypeError) {  // new node!
      return
    }
    throw(err)
  }
}

function unhash(dataMap, hash) {
  if (dataMap.hasOwnProperty(hash)) {
    return dataMap[hash]
  } else {
    return null
  }
}

/*
 * uri: node://[owner+]name[:version][#...]
        (note that `name` is mandatory)
 */
module.exports.decodeNodeURI = (uri, defaultOwner) => {
  const defaultVersion = 'unversioned'

  let owner = '', rest = '', name = '', version = ''

  const urn = uri.slice(7)
  return decodeNodeURN(urn, defaultOwner, defaultVersion)
}

function decodeNodeURN(urn, defaultOwner, defaultVersion) {
  let owner = defaultOwner, rest = '', name = '', version = defaultVersion

  if (urn.includes('+')) {
    [owner, rest] = urn.split('+')
  } else {
    rest = urn
  }

  if (urn.includes(':')) {
    [name, version] = rest.split(':')
  } else {
    name = rest
  }

  return { owner, name, version }
}
module.exports.decodeNodeURN = decodeNodeURN

module.exports.encodeFullNodeURI = (owner, name, version) => {
  return `node://${owner}+${name}:${version}`
}
