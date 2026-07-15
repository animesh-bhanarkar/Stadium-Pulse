const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { geminiModel } = require('../lib/geminiClient');

const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Too many requests, please try again later.' }
});

const SYSTEM_INSTRUCTION = "You are StadiumPulse Assistant, helping FIFA World Cup 2026 stadium staff and volunteers with operational questions — crowd management, safety procedures, general guidance. Be concise and practical.";

router.post('/', chatLimiter, async (req, res) => {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string' || message.length > 1000) {
        return res.status(400).json({ error: 'Message must be a string under 1000 characters.' });
    }

    const MAX_ATTEMPTS = 3;
    const RETRY_DELAYS_MS = [1000, 2000]; // delay before attempt 2, then attempt 3

    // Build contents array starting with system instruction
    const contents = [
        { role: 'user', parts: [{ text: SYSTEM_INSTRUCTION }] },
        { role: 'model', parts: [{ text: "Understood. I am StadiumPulse Assistant." }] }
    ];

    // Append history
    for (const turn of history) {
        contents.push(turn);
    }

    // Append current message
    contents.push({ role: 'user', parts: [{ text: message }] });

    let reply;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const result = await geminiModel.generateContent({ contents });
            reply = result.response.text();
            break; // success
        } catch (error) {
            const errMsg = error?.message || String(error);
            const errStatus = error?.status ?? error?.statusCode ?? error?.code ?? 'N/A';
            let errJson;
            try { errJson = JSON.stringify(error, Object.getOwnPropertyNames(error), 2); }
            catch (_) { errJson = String(error); }
            console.error(`=== Chat API Error (attempt ${attempt}/${MAX_ATTEMPTS}) ===`);
            console.error("status/code:", errStatus);
            console.error("message:", errMsg);
            console.error("full error object:", errJson);
            console.error("=====================");

            // Only retry on 503 (model overloaded)
            if (errStatus !== 503 || attempt === MAX_ATTEMPTS) {
                return res.status(502).json({ error: 'AI service unavailable, please try again later.' });
            }
            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
        }
    }

    return res.status(200).json({ reply });
});

module.exports = router;
