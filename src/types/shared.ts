export interface Config {
  IdentityPoolId: string
  region: string,
  sampleRate?: number
  lang?: 'en-GB' | 'en-US' | 'fr-CA' | 'fr-FR' | 'de-De' | 'ja-JP' | 'ko-KR' | 'pt-BR' | 'it-IT'
}

export interface AWSSpeechRecognitionResults {
  [index: number]: {
    [index: number]: {transcript: string, confidence: number }
    isFinal: boolean
  }
}

export class AWSSpeechRecognitionEvent {
  type: string
  results: AWSSpeechRecognitionResults
  defaultPrevented: boolean = false

  constructor(type: string, results: AWSSpeechRecognitionResults ) {
    this.type = type
    this.results = results
  }
}

export type Listener = EventListener | EventListenerObject | null
export interface Listeners {
  [type: string]: ListenerCallback[]
}
export type ListenerCallback = (e?: Event | AWSSpeechRecognitionEvent) => void

export interface AWSTranscribeResponse {
  Transcript: {
    Results: {
      Alternatives:  {
        Items: {
          Content: string
          EndTime: number
          StartTime: number
          Type: string
          VocabularyFilterMatch: boolean
        }[]
        Transcript: string
      }[]
      EndTime: number
      IsPartial: boolean
      ResultId: string
      StartTime: number
    }[]
  }
}
