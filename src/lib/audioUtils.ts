import { adjust, divide, sum, ifElse, propEq, prop, map, append, prepend, __, reduce, addIndex, construct, multiply } from 'ramda'
import { createPipe, pipe } from 'remeda'

const reduceIdx = addIndex(reduce)

// createDataView :: buffer -> int -> int -> buffer -> DataView
const createDataView = createPipe(
  (buf: Buffer) => buf.length,
  multiply(2),
  construct(ArrayBuffer),
  construct(DataView)
)

// pcmEncode :: buffer -> buffer
export function pcmEncode (input: Buffer) {
  const view = createDataView(input)
  // Using recursion would be cleaner but much more computationally
  // expensive until TCO is properly implemented in ECMAScript
  // eslint-disable-next-line no-loops/no-loops, immutable/no-let
  for (let i = 0, offset = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
  }
  return view.buffer
}

interface DownsampleBufferArgs { buffer: Uint8Array, outputSampleRate: number }
export const downsampleBuffer = ({ buffer, outputSampleRate = 16000 }: DownsampleBufferArgs) => {
  const ratio = 44100 / outputSampleRate
  return ifElse(
    // if
    propEq('outputSampleRate', 44100),
    // then
    prop('buffer'),
    // else
    createPipe(
      prop('buffer'),
      reduceIdx((acc: any, val, i) =>
        pipe(
          ratio,
          divide(i + 0.1),
          Math.floor,
          (number: number) => Array.isArray(acc[number])
            ? adjust(
                number,
                prepend(val),
                acc
              )
            : () => append([val], acc)
        ),
      []
      ),
      map((values: number[]) => sum(values) / values.length)
    )
  )({ buffer, outputSampleRate })
}
