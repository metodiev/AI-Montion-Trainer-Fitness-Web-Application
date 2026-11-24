export type SoundName =
  | 'count'
  | 'clean'
  | 'warn'
  | 'error'
  | 'start'
  | 'finish'
  | 'levelUp'
  | 'achievement'
  | 'tick';

interface ToneStep {
  frequency: number;
  duration: number;
  type: OscillatorType;
  gain: number;
  delay?: number;
  slideTo?: number;
}

const SOUNDS: Record<SoundName, ToneStep[]> = {
  count: [{ frequency: 660, duration: 0.07, type: 'sine', gain: 0.12 }],
  clean: [
    { frequency: 784, duration: 0.08, type: 'sine', gain: 0.14 },
    { frequency: 1046, duration: 0.1, type: 'sine', gain: 0.12, delay: 0.07 },
  ],
  warn: [
    { frequency: 392, duration: 0.12, type: 'triangle', gain: 0.1 },
    { frequency: 330, duration: 0.14, type: 'triangle', gain: 0.1, delay: 0.1 },
  ],
  error: [
    { frequency: 220, duration: 0.16, type: 'sawtooth', gain: 0.07 },
    { frequency: 180, duration: 0.18, type: 'sawtooth', gain: 0.06, delay: 0.13 },
  ],
  start: [
    { frequency: 523, duration: 0.1, type: 'sine', gain: 0.12 },
    { frequency: 659, duration: 0.1, type: 'sine', gain: 0.12, delay: 0.1 },
    { frequency: 784, duration: 0.16, type: 'sine', gain: 0.12, delay: 0.2 },
  ],
  finish: [
    { frequency: 523, duration: 0.14, type: 'sine', gain: 0.12 },
    { frequency: 659, duration: 0.14, type: 'sine', gain: 0.12, delay: 0.14 },
    { frequency: 784, duration: 0.14, type: 'sine', gain: 0.12, delay: 0.28 },
    { frequency: 1046, duration: 0.32, type: 'sine', gain: 0.13, delay: 0.42 },
  ],
  levelUp: [
    { frequency: 659, duration: 0.12, type: 'triangle', gain: 0.12 },
    { frequency: 880, duration: 0.12, type: 'triangle', gain: 0.12, delay: 0.12 },
    { frequency: 1174, duration: 0.3, type: 'triangle', gain: 0.13, delay: 0.24, slideTo: 1318 },
  ],
  achievement: [
    { frequency: 880, duration: 0.1, type: 'square', gain: 0.05 },
    { frequency: 1108, duration: 0.1, type: 'square', gain: 0.05, delay: 0.1 },
    { frequency: 1318, duration: 0.24, type: 'square', gain: 0.05, delay: 0.2 },
  ],
  tick: [{ frequency: 880, duration: 0.04, type: 'sine', gain: 0.06 }],
};

export interface AudioFeedbackOptions {
  volume?: number;
  sound?: boolean;
  voice?: boolean;
}

/**
 * Synthesises all game audio with the Web Audio API: no audio files to download
 * and no network requests. Speech uses the local browser voice.
 */
export class AudioFeedback {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume: number;
  private soundEnabled: boolean;
  private voiceEnabled: boolean;
  private lastSpokenAt = 0;
  private lastSpokenText = '';
  private voice: SpeechSynthesisVoice | null = null;

  constructor(options: AudioFeedbackOptions = {}) {
    this.volume = options.volume ?? 0.7;
    this.soundEnabled = options.sound ?? true;
    this.voiceEnabled = options.voice ?? true;
  }

  configure(options: AudioFeedbackOptions): void {
    if (options.volume !== undefined) {
      this.volume = Math.max(0, Math.min(1, options.volume));
      if (this.master && this.context) {
        this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.02);
      }
    }
    if (options.sound !== undefined) this.soundEnabled = options.sound;
    if (options.voice !== undefined) {
      if (!options.voice && this.voiceEnabled) this.stopSpeech();
      this.voiceEnabled = options.voice;
    }
  }

  /** Must be called from a user gesture on Safari/Chrome. */
  async unlock(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      if (!this.context) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.context = new Ctor();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') await this.context.resume();
    } catch {
      this.context = null;
      this.master = null;
    }
  }

  play(name: SoundName): void {
    if (!this.soundEnabled) return;
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    for (const step of SOUNDS[name]) {
      const start = now + (step.delay ?? 0);
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = step.type;
      oscillator.frequency.setValueAtTime(step.frequency, start);
      if (step.slideTo) {
        oscillator.frequency.exponentialRampToValueAtTime(step.slideTo, start + step.duration);
      }
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(step.gain, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + step.duration);
      oscillator.connect(gain);
      gain.connect(this.master);
      oscillator.start(start);
      oscillator.stop(start + step.duration + 0.02);
    }
  }

  speak(text: string, options: { force?: boolean; rate?: number } = {}): void {
    if (!this.voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const now = Date.now();
    if (!options.force) {
      if (text === this.lastSpokenText && now - this.lastSpokenAt < 4000) return;
      if (now - this.lastSpokenAt < 1800) return;
    }
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = Math.max(0, Math.min(1, this.volume));
      utterance.rate = options.rate ?? 1.03;
      utterance.pitch = 1.02;
      if (!this.voice) {
        this.voice =
          synth
            .getVoices()
            .find((candidate) => /en[-_]/i.test(candidate.lang) && /female|samantha|karen|serena|zira|aria/i.test(candidate.name)) ??
          synth.getVoices().find((candidate) => /^en/i.test(candidate.lang)) ??
          null;
      }
      if (this.voice) utterance.voice = this.voice;
      this.lastSpokenAt = now;
      this.lastSpokenText = text;
      synth.speak(utterance);
    } catch {
      // Voice is optional; ignore unavailable speech engines.
    }
  }

  count(value: number, clean = true): void {
    this.play(clean ? 'clean' : 'count');
    const words = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
    const word = value <= 10 ? words[value - 1] : `${value}`;
    if (value % 5 === 0 || value <= 3) {
      this.speak(word);
    } else {
      this.speak(word, { force: false });
    }
  }

  coach(severity: 'error' | 'warning' | 'success' | 'info', message: string): void {
    if (severity === 'error') this.play('error');
    else if (severity === 'warning') this.play('warn');
    else if (severity === 'success') this.play('clean');
    if (severity !== 'info') this.speak(message);
  }

  stopSpeech(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }

  dispose(): void {
    this.stopSpeech();
    try {
      void this.context?.close();
    } catch {
      // ignore
    }
    this.context = null;
    this.master = null;
  }
}

let singleton: AudioFeedback | null = null;

export function getAudioFeedback(): AudioFeedback {
  if (!singleton) singleton = new AudioFeedback();
  return singleton;
}
