import { useSyncExternalStore } from 'react'

// Tiny Web Audio synth — no audio files needed, works offline.
const KEY = 'kml_sound_enabled'
const EVENT = 'kml-sound-change'
let ctx = null

export const isSoundEnabled = () => {
    try {
        return localStorage.getItem(KEY) !== '0'
    } catch {
        return true
    }
}

export const setSoundEnabled = (enabled) => {
    try {
        localStorage.setItem(KEY, enabled ? '1' : '0')
    } catch { /* ignore */ }
    window.dispatchEvent(new Event(EVENT))
}

const subscribe = (cb) => {
    window.addEventListener(EVENT, cb)
    window.addEventListener('storage', cb)
    return () => {
        window.removeEventListener(EVENT, cb)
        window.removeEventListener('storage', cb)
    }
}

export function useSoundEnabled() {
    return useSyncExternalStore(subscribe, isSoundEnabled, () => true)
}

function tone(freq, duration = 0.1, delay = 0, type = 'sine', volume = 0.07) {
    try {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
        if (ctx.state === 'suspended') ctx.resume()
        const t = ctx.currentTime + delay
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = type
        osc.frequency.setValueAtTime(freq, t)
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(volume, t + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
        osc.connect(gain).connect(ctx.destination)
        osc.start(t)
        osc.stop(t + duration + 0.02)
    } catch { /* audio not available */ }
}

export const playBeep = () => {
    if (!isSoundEnabled()) return
    tone(880, 0.09, 0, 'sine', 0.06)
}

export const playTap = () => {
    if (!isSoundEnabled()) return
    tone(520, 0.05, 0, 'triangle', 0.04)
}

export const playSuccess = () => {
    if (!isSoundEnabled()) return
    tone(659.25, 0.14, 0)
    tone(880, 0.14, 0.11)
    tone(1318.5, 0.28, 0.22, 'sine', 0.06)
}

export const playError = () => {
    if (!isSoundEnabled()) return
    tone(220, 0.16, 0, 'square', 0.03)
    tone(180, 0.2, 0.12, 'square', 0.03)
}
