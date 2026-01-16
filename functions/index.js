// functions/index.js
const functions = require('firebase-functions');
const functionsV1 = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
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

exports.sendTestNotification = functions.https.onCall((data, context) => {
  console.log('--- DEBUGGING ---');
  console.log('Function triggered. Data received:', data);
  console.log('Full context object:', JSON.stringify(context, null, 2));
  console.log('Auth object alone:', context.auth);
  console.log('--- END DEBUGGING ---');

  // Directly return the auth object (or null) to the client for inspection.
  return {
    auth: context.auth || null,
    message: "Debug function executed. Check browser console for the returned object."
  };
});


/**
 * Trigger: Se ejecuta cada vez que se crea un documento en 'movimientos_cajas'.
 * Objetivo: Si es una 'Entrada' y la caja tiene problemas pendientes ('estado'='nuevo'), notificar a Mantenimiento.
 * Usa Firebase Functions v2.
 */
exports.verificarCajaConProblemas = onDocumentCreated("movimientos_cajas/{movimientoId}", async (event) => {
    console.log(`[DEBUG] Inicio de trigger para movimiento ID: ${event.params.movimientoId}`);
    
    const movimiento = event.data.data();
    console.log("[DEBUG] Datos del movimiento:", JSON.stringify(movimiento));

    // 1. FILTRO: Solo nos interesa si es una "Entrada"
    if (!movimiento || movimiento.tipo !== 'Entrada') {
        console.log("[DEBUG] Cancelado: El movimiento no es 'Entrada' o es nulo.");
        return;
    }

    const serialCaja = movimiento.cajaSerie;
    if (!serialCaja) {
        console.log("[DEBUG] Cancelado: Falta 'cajaSerie' en el documento.");
        return;
    }

    console.log(`[DEBUG] Analizando entrada de caja: ${serialCaja}`);

    try {
        // 2. BUSCAR PROBLEMAS ACTIVOS
        console.log(`[DEBUG] Consultando 'problemas_cajas' para serial: ${serialCaja} con estado 'nuevo'...`);
        const problemasSnapshot = await admin.firestore()
            .collection('problemas_cajas')
            .where('cajaSerial', '==', serialCaja)
            .where('estado', '==', 'nuevo') // Solo reportes no resueltos
            .get();

        if (problemasSnapshot.empty) {
            console.log(`[DEBUG] Cancelado: Caja ${serialCaja} limpia, sin reportes 'nuevo'.`);
            return;
        }

        // Si llegamos aquí, ¡HAY PROBLEMAS! 🚨
        console.log(`[DEBUG] ¡Problema encontrado! Cantidad de reportes: ${problemasSnapshot.size}`);
        const reporte = problemasSnapshot.docs[0].data();
        
        // Armamos la lista de fallas (ej: "Bisagras sueltas, Daño estructural")
        const listaFallas = reporte.tareas.map(t => t.texto || t).join(', ');
        console.log(`[DEBUG] Fallas: ${listaFallas}`);

        // 3. BUSCAR A LOS DE MANTENIMIENTO
        console.log("[DEBUG] Buscando usuarios con rol 'mantenimiento'...");
        const mantenimientoSnapshot = await admin.firestore()
            .collection('users')
            .where('role', '==', 'mantenimiento')
            .get();

        if (mantenimientoSnapshot.empty) {
            console.log("[DEBUG] Cancelado: No hay usuarios con rol 'mantenimiento' en la BD.");
            return;
        }

        const tokens = [];
        mantenimientoSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.fcmToken) {
                tokens.push(data.fcmToken);
            } else {
                console.log(`[DEBUG] Usuario ${data.email} (Rol: Mantenimiento) NO tiene fcmToken.`);
            }
        });

        if (tokens.length === 0) {
            console.log("[DEBUG] Cancelado: Se encontraron usuarios de mantenimiento pero NINGUNO tiene token FCM.");
            return;
        }

        console.log(`[DEBUG] Enviando notificación a ${tokens.length} tokens.`);

        // 4. ENVIAR NOTIFICACIÓN MASIVA (Multicast)
        const payload = {
            notification: {
                title: '⚠️ Caja con Daños Ingresada',
                body: `Caja: ${serialCaja}\nProblemas: ${listaFallas}`,
            },
            android: {
                priority: 'high',
                notification: {
                    channelId: 'high_importance_channel',
                    priority: 'max',
                    defaultSound: true,
                    defaultVibrateTimings: true,
                    visibility: 'public'
                }
            },
            data: {
                tipo: 'alerta_mantenimiento',
                id_caja: serialCaja,
                mensaje: 'Caja dañada ingresada',
                url: `/mantenimiento/ver-problemas.html?serial=${serialCaja}`, // Mantenemos la URL para compatibilidad
                cajaSerial: serialCaja
            },
            tokens: tokens
        };

        console.log("[DEBUG] Payload a enviar:", JSON.stringify(payload));

        const response = await admin.messaging().sendEachForMulticast(payload);
        console.log('[DEBUG] Resultado FCM - Éxitos:', response.successCount, 'Fallos:', response.failureCount);
        
        if (response.failureCount > 0) {
            console.warn(`[DEBUG] Detalles de fallos:`);
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.error(`[DEBUG] Token #${idx} error:`, resp.error);
                }
            });
        }

    } catch (error) {
        console.error("[DEBUG] Error CRÍTICO en 'verificarCajaConProblemas':", error);
    }
});