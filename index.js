require("dotenv").config();
const express = require("express");
const vision = require("@google-cloud/vision");
const fs = require("fs");
const cors = require("cors");
const multer = require("multer");

const eventoRoute = require("./Routes/evento.route");

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURAR CORS ---
const allowedOrigins = [
  process.env.FRONTEND_URL_LOCAL,
  process.env.FRONTEND_URL_PROD,
   "http://localhost:5173", 
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

// --- CONFIGURAR MULTER ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 70 }, // 10MB x archivo, hasta 70 archivos
});

// --- CONFIGURAR GOOGLE VISION CLIENT ---
console.log("GOOGLE_CREDENTIALS definida:", !!process.env.GOOGLE_CREDENTIALS);
if (process.env.GOOGLE_CREDENTIALS) {
  fs.writeFileSync("/tmp/vision-key.json", process.env.GOOGLE_CREDENTIALS);
  console.log("Credenciales cargadas en /tmp/vision-key.json");
} else {
  console.error(
    "GOOGLE_CREDENTIALS no definida. Revisa configuración en Render."
  );
}
const client = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_CREDENTIALS
    ? "/tmp/vision-key.json"
    : "./vision-key.json",
});

// --- RUTA DE UPLOAD ---
app.post("/api/upload", upload.array("images", 70), async (req, res) => {
  if (!req.files || req.files.length === 0)
    return res.status(400).json({ error: "No se subieron imágenes" });

  try {
    const resultados = await Promise.all(
      req.files.map(async (file) => {
        const [result] = await client.textDetection({
          image: { content: file.buffer },
        });

        const text = result.fullTextAnnotation
          ? result.fullTextAnnotation.text
          : "";

        // --- EXTRAER TOTAL ---
        const totalRegex =
          /Total[\s:]*([\s\S]{0,20}?)([0-9O]+(?:\.[0-9O]+)?)\s*bs/i;
        let total = null;
        const matchTotal = text.match(totalRegex);
        if (matchTotal) {
          let numberText = matchTotal[2]
            .replace(/O/gi, "0")
            .replace(/[^0-9.]/g, "");
          if (numberText.length > 0) total = Number(numberText);
        }

        // --- EXTRAER HORA ---
        const horaRegex = /\b([01]?[0-9]|2[0-3]):[0-5][0-9]\b/;
        const matchHora = text.match(horaRegex);
        const hora = matchHora ? matchHora[0] : "No detectada";

        return { archivo: file.originalname, total, hora };
      })
    );

    // --- ORDENAR POR HORA CRONOLOGICA ---
    const ordenarPorHoraCronologica = (resArray) => {
      const convertToMinutes = (h) => {
        const [hh, mm] = h.split(":").map(Number);
        return hh * 60 + mm;
      };

      // Detectamos horas válidas
      const minutosArray = resArray
        .map((r) =>
          r.hora && r.hora !== "No detectada" ? convertToMinutes(r.hora) : null
        )
        .filter((m) => m !== null);

      const UMBRAL_NOCHE = 18 * 60; // 18:00

      resArray.forEach((r) => {
        if (!r.hora || r.hora === "No detectada") {
          r.horaOrden = Infinity;
          return;
        }

        let minutos = convertToMinutes(r.hora);

        if (
          minutos < UMBRAL_NOCHE &&
          minutosArray.some((m) => m >= UMBRAL_NOCHE)
        ) {
          minutos += 24 * 60; // sumamos 24h para colocar después de la noche
        }

        r.horaOrden = minutos;
      });

      resArray.sort((a, b) => a.horaOrden - b.horaOrden);
      resArray.forEach((r) => delete r.horaOrden);
      return resArray;
    };

    const resultadosOrdenados = ordenarPorHoraCronologica(resultados);

    console.log(
      "Resultados extraídos:",
      JSON.stringify(resultadosOrdenados, null, 2)
    );
    res.json(resultadosOrdenados);
  } catch (error) {
    console.error("Error general al procesar imágenes:", error.message);
    res.status(500).json({
      error: "Error general al procesar imágenes",
      detalle: error.message,
    });
  }
});

// --- RUTAS ADICIONALES ---
app.use("/api/eventos", eventoRoute);

// --- INICIAR SERVIDOR ---
app.listen(PORT, () => {
  console.log(
    `Servidor escuchando en el puerto ${PORT} en todas las interfaces`
  );
});
