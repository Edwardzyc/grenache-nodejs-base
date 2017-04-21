'use strict'

const _ = require('lodash')
const uuid = require('uuid')
const Transport = require('./Transport')

class TransportRPC extends Transport {

  constructor(client, conf) {
    super(client, conf)

    if (!this.conf.timeout) {
      this.conf.timeout = 10000
    }
  }

  init() {
    super.init()

    this._reqs = new Map()

    setInterval(() => {
      this.monitor()
    }, this.conf.timeout)
  }

  newRequest(key, payload, _opts, cb) {
    const rid = uuid.v4()
    const opts = _.extend({
      timeout: this.conf.timeout
    }, _opts)

    const req = {
      rid: rid,
      key: key,
      payload: payload,
      opts: opts,
      cb: cb,
      _ts: (new Date()).getTime()
    }

    return req
  }

  addRequest(req) {
    this._reqs.set(req.rid, req)
  }

  delRequest(req) {
    this._reqs.delete(req.rid)
  }

  getRequest(rid) {
    return this._reqs.get(rid)
  }

  handleRequest(handler, data) {
    if (!data) {
      this.emit('request-error')
      return
    }

    const rid = data[0]
    const key = data[1]
    const payload = data[2]

    this.emit(
      'request', rid, key, payload,
      {
        reply: res => {
          handler.reply(rid, res)
        }
      }
    )
  }

  handleReply(rid, data) {
    const req = this.getRequest(rid)
    if (!req) return

    this.delRequest(req)

    const now = new Date()
    let err = null

    if (_.isString(data) && _.startsWith(data, 'ERR_')) {
      err = data
      data = null
    }

    if (_.isFunction(req.cb)) {
      req.cb(err, data)
    }
  }

  parse(data) {
    try {
      data = JSON.parse(data)
    } catch(e) {
      data = null
    }

    return data
  }

  format(data) {
    return JSON.stringify(data)
  }

  monitor() {
    const now = (new Date()).getTime()
    this._reqs.forEach(req => {
      if (now > req._ts + req.opts.timeout) {
        this.handleReply(req.rid, 'ERR_TIMEOUT')
      }
    })
  }
}

module.exports = TransportRPC