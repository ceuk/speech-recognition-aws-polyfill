import {createPipe, pipe} from 'remeda'
import {EventStreamMarshaller} from '@aws-sdk/eventstream-marshaller'
import {fromUtf8, toUtf8} from '@aws-sdk/util-utf8-node'
import {when} from 'ramda'
import {toRaw} from 'microphone-stream'
import {getAudioEventMessage} from './awsV4'

const inputSampleRate = 44100

const eventStreamMarshaller = new EventStreamMarshaller(toUtf8, fromUtf8)

export function pcmEncode(input: Float32Array) {
  var offset = 0
  var buffer = new ArrayBuffer(input.length * 2)
  var view = new DataView(buffer)
  for (var i = 0; i < input.length; i++, offset += 2) {
    var s = Math.max(-1, Math.min(1, input[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
  }
  return buffer
}

export function downsampleBuffer({buffer, outputSampleRate = 16000}: {buffer: Float32Array, outputSampleRate: number}) {
  if (outputSampleRate === inputSampleRate) {
    return buffer
  }

  var sampleRateRatio = inputSampleRate / outputSampleRate
  var newLength = Math.round(buffer.length / sampleRateRatio)
  var result = new Float32Array(newLength)
  var offsetResult = 0
  var offsetBuffer = 0
  while (offsetResult < result.length) {
    var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio)
    var accum = 0
    var count = 0
    for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i]
      count++
    }
    result[offsetResult] = accum / count
    offsetResult++
    offsetBuffer = nextOffsetBuffer
  }
  return result
}

export function convertAudioToBinaryMessage(audioChunk: Buffer, sampleRate: number): Uint8Array {
  return pipe(
    audioChunk,
    when<Uint8Array, Uint8Array>(Boolean, createPipe(
      toRaw,
      // downsample and convert the raw audio bytes to PCM
      (buffer: Float32Array) => downsampleBuffer({buffer, outputSampleRate: sampleRate}),
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

