/* global WebSocket */
/* eslint-disable immutable/no-this */
import MicrophoneStream from 'microphone-stream'
import ReadableStream from '../types/microphone-stream'

class Connection {
  connection?: WebSocket
  url: string

  of (url: string) {
    const { connection } = this
    this.connection = connection && connection.readyState === 1
      ? connection
      : new WebSocket(url)
    return this
  }

  get $value () {
    return this.connection
  }

  close() {
    this.connection?.close()
    this.connection = undefined
  }

  map (f: (s: string) => string) {
    this.connection?.close()
    this.connection = new WebSocket(f(this.url))
    return this
  }
}

class MicStream {
  stream: MediaStream
  micStream: ReadableStream
  done: boolean = false

  of (stream: MediaStream) {
    const { micStream } = this
    this.stream = stream
    this.micStream = micStream && !this.done ? micStream : new MicrophoneStream()
    this.done = false
    this.micStream.setStream(stream)
    return this
  }

  get $value () {
    return this.micStream
  }

  stop() {
    if (this.micStream.readable) {
      this.micStream.stop()
      this.done = true
    }
  }

  map (f: (s: MediaStream) => MediaStream) {
    this.micStream.setStream(f(this.stream))
    this.done = false
    return this
  }
}

const connectionInstance = new Connection()
const streamInstance = new MicStream()

export {
  Connection,
  MicStream,
  connectionInstance,
  streamInstance
}
