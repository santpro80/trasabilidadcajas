
const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");

// Inicializar la app de Express
const app = express();

// Usar cors para permitir peticiones desde el frontend
app.use(cors({origin: true}));

// Crear nuestro primer endpoint (ruta)
app.get("/saludo", (req, res) => {
  res.status(200).send({mensaje: "¡Hola desde la API!"});
});

// Exponer la app de Express como una Cloud Function
// El nombre "api" será parte de la URL de la función
exports.api = functions.https.onRequest(app);
