import axios from 'axios';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.5-flash';

if (!GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY');
}

async function listAvailableModels() {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models';
  const res = await axios.get(url, {
    headers: {
      'x-goog-api-key': GEMINI_API_KEY,
    },
    timeout: 15000,
  });
  return res.data.models;
}

export default async function callGemini(prompt, structuredSchema = null) {
  // Optionally list the models (for debug / dynamic model selection)
  const models = await listAvailableModels();
  console.log('Available models:', models.map(m => m.name));

  const modelName = DEFAULT_MODEL;  // Ensure this is one of the valid names from listAvailableModels
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent`;

  const generationConfig = {};
  if (structuredSchema?.json_schema) {
    generationConfig.response_mime_type = 'application/json';
    generationConfig.response_schema = structuredSchema.json_schema;
  }

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
  };

  try {
    const res = await axios.post(url, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      timeout: 30000,
    });
    return res.data;
  } catch (err) {
    console.error('Gemini API error:', err.response?.data || err.message);
    throw new Error(`Gemini API failed: ${err.response?.data?.error?.message || err.message}`);
  }
}
