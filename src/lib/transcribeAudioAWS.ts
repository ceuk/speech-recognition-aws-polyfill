/* global Buffer console TextDecoder */
import { streamInstance } from './cacheContainers'
import { assoc, ifElse, pathEq, when, construct, tap, propSatisfies, pathSatisfies, not } from 'ramda'
import { pipe, createPipe, prop, allPass } from 'remeda'
import { Buffer } from 'buffer/'
import { toRaw } from 'microphone-stream'
import { downsampleBuffer, pcmEncode } from './audioUtils'
import { toUtf8, fromUtf8 } from '@aws-sdk/util-utf8-node'
import { EventStreamMarshaller } from '@aws-sdk/eventstream-marshaller'
import { createPresignedURL } from './awsV4'
import crypto from 'webcrypto'
import { AWSTranscribeResponse, Config } from '../types/shared'
import ReadableStream from '../types/microphone-stream'
import { CognitoIdentityCredentials, config as awsConfig, Credentials } from 'aws-sdk'

const eventStreamMarshaller = new EventStreamMarshaller(toUtf8, fromUtf8)

const stringEncode = (data: ArrayBufferLike) => new TextDecoder('utf-8').decode(data)

interface AssocBy { <T,U>(name: string, fn: (obj: T) => U): (obj: T) => Record<string, U> & T }
const assocBy: AssocBy = (name, fn) => obj => assoc(name, fn(obj), obj)

const transcribeEndpoint = ({ region }: GetSignedURLArgs) => `transcribestreaming.${region}.amazonaws.com:8443`

export const getCredentials = async ({ IdentityPoolId, region }: Config) => {
  awsConfig.region = region
  awsConfig.credentials = new CognitoIdentityCredentials({ IdentityPoolId })
  await (awsConfig.credentials as Credentials).getPromise()
  return awsConfig.credentials
}


interface GetSignedURLArgs extends Config { credentials: Credentials }
type GetSignedURL = (args: GetSignedURLArgs) => string
export const getSignedURL: GetSignedURL = createPipe(
  assocBy<GetSignedURLArgs, string>('endpoint', transcribeEndpoint),
  ({ endpoint, credentials, region, sampleRate, lang }) =>
    createPresignedURL(
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
        region,
        query: `language-code=${lang}&media-encoding=pcm&sample-rate=${sampleRate}`
      }
    )
)

interface StreamAudioToWebsocketArgs { stream: MediaStream, socket: WebSocket, sampleRate: number, emitSoundStart: () => void, emitSoundEnd: () => void }
type StreamAudioToWebsocket = (args: StreamAudioToWebsocketArgs) => Promise<string>
export const streamAudioToWebSocket: StreamAudioToWebsocket = ({ stream, socket, sampleRate, emitSoundStart, emitSoundEnd }) => new Promise((resolve, reject) => {
  try {
    // get mic stream from browser
    const micStream = streamInstance.of(stream).$value

    socket.binaryType = 'arraybuffer'

    // when we get audio data from the mic, send it to the WebSocket if possible
    // eslint-disable-next-line unicorn/prefer-add-event-listener
    socket.onopen = () => {
      micStream.on('data', createPipe(
        tap(emitSoundStart),
        // the audio stream is raw audio bytes. Transcribe expects PCM with additional metadata, encoded as binary
        (audioChunk: Buffer) => convertAudioToBinaryMessage({ audioChunk, sampleRate }),
        when(() => socket.readyState === 1, socket.send.bind(socket))
      ))
    }

    // handle messages, errors, and close events
    wireSocketEvents({ micStream, socket, resolve, reject, emitSoundEnd })
  } catch (error) {
    emitSoundEnd()
    reject(error)
  }
})

interface WireSocketEventsArgs { micStream: ReadableStream, resolve: (value: string | PromiseLike<string>) => void, reject: (reason?: any) => void, socket: WebSocket, emitSoundEnd: () => void }
function wireSocketEvents ({ micStream, resolve, reject, socket, emitSoundEnd }: WireSocketEventsArgs) {
  // convert the binary event stream message to JSON
  const messageBody = createPipe(
    ({ body }) => body,
    stringEncode,
    JSON.parse.bind(JSON)
  )

  // handle inbound messages from Amazon Transcribe
  // eslint-disable-next-line unicorn/prefer-add-event-listener
  socket.onmessage = createPipe(
    prop('data'),
    Buffer.from,
    eventStreamMarshaller.unmarshall.bind(eventStreamMarshaller),
    tap(emitSoundEnd),
    ifElse(
      pathEq(['headers', ':message-type', 'value'], 'event'),
      createPipe(
        messageBody,
        handleEventStreamMessage(resolve)
      ),
      createPipe(
        messageBody,
        prop('Message'),
        tap(console.error),
        construct(Error),
        reject
      )
    )
  )

  // eslint-disable-next-line unicorn/prefer-add-event-listener
  socket.onerror = createPipe(
    tap(console.error),
    tap(emitSoundEnd),
    construct(Error),
    reject
  )

  socket.onclose = micStream.stop.bind(micStream)
}

interface ConvertAudioToBinaryMessageArgs { audioChunk: Buffer, sampleRate: number }
function convertAudioToBinaryMessage ({ audioChunk, sampleRate }: ConvertAudioToBinaryMessageArgs): Uint8Array {
  return pipe(
    audioChunk,
    when<Uint8Array, Uint8Array>(Boolean, createPipe(
      toRaw,
      // downsample and convert the raw audio bytes to PCM
      (buffer: Float32Array) => downsampleBuffer({ buffer, outputSampleRate: sampleRate }),
      pcmEncode,
      // @ts-ignore
      Buffer,
      // add the right JSON headers and structure to the message
      getAudioEventMessage,
      // convert the JSON object + headers into a binary event stream message
      eventStreamMarshaller.marshall.bind(eventStreamMarshaller)
    ))
  )
}

type HandleEventStreamMessage = (resolve: (value: string | PromiseLike<string>) => void) => (messsage: AWSTranscribeResponse) => void
const handleEventStreamMessage: HandleEventStreamMessage = (resolve) => createPipe(
    body => body.Transcript.Results,
    when(
      allPass([
        propSatisfies((x: number) => x > 0, 'length'),
        pathSatisfies((x: number) => x > 0, [0, 'Alternatives', 'length']),
        pathSatisfies(not, [0, 'IsPartial'])
      ]),
      (results:AWSTranscribeResponse['Transcript']['Results']) => pipe(
        results[0].Alternatives[0].Transcript,
        // fix encoding for accented characters
        escape,
        decodeURIComponent,
        resolve
      )
    )
  )

function getAudioEventMessage (buffer: Buffer) {
  // wrap the audio data in a JSON envelope
  return {
    headers: {
      ':message-type': {
        type: 'string',
        value: 'event'
      },
      ':event-type': {
        type: 'string',
        value: 'AudioEvent'
      }
    },
    body: buffer
  }
}
