require("dotenv").config();
require("./DB/Db");
const express = require("express");

const cors = require("cors");
const multer = require("multer");
const { createWorker } = require("tesseract.js");
const eventoRoute = require("./Routes/evento.route");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
); // Origen específico de tu frontend
app.use(express.json());
// Configurar multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/api/upload", upload.array("images", 15), async (req, res) => {
  if (!req.files || req.files.length === 0)
    return res.status(400).json({ error: "No se subieron imágenes" });

  try {
    const resultados = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      // console.log(`Procesando archivo ${i + 1}: ${file.originalname}`);

      // 🔹 Worker correcto en Tesseract v5.1
      const worker = await createWorker("spa", 1);

      // 🔹 Reconocer texto directamente
      const { data } = await worker.recognize(file.buffer);

      await worker.terminate();

      const lineas = data.text.split("\n").map((l) => l.trim());
      let total = null;

      const regex = /\d+(?:\.\d+)?/g;

      // Buscar total
      for (const linea of lineas) {
        if (/total/i.test(linea)) {
          const nums = linea.match(regex);
          if (nums) total = parseFloat(nums.pop());
        }
      }

      resultados.push({
        archivo: file.originalname,
        total,
      });
    }

    console.log("Totales extraídos:", resultados);
    res.json(resultados);
  } catch (error) {
    console.error("Error al procesar imágenes:", error);
    res.status(500).json({ error: "Error al procesar imágenes" });
  }
});

app.use("/api/eventos", eventoRoute);

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
