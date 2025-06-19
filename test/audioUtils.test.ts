import { pcmEncode, downsampleBuffer } from '../src/lib/audioUtils';

describe('pcmEncode', () => {
  it('outputs an ArrayBuffer twice the input length', () => {
    const input = new Float32Array([0.5, -0.5, 0, 1]);
    const result = pcmEncode(input);
    expect(result.byteLength).toBe(input.length * 2);
  });
});

describe('downsampleBuffer', () => {
  it('resamples to the expected array length', () => {
    const inputLength = 44100;
    const input = new Float32Array(inputLength);
    const output = downsampleBuffer({ buffer: input, outputSampleRate: 16000 });
    expect(output.length).toBe(16000);
  });
});
