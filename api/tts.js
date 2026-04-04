export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, lang } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  const apiKey = process.env.GOOGLE_TTS_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Voice service not configured' });
  }

  // Strip markdown AND all emoji for speech
  const cleanText = text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\n/g, '. ')
    // Remove ALL emoji (Unicode emoji ranges)
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')  // emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')  // symbols & pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')  // transport & map
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')  // flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '')    // misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')    // dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')    // variation selectors
    .replace(/[\u{200D}]/gu, '')              // zero width joiner
    .replace(/[\u{20E3}]/gu, '')              // combining enclosing keycap
    .replace(/[\u{E0020}-\u{E007F}]/gu, '')  // tags
    .replace(/  +/g, ' ')                     // collapse double spaces
    .trim()
    .slice(0, 5000);

  // Google Chirp3-HD voices — Kore (female) across all Indian languages
  const voices = {
    bn: { languageCode: 'bn-IN', name: 'bn-IN-Chirp3-HD-Kore' },
    hi: { languageCode: 'hi-IN', name: 'hi-IN-Chirp3-HD-Kore' },
    en: { languageCode: 'en-IN', name: 'en-IN-Chirp3-HD-Kore' },
  };
  const voiceConfig = voices[lang] || voices.en;

  try {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: cleanText },
          voice: voiceConfig,
          audioConfig: {
            audioEncoding: 'MP3',
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Google TTS error:', response.status, errText);
      return res.status(502).json({ error: 'Voice synthesis failed' });
    }

    const data = await response.json();
    if (!data.audioContent) {
      return res.status(502).json({ error: 'No audio returned' });
    }

    const audioBuffer = Buffer.from(data.audioContent, 'base64');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.send(audioBuffer);
  } catch (err) {
    console.error('TTS error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
