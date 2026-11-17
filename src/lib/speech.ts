export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

/** Speak text aloud with the browser's built-in text-to-speech. */
export function speak(text: string) {
  if (!canSpeak || !text) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.95
  window.speechSynthesis.speak(u)
}
