const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("Startup Error: GEMINI_API_KEY is missing from environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey);

// We'll export a function to get the model so it can be dynamically swapped if needed,
// but the prompt says: "Exports an initialized @google/generative-ai client using model 'gemini-2.0-flash'"
// Let's export the initialized model directly, or the genAI instance.
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

module.exports = {
    genAI,
    geminiModel
};
