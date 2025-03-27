const express = require('express');
const { MongoClient } = require('mongodb');
const taskRoutes = require('./routes/taskRoutes'); // Import the routes
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;
const MONGODB_URI = 'mongodb://root:root@localhost:27017/m165?authSource=admin&directConnection=true';

// Middleware
app.use(express.json());
app.use(cors())

// Database connection middleware
app.use(async (req, res, next) => {
  try {
    if (!req.db) {
      const client = await MongoClient.connect(MONGODB_URI);
      req.db = client.db();
    }
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ error: 'Database connection error' });
  }
});

// Routes
app.use('/api', taskRoutes);

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});