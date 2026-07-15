const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { geminiModel } = require('../lib/geminiClient');
const { triageIncident } = require('../lib/decisionEngine');

const incidentLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Too many requests, please try again later.' }
});

router.post('/report', incidentLimiter, async (req, res) => {
    const { description } = req.body;

    if (!description || typeof description !== 'string' || description.length > 500) {
        return res.status(400).json({ error: 'Description must be a string under 500 characters.' });
    }

    const prompt = `
You are an expert incident classifier for a stadium. Analyze the following incident description and extract the details into a JSON object.
Return ONLY valid JSON. Do not include markdown formatting or fences.
The JSON must EXACTLY match this shape:
{
  "incidentType": "medical" | "overcrowding" | "security_threat" | "lost_child" | "weather" | "technical_failure" | "fire_hazard",
  "zoneCrowdLevel": "low" | "moderate" | "high" | "critical",
  "urgency": "routine" | "urgent" | "critical",
  "zone": "extracted string or 'unspecified'"
}
Incident Description: "${description}"
`;

    let aiResult;
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAYS_MS = [1000, 2000]; // delay before attempt 2, then attempt 3
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const result = await geminiModel.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            });
            const text = result.response.text();
            aiResult = JSON.parse(text);
            lastError = null;
            break; // success
        } catch (error) {
            lastError = error;
            const errMsg = error?.message || String(error);
            const errStatus = error?.status ?? error?.statusCode ?? error?.code ?? 'N/A';
            let errJson;
            try { errJson = JSON.stringify(error, Object.getOwnPropertyNames(error), 2); }
            catch (_) { errJson = String(error); }
            console.error(`=== Gemini Incident API Error (attempt ${attempt}/${MAX_ATTEMPTS}) ===`);
            console.error("status/code:", errStatus);
            console.error("message:", errMsg);
            console.error("full error object:", errJson);
            console.error("=================================");

            // Only retry on 503 (model overloaded)
            if (errStatus !== 503 || attempt === MAX_ATTEMPTS) {
                return res.status(502).json({ error: 'AI classification failed, please retry' });
            }
            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
        }
    }
    if (lastError) {
        return res.status(502).json({ error: 'AI classification failed, please retry' });
    }

    let triage;
    try {
        triage = triageIncident({
            incidentType: aiResult.incidentType,
            zoneCrowdLevel: aiResult.zoneCrowdLevel,
            urgency: aiResult.urgency
        });
    } catch (error) {
        console.error("Triage Error:", error);
        return res.status(502).json({ error: 'AI returned an unrecognized category, please retry' });
    }

    return res.status(200).json({
        classification: {
            incidentType: aiResult.incidentType,
            zoneCrowdLevel: aiResult.zoneCrowdLevel,
            urgency: aiResult.urgency,
            zone: aiResult.zone || 'unspecified'
        },
        triage
    });
});

module.exports = router;
