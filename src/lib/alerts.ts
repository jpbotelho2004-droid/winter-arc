// Alertas de fim de descanso: som, vibração e notificação (quando suportado).
// Nota: no iOS as páginas web não conseguem agendar notificações com o ecrã bloqueado.
// O cronómetro usa sempre timestamps, por isso fica correto ao regressar à aplicação.

let ctx: AudioContext | null = null

export function unlockAudio(): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    if (!ctx) ctx = new AC()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* ignorar */
  }
}

export function beep(times = 3): void {
  try {
    if (!ctx) return
    const t0 = ctx.currentTime
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = i === times - 1 ? 1175 : 880
      gain.gain.setValueAtTime(0.0001, t0 + i * 0.28)
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + i * 0.28 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.28 + 0.22)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t0 + i * 0.28)
      osc.stop(t0 + i * 0.28 + 0.25)
    }
  } catch {
    /* ignorar */
  }
}

export function vibrate(): void {
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    /* ignorar */
  }
}

export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'unsupported'
  }
}

export function notify(title: string, body: string): void {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body, silent: false })
  } catch {
    /* ignorar */
  }
}

export function notificationsSupported(): boolean {
  return typeof Notification !== 'undefined'
}
