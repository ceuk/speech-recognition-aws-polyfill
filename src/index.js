import './lib/bufferPolyfill'
import AWSRecognizer from './recognizers/aws'
import BrowserRecognizer from './recognizers/browser'

const recognizer = BrowserRecognizer.isSupported
  ? BrowserRecognizer
  : AWSRecognizer

window.SpeechRecognitionPolyfill = recognizer
export default recognizer
