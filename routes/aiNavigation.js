const express = require('express');

const router = express.Router();

const SYSTEM_PROMPT = `You are Meds AI Navigation for Meds Healthcare in Juba, South Sudan. You help with general health education, symptom awareness, when to seek care, finding specialists, and emergency awareness.

Rules:
- You are not a doctor: do not give a definitive diagnosis or prescribe medication.
- Be clear, compassionate, and concise. Use plain language.
- For serious or emergency symptoms, tell the user to seek immediate in-person care or emergency services.
- For HIV/AIDS and similar topics: give factual, non-stigmatizing public-health information; encourage testing, treatment adherence, and care from qualified providers.
- You may mention local context (Juba) when relevant for navigation, not as medical fact specific to the user.`;

/**
 * POST /api/ai-navigation/chat
 * Body: { message: string, history?: { role: 'user'|'assistant', content: string }[] }
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not set');
      return res.status(503).json({
        error: 'AI service is not configured. Set OPENAI_API_KEY on the server.',
      });
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const prior = Array.isArray(history)
      ? history
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
          .slice(-20)
      : [];

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...prior.map((m) => ({ role: m.role, content: String(m.content).slice(0, 8000) })),
      { role: 'user', content: message.trim().slice(0, 8000) },
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 1200,
        temperature: 0.55,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI API error:', response.status, errText);
      return res.status(502).json({ error: 'AI service temporarily unavailable' });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();

    if (!text) {
      return res.status(502).json({ error: 'Empty response from AI' });
    }

    return res.json({ reply: text });
  } catch (err) {
    console.error('ai-navigation chat error:', err);
    return res.status(500).json({ error: 'Failed to generate response' });
  }
});

module.exports = router;
