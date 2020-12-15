import { adjust, divide, sum, ifElse, propEq, pipe, prop, map, append, propSatisfies, prepend, __, reduce, addIndex, construct, multiply } from 'ramda'

const reduceIdx = addIndex(reduce)

// createDataView :: buffer -> int -> int -> buffer -> DataView
const createDataView = pipe(
  prop('length'),
  multiply(2),
  construct(ArrayBuffer),
  construct(DataView)
)

// pcmEncode :: buffer -> buffer
export function pcmEncode (input) {
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

// downsampleBuffer :: {buffer, outputSampleRate} -> buffer
export const downsampleBuffer = ({ buffer, outputSampleRate = 16000 }) => {
  const ratio = 44100 / outputSampleRate
  return ifElse(
    // if
    propEq('outputSampleRate', 44100),
    // then
    prop('buffer'),
    // else
    pipe(
      prop('buffer'),
      reduceIdx((acc, val, i) =>
        pipe(
          divide(i + 0.1),
          Math.floor,
          ifElse(
            propSatisfies(Array.isArray, __, acc),
            adjust(
              __,
              prepend(val),
              acc
            ),
            () => append([val], acc)
          )
        )(ratio),
      []
      ),
      map(values => sum(values) / values.length)
    )
  )({ buffer, outputSampleRate })
}
