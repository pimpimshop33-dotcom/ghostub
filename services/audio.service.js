// ── GHOSTUB Audio Service ──────────────────────────────
// Sons procéduraux via Web Audio API — pas de fichiers audio nécessaires
// Usage : import AudioService from './services/audio.service.js';
//         AudioService.playSealBreak();

class _AudioService {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.ambientDrone = null;
    this._masterGain = null;
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this.ctx.createGain();
      this._masterGain.gain.value = 0.6;
      this._masterGain.connect(this.ctx.destination);
    } catch(e) { console.warn('AudioService: Web Audio not available'); }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(v) { this.enabled = !!v; }

  // ── Chime cristallin — nouveau fantôme détecté ──
  playChime(freq = 880) {
    if (!this.enabled) return;
    this.init(); this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = freq;
    osc2.type = 'sine'; osc2.frequency.value = freq * 1.5;
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    osc.connect(gain); osc2.connect(gain);
    gain.connect(this._masterGain);
    osc.start(t); osc2.start(t + 0.05);
    osc.stop(t + 1.2); osc2.stop(t + 1.2);
  }

  // ── Cachet de cire qui se brise ──
  playSealBreak() {
    if (!this.enabled) return;
    this.init(); this.resume();
    const t = this.ctx.currentTime;
    // Noise burst (craquement)
    const bufLen = Math.floor(this.ctx.sampleRate * 0.12);
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.15));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3000, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.12);
    filter.Q.value = 2;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    noise.connect(filter).connect(gain).connect(this._masterGain);
    noise.start(t);
    // Impact grave
    const osc = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.2);
    g2.gain.setValueAtTime(0.3, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(g2).connect(this._masterGain);
    osc.start(t); osc.stop(t + 0.3);
  }

  // ── Révélation du message ──
  playReveal() {
    if (!this.enabled) return;
    this.init(); this.resume();
    const t = this.ctx.currentTime;
    [440, 554, 659, 880].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, t + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.15, t + i * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.6);
      osc.connect(gain).connect(this._masterGain);
      osc.start(t + i * 0.12);
      osc.stop(t + i * 0.12 + 0.7);
    });
  }

  // ── Résonance envoyée (onde qui s'étend) ──
  playResonance() {
    if (!this.enabled) return;
    this.init(); this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.3);
    osc.frequency.exponentialRampToValueAtTime(110, t + 1.5);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    osc.connect(gain).connect(this._masterGain);
    osc.start(t); osc.stop(t + 2);
  }

  // ── Dépôt réussi (accord satisfaisant) ──
  playDeposit() {
    if (!this.enabled) return;
    this.init(); this.resume();
    const t = this.ctx.currentTime;
    [261.6, 329.6, 392, 523.3].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i < 2 ? 'triangle' : 'sine';
      osc.frequency.value = f;
      const start = t + i * 0.08;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.9);
      osc.connect(gain).connect(this._masterGain);
      osc.start(start); osc.stop(start + 1);
    });
  }

  // ── Fantôme rare trouvé ──
  playRareGhost() {
    if (!this.enabled) return;
    this.init(); this.resume();
    const t = this.ctx.currentTime;
    // Mélodie ascendante + reverb simulée
    [523.3, 659.3, 784, 1047].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      const start = t + i * 0.15;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 1.2);
      osc.connect(gain).connect(this._masterGain);
      osc.start(start); osc.stop(start + 1.3);
    });
    // Shimmer (harmonique haute)
    const shimmer = this.ctx.createOscillator();
    const sg = this.ctx.createGain();
    shimmer.type = 'sine'; shimmer.frequency.value = 2093;
    sg.gain.setValueAtTime(0, t + 0.5);
    sg.gain.linearRampToValueAtTime(0.08, t + 0.7);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
    shimmer.connect(sg).connect(this._masterGain);
    shimmer.start(t + 0.5); shimmer.stop(t + 2.5);
  }

  // ── Ghost Whisper (chuchotement mystérieux) ──
  playWhisper() {
    if (!this.enabled) return;
    this.init(); this.resume();
    const t = this.ctx.currentTime;
    const bufLen = Math.floor(this.ctx.sampleRate * 0.8);
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      const env = Math.sin(Math.PI * i / bufLen);
      d[i] = (Math.random() * 2 - 1) * env * 0.15;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 800; filter.Q.value = 5;
    src.connect(filter).connect(this._masterGain);
    src.start(t);
  }

  // ── Drone ambiant zone hantée ──
  startAmbientDrone() {
    if (!this.enabled || this.ambientDrone) return;
    this.init(); this.resume();
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc1.type = 'sine'; osc1.frequency.value = 55;
    osc2.type = 'sine'; osc2.frequency.value = 82.5;
    gain.gain.value = 0.04;
    osc1.connect(gain); osc2.connect(gain);
    gain.connect(this._masterGain);
    osc1.start(); osc2.start();
    this.ambientDrone = { osc1, osc2, gain };
  }

  stopAmbientDrone() {
    if (!this.ambientDrone) return;
    try {
      this.ambientDrone.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
      setTimeout(() => {
        try { this.ambientDrone.osc1.stop(); this.ambientDrone.osc2.stop(); } catch(e) {}
        this.ambientDrone = null;
      }, 600);
    } catch(e) { this.ambientDrone = null; }
  }

  // ── Crescendo ouverture (existant amélioré) ──
  playSealCrescendo(durationMs = 1400) {
    if (!this.enabled) return;
    this.init(); this.resume();
    const t = this.ctx.currentTime;
    const dur = durationMs / 1000;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + dur);
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + dur);
    osc.connect(gain).connect(this._masterGain);
    osc.start(t); osc.stop(t + dur + 0.1);
    return { stop: () => { try { osc.stop(); } catch(e) {} } };
  }
}

const AudioService = new _AudioService();
export default AudioService;
