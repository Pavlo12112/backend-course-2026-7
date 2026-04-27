const express = require('express');
const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Pool } = require('pg');
require('dotenv').config();

const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

/* =======================
   CLI
======================= */
program
  .option('-H, --host <host>', 'host', process.env.HOST || '0.0.0.0')
  .option('-p, --port <port>', 'port', process.env.PORT || 3000)
  .option('-c, --cache <cache>', 'cache', 'cache');

program.parse();
const options = program.opts();

/* =======================
   Folders
======================= */
if (!fs.existsSync(options.cache)) fs.mkdirSync(options.cache);
if (!fs.existsSync('photos')) fs.mkdirSync('photos');

/* =======================
   App
======================= */
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: 'photos/' });

/* =======================
   PostgreSQL
======================= */
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

/* =======================
   Create table
======================= */
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      photo TEXT
    )
  `);
}

/* =======================
   Swagger
======================= */
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Inventory API",
      version: "1.0.0",
      description: "Lab 7 - Docker + PostgreSQL + Swagger"
    },
    servers: [
      {
        url: `http://localhost:${options.port}`
      }
    ]
  },
  apis: ["./index.js"]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/* =======================
   HTML
======================= */
app.get('/RegisterForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'RegisterForm.html'));
});

app.get('/SearchForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'SearchForm.html'));
});

/* =======================
   REGISTER
======================= */
/**
 * @openapi
 * /register:
 *   post:
 *     summary: Register item
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - inventory_name
 *             properties:
 *               inventory_name:
 *                 type: string
 *               description:
 *                 type: string
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Created
 */
app.post('/register', upload.single('photo'), async (req, res) => {
  try {
    if (!req.body.inventory_name) {
      return res.status(400).send("Name required");
    }

    const result = await pool.query(
      `INSERT INTO inventory(name, description, photo)
       VALUES($1,$2,$3)
       RETURNING *`,
      [
        req.body.inventory_name,
        req.body.description || '',
        req.file ? req.file.filename : null
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* =======================
   GET ALL
======================= */
/**
 * @openapi
 * /inventory:
 *   get:
 *     summary: Get all items
 *     responses:
 *       200:
 *         description: OK
 */
app.get('/inventory', async (req, res) => {
  const result = await pool.query('SELECT * FROM inventory ORDER BY id');
  res.json(result.rows);
});

/* =======================
   GET ONE
======================= */
/**
 * @openapi
 * /inventory/{id}:
 *   get:
 *     summary: Get item by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: OK
 */
app.get('/inventory/:id', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM inventory WHERE id=$1',
    [req.params.id]
  );

  if (!result.rows.length) return res.sendStatus(404);

  res.json(result.rows[0]);
});

/* =======================
   DELETE
======================= */
/**
 * @openapi
 * /inventory/{id}:
 *   delete:
 *     summary: Delete item
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted
 */
app.delete('/inventory/:id', async (req, res) => {
  const result = await pool.query(
    'DELETE FROM inventory WHERE id=$1 RETURNING *',
    [req.params.id]
  );

  if (!result.rows.length) return res.sendStatus(404);

  res.sendStatus(200);
});

/* =======================
   GET PHOTO
======================= */
/**
 * @openapi
 * /inventory/{id}/photo:
 *   get:
 *     summary: Get photo
 */
app.get('/inventory/:id/photo', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM inventory WHERE id=$1',
    [req.params.id]
  );

  if (!result.rows.length) return res.sendStatus(404);

  const item = result.rows[0];

  if (!item.photo) return res.sendStatus(404);

  res.sendFile(path.join(__dirname, 'photos', item.photo));
});

/* =======================
   SEARCH
======================= */
/**
 * @openapi
 * /search:
 *   post:
 *     summary: Search item
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Found
 */
app.post('/search', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM inventory WHERE id=$1',
    [req.body.id]
  );

  if (!result.rows.length) return res.sendStatus(404);

  res.json(result.rows[0]);
});

/* =======================
   405
======================= */
app.use((req, res) => {
  res.status(405).send("Method not allowed");
});

/* =======================
   START
======================= */
initDB().then(() => {
  app.listen(options.port, options.host, () => {
    console.log(`Server: http://${options.host}:${options.port}`);
    console.log(`Swagger: http://${options.host}:${options.port}/api-docs`);
  });
});