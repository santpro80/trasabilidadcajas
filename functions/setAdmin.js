// Archivo: setAdmin.js
const admin = require("firebase-admin");

// IMPORTANTE: Asegúrate de que la ruta a tu serviceAccountKey sea correcta
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// ---------------------------------------------------------------
// --- MODIFICA ESTA LÍNEA ---
// Pega aquí el UID de tu usuario supervisor que copiaste de la consola
const uid = "YScfGSOr86eMnQ3xNzqX9OBunA82";
// ---------------------------------------------------------------

admin.auth().setCustomUserClaims(uid, { role: 'supervisor' })
  .then(() => {
    console.log(`¡Éxito! Se asignó el rol de 'supervisor' al usuario ${uid}`);
    console.log("Ahora ese usuario debe cerrar sesión y volver a iniciarla.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error al asignar custom claim:", error);
    process.exit(1);
  });