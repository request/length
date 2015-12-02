
var fs = require('fs')
var stream = require('stream')


function sync (body) {
  var length = 0
  if (typeof body === 'string') {
    length = Buffer.byteLength(body)
  }
  else if (Array.isArray(body)) {
    length = body.reduce(function (a, b) {return a + b.length}, 0)
  }
  else if (Buffer.isBuffer(body)) {
    length = body.length
  }

  return length
}

function async (body, done) {
  _async(body, function (err, length) {
    if (err) {
      done(err)
    }
    else if (!length) {
      done(new Error('Content length not available'))
    }
    else {
      done(null, parseInt(length))
    }
  })
}

function _async (body, done) {
  // file stream
  if (body.hasOwnProperty('fd')) {
    fs.stat(body.path, function (err, stats) {
      done(err, stats.size)
    })
  }
  // http response
  else if (body.hasOwnProperty('httpVersion')) {
    done(null, body.headers['content-length'])
  }
  // request
  else if (body.hasOwnProperty('httpModule')) {
    body.on('response', function (res) {
      done(null, res.headers['content-length'])
    })
  }
  // @request/core
  else if (body.hasOwnProperty('_client')) {
    body.on('response', function (res) {
      done(null, res.headers.get('content-length'))
    })
  }
  else {
    done(new Error('Content length not available'))
  }
}

// @request/multipart
function multipart (body, done) {
  var length = 0, streams = []
  body._items.forEach(function (item) {
    length += sync(item)
    if (item instanceof stream.Stream) {
      streams.push(item)
    }
  })
  if (!streams.length) return done(null, length)

  var ready = 0, error
  streams.forEach(function (stream) {
    handle(stream, function (err, len) {
      if (err) {
        error = err
      }
      else {
        length += len
      }
      if (++ready === streams.length) {
        done(error, length)
      }
    })
  })

  function handle (stream, done) {
    if (stream._knownLength) {
      done(null, stream._knownLength)
    }
    else {
      async(stream, done)
    }
  }
}

exports.sync = sync
exports.async = async
exports.multipart = multipart
