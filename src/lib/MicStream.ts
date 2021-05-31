import MicrophoneStream from 'microphone-stream'

/**
 * MicStream singleton
 */
class MicStream extends MicrophoneStream {
  private static mediaStream: MediaStream
  private static instance?: MicStream

  private constructor(stream: MediaStream) {
    super()
    this.setStream(stream)
  }

  public static getInstance() {
    if (!MicStream.instance && MicStream.mediaStream) {
      MicStream.instance = new MicStream(MicStream.mediaStream);
    }
    return MicStream.instance
  }

  public static get active() {
    return this.mediaStream.active
  }

  public static setStream(mediaStream: MediaStream) {
    if (MicStream.mediaStrem && MicStream.mediaStream.id !== mediaStream.id) {
      MicStream.instance?.stop();
      MicStream.instance = new MicStream(mediaStream);
    }
    MicStream.mediaStream = mediaStream
  }

  public end() {
    if (this.readable && MicStream.instance) {
      MicStream.mediaStream && MicStream.mediaStream.getTracks().forEach(track => track.stop())
      MicStream.instance = undefined
    }
  }
}

export default MicStream
