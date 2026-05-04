const admin = require('firebase-admin');

// Apunta al archivo de credenciales que moviste a esta carpeta.
const serviceAccount = require('./serviceAccountKey.json');

// Email del usuario a convertir en supervisor.
const emailToMakeSupervisor = 'santiagoezequielgil@gmail.com';

// Inicializa la app con las credenciales de administrador.
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function setSupervisor() {
  try {
    console.log(`Buscando al usuario: ${emailToMakeSupervisor}...`);
    const user = await admin.auth().getUserByEmail(emailToMakeSupervisor);

    console.log(`Asignando el rol 'supervisor' al UID: ${user.uid}...`);
    await admin.auth().setCustomUserClaims(user.uid, { role: 'supervisor' });

    console.log('----------------------------------------------------');
    console.log(`¡Éxito! El usuario ${emailToMakeSupervisor} ahora es supervisor.`);
    console.log('¡ACCIÓN REQUERIDA! Por seguridad, elimina AHORA los archivos:');
    console.log('1. temp-set-supervisor.js');
    console.log('2. serviceAccountKey.json');
    console.log('----------------------------------------------------');

  } catch (error) {
    console.error('¡Error! No se pudo asignar el rol:', error.message);
  }
}

setSupervisor();
