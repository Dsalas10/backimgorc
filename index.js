require("dotenv").config();
require("./DB/Db");
const express = require("express");

const cors = require("cors");
const multer = require("multer");
// const { createWorker } = require("tesseract.js");
const eventoRoute = require("./Routes/evento.route");

const vision = require("@google-cloud/vision"); // Agrega esto arriba en tu archivo

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: ["http://localhost:5173", "https://frontorc.vercel.app/"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());
// Configurar multer
const storage = multer.memoryStorage();
// const upload = multer({ storage });
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024, files: 70 }, // 10MB por archivo, 70 archivos
});

// app.post("/api/upload", upload.array("images", 70), async (req, res) => {
//   if (!req.files || req.files.length === 0)
//     return res.status(400).json({ error: "No se subieron imágenes" });

//   try {
//     // Procesar todas las imágenes en paralelo con Promise.all
//     const resultados = await Promise.all(
//       req.files.map(async (file, i) => {
//         console.log(`Procesando archivo ${i + 1}: ${file.originalname}`);

//         // Crear worker para cada imagen
//         const worker = await createWorker("spa", 1);
//         const { data } = await worker.recognize(file.buffer);
//         await worker.terminate(); // Terminar worker después de usar

//         // Extraer total del texto
//         const lineas = data.text.split("\n").map((l) => l.trim());
//         let total = null;
//         const regex = /\d+(?:\.\d+)?/g;

//         for (const linea of lineas) {
//           if (/total/i.test(linea)) {
//             const nums = linea.match(regex);
//             if (nums) total = parseFloat(nums.pop());
//           }
//         }

//         return {
//           archivo: file.originalname,
//           total,
//         };
//       })
//     );

//     console.log("Totales extraídos:", resultados);
//     res.json(resultados);
//   } catch (error) {
//     console.error("Error al procesar imágenes:", error);
//     res.status(500).json({ error: "Error al procesar imágenes" });
//   }
// });

app.post("/api/upload", upload.array("images", 70), async (req, res) => {
  if (!req.files || req.files.length === 0)
    return res.status(400).json({ error: "No se subieron imágenes" });

  try {
    const client = new vision.ImageAnnotatorClient();

    const resultados = await Promise.all(
      req.files.map(async (file, i) => {
        console.log(`Procesando archivo ${i + 1}: ${file.originalname}`);

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
            .replace(/O/gi, "0") // OCR confunde O con 0
            .replace(/[^0-9.]/g, ""); // solo dígitos y punto
          if (numberText.length > 0) total = Number(numberText);
        }

        // --- EXTRAER HORA (HH:MM) ---
        const horaRegex = /\b([01]?[0-9]|2[0-3]):[0-5][0-9]\b/;
        const matchHora = text.match(horaRegex);
        const hora = matchHora ? matchHora[0] : "No detectada";

        return {
          archivo: file.originalname,
          total,
          hora,
        };
      })
    );

    function ordenarPorHoraCronologica(resultados) {
      const convertToMinutes = (h) => {
        const [hh, mm] = h.split(":").map(Number);
        return hh * 60 + mm;
      };

      // Separar horas válidas
      const minutosArray = resultados
        .map((r) => (r.hora ? convertToMinutes(r.hora) : null))
        .filter((m) => m !== null);

      // Definir umbral de noche (18:00 = 1080 min)
      const UMBRAL_NOCHE = 18 * 60;

      resultados.forEach((r) => {
        if (!r.hora) {
          r.horaOrden = Infinity;
          return;
        }

        let minutos = convertToMinutes(r.hora);

        // Si la hora es antes del umbral de noche pero hay alguna hora >= 18:00, es parte de la noche anterior
        if (
          minutos < UMBRAL_NOCHE &&
          minutosArray.some((m) => m >= UMBRAL_NOCHE)
        ) {
          minutos += 24 * 60; // sumamos 24h para colocarla después de la noche
        }

        r.horaOrden = minutos;
      });

      // Orden ascendente
      resultados.sort((a, b) => a.horaOrden - b.horaOrden);

      // Limpiar campo temporal
      resultados.forEach((r) => delete r.horaOrden);

      return resultados;
    }

    const resultadosOrdenados = ordenarPorHoraCronologica(resultados);

    // Mostrar resultados completos
    console.log(
      "Resultados extraídos:",
      JSON.stringify(resultadosOrdenados, null, 2)
    );

    res.json(resultadosOrdenados);
  } catch (error) {
    console.error("Error al procesar imágenes:", error);
    res.status(500).json({ error: "Error al procesar imágenes" });
  }
});

app.use("/api/eventos", eventoRoute);

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Servidor escuchando en el puerto ${PORT} en todas las interfaces`
  );
});
