// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const {defineString} = require('firebase-functions/params');

// --- Configuración Centralizada ---
// Parámetro para el secreto del cliente de OneDrive (configurado en Firebase)
const oneDriveClientSecret = defineString('ONEDRIVE_CLIENT_SECRET');
// ID de tu aplicación de Azure
const CLIENT_ID = '706bf438-e836-49dc-a418-ae8aecb200cd';
// ID del Tenant de tu organización (ej: 'tuorganizacion.onmicrosoft.com' o el ID de Directorio)
const TENANT_ID = 'common'; // Si la cuenta es personal, 'common' puede funcionar. Si es de empresa, es mejor usar el ID de Tenant específico.
// El email del usuario/cuenta de OneDrive donde se guardarán TODOS los archivos.
const TARGET_USER_EMAIL = 'tecnicacontrol01@hotmail.com'; // <--- ¡¡CAMBIA ESTO por el email de la cuenta OneDrive destino!!

admin.initializeApp();

/**
 * A Callable Function to upload a PDF file (as base64) to OneDrive.
 */
exports.uploadPdfToOneDrive = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called by an authenticated user.');
  }
 
  const { pdfBase64, fileName, folderPath } = request.data;
  if (!pdfBase64 || !fileName || !folderPath) {
    throw new functions.https.HttpsError('invalid-argument', 'Faltan los parámetros "pdfBase64", "fileName" o "folderPath".');
  }
 
  try {
    // 1. Obtener el token de acceso para la APLICACIÓN
    console.log("Obteniendo token de acceso para la aplicación...");
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        'client_id': CLIENT_ID,
        'scope': 'https://graph.microsoft.com/.default',
        'client_secret': oneDriveClientSecret.value(),
        'grant_type': 'client_credentials',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const accessToken = tokenResponse.data.access_token;
    console.log("Token de acceso de aplicación obtenido con éxito.");
 
    // 2. Convertir el PDF de base64 a buffer
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
 
    // 3. Construir la URL de subida de Microsoft Graph
    // La URL apunta al OneDrive del usuario específico que definimos en TARGET_USER_EMAIL
    const uploadUrl = `https://graph.microsoft.com/v1.0/users/${TARGET_USER_EMAIL}/drive/root:/${folderPath}/${fileName}:/content`;
 
    console.log(`Intentando subir '${fileName}' a la ruta: '${folderPath}'`);
 
    // 4. Subir el archivo
    await axios.put(uploadUrl, pdfBuffer, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/pdf',
      },
    });
 
    console.log(`Éxito: Archivo '${fileName}' subido a OneDrive en la cuenta de ${TARGET_USER_EMAIL}.`);
    return { success: true, message: `Archivo '${fileName}' subido a OneDrive con éxito.` };
 
  } catch (error) {
    // Loguear el error detallado en Firebase para depuración
    console.error("Error detallado al subir a OneDrive:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    
    // Devolver un error claro al cliente
    throw new functions.https.HttpsError(
      'internal',
      'Ocurrió un error al subir el archivo a OneDrive. Revisa los logs de la función para más detalles.',
      error.message
    );
  }
});