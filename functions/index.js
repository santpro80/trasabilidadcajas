// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
// const { AuthorizationCode } = require('simple-oauth2');
// const axios = require('axios');

admin.initializeApp();
const db = admin.firestore();

// --- Configuración de Microsoft Graph OAuth2 ---
// ¡IMPORTANTE! Guarda estos valores como secretos en Firebase
// const secrets = require('./onedrive_secret.json');
// const CLIENT_ID = '706bf438-e836-49dc-a418-ae8aecb200cd';
// const CLIENT_SECRET = secrets.client_secret;

// const oauth2Client = new AuthorizationCode({
//   client: {
//     id: CLIENT_ID,
//     secret: CLIENT_SECRET,
//   },
//   auth: {
//     tokenHost: 'https://login.microsoftonline.com',
//     tokenPath: 'common/oauth2/v2.0/token',
//     authorizePath: 'common/oauth2/v2.0/authorize',
//   },
//   options: {
//     authorizationMethod: 'body',
//   },
// });

/**
 * Obtiene un token de acceso válido para un usuario, refrescándolo si es necesario.
 */
// async function getValidAccessTokenForUser(userId) {
//   const userDocRef = db.collection('users').doc(userId);
//   const userDoc = await userDocRef.get();

//   if (!userDoc.exists() || !userDoc.data().oneDriveRefreshToken) {
//     throw new functions.https.HttpsError(
//       'failed-precondition',
//       'El usuario no tiene un refresh token de OneDrive. Por favor, conecta tu cuenta desde la página "Mi Cuenta".'
//     );
//   }

//   const tokenData = userDoc.data().oneDriveTokenData || {};
//   let accessToken = oauth2Client.createToken(tokenData);

//   // Si el token ha expirado, lo refrescamos
//   if (accessToken.expired()) {
//     console.log('El token de acceso ha expirado. Refrescando...');
//     try {
//       const refreshTokenObject = { refresh_token: userDoc.data().oneDriveRefreshToken };
//       accessToken = await accessToken.refresh(refreshTokenObject);
      
//       // Guardamos el nuevo token (que puede incluir un nuevo refresh token)
//       await userDocRef.update({
//         oneDriveTokenData: accessToken.token,
//         oneDriveRefreshToken: accessToken.token.refresh_token || userDoc.data().oneDriveRefreshToken,
//       });
//       console.log('Token refrescado y guardado exitosamente.');
//     } catch (error) {
//       console.error('Error al refrescar el token:', error.message);
//       throw new functions.https.HttpsError(
//         'unauthenticated',
//         'No se pudo refrescar la sesión de OneDrive. Por favor, vuelve a conectar tu cuenta.'
//       );
//     }
//   }

//   return accessToken.token.access_token;
// }

/**
 * A Callable Function to upload a PDF file (as base64) to OneDrive.
 */
// exports.uploadPdfToOneDrive = functions.https.onCall(async (data, context) => {
//   if (!context.auth) {
//     throw new functions.https.HttpsError('unauthenticated', 'The function must be called by an authenticated user.');
//   }
 
//   const { pdfBase64, fileName, folderPath } = data;
//   if (!pdfBase64 || !fileName || !folderPath) {
//     throw new functions.https.HttpsError('invalid-argument', 'Faltan los parámetros "pdfBase64", "fileName" o "folderPath".');
//   }

//   const userId = context.auth.uid;
//   console.log(`Iniciando subida para el usuario: ${userId}`);

//   try {
//     // 1. Obtener un token de acceso válido para el USUARIO que hace la llamada
//     const accessToken = await getValidAccessTokenForUser(userId);
//     console.log("Token de acceso de usuario obtenido con éxito.");
 
//     // 2. Convertir el PDF de base64 a buffer
//     const pdfBuffer = Buffer.from(pdfBase64, 'base64');
 
//     // 3. Construir la URL de subida de Microsoft Graph
//     // La URL apunta al OneDrive del usuario que está autenticado
//     const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${folderPath}/${fileName}:/content`;
 
//     console.log(`Intentando subir '${fileName}' a la ruta: '${folderPath}'`);
 
//     // 4. Subir el archivo
//     await axios.put(uploadUrl, pdfBuffer, {
//       headers: {
//         'Authorization': `Bearer ${accessToken}`, // Usa el token del usuario
//         'Content-Type': 'application/pdf',
//       },
//     });
 
//     console.log(`Éxito: Archivo '${fileName}' subido a OneDrive.`);
//     return { success: true, message: `Archivo '${fileName}' subido a OneDrive con éxito.` };
 
//   } catch (error) {
//     console.error("Error detallado al subir a OneDrive:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
//     if (error instanceof functions.https.HttpsError) {
//       throw error;
//     }
//     throw new functions.https.HttpsError(
//       'internal',
//       'Ocurrió un error al subir el archivo a OneDrive. Revisa los logs de la función para más detalles.',
//       error.message
//     );
//   }
// });

// (Asegúrate de tener también las funciones 'initiateOneDriveOAuth' y 'handleOneDriveRedirect' en tu archivo)
// Forzando un cambio para el despliegue.

exports.sendTestNotification = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called by an authenticated user.');
    }

    const userId = data.userId;
    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "userId" parameter.');
    }

    try {
        const userDocRef = db.collection('users').doc(userId);
        const userDoc = await userDocRef.get();

        if (!userDoc.exists() || !userDoc.data().fcmToken) {
            throw new functions.https.HttpsError('not-found', 'No FCM token found for this user.');
        }

        const fcmToken = userDoc.data().fcmToken;

        const payload = {
            notification: {
                title: '¡Notificación de prueba!',
                body: 'Esta es una notificación de prueba desde la app.',
                icon: 'https://cajas-secuela.firebaseapp.com/assets/logo.png'
            }
        };

        const response = await admin.messaging().sendToDevice(fcmToken, payload);
        console.log('Successfully sent message:', response);
        return { success: true, response };

    } catch (error) {
        console.error('Error sending message:', error);
        throw new functions.https.HttpsError('internal', 'Error sending message', error);
    }
});