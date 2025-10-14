const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

exports.setCustomUserRole = onCall({ cors: true }, async (request) => {
  // NOTA: En la v2, 'context' se llama 'request'
  const context = request;

  // 1. Verificación de seguridad:
  // Se asegura que quien llama esté autenticado y sea supervisor.
  if (!context.auth || context.auth.token.role !== "supervisor") {
    throw new Error("Permiso denegado. Se requiere rol de supervisor.");
  }

  // 2. Obtenemos los datos enviados desde el cliente
  const email = context.data.email;
  const role = context.data.role;

  try {
    // 3. Buscamos al usuario por su email
    const user = await admin.auth().getUserByEmail(email);

    // 4. Asignamos el custom claim y actualizamos Firestore
    await Promise.all([
      admin.auth().setCustomUserClaims(user.uid, { role: role }),
      admin.firestore().collection("users").doc(user.uid).set({ role: role }, { merge: true })
    ]);

    // 5. Devolvemos una respuesta exitosa
    return {
      message: `¡Éxito! Se ha asignado el rol '${role}' a ${email}.`,
    };
  } catch (error) {
    console.error("Error al asignar rol:", error);
    // Lanza un error que el cliente puede interpretar
    throw new Error("Ocurrió un error interno al intentar asignar el rol.");
  }
});