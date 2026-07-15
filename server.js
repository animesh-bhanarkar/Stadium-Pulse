require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Ensure geminiClient is loaded AFTER dotenv
require('./src/lib/geminiClient');

const incidentsRouter = require('./src/routes/incidents');
const chatRouter = require('./src/routes/chat');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json()); // Need to parse JSON bodies
app.use(express.static('public'));

app.use('/api/incidents', incidentsRouter);
app.use('/api/chat', chatRouter);

app.get('/health', (req, res) => {
    res.json({ status: "ok" });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
