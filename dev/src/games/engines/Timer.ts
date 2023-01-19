import { createSignal, Accessor, Setter } from 'solid-js'

export type TimerSerial = {
  start: Date,
  end: Date,
}



export class Timer {
  start: Date | null
  end: Date | null
  timeout: number | null
  isAnimating: boolean
  msRemaining: Accessor<number>
  setMsRemaining: Setter<number>
  percentRemaining: Accessor<number>
  setPercentRemaining: Setter<number>
  clientGraceMs: number // To account for db message timings

  constructor() {
    this.start = null;
    this.end = null;
    this.timeout = null;
    this.isAnimating = false;
    [this.msRemaining, this.setMsRemaining] = createSignal<number>(0);
    [this.percentRemaining, this.setPercentRemaining] = createSignal<number>(0);
    this.clientGraceMs = 3000;
  }

  static initState() {
    return {
      start: new Date(0),
      end: new Date(0),
    }
  }

  unset() {
    if (this.timeout) {
      window.clearTimeout(this.timeout);
    }
    this.start = new Date(0);
    this.end = new Date(0);
  }

  serialize(): TimerSerial {
    return {
      start: this.start ?? new Date(0),
      end: this.end ? new Date(this.end.getTime() - this.clientGraceMs) : new Date(0),
    }
  }

  startAnimation() {
    this.isAnimating = true;
    this.animate();
  }

  animate() {
    const now = new Date();
    if (this.start && this.end) {
      if (now < this.end) {
        const remaining = this.end.getTime() - now.getTime();
        this.setMsRemaining(remaining);
        const duration = this.end.getTime() - this.start.getTime();
        this.setPercentRemaining(100 * remaining / duration);
      } else {
        this.setMsRemaining(0);
        this.setPercentRemaining(0);
        this.isAnimating = false;
      }
    }
    if (this.isAnimating) {
      window.requestAnimationFrame(() => { this.animate() });
    }
  }

  setFromSerial(s: TimerSerial, callback: () => void) {
    if (this.timeout) {
      window.clearTimeout(this.timeout);
    }
    this.start = new Date(s.start);
    this.end = new Date(s.end);
    const now = new Date();
    console.log("end, now", this.end, now, now < this.end)
    if (this.end && now < this.end) {
      this.timeout = window.setTimeout(() => { callback() }, this.end.getTime() - now.getTime());
      this.startAnimation();
    }
  }

  countdown(seconds: number, callback: () => void) {
    if (this.timeout) {
      window.clearTimeout(this.timeout);
    }
    console.log("countdown!")
    this.start = new Date();
    this.end = new Date();
    this.end.setSeconds(this.end.getSeconds() + seconds);
    this.timeout = window.setTimeout(() => { callback() }, seconds * 1000);
    this.startAnimation();
  }

  stopCountdown() {
    this.isAnimating = false;
    if (this.timeout) {
      window.clearTimeout(this.timeout);
    }
  }
}