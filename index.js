require("dotenv").config();

const express = require("express");
const { program } = require("commander");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const pool = require("./src/db");

/* =======================
   CLI
======================= */
program
  .option("-H, --host <host>", "host", process.env.HOST || "0.0.0.0")
  .option("-p, --port <port>", "port", process.env.PORT || 3000)
  .option("-c, --cache <cache>", "cache", "cache");

program.parse();

const options = program.opts();

/* =======================
   Folders
======================= */
if (!fs.existsSync(options.cache)) fs.mkdirSync(options.cache);

if (!fs.existsSync("photos")) fs.mkdirSync("photos");

/* =======================
   App
======================= */
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: "photos/" });

/* =======================
   Swagger
======================= */
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Inventory API",
      version: "2.0.0"
    }
  },
  apis: ["./index.js"]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/* =======================
   HTML Forms
======================= */
app.get("/RegisterForm.html", (req, res) => {
  res.sendFile(path.join(__dirname, "RegisterForm.html"));
});

app.get("/SearchForm.html", (req, res) => {
  res.sendFile(path.join(__dirname, "SearchForm.html"));
});

/* =======================
   REGISTER
======================= */
app.post("/register", upload.single("photo"), async (req, res) => {
  try {
    if (!req.body.inventory_name)
      return res.status(400).send("Name required");

    const result = await pool.query(
      `INSERT INTO inventory(name, description, photo)
       VALUES($1,$2,$3)
       RETURNING *`,
      [
        req.body.inventory_name,
        req.body.description || "",
        req.file ? req.file.filename : null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).send("Server error");
  }
});

/* =======================
   GET ALL
======================= */
app.get("/inventory", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM inventory ORDER BY id"
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).send("Server error");
  }
});

/* =======================
   GET ONE
======================= */
app.get("/inventory/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM inventory WHERE id=$1",
      [req.params.id]
    );

    if (result.rows.length === 0)
      return res.sendStatus(404);

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).send("Server error");
  }
});

/* =======================
   UPDATE
======================= */
app.put("/inventory/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE inventory
       SET name = COALESCE($1,name),
           description = COALESCE($2,description)
       WHERE id=$3
       RETURNING *`,
      [
        req.body.name || null,
        req.body.description || null,
        req.params.id
      ]
    );

    if (result.rows.length === 0)
      return res.sendStatus(404);

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).send("Server error");
  }
});

/* =======================
   DELETE
======================= */
app.delete("/inventory/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM inventory WHERE id=$1 RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0)
      return res.sendStatus(404);

    res.sendStatus(200);
  } catch (error) {
    res.status(500).send("Server error");
  }
});

/* =======================
   GET PHOTO
======================= */
app.get("/inventory/:id/photo", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM inventory WHERE id=$1",
      [req.params.id]
    );

    if (
      result.rows.length === 0 ||
      !result.rows[0].photo
    ) {
      return res.sendStatus(404);
    }

    res.sendFile(
      path.join(__dirname, "photos", result.rows[0].photo)
    );
  } catch (error) {
    res.status(500).send("Server error");
  }
});

/* =======================
   UPDATE PHOTO
======================= */
app.put(
  "/inventory/:id/photo",
  upload.single("photo"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE inventory
         SET photo=$1
         WHERE id=$2
         RETURNING *`,
        [req.file.filename, req.params.id]
      );

      if (result.rows.length === 0)
        return res.sendStatus(404);

      res.sendStatus(200);
    } catch (error) {
      res.status(500).send("Server error");
    }
  }
);

/* =======================
   SEARCH
======================= */
app.post("/search", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM inventory WHERE id=$1",
      [req.body.id]
    );

    if (result.rows.length === 0)
      return res.sendStatus(404);

    let item = result.rows[0];

    if (req.body.has_photo) {
      item.photoLink = `/inventory/${item.id}/photo`;
    }

    res.json(item);
  } catch (error) {
    res.status(500).send("Server error");
  }
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
app.listen(options.port, options.host, () => {
  console.log(
    `Server: http://${options.host}:${options.port}`
  );

  console.log(
    `Swagger: http://${options.host}:${options.port}/api-docs`
  );
});