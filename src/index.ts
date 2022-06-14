import './lib/bufferPolyfill'
import AWSRecognizer, { configArgs } from './recognizers/aws'

const w = window || {}

const BrowserRecognizer = w.SpeechRecognition || w.webkitSpeechRecognition
const browserSupportsSpeechRecognition = BrowserRecognizer && new BrowserRecognizer()

const BrowserRecognizerWithCreate = Object.assign(BrowserRecognizer, {
  create: (config: configArgs) => BrowserRecognizer
})

const recognizer = browserSupportsSpeechRecognition
  ? BrowserRecognizerWithCreate
  : AWSRecognizer

//@ts-ignore
w.SpeechRecognitionPolyfill = recognizer
export default recognizer
