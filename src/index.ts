import './lib/bufferPolyfill'
import AWSRecognizer, { configArgs } from './recognizers/aws'

const w = window || {}

const BrowserRecognizer = w.SpeechRecognition || w.webkitSpeechRecognition
const browserSupportsSpeechRecognition = BrowserRecognizer && new BrowserRecognizer()

const recognizer = browserSupportsSpeechRecognition
  ? Object.assign(BrowserRecognizer, {
      create: (config: configArgs) => BrowserRecognizer
    })
  : AWSRecognizer

//@ts-ignore
w.SpeechRecognitionPolyfill = recognizer
export default recognizer
