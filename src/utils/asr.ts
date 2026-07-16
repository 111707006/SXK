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
