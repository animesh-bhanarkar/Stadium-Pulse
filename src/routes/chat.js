const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { geminiModel } = require('../lib/geminiClient');
const { retryWithBackoff } = require('../lib/retryWithBackoff');

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

    try {
        const reply = await retryWithBackoff(async () => {
            const result = await geminiModel.generateContent({ contents });
            return result.response.text();
        }, {
            logPrefix: "Chat API Error",
            logDivider: "=====================",
            retryableCheck: (error) => {
                const errStatus = error?.status ?? error?.statusCode ?? error?.code ?? 'N/A';
                return errStatus === 503;
            }
        });
        return res.status(200).json({ reply });
    } catch (error) {
        return res.status(502).json({ error: 'AI service unavailable, please try again later.' });
    }
});

module.exports = router;
