import { Buffer } from 'buffer'

if (typeof window.Buffer === 'undefined') {
  window.Buffer = Buffer
}
