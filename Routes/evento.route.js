const express = require("express");
const router = express.Router();

const {nuevoEvento} = require("../Controller/ControllerEvent.js")

router.post("/nuevo", async (req, res) => {
  
  try {
    const datosEvento = req.body;
    // const resultado = await nuevoEvento(datosEvento);
    return res
      .status(201)
      .json({ mensaje: "Registro del Evento Existoso"});
  } catch (error) {
    return res
      .status(500)
      .json({ mensaje: "Error al crear el evento", error: error.message });
  }
});


module.exports = router;
