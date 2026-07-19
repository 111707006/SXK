/**
 * Shared Qwen3-ASR speech recognition helper.
 * Sends a recorded audio blob to the backend /api/asr endpoint (which proxies
 * to Alibaba DashScope qwen3-asr-flash) and returns the recognized text.
 * Returns null on any failure so callers can fall back to simulated recognition.
 */
export async function transcribeWithQwenASR(audioBlob: Blob, contextPrompt: string): Promise<string | null> {
  try {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });
    const resp = await fetch('/api/asr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioData: dataUrl, context: `儿童正在朗读："${contextPrompt}"` })
    });
    if (!resp.ok) return null;
    const ct = resp.headers.get('content-type');
    if (!ct || !ct.includes('application/json')) return null;
    const result = await resp.json();
    return result.text ? String(result.text) : null;
  } catch (err) {
    console.warn('Qwen ASR unavailable, will fall back to simulated recognition:', err);
    return null;
  }
}

/** Strip punctuation/whitespace so recognized speech can be compared to the target. */
export const cleanSpeechText = (s: string) => s.replace(/[，。！？、,.!?…\s]/g, '');

export type ArticulationStatus = 'normal' | 'substitute' | 'stutter' | 'unclear';

/** Classify a child's recognized speech against the target prompt. */
export function judgeArticulation(promptText: string, recognized: string): ArticulationStatus {
  const p = cleanSpeechText(promptText);
  const t = cleanSpeechText(recognized);
  if (!t) return 'unclear';
  if (t === p) return 'normal';
  // Repeated leading syllables (e.g. "苹苹苹果") read as dysfluency
  if (t.length > p.length && /(.)\1/.test(t.slice(0, 4))) return 'stutter';
  return 'substitute';
}
