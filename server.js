require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Ensure API clients are loaded AFTER dotenv so key-checks fire at startup
require('./src/lib/geminiClient');
require('./src/lib/mapsClient');

const incidentsRouter = require('./src/routes/incidents');
const chatRouter = require('./src/routes/chat');
const routeRouter = require('./src/routes/route');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json()); // Need to parse JSON bodies
app.use(express.static('public'));

app.use('/api/incidents', incidentsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/route', routeRouter);

app.get('/health', (req, res) => {
    res.json({ status: "ok" });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
