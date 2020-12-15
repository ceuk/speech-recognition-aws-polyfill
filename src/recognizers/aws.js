/* global console */
/* eslint-disable immutable/no-this */
import { invoker } from 'ramda'
import { Connection } from '../lib/cacheContainers'
import getUserMedia from 'get-user-media-promise'
import { getCredentials, getSignedURL, streamAudioToWebSocket } from '../lib/transcribeAudioAWS'

class AWSRecognizer {
  static get isSupported () {
    return getUserMedia.isSupported
  }

  static get type () {
    return 'AWS'
  }

  constructor (config) {
    if (!config.IdentityPoolId || !config.region) throw new Error('Could not create AWS recognizer: missing configuration, see: https://github.com/ceuk/speech-recognition-aws-polyfill#configuration')
    const defaults = {
      sampleRate: 12000
    }
    this.config = Object.assign(defaults, config)
  }

  async start () {
    this.stream = await getUserMedia({ audio: true, video: false })
    return this.stream
  }

  async stop () {
    this.stream
      .getTracks()
      .forEach(invoker(0, 'stop'))
  }

  async transcribe () {
    const { IdentityPoolId, region, sampleRate } = this.config
    const credentials = await getCredentials({ IdentityPoolId, region })
    const url = getSignedURL({ IdentityPoolId, region, sampleRate, credentials })
    const connection = Connection.of(url).$value
    try {
      const transcription = await streamAudioToWebSocket({ stream: this.stream, socket: connection, sampleRate: this.config.sampleRate })
      this.stop()
      return transcription
    } catch (error) {
      console.error(error)
    }
  }
}

export default AWSRecognizer
