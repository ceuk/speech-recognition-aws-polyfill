speech-recognition-aws-polyfill
===

![package size](https://img.shields.io/bundlephobia/min/base-ui)
![vulnerabilities](https://img.shields.io/snyk/vulnerabilities/npm/speech-recognition-aws-polyfill)
![](https://img.shields.io/npm/v/speech-recognition-aws-polyfill)

A [polyfill](https://remysharp.com/2010/10/08/what-is-a-polyfill) for the experimental browser [Speech Recognition API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) which falls back to [AWS Transcribe](https://aws.amazon.com/transcribe/).

## Features

* Works without a server (browser-only)
* Supports the [following browsers/versions](https://caniuse.com/stream) (~94% coverage)

**Note:** this is not a polyfill for [`MediaDevices.getUserMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) - check the support table in the link above.

## Who is it for?

This Library is a good fit if you are already using AWS services (or you would just prefer to use AWS).

A polyfill also exists at: [/antelow/speech-polyfill](https://github.com/anteloe/speech-polyfill), which uses [Azure Cognitive Services](https://azure.microsoft.com/en-gb/services/cognitive-services/) as a fallback. However, it seems to have gone stale with no updates for ~2 years.


## Prerequisites

* An AWS account
* A Cognito [identity pool](https://docs.aws.amazon.com/cognito/latest/developerguide/identity-pools.html) (unauthenticated or authenticated) with the `TranscribeStreaming` permission.

## AWS Setup Guide

1. In the AWS console, visit the Cognito section and click **Manage Identity Pools**.
1. Click **Create new identity pool** and give it a name.
1. To allow anyone who visits your app to use speech recognition (e.g. for public-facing web apps) check **Enable access to unauthenticated identities**
1. If you want to configure authentication instead, do so now.
1. Click **Create Pool**
1. Choose or create a role for your users. If you are just using authenticated sessions, you are only interested in the second section. If you aren't sure what to do here, the default role is fine.
1. Make sure your role has the `TranscribeStreaming` policy attached. To attach this to your role search for IAM -> Roles, find your role, click "Attach policies" and search for the TranscribeStreaming role.
1. Go back to Cognito and find your identity pool. Click **Edit identity pool** in the top right and make a note of your **Identity pool ID**

## Usage

Install with `npm i --save speech-recognition-aws-polyfill`

Import into your application: 
```javascript
import SpeechRecognitionPolyfill from 'speech-recognition-aws-polyfill'
```

Or use from the unpkg CDN: 
```html
<script src="https://unpkg.com/speech-recognition-aws-polyfill"></script>
```

Create a new instance of the polyfill:

```javascript
const recognition = new SpeechRecognitionPolyfill({
  IdentityPoolId: 'eu-west-1:11111111-1111-1111-1111-1111111111', // your Identity Pool ID
  region: 'eu-west-1' // your AWS region
})
```

Alternatively, use the `create` method.

```javascript
const SpeechRecognition = SpeechRecognititionPolyfill.create({
  IdentityPoolId: 'eu-west-1:11111111-1111-1111-1111-1111111111', // your Identity Pool ID
  region: "eu-west-1"
});

const recognition = new SpeechRecognition()
```

You can then interact with `recognition` the same as you would with an instance of [`window.SpeechRecognition`](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)

The recognizer will stop capturing if it doesn't detect speech for a period. You can also stop manually with the `stop()` method.

## Support Table

### Properties

| Property          | Supported |
|-------------------|-----------|
| `lang`            |    Yes    |
| `grammars`        |     No    |
| `continuous`      |     Yes    |
| `interimResults`  |     No    |
| `maxAlternatives` |     No    |
| `serviceURI`      |     No    |

### Methods

| Method            | Supported |
|-------------------|-----------|
| `abort`           |    Yes    |
| `start`           |    Yes    |
| `stop`            |    Yes    |

### Events

| Events        | Supported |
|---------------|-----------|
| `audiostart`  |    Yes    |
| `audioend`    |    Yes    |
| `start`       |    Yes    |
| `end`         |    Yes    |
| `error`       |    Yes    |
| `nomatch`     |    Yes    |
| `result`      |    Yes    |
| `soundstart`  |  Partial  |
| `soundend`    |  Partial  |
| `speechstart` |  Partial  |
| `speechend`   |  Partial  |


## Full Example

```javascript
import SpeechRecognitionPolyfill from 'speech-recognition-aws-polyfill'

const recognition = new SpeechRecognitionPolyfill({
  IdentityPoolId: 'eu-west-1:11111111-1111-1111-1111-1111111111', // your Identity Pool ID
  region: 'eu-west-1' // your AWS region
})
recognition.lang = 'en-US'; // add this to the config above instead if you want

document.body.onclick = function() {
  recognition.start();
  console.log('Listening');
}

recognition.onresult = function(event) {
  const { transcript } = event.results[0][0]
  console.log('Heard: ', transcript)
}

recognition.onerror = console.error
```

## Demo

Check the [examples](./examples) folder for a simple HTML page that shows how to
use the polyfill. Replace the placeholder AWS credentials with your own before
running the example.

## Roadmap

* Further increase parity between the two implementations by better supporting additional options and events.
* Build a companion polyfill for speech synthesis (TTS) using AWS Polly
* Provide a way to output the transcription as an RxJS observable

## Contributing and Bugs

Questions, comments and contributions are very welcome. Just raise an Issue/PR (or, check out the fancy new [Github Discussions](https://github.com/ceuk/speech-recognition-aws-polyfill/discussions) feature)

## License

MIT
