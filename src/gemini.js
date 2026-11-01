const MODEL = 'gemini-3.8-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`;

/**
 * Streams a Gemini reply. `history` is [{ role: 'user' | 'model', text }].
 * Calls onChunk with each piece of text as it arrives and resolves with the full reply.
 */
export async function streamChat({ apiKey, system, history, onChunk, signal }) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      generationConfig: { temperature: 0.7 },
    }),
    signal,
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.error?.message || '';
    } catch {}
    throw new Error(detail || `Gemini request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by blank lines; keep any partial event in the buffer.
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop();
    for (const event of events) {
      const data = event
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join('');
      if (!data) continue;
      const json = JSON.parse(data);
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      if (text) {
        full += text;
        onChunk(text);
      }
    }
  }

  return full;
}
