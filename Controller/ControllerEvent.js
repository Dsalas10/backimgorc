const eventomodel = require("../Model/modelEvent"); 

async function nuevoEvento(datos) {
  try {
   
    const nuevo = new eventomodel(datos);
    await nuevo.save();
    return { mensaje: "Evento creado exitosamente", evento: nuevo };
  } catch (error) {
    return { mensaje: "Error al crear el evento", error: error.message };
  }
}

module.exports = {
 nuevoEvento
};

