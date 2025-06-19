import { Buffer } from 'buffer'

// ensure the Buffer polyfill only runs in browsers
if (typeof window !== 'undefined' && typeof (window as any).Buffer === 'undefined') {
  // @ts-ignore - window is defined in browsers
  (window as any).Buffer = Buffer
}
