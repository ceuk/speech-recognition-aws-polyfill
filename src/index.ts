import './lib/bufferPolyfill'
import AWSRecognizer from './recognizers/aws'

const w = window || {}

//@ts-ignore
const BrowserRecognizer = w.SpeechRecognition || w.webkitSpeechRecognition

const recognizer = BrowserRecognizer && new BrowserRecognizer()
  ? BrowserRecognizer
  : AWSRecognizer

//@ts-ignore
w.SpeechRecognitionPolyfill = recognizer
export default recognizer
