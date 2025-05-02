const express = require('express');
const path = require('path');
const app = express();
const PORT = 3030;

// Configure static file serving
app.use(express.static(path.join(__dirname)));

// Simple route handling
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback for client-side routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Frontend server running on http://localhost:${PORT}`);
});