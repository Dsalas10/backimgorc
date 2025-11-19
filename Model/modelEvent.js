const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ProductoSchema = new Schema({
  numero: { type: Number, default: 0 },
  hora: { type: String },
  archivo: { type: String },
  total: { type: Number },
});

const LoteSchema = new Schema({
  fecha: { type: Date, default: Date.now },
  productos: [ProductoSchema],
  comandas: { type: Number },
  totalProductos: { type: Number },
});

const EventoModelo = mongoose.model("LoteEvento", LoteSchema);
module.exports = EventoModelo;
