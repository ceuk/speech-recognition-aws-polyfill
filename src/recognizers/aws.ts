/* eslint-disable immutable/no-this */
import { connectionInstance } from '../lib/cacheContainers'
import Maybe, {nothing} from '@versita/fp-lib/maybe'
import { getCredentials, getSignedURL, streamAudioToWebSocket } from '../lib/transcribeAudioAWS'
import { AWSSpeechRecognitionEvent, Config, Listener } from '../types/shared'
import {Credentials} from 'aws-sdk'
import { DelegatedEventTarget } from '../lib/delegatedEventTarget'


function stopStream(stream:MediaStream) {
  stream.getTracks().forEach(track => track.stop())
  return stream
}

class AWSRecognizer extends DelegatedEventTarget {
  config: Config
  stream: Maybe<MediaStream>
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
      sampleRate: 12000
    }
    this.config = Object.assign(defaults, config)
  }

  start() {
    if (this.listening) return
    this.dispatchEvent(new Event('start'))
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then((stream) => {
        this.stream = Maybe.of(stream)
        this.listening = true
        this.dispatchEvent(new Event('audiostart'))
        this.transcribe()
      })
      .catch(err => {
        this.stream = nothing()
        this.listening = false
        this.emitError(err)
      });
  }

  abort() {
    if (this.listening) {
      this.stream.map(stopStream)
      this.listening = false
      this.dispatchEvent(new Event('audioend'))
    }
  }

  stop() {
    if (this.listening) {
      this.stream.map(stopStream)
      this.handleStop()
      this.listening = false
      this.dispatchEvent(new Event('audioend'))
    }
  }

  private emitResult(transcript: string) {
    if (transcript && transcript.length > 1) {
      this.dispatchEvent(new AWSSpeechRecognitionEvent('result', {
        results: [[
          { transcript }
        ]]
      }) as SpeechRecognitionEvent)
    } else {
      this.dispatchEvent(new Event('nomatch'))
    }
    this.dispatchEvent(new Event('end'))
  }

  private emitError(error: Error) {
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
    const { IdentityPoolId, region, sampleRate } = this.config
    const credentials = await getCredentials({ IdentityPoolId, region }) as Credentials
    const url = getSignedURL({ IdentityPoolId, region, sampleRate, credentials })
    const connection = connectionInstance.of(url).$value
    if (this.stream.isJust()) {
      try {
        const transcript = await streamAudioToWebSocket({ stream: this.stream.unsafelyGet(), socket: connection, sampleRate: this.config.sampleRate || 1200, emitSoundStart: this.emitSoundStart.bind(this), emitSoundEnd: this.emitSoundEnd.bind(this) })
        this.emitResult(transcript)
        this.stop()
      } catch (err) {
        this.emitError(err)
      }
    }
  }

  private handleStop() {
    if (this.listening) {
    }
  }

  // proxy event listeners
  onaudiostart(listener: Listener): void {
    return this.addEventListener('audiostart', listener)
  }
  
  onaudioend(listener: Listener): void {
    return this.addEventListener('audioend', listener)
  }

  onend(listener: Listener): void {
    return this.addEventListener('end', listener)
  }

  onerror(listener: Listener): void {
    return this.addEventListener('error', listener)
  }

  onnomatch(listener: Listener): void {
    return this.addEventListener('nomatch', listener)
  }

  onresult(listener: Listener): void {
    return this.addEventListener('result', listener)
  }

  onsoundstart(listener: Listener): void {
    return this.addEventListener('soundstart', listener)
  }

  onsoundend(listener: Listener): void {
    return this.addEventListener('soundend', listener)
  }

  onspeechstart(listener: Listener): void {
    return this.addEventListener('speechstart', listener)
  }

  onspeechend(listener: Listener): void {
    return this.addEventListener('speechend', listener)
  }

  onstart(listener: Listener): void {
    return this.addEventListener('start', listener)
  }
}

export default AWSRecognizer
