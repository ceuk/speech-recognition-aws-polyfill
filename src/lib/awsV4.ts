// Copied from https://github.com/department-stockholm/aws-signature-v4
// and fixed the sorting of query parameters by using 'query-string' package instead of 'querystring'
import crypto from 'crypto-browserify'
import querystring from 'query-string'

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

function toTime (time: number) {
  // eslint-disable-next-line no-useless-escape
  return new Date(time).toISOString().replace(/[:\-]|\.\d{3}/g, '')
}

function toDate (time: number) {
  return toTime(time).slice(0, 8)
}

function hmac (key: string, string: string, encoding?: string) {
  return crypto.createHmac('sha256', key)
  .update(string, 'utf8')
  .digest(encoding)
}

function hash (string: string, encoding?: string) {
  return crypto.createHash('sha256')
  .update(string, 'utf8')
  .digest(encoding)
}
