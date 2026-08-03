// Placeholder para la URL de la Cloud Function. Actualízalo con la URL real tras el despliegue (ej: https://refrescartokenonedrive-xyz-uc.a.run.app)
const CLOUD_FUNCTION_URL = "https://us-central1-cajas-secuela.cloudfunctions.net/refrescarTokenOneDrive";

const OD_CONFIG = {
    clientId: "56c7f9c1-d4df-41f8-af09-3c3561ccb35a",
    // Asegúrate de que este sea el TOKEN NUEVO que generaste recién con PowerShell
    initialRefreshToken: "M.C501_BAY.0.U.MsaArtifacts.-Cg1ayh2JHwQtMXUYWihRqxvetWg00BRFiR7Sb1XmSL*LO3pr68lpqGpoeenVZGcasdrOC0Sdvw2NVLaestE0Oe3o2lQWNAmdlddZ3LHlTRjgMf1wuAmolwKNERblZT7PduKxsuW2QQe18mxikMEpwzmJdO4UTojlmXr8HjOHPuJZEpwQtSb59BA!6w9zwObRjyP8WJicFCnoo!8g3VMb!kDu2IfS9jDmenta3*j9UYzDVHvdPTP4PLCw8pes7S29cK*cO1dOHJ492APVDCwqNdLDo0mUFrGYCq00sHH5EbaZ0JlqGZm*zP72hJv3q5e4i0DNLqRme2uCMtjT0hg2i64RHnYHAiYrSo*x6vgQuzrd"
}

async function getODAccessToken() {
    // 1. Buscamos si tenemos un token guardado (el que se renovó ayer)
    let currentRefreshToken = localStorage.getItem("od_refresh_token");

    // 2. Si no hay nada guardado en el navegador, usamos el inicial del código
    if (!currentRefreshToken) {
        currentRefreshToken = OD_CONFIG.initialRefreshToken;
    }

    try {
        const response = await fetch(CLOUD_FUNCTION_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: currentRefreshToken })
        });
        
        const data = await response.json();
        
        if (data.error) {
            // Si el token guardado en el navegador falló...
            if (currentRefreshToken !== OD_CONFIG.initialRefreshToken) {
                console.warn("⚠️ Token guardado vencido. Intentando recuperar con el token inicial...");
                // Lo borramos para obligar a usar el inicial en el próximo intento recursivo
                localStorage.removeItem("od_refresh_token");
                return getODAccessToken(); 
            }
            // Si llegamos aquí, es que ni el guardado ni el inicial funcionan.
            throw new Error("❌ Error fatal: Ambos tokens han caducado. Actualiza initialRefreshToken en el código.");
        }

        // --- RENOVACIÓN AUTOMÁTICA (CON VERIFICACIÓN DE GUARDADO) ---
        if (data.refresh_token) {
            console.log("🔄 Microsoft nos dio un token nuevo. Intentando guardar...");
            
            try {
                // 1. Guardamos
                localStorage.setItem("od_refresh_token", data.refresh_token);
                
                // 2. LEEMOS INMEDIATAMENTE para verificar
                const testRead = localStorage.getItem("od_refresh_token");
                
                if (testRead === data.refresh_token) {
                    console.log("✅ Token guardado correctamente en LocalStorage. ¡El sistema es autónomo!");
                } else {
                    console.error("⚠️ ALERTA CRÍTICA: El navegador NO está guardando el token. Revisa si estás en Modo Incógnito o Configuración de Cookies.");
                }
            } catch (storageError) {
                console.error("❌ Error escribiendo en localStorage:", storageError);
            }
        }
        // -----------------------------------------------------------

        return data.access_token;

    } catch (error) {
        console.error("❌ Error obteniendo token:", error);
        throw error;
    }
}

// Función global de subida
window.uploadToOneDrive = async function(fileName, fileBlob, folderPath) {
    try {
        console.log(`☁️ Iniciando subida de: ${fileName}...`);
        
        const token = await getODAccessToken();
        
        // CORRECCIÓN: Codificar cada segmento por separado para que los '/' se mantengan como separadores de carpeta
        const fullPath = folderPath + '/' + fileName;
        const encodedPath = fullPath.split('/')
            .map(segment => encodeURIComponent(segment))
            .join('/');

        const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/content`;

        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/pdf"
            },
            body: fileBlob
        });

        if (response.ok) {
            const json = await response.json();
            console.log("✅ Archivo subido exitosamente a OneDrive", json);
            return json;
        } else {
            const errorText = await response.text();
            let errorMessage = "Error en la subida a OneDrive";
            
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error && errorJson.error.message) {
                    errorMessage = `OneDrive Error: ${errorJson.error.message}`;
                }
            } catch (e) {
                errorMessage = `OneDrive Error (${response.status}): ${errorText}`;
            }
            
            console.error("❌ Detalle del error de Microsoft Graph:", errorText);
            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error("❌ Falló la subida a OneDrive:", error);
        throw error;
    }
};