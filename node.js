/* jshint -W120 */

import crypto from 'crypto'
import { readFileSync, writeFileSync } from 'fs'


export function sha256(x) {
  return crypto.createHash('sha256').update(x, 'utf8').digest('hex')
}

export function readJsonFile(url) {
  return JSON.parse(readFileSync(url, 'utf8'))
}

export function writeJsonFile(url, map) {
  return writeFileSync(url, JSON.stringify(map), 'utf8')
}

export function setNode(nodeMap, dataMap, owner, name, version, datum) {
  const hash = sha256(datum)
  dataMap[hash] = datum

  const names = nodeMap[owner]
  if (typeof names === 'undefined') nodeMap[owner] = {}
  const versions = nodeMap[owner][name]
  if (typeof versions === 'undefined') nodeMap[owner][name] = {}
  nodeMap[owner][name][version] = hash
}

export function getNode(nodeMap, dataMap, owner, name, version) {
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
export function decodeNodeURI(uri, defaultOwner) {
  const defaultVersion = 'unversioned'

  let owner = '', rest = '', name = '', version = ''

  uri = uri.slice(7)
  if (uri.includes('+')) {
    [owner, rest] = uri.split('+')
  } else {
    owner = defaultOwner
    rest = uri
  }

  if (uri.includes(':')) {
    [name, version] = rest.split(':')
  } else {
    name = rest
    version = defaultVersion
  }

  return { owner, name, version }
}

export function encodeFullNodeURI(owner, name, version) {
  return `node://${owner}+${name}:${version}`
}
