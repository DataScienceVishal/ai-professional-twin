import { OpenAI } from 'openai';

const openai = new OpenAI({
    baseURL: "https://models.github.ai/inference",
    apiKey: process.env.GITHUB_TOKEN
});

export default async function handler(request, response) {
    // Standard Cross-Origin Headers
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'POST requests allowed only.' });
    }

    try {
        if (!request.body || !request.body.messages) {
            return response.status(400).json({ error: "Missing message context payload." });
        }

        const { messages } = request.body;

        const completion = await openai.chat.completions.create({
            model: 'GPT-4.1-mini', 
            messages: messages,
            temperature: 0.3
        });
        
        return response.status(200).json(completion);

    } catch (error) {
        console.error('Pipeline Error:', error);
        return response.status(500).json({ error: "Inference endpoint failed to reply." });
    }
}