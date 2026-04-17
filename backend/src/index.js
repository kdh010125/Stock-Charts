require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Placeholder endpoints
app.get('/api/stocks', (req, res) => {
  // TODO: Integrate real stock API
  res.json([
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology' }
  ]);
});

app.get('/api/stocks/:symbol', (req, res) => {
  // TODO: Integrate real stock details & chart data
  res.json({
    symbol: req.params.symbol,
    name: 'Sample Stock',
    chartData: [],
    news: []
  });
});

app.get('/api/predict/:symbol', (req, res) => {
  // TODO: Replace with real AI prediction
  res.json({
    symbol: req.params.symbol,
    prediction: 'up',
    confidence: 0.7,
    explanation: 'Based on recent trend, predicted to rise.'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
