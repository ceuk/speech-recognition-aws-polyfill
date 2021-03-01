import { Buffer } from 'buffer'

// @ts-ignore
if (typeof window.Buffer === 'undefined') {
  // @ts-ignore
  window.Buffer = Buffer
}
