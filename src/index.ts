import './lib/bufferPolyfill'
import AWSRecognizer, { configArgs } from './recognizers/aws'

const w = typeof window === 'undefined' ? {} as any : window

const BrowserRecognizer = w.SpeechRecognition || w.webkitSpeechRecognition
const browserSupportsSpeechRecognition = BrowserRecognizer && new BrowserRecognizer()

const recognizer = browserSupportsSpeechRecognition
  ? { ...BrowserRecognizer, create: (_: configArgs) => BrowserRecognizer }
  : AWSRecognizer

//@ts-ignore
w.SpeechRecognitionPolyfill = recognizer
export default recognizer
