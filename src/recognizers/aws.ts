/* eslint-disable immutable/no-this */
import { connectionInstance, streamInstance } from '../lib/cacheContainers'
import { getCredentials, getSignedURL, streamAudioToWebSocket } from '../lib/transcribeAudioAWS'
import { Config, AWSSpeechRecognitionEvent, ListenerCallback } from '../types/shared'
import {Credentials} from 'aws-sdk'
import { CustomEventTarget } from '../lib/customEventTarget'


function stopStream(stream?:MediaStream) {
  if (!stream) return
  stream.getTracks().forEach(track => track.stop())
  streamInstance.stop()
  return stream
}

class AWSRecognizer extends CustomEventTarget {
  config: Config
  stream?: MediaStream
  listening: boolean = false

  static get isSupported () {
    return !!navigator?.mediaDevices?.getUserMedia
  }

  static get type () {
    return 'AWS'
  }

  constructor (config: Config) {
    super()
    if (!config.IdentityPoolId || !config.region) throw new Error('Could not create AWS recognizer: missing configuration, see: https://github.com/ceuk/speech-recognition-aws-polyfill#configuration')
    const defaults = {
      sampleRate: 12000,
      lang: 'en-US'
    }
    this.config = Object.assign(defaults, config)
    this.lang = this.config.lang
  }

  start() {
    if (this.listening) return
    this.dispatchEvent(new Event('start'))
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then((stream) => {
        this.stream = stream
        this.listening = true
        this.dispatchEvent(new Event('audiostart'))
        this.transcribe()
      })
      .catch(err => {
        this.stream = undefined
        this.listening = false
        this.emitError(err)
      });
  }

  abort() {
    if (this.listening) {
      stopStream(this.stream)
      connectionInstance.close()
      this.listening = false
      this.dispatchEvent(new Event('audioend'))
    }
  }

  stop() {
    stopStream(this.stream)
    connectionInstance.close()
    this.listening = false
    this.dispatchEvent(new Event('audioend'))
  }

  set lang(lang:Config['lang']) {
    this.lang = lang
    this.config.lang = lang
  }

  private emitResult(transcript: string) {
    if (transcript && transcript.length > 1) {
      this.dispatchEvent(new AWSSpeechRecognitionEvent('result',
        [{
          0: { 
            transcript,
            confidence: 1
          },
          // TODO make this dynamic
          isFinal: true
        }]
      ))
    } else {
      this.dispatchEvent(new Event('nomatch'))
    }
    this.dispatchEvent(new Event('end'))
  }

  private emitError(error: Error) {
    this.stop()
    this.dispatchEvent(new ErrorEvent('error', error))
  }

  private emitSoundStart() {
    this.dispatchEvent(new ErrorEvent('speechstart'))
    this.dispatchEvent(new ErrorEvent('soundstart'))
  }

  private emitSoundEnd() {
    this.dispatchEvent(new ErrorEvent('speechend'))
    this.dispatchEvent(new ErrorEvent('soundend'))
  }

  private async transcribe () {
    const { IdentityPoolId, region, sampleRate, lang } = this.config
    const credentials = await getCredentials({ IdentityPoolId, region }) as Credentials
    const url = getSignedURL({ IdentityPoolId, region, sampleRate, credentials, lang })
    const connection = connectionInstance.of(url).$value
    if (this.stream && connection instanceof WebSocket) {
      try {
        const transcript = await streamAudioToWebSocket({ stream: this.stream, socket: connection, sampleRate: this.config.sampleRate || 1200, emitSoundStart: this.emitSoundStart.bind(this), emitSoundEnd: this.emitSoundEnd.bind(this) })
        this.emitResult(transcript)
        this.stop()
      } catch (err) {
        this.emitError(err)
      }
    }
  }

  // stub some props
  set continous(_) {
    console.warn('`continous` is not yet implemented in the AWS polyfill')
  }

  get continous() {
    return false
  }

  set interimResults(_) {
    console.warn('`continous` is not yet implemented in the AWS polyfill')
  }

  get interimResults() {
    return false
  }

  set maxAlternatives(_) {
    console.warn('`maxAlternatives` is not yet implemented in the AWS polyfill')
  }

  get maxAlternatives() {
    return 1
  }

  set grammars(_) {
    console.warn('`grammars` is not yet implemented in the AWS polyfill')
  }

  get grammars() {
    return {}
  }

  // proxy event listeners
  set onaudiostart(fn: ListenerCallback) {
    this.addEventListener('audiostart', fn)
  }
  
  set onaudioend(fn: ListenerCallback) {
    this.addEventListener('audioend', fn)
  }

  set onend(fn: ListenerCallback) {
    this.addEventListener('end', fn)
  }

  set onerror(fn: ListenerCallback) {
    this.addEventListener('error', fn)
  }

  set onnomatch(fn: ListenerCallback) {
    this.addEventListener('nomatch', fn)
  }

  set onresult(fn: ListenerCallback) {
    this.addEventListener('result', fn)
  }

  set onsoundstart(fn: ListenerCallback) {
    this.addEventListener('soundstart', fn)
  }

  set onsoundend(fn: ListenerCallback) {
    this.addEventListener('soundend', fn)
  }

  set onspeechstart(fn: ListenerCallback) {
    this.addEventListener('speechstart', fn)
  }

  set onspeechend(fn: ListenerCallback) {
    this.addEventListener('speechend', fn)
  }

  set onstart(fn: ListenerCallback) {
    this.addEventListener('start', fn)
  }
}

export default AWSRecognizer
