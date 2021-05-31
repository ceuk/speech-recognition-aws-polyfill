// forked from from https://github.com/department-stockholm/aws-signature-v4 with modifications
import crypto from 'crypto-browserify'
import querystring from 'query-string'
import {CognitoIdentityCredentials, config as awsConfig, Credentials} from 'aws-sdk'
import {when} from 'ramda'
import {createPipe, pipe} from 'remeda'
import {Config} from '../types/shared'
import {downsampleBuffer, pcmEncode} from './audioUtils'
import {toRaw} from 'microphone-stream'
import {EventStreamMarshaller} from '@aws-sdk/eventstream-marshaller'
import {fromUtf8, toUtf8} from '@aws-sdk/util-utf8-node'

const eventStreamMarshaller = new EventStreamMarshaller(toUtf8, fromUtf8)

interface Params {
  [key: string]: any
}

interface Headers {
  [key: string]: any
}

interface AWSOptions {
  bucket?: string
  method?: string
  protocol?: string
  headers?: Headers
  timestamp?: number
  region?: string
  expires?: number
  query: string
  key: string
  sessionToken?: string
  secret: string
}

export const getCredentials = async ({IdentityPoolId, region}: Pick<Config, "IdentityPoolId" | "region">) => {
  awsConfig.region = region
  awsConfig.credentials = new CognitoIdentityCredentials({IdentityPoolId})
  await (awsConfig.credentials as Credentials).getPromise()
  return awsConfig.credentials
}

export function getAudioEventMessage(buffer: Buffer) {
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

export const createCanonicalQueryString = function (params: Params) {
  return Object.keys(params).sort().map(function (key) {
    return encodeURIComponent(key) + '=' + encodeURIComponent(params[key])
  }).join('&')
}

export const createCanonicalHeaders = function (headers: Headers) {
  return Object.keys(headers).sort().map(function (name) {
    return name.toLowerCase().trim() + ':' + headers[name].toString().trim() + '\n'
  }).join('')
}

export const createSignedHeaders = function (headers: Headers) {
  return Object.keys(headers).sort().map(function (name) {
    return name.toLowerCase().trim()
  }).join(';')
}

export const createCredentialScope = function (time: number, region: string, service: string) {
  return [toDate(time), region, service, 'aws4_request'].join('/')
}

export const createStringToSign = function (time: number, region: string, service: string, request: string) {
  return [
    'AWS4-HMAC-SHA256',
    toTime(time),
    createCredentialScope(time, region, service),
    hash(request, 'hex')
  ].join('\n')
}

export const createSignature = function (secret: string, time: number, region: string, service: string, stringToSign: string) {
  const h1 = hmac('AWS4' + secret, toDate(time)) // date-key
  const h2 = hmac(h1, region) // region-key
  const h3 = hmac(h2, service) // service-key
  const h4 = hmac(h3, 'aws4_request') // signing-key
  return hmac(h4, stringToSign, 'hex')
}

export const createPresignedS3URL = function (name: string, options: AWSOptions) {
  if (!options?.bucket) throw new Error('S3 Bucket not provided')
  options.method = options.method || 'GET'
  return createPresignedURL(
    options.method,
    options.bucket + '.s3.amazonaws.com',
    '/' + name,
    's3',
    'UNSIGNED-PAYLOAD',
    options
  )
}

export const createCanonicalRequest = function (method: string, pathname: string, query: Params, headers: Headers, payload: unknown) {
  return [
    method.toUpperCase(),
    pathname,
    createCanonicalQueryString(query),
    createCanonicalHeaders(headers),
    createSignedHeaders(headers),
    payload
  ].join('\n')
}

export const createPresignedURL = function (method: string, host: string, path: string, service: string, payload: unknown, options: AWSOptions) {
  options.protocol = options.protocol || 'https'
  options.headers = options.headers || {}
  options.timestamp = options.timestamp || Date.now()
  options.region = options.region || 'us-west-1'
  options.expires = options.expires || 86400 // 24 hours
  options.headers = options.headers || {}

  // host is required
  options.headers.Host = host

  const query = options.query ? querystring.parse(options.query) : {}
  query['X-Amz-Algorithm'] = 'AWS4-HMAC-SHA256'
  query['X-Amz-Credential'] = options.key + '/' + createCredentialScope(options.timestamp, options.region, service)
  query['X-Amz-Date'] = toTime(options.timestamp)
  query['X-Amz-Expires'] = String(options.expires)
  query['X-Amz-SignedHeaders'] = createSignedHeaders(options.headers)
  if (options.sessionToken) {
    query['X-Amz-Security-Token'] = options.sessionToken
  }

  const canonicalRequest = createCanonicalRequest(method, path, query, options.headers, payload)
  const stringToSign = createStringToSign(options.timestamp, options.region, service, canonicalRequest)
  const signature = createSignature(options.secret, options.timestamp, options.region, service, stringToSign)
  query['X-Amz-Signature'] = signature
  return options.protocol + '://' + host + path + '?' + querystring.stringify(query)
}

function toTime(time: number) {
  // eslint-disable-next-line no-useless-escape
  return new Date(time).toISOString().replace(/[:\-]|\.\d{3}/g, '')
}

function toDate(time: number) {
  return toTime(time).slice(0, 8)
}

function hmac(key: string, string: string, encoding?: string) {
  return crypto.createHmac('sha256', key)
    .update(string, 'utf8')
    .digest(encoding)
}

function hash(string: string, encoding?: string) {
  return crypto.createHash('sha256')
    .update(string, 'utf8')
    .digest(encoding)
}
