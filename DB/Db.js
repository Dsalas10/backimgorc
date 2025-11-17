const mongoose = require("mongoose");
// Conexion a base de datos
const dbName = process.env.DBNAME;
const uri = `mongodb+srv://${process.env.USER}:${process.env.PASSWORD}@cluster0.ugqzyrp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

mongoose.connect(uri, { dbName})
    .then(() => console.log("✅ Base de Datos MongoDB conectada correctamente"))
    .catch((e) => {
        console.error("❌ Error al conectar la BD:", e.message);
        process.exit(1);
    });

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  Se perdió la conexión con MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Error en la conexión de MongoDB:', err);
});



module.exports = mongoose;