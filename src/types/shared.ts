export interface Config {
  IdentityPoolId: string
  region: string,
  sampleRate?: number
}

export interface AWSSpeechRecognitionEventInit extends EventInit {
  results: { transcript: string }[][]
}

export class AWSSpeechRecognitionEvent extends Event {
  constructor(type: string, eventInitDict: AWSSpeechRecognitionEventInit ) {
    super(type, eventInitDict)
  }
}

export type Listener = EventListener | EventListenerObject | null

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
