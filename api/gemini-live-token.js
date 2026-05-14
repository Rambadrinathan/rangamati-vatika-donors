export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini Live not configured' });
  }

  const { lang } = req.body || {};
  const langLine = lang === 'bn'
    ? 'Speak Bengali when the user speaks Bengali, using Bengali script.'
    : lang === 'hi'
    ? 'Speak Hindi when the user speaks Hindi, using Devanagari.'
    : 'Speak English when the user speaks English.';

  const systemPrompt = `You are Priya, a warm and knowledgeable Sponsorship Advisor for KarmYog Vatika at RangaMati. You are a young Indian woman who speaks like a trusted friend.

${langLine}

This is a real-time voice conversation. Keep each spoken reply short, natural, and conversational — 2-4 sentences max.
Do not use markdown, bullets, numbered lists, or emoji.
Do not say "prayer hands" or describe emoji — speak naturally.

Your ONLY role is to answer questions about KarmYog Vatika at RangaMati sponsorship. If asked about anything else, politely redirect.

Key facts you know:
- KarmYog Vatika at RangaMati — intergenerational campus near Uluberia, West Bengal, on the Ganges
- 4 Named Ashrams (~80 kathas) + Temple Complex (~17 kathas)
- Gunagrahi Awaas sponsorship = 51 Lakhs (naming + nomination rights)
- Swajan Griha = 21 Lakhs, Atithi Kutir = 21 Lakhs
- Bhojanalaya = 11 Lakhs, Biophilic Commons = 11 Lakhs
- Biophilic Vatika = 7 Lakhs
- GunaKul Beds = 2 Lakhs, Swajan Beds = 4 Lakhs, Atithi Beds = 4 Lakhs
- Per-ashram total = 5.50 Crore
- Contact: Ram ji at +91 9167719898 or reachus@ky21c.org

If unsure about something, say "Let me connect you with Ram ji for accurate details."`;

  const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-2.0-flash-live-001';

  const now = Date.now();
  const expire_time = new Date(now + 30 * 60 * 1000).toISOString();
  const new_session_expire_time = new Date(now + 2 * 60 * 1000).toISOString();

  const tokenRequest = {
    uses: 1,
    expire_time,
    new_session_expire_time,
    bidi_generate_content_setup: {
      model: `models/${LIVE_MODEL}`,
      generation_config: {
        response_modalities: ['AUDIO'],
        temperature: 0.55,
      },
      session_resumption: {},
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      input_audio_transcription: {},
      output_audio_transcription: {},
    },
  };

  try {
    const tokenRes = await fetch('https://generativelanguage.googleapis.com/v1alpha/auth_tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(tokenRequest),
    });

    const rawBody = await tokenRes.text();
    let token = {};
    try { token = JSON.parse(rawBody); } catch { token = {}; }

    if (!tokenRes.ok || !token.name) {
      console.error('Gemini Live token error:', { status: tokenRes.status, body: rawBody });
      return res.status(502).json({ error: 'Could not create voice session' });
    }

    return res.status(200).json({
      token: token.name,
      model: LIVE_MODEL,
      websocketUrl: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token.name)}`,
    });
  } catch (err) {
    console.error('Gemini Live token error:', err);
    return res.status(500).json({ error: 'Voice service error' });
  }
}
