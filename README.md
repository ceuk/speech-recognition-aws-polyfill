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
const recognizer = new SpeechRecognitionPolyfill({
  IdentityPoolId: 'eu-west-1:11111111-1111-1111-1111-1111111111', // your Identity Pool ID
  region: 'eu-west-1' // your AWS region
})
```

Start "listening" with `start()` then transcribe any detected speech with `transcribe()`:

```javascript
try {
  await recognizer.start()
  const words = await recognizer.transcribe()
} catch (err) {
  console.error(err)
}
```
The recognizer will stop capturing if it doesn't detect speech for a period. You can also stop manually with the `stop()` method.

Finally, there are two static properties that may be useful:

`isSupported`: This will be false if neither speech recognition methods are supported by the browser (meaning you will be unable to perform any STT and should disable it for this user)

`type`: either 'BROWSER' or 'AWS' depending on which method is being used. The library will try to use browser first and fall back to AWS if needed.

## Roadmap

* Build a companion polyfill for speech synthesis (TTS) using AWS Polly
* Provide a way to output the transcription as an RxJS observable

## Contributing and Bugs

Questions, comments and contributions are very welcome. Just raise an Issue/PR (or, check out the fancy new [Github Discussions](https://github.com/ceuk/speech-recognition-aws-polyfill/discussions) feature)

## License

MIT
