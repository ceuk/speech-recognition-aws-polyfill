import './lib/bufferPolyfill'
import AWSRecognizer from './recognizers/aws'

//@ts-ignore
const BrowserRecognizer = window.SpeechRecognition || window.webkitSpeechRecognition

const recognizer = BrowserRecognizer && new BrowserRecognizer()
  ? BrowserRecognizer
  : AWSRecognizer

//@ts-ignore
window.SpeechRecognitionPolyfill = recognizer
export default recognizer
