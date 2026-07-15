const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("Startup Error: GEMINI_API_KEY is missing from environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey);

// Export a model instance. Model: gemini-2.5-flash
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

module.exports = {
    genAI,
    geminiModel
};
