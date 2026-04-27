require('dotenv').config();

const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

// middleware
app.use(express.json());

// test route
app.get('/', (req, res) => {
  res.json({ message: 'API is running 🚀' });
});

// start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});