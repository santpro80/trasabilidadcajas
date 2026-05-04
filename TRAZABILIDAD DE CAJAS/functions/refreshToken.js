const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

// Inicializamos admin si no se ha hecho
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

/**
 * Función programada para mantener vivos los tokens.
 * Se ejecuta cada 45 minutos (los tokens de Microsoft duran ~1 hora).
 */
exports.scheduledTokenRefresh = functions.pubsub.schedule('every 45 minutes').onRun(async (context) => {
    console.log('--- Iniciando Refresco de Tokens Programado ---');

    // 1. Carga Perezosa: Importamos las librerías AQUÍ dentro.
    // Si esto falla, solo fallará esta función, no tumbará todo el servidor.
    const { AuthorizationCode } = require('simple-oauth2');

    // 2. Configuración segura dentro de la ejecución
    const config = functions.config().onedrive || {};
    let client_id = config.client_id;
    let client_secret = config.client_secret;

    // Fallback de seguridad
    if (!client_id || !client_secret) {
        client_id = client_id || '706bf438-e836-49dc-a418-ae8aecb200cd';
        try { 
            const secrets = require('./onedrive_secret.json'); 
            client_secret = secrets.client_secret; 
        } catch (e) {
            console.warn("No se encontró onedrive_secret.json ni variables de entorno.");
        }
    }

    if (!client_id || !client_secret) {
        console.error("ERROR: Faltan credenciales (client_id o client_secret). Abortando.");
        return null;
    }

    // 3. Inicializar cliente OAuth
    const oauth2Client = new AuthorizationCode({
        client: { id: client_id, secret: client_secret },
        auth: {
            tokenHost: 'https://login.microsoftonline.com',
            tokenPath: 'common/oauth2/v2.0/token',
            authorizePath: 'common/oauth2/v2.0/authorize',
        },
    });

    try {
        // 4. Buscar usuarios conectados
        const usersSnapshot = await db.collection('users')
            .where('oneDriveRefreshToken', '!=', null)
            .get();

        if (usersSnapshot.empty) {
            console.log('No hay usuarios con OneDrive conectado.');
            return null;
        }

        const promises = usersSnapshot.docs.map(async (doc) => {
            const userId = doc.id;
            const userData = doc.data();
            const currentRefreshToken = userData.oneDriveRefreshToken;

            if (!currentRefreshToken) return;

            console.log(`Procesando usuario: ${userId}`);

            try {
                // Crear objeto de token para refrescar
                // Forzamos expires_in: 0 para obligar el refresco
                const tokenObject = {
                    refresh_token: currentRefreshToken,
                    expires_in: 0
                };

                let accessToken = oauth2Client.createToken(tokenObject);

                // Refrescar
                const newToken = await accessToken.refresh();

                // Guardar nuevo token
                const newRefreshToken = newToken.token.refresh_token;
                const updateData = {
                    oneDriveTokenData: newToken.token,
                    lastTokenRefresh: admin.firestore.FieldValue.serverTimestamp()
                };

                // Rotación de Refresh Token: Si Microsoft nos da uno nuevo, lo guardamos
                if (newRefreshToken && newRefreshToken !== currentRefreshToken) {
                    console.log(`Usuario ${userId}: ¡Nuevo Refresh Token recibido! Guardando...`);
                    updateData.oneDriveRefreshToken = newRefreshToken;
                }

                await db.collection('users').doc(userId).update(updateData);
                console.log(`Usuario ${userId}: Token refrescado exitosamente.`);

            } catch (refreshError) {
                console.error(`Error al refrescar usuario ${userId}:`, refreshError.message);
                if (refreshError.message && refreshError.message.includes('invalid_grant')) {
                    console.error(`ALERTA: El token del usuario ${userId} ha caducado definitivamente.`);
                }
            }
        });

        await Promise.all(promises);
        console.log('--- Fin del ciclo de refresco ---');

    } catch (error) {
        console.error('Error general en scheduledTokenRefresh:', error);
    }

    return null;
});
