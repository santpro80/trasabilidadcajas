const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

// Inicializamos Firebase Admin SDK
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Inicializar la app de Express
const app = express();

// Usar cors para permitir peticiones desde el frontend
app.use(cors({origin: true}));

// Crear nuestro primer endpoint (ruta)
app.get("/saludo", (req, res) => {
  return res.status(200).send({mensaje: "¡Hola desde la API!"});
});

// Exponer la app de Express como una Cloud Function
// El nombre "api" será parte de la URL de la función
exports.api = functions.https.onRequest(app);

// --- Nueva Función Callable para Asignar Roles ---

exports.setCustomUserRole = functions.https.onCall(async (data, context) => {
  // 1. Verificación de seguridad:
  // Primero, verificar que el usuario está autenticado.
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "La función debe ser llamada por un usuario autenticado.",
    );
  }

  // Nos aseguramos de que el usuario que llama a la función sea un supervisor.
  if (context.auth.token.role !== "supervisor") {
    throw new functions.https.HttpsError(
        "permission-denied",
        "Solo los supervisores pueden asignar roles.",
    );
  }

  // 2. Obtenemos los datos enviados desde el cliente:
  // el email del usuario a modificar y el rol a asignar.
  const email = data.email;
  const role = data.role;

  try {
    // 3. Buscamos al usuario por su email.
    const user = await admin.auth().getUserByEmail(email);

    // 4. Asignamos el custom claim y actualizamos Firestore en paralelo.
    await Promise.all([
        admin.auth().setCustomUserClaims(user.uid, {role: role}),
        admin.firestore().collection("users").doc(user.uid).set({role: role}, {merge: true})
    ]);

    // 5. Devolvemos una respuesta exitosa.
    return {
      message: `¡Éxito! Se ha asignado el rol '${role}' a ${email}.`,
    };
  } catch (error) {
    console.error("Error al asignar rol:", error);
    throw new functions.https.HttpsError(
        "internal",
        "Ocurrió un error al intentar asignar el rol.",
        error,
    );
  }
});
