import './lib/bufferPolyfill'
import AWSRecognizer from './recognizers/aws'

const BrowserRecognizer = window.SpeechRecognition

const recognizer = BrowserRecognizer && new BrowserRecognizer()
  ? BrowserRecognizer
  : AWSRecognizer

//@ts-ignore
window.SpeechRecognitionPolyfill = recognizer
export default recognizer
