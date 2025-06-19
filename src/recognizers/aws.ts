/* eslint-disable immutable/no-this */
import {EventStreamMarshaller} from '@aws-sdk/eventstream-marshaller'
import {fromUtf8, toUtf8} from '@aws-sdk/util-utf8-node'
import {Credentials} from 'aws-sdk'
import {ifElse, not, pathEq, pathOr, pathSatisfies, propSatisfies, tap, when} from 'ramda'
import {allPass, createPipe, prop} from 'remeda'
import crypto from 'webcrypto'
import {createPresignedURL, getCredentials} from '../lib/awsV4'
import Connection from '../lib/Connection'
import {CustomEventTarget} from '../lib/CustomEventTarget'
import MicStream from '../lib/MicStream'
import {convertAudioToBinaryMessage} from '../lib/audioUtils'
import {AWSSpeechRecognitionEvent, AWSTranscribeResponse, Config, ListenerCallback} from '../types/shared'

type requiredConfigs = Pick<Config, "region" | "IdentityPoolId">
type optionalConfigs = Omit<Config, "region" | "IdentityPoolId">
export type configArgs = requiredConfigs & Partial<optionalConfigs>

class AWSRecognizer extends CustomEventTarget implements SpeechRecognition {
  /** in case future recognizers are built in the future (e.g. Azure) */
  static type = 'AWS'

  /** true if the library is supported by the currenly browser */
  static isSupported = !!navigator?.mediaDevices?.getUserMedia

  /** polyfill-specific config */
  public config: Config

  /** if the library is currently capturing/transcribing audio */
  public listening = false

  /** the language (default en-US) */
  public lang: Config['lang']

  /** whether to continuously transcribe audio until `.stop()` is called */
  public continuous: boolean

  /** a proxy for new AWSRecognizer(config) */
  static create(config: configArgs): typeof SpeechRecognition {
    return class AWSRecognizerWithConfig extends AWSRecognizer {
      constructor() {
        super(config)
      }
    }
  }

  constructor(config: configArgs) {
    super()
    if (!config.IdentityPoolId || !config.region) throw new Error('Could not create AWS recognizer: missing configuration, see: https://github.com/ceuk/speech-recognition-aws-polyfill#configuration')
    const defaults: optionalConfigs = {
      sampleRate: 12000,
      lang: 'en-US',
      continuous: false
    }
    this.config = Object.assign(defaults, config)
    this.lang = this.config.lang
    this.continuous = this.config.continuous
  }

  /** start capturing/transcribing audio */
  start() {
    if (this.listening) return

    this.dispatchEvent(new Event('start'))
    navigator.mediaDevices.getUserMedia({audio: true, video: false})
      .then(this.establishConnection.bind(this))
      .catch(err => {
        this.emitError(err)
      });
  }

  /** stop capturing and return any final transcriptions */
  public stop() {
    MicStream.getInstance()?.end()
    Connection.getInstance()?.close()
    this.listening = false
    this.dispatchEvent(new Event('audioend'))
  }

  /** stop capturing and don't emit any transcibed audio */
  public abort() {
    if (this.listening) {
      MicStream.getInstance()?.end()
      Connection.getInstance()?.close()
      this.listening = false
      this.dispatchEvent(new Event('audioend'))
    }
  }

  /** dispatch transcription result */
  private emitResult(transcript: string) {
    if (!this.continuous && this.listening) {
      this.stop()
    }

    if (transcript && transcript.length > 1) {
      this.dispatchEvent(new AWSSpeechRecognitionEvent('result',
        [{
          0: {
            transcript,
            confidence: 1
          },
          isFinal: !this.listening
        }]
      ))
    } else {
      this.dispatchEvent(new Event('nomatch'))
    }

    if (!this.listening) {
      this.dispatchEvent(new Event('end'))
    }
  }

  /** dispatch error event */
  private emitError(error: Error) {
    this.stop()
    this.dispatchEvent(new ErrorEvent('error', error))
  }

  /** dispatch events related to sound start */
  private emitSoundStart() {
    this.dispatchEvent(new Event('speechstart'))
    this.dispatchEvent(new Event('soundstart'))
  }

  /** dispatch events realated to sound end */
  private emitSoundEnd() {
    this.dispatchEvent(new Event('speechend'))
    this.dispatchEvent(new Event('soundend'))
  }

  /** authenticate and connect to AWS Transcribe */
  private async establishConnection(mediaStream: MediaStream) {
    this.listening = true
    this.dispatchEvent(new Event('audiostart'))

    try {
      const {IdentityPoolId, region} = this.config
      const credentials = await getCredentials({IdentityPoolId, region}) as Credentials
      Connection.setUrl(this.getSignedURL(credentials))
      MicStream.setStream(mediaStream)
      this.streamAudioToWebSocket()
    } catch (err) {
      if (err instanceof Error) {
        this.emitError(err)
      }
    }
  }

  /** get a signed url using specified credentials */
  private getSignedURL(credentials: Credentials) {
    const endpoint = `transcribestreaming.${this.config.region}.amazonaws.com:8443`
    return createPresignedURL(
      'GET',
      endpoint,
      '/stream-transcription-websocket',
      'transcribe',
      crypto.createHash('sha256').update('', 'utf8').digest('hex'),
      {
        key: credentials.accessKeyId,
        secret: credentials.secretAccessKey,
        timestamp: Date.now(),
        sessionToken: credentials.sessionToken,
        protocol: 'wss',
        expires: 15,
        region: this.config.region,
        query: `language-code=${this.lang}&media-encoding=pcm&sample-rate=${this.config.sampleRate}`
      }
    )
  }

  /** handle streaming received audio buffer to AWS transcribe */
  private streamAudioToWebSocket() {
    try {
      // when we get audio data from the mic, send it to the WebSocket if possible
      const connection = Connection.getInstance()

      if (!connection) {
        console.error('no usable connection')
        return
      }

      connection.onopen = () => {
        const micStream = MicStream.getInstance()
        if (!micStream) {
          console.error('no usable stream')
          return
        }

        // emit sound start events
        this.emitSoundStart()

        // when audio is received from the mic stream, send it AWS
        micStream.on('data', createPipe(
          // emit the sound end if we are about to stop capturing
          when(
            () => !this.continuous,
            tap(() => this.emitSoundEnd()),
          ),
          // the audio stream is raw audio bytes. Transcribe expects PCM with additional metadata, encoded as binary
          (audioChunk: Buffer) => convertAudioToBinaryMessage(audioChunk, this.config.sampleRate),
          when(() => Connection.isActive(), connection.send.bind(connection))
        ))

        // handle messages, errors, and close events
        this.handleSocketMessages()
      }
    } catch (error) {
      if (error instanceof Error) {
        this.emitError(error)
      }
    }
  }

  /** handle websocket responses */
  private handleSocketMessages() {
    const eventStreamMarshaller = new EventStreamMarshaller(toUtf8, fromUtf8)
    const stringEncode = (data: ArrayBufferLike) => new TextDecoder('utf-8').decode(data)

    // convert the binary event stream message to JSON
    type ParseMessageBody = (response: {body: ArrayBufferLike}) => AWSTranscribeResponse
    const parseMessageBody: ParseMessageBody = createPipe(
      prop('body'),
      stringEncode,
      JSON.parse.bind(JSON)
    )

    const connection = Connection.getInstance()
    if (connection) {
      connection.onmessage = createPipe(
        prop('data'),
        Buffer.from,
        (buffer: Buffer) => eventStreamMarshaller.unmarshall(buffer) as MessageEvent,
        ifElse(
          pathEq(['headers', ':message-type', 'value'], 'event'),
          // valid response
          createPipe(
            parseMessageBody,
            pathOr([], ['Transcript', 'Results']),
            when(
              // validate the results
              allPass([
                propSatisfies((x: number) => x > 0, 'length'),
                pathSatisfies((x: number) => x > 0, [0, 'Alternatives', 'length']),
                pathSatisfies(not, [0, 'IsPartial'])
              ]),
              // emit the transcription result
              createPipe(
                pathOr('', [0, 'Alternatives', 0, 'Transcript']),
                decodeURIComponent,
                this.emitResult.bind(this)
              )
            )
          ),
          // error response
          createPipe(
            parseMessageBody,
            prop('Message'),
            console.error
          )
        )
      )
    }
  }

  // stub some unimplemented props/methods

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
    console.warn('`grammars` is not yet implemented in the AWS polyfill')
    return SpeechGrammar ? new SpeechGrammarList() : ([] as unknown as SpeechGrammarList)
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
