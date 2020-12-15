/* global Buffer console TextDecoder */
import { MicStream } from './cacheContainers'
import { assoc, ifElse, pathEq, prop, pipe, when, curry, construct, tap, path, propSatisfies, allPass, pathSatisfies, not, pick, invoker } from 'ramda'
import { toRaw } from 'microphone-stream'
import { downsampleBuffer, pcmEncode } from './audioUtils'
import { toUtf8, fromUtf8 } from '@aws-sdk/util-utf8-node'
import { EventStreamMarshaller } from '@aws-sdk/eventstream-marshaller'
import { createPresignedURL } from './awsV4'
import crypto from 'webcrypto'
import { CognitoIdentityCredentials, config as awsConfig } from 'aws-sdk'

const eventStreamMarshaller = new EventStreamMarshaller(toUtf8, fromUtf8)

const stringEncode = data => new TextDecoder('utf-8').decode(data)

const assocBy = curry((name, fn, obj) => assoc(name, fn(obj), obj))

const transcribeEndpoint = pipe(({ region }) => `transcribestreaming.${region}.amazonaws.com:8443`)

export const getCredentials = async ({ IdentityPoolId, region }) => {
  awsConfig.region = region
  awsConfig.credentials = new CognitoIdentityCredentials({ IdentityPoolId })
  await awsConfig.credentials.getPromise()
  return awsConfig.credentials
}

export const getSignedURL = pipe(
  assocBy('endpoint', transcribeEndpoint),
  ({ endpoint, credentials, region, sampleRate }) =>
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
        query: `language-code=en-GB&media-encoding=pcm&sample-rate=${sampleRate}`
      }
    )
)

export const streamAudioToWebSocket = ({ stream, socket, sampleRate }) => new Promise((resolve, reject) => {
  try {
    // get mic stream from browser
    const micStream = MicStream.of(stream).$value

    socket.binaryType = 'arraybuffer'

    // when we get audio data from the mic, send it to the WebSocket if possible
    // eslint-disable-next-line unicorn/prefer-add-event-listener
    socket.onopen = () => {
      micStream.on('data', pipe(
        // the audio stream is raw audio bytes. Transcribe expects PCM with additional metadata, encoded as binary
        audioChunk => convertAudioToBinaryMessage({ audioChunk, sampleRate }),
        when(() => socket.readyState === 1, socket.send.bind(socket))
      ))
    }

    // handle messages, errors, and close events
    wireSocketEvents({ micStream, socket, resolve, reject })
  } catch (error) {
    reject(error)
  }
})

function wireSocketEvents ({ micStream, resolve, reject, socket }) {
  // convert the binary event stream message to JSON
  const messageBody = pipe(
    prop('body'),
    stringEncode,
    JSON.parse.bind(JSON)
  )

  // handle inbound messages from Amazon Transcribe
  // eslint-disable-next-line unicorn/prefer-add-event-listener
  socket.onmessage = pipe(
    prop('data'),
    Buffer.from,
    eventStreamMarshaller.unmarshall.bind(eventStreamMarshaller),
    ifElse(
      pathEq(['headers', ':message-type', 'value'], 'event'),
      pipe(
        messageBody,
        handleEventStreamMessage(resolve)
      ),
      pipe(
        messageBody,
        prop('Message'),
        tap(console.error),
        construct(Error),
        reject
      )
    )
  )

  // eslint-disable-next-line unicorn/prefer-add-event-listener
  socket.onerror = pipe(
    tap(console.error),
    construct(Error),
    reject
  )

  socket.onclose = micStream.stop.bind(micStream)
}

function convertAudioToBinaryMessage ({ audioChunk, sampleRate }) {
  return pipe(
    toRaw,
    when(Boolean, pipe(
      // downsample and convert the raw audio bytes to PCM
      buffer => downsampleBuffer({ buffer, outputSampleRate: sampleRate }),
      pcmEncode,
      Buffer,
      // add the right JSON headers and structure to the message
      getAudioEventMessage,
      // convert the JSON object + headers into a binary event stream message
      eventStreamMarshaller.marshall.bind(eventStreamMarshaller)
    ))
  )(audioChunk)
}

// handleEventStreamMessage :: resolveFn -> object -> undefined
function handleEventStreamMessage (resolve) {
  return pipe(
    path(['Transcript', 'Results']),
    when(
      allPass([
        propSatisfies(x => x > 0, 'length'),
        pathSatisfies(x => x > 0, [0, 'Alternatives', 'length']),
        pathSatisfies(not, [0, 'IsPartial'])
      ]),
      pipe(
        path([0, 'Alternatives', 0, 'Transcript']),
        // fix encoding for accented characters
        escape,
        decodeURIComponent,
        resolve
      )
    )
  )
}

function getAudioEventMessage (buffer) {
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
