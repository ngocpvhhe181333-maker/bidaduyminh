import paymentSuccessSound from '../assets/payment-success.mp3'

let audio

export function playPaymentSuccessSound() {
  try {
    if (!audio) audio = new Audio(paymentSuccessSound)
    audio.currentTime = 0
    void audio.play().catch(() => {})
  } catch {
    // Audio availability must not affect a completed payment.
  }
}
