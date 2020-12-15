/* global WebSocket */
/* eslint-disable immutable/no-this */
import MicrophoneStream from 'microphone-stream'

class CConnection {
  of (url) {
    const { connection } = this
    this.connection = connection && connection.readyState === 1
      ? connection
      : new WebSocket(url)
    return this
  }

  get $value () {
    return this.connection
  }

  map (f) {
    this.connection?.close()
    this.connection = new WebSocket(f(this.url))
    return this
  }
}

class CMicStream {
  of (stream) {
    const { micStream } = this
    this.stream = stream
    this.micStream = micStream || new MicrophoneStream()
    this.micStream.setStream(stream)
    return this
  }

  get $value () {
    return this.micStream
  }

  map (f) {
    this.micStream.setStream(f(this.stream))
    return this
  }
}

const Connection = new CConnection()
const MicStream = new CMicStream()

export {
  Connection,
  MicStream
}
