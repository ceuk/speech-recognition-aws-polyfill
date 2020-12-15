/* eslint-disable immutable/no-this */
import { prop, pipe, head } from 'ramda'

// shim Chrome recognition API
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
const recognition = Recognition && new Recognition()

class BrowserRecognizer {
  static get isSupported () {
    return Boolean(recognition)
  }

  static get type () {
    return 'BROWSER'
  }

  start () {
    recognition.start()
    return Promise.resolve()
  }

  stop () {
    recognition.stop()
    return Promise.resolve()
  }

  transcribe () {
    return new Promise((resolve, reject) => {
      const handleResults = pipe(
        prop('results'),
        head,
        head,
        prop('transcript'),
        resolve
      )
      const handleError = pipe(
        prop('error'),
        reject
      )
      recognition.onresult = handleResults
      recognition.addEventListener('error', handleError)
    })
  }
}

export default BrowserRecognizer
