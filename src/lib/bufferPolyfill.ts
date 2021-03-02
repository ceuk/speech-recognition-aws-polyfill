import { Buffer } from 'buffer'

// @ts-ignore
if (window && typeof window.Buffer === 'undefined') {
  // @ts-ignore
  window.Buffer = Buffer
}
