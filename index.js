// index.js (Express Backend)
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { Pool } = require('pg')
const admin = require('firebase-admin')

const app = express()
app.use(cors())
app.use(express.json())

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
})

const verifyAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || ''
  const match = authHeader.match(/^Bearer (.*)$/)
  const idToken = match?.[1]
  if (!idToken) return res.status(401).json({ error: 'Missing token' })
  try {
    const decoded = await admin.auth().verifyIdToken(idToken)
    req.user = decoded
    next()
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' })
  }
}

app.get('/', (req, res) => {
  res.send('Backend server is running!')
})

app.get('/ads', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, ca.model_year, ca.doors, ca.seats,
             ea.brand, ea.specs,
             ra.area, ra.rooms, ra.price AS real_estate_price,
             ja.job_title, ja.salary, ja.employment_type
      FROM ads a
      LEFT JOIN car_ads ca ON ca.ad_id = a.id
      LEFT JOIN electronics_ads ea ON ea.ad_id = a.id
      LEFT JOIN real_estate_ads ra ON ra.ad_id = a.id
      LEFT JOIN job_ads ja ON ja.ad_id = a.id
      ORDER BY a.created_at DESC
    `)
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: 'Database error' })
  }
})

app.post('/ads', verifyAuth, async (req, res) => {
  const { title, description, images, category, extra } = req.body
  const userId = req.user.uid

  try {
    const insertAd = await pool.query(
      'INSERT INTO ads (title, description, image_url, category, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [title, description, images[0], category, userId]
    )
    const adId = insertAd.rows[0].id

    // Save extra images (if more than one)
    if (images.length > 1) {
      const values = images.slice(1).map((url, idx) => `(${adId}, '${url}')`).join(',')
      await pool.query(`INSERT INTO ad_images (ad_id, url) VALUES ${values}`)
    }

    if (category === 'car') {
      await pool.query('INSERT INTO car_ads (ad_id, model_year, doors, seats) VALUES ($1, $2, $3, $4)', [adId, extra.model_year, extra.doors, extra.seats])
    } else if (category === 'electronics') {
      await pool.query('INSERT INTO electronics_ads (ad_id, brand, specs) VALUES ($1, $2, $3)', [adId, extra.brand, extra.specs])
    } else if (category === 'real_estate') {
      await pool.query('INSERT INTO real_estate_ads (ad_id, area, rooms, price) VALUES ($1, $2, $3, $4)', [adId, extra.area, extra.rooms, extra.price])
    } else if (category === 'job') {
      await pool.query('INSERT INTO job_ads (ad_id, job_title, salary, employment_type) VALUES ($1, $2, $3, $4)', [adId, extra.job_title, extra.salary, extra.employment_type])
    }

    res.status(201).json({ message: 'Ad created', id: adId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to insert ad' })
  }
})

const PORT = process.env.PORT || 8080
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`)
})
