
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
  // file stream
  if (body.hasOwnProperty('fd')) {
    fs.stat(body.path, function (err, stats) {
      if (err) return done(0)
      done(stats.size)
    })
  }
  // http response
  else if (body.hasOwnProperty('httpVersion')) {
    done(parseInt(body.headers['content-length']))
  }
  // request
  else if (body.hasOwnProperty('httpModule')) {
    body.on('response', function (res) {
      done(parseInt(res.headers['content-length']))
    })
  }
  // request-next
  else if (body.hasOwnProperty('_client')) {
    body.on('response', function (res) {
      done(parseInt(res.headers.get('content-length')) || 0)
    })
  }
  else {
    done(0)
  }
}

// request-multipart
function multipart (body, done) {
  var length = 0, streams = []
  body._items.forEach(function (item) {
    length += sync(item)
    if (item instanceof stream.Stream) {
      streams.push(item)
    }
  })
  if (!streams.length) return done(length)

  var ready = 0
  streams.forEach(function (stream) {
    handle(stream, function () {
      if (++ready === streams.length) {
        done(length)
      }
    })
  })

  function handle (stream, done) {
    if (stream._knownLength) {
      length += stream._knownLength
      done()
    }
    else {
      async(stream, function (len) {
        length += len
        done()
      })
    }
  }
}

exports.sync = sync
exports.async = async
exports.multipart = multipart
