require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cloudinary = require('cloudinary').v2;

const app = express();
app.use(cors());
app.use(express.json());

// Middleware to log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Debug: Check required environment variables
console.log('Loaded env vars:', {
  DATABASE_URL: process.env.DATABASE_URL ? '✔️' : '❌ MISSING',
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? '✔️' : '❌ MISSING',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? '✔️' : '❌ MISSING',
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? '✔️' : '❌ MISSING',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? '✔️' : '❌ MISSING',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? '✔️' : '❌ MISSING',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? '✔️' : '❌ MISSING',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? '✔️' : '❌ MISSING',
});

// Initialize PostgreSQL with SSL (required for Supabase)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Test PostgreSQL connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Postgres connection error:', err.message);
  } else {
    console.log('✅ Postgres connected at:', res.rows[0].now);
  }
});

// Initialize Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
  console.log('✅ Firebase initialized');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Routes
app.get('/', (req, res) => {
  res.send('Backend server is running!');
});

app.get('/ads', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ads ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error querying ads:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Start server
const PORT = process.env.PORT || 6543;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
