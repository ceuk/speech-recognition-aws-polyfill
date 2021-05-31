import {equals, reject, concat} from 'remeda';
import {Listeners, ListenerCallback, AWSSpeechRecognitionEvent} from '../types/shared'

export class CustomEventTarget {
  listeners: Listeners = {}

  addEventListener(type: string, callback: ListenerCallback) {
    const stack = this.listeners[type] || []
    this.listeners[type] = concat(stack, [callback])
  }

  removeEventListener(type: string, callback: ListenerCallback) {
    if (!(type in this.listeners)) return
    this.listeners[type] = reject(this.listeners[type], equals(callback))
  }

  dispatchEvent(e: Event | AWSSpeechRecognitionEvent) {
    if (!(e.type in this.listeners)) return true
    this.listeners[e.type].forEach((fn: ListenerCallback) => fn(e))

    return !e.defaultPrevented;
  };
}



