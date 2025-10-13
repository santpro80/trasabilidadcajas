// Archivo: checkClaim.js
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// --- MODIFICA ESTA LÍNEA ---
const uid = "YScfGSOr86eMnQ3xNzqX9OBunA82";
// --------------------------

admin.auth().getUser(uid)
  .then((userRecord) => {
    console.log(`Revisando claims para el usuario: ${userRecord.email}`);
    console.log("Custom Claims asignados:", userRecord.customClaims);
    if (userRecord.customClaims && userRecord.customClaims.role === 'supervisor') {
      console.log("\n✅ ¡Verificación exitosa! El claim 'supervisor' está asignado correctamente.");
    } else {
      console.log("\n❌ ¡Error! El claim 'supervisor' NO está asignado a este usuario.");
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error al obtener datos del usuario:", error);
    process.exit(1);
  });