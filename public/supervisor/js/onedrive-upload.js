const OD_CONFIG = {
    clientId: "56c7f9c1-d4df-41f8-af09-3c3561ccb35a",
    // IMPORTANTE: Genera un token nuevo hoy manualmente y pégalo aquí abajo.
    // Este será el "padre" de todos los futuros tokens automáticos.M.C501_BAY.0.U.
    initialRefreshToken: "M.C501_BL2.0.U.-CnDgZIUUnjt*gMQHGGXV5isL!cQ4SHApT0jMclNb1*mAPuNsm2jQoqCUkg1DcNl*WoAsIO!P*o*ePEmN3rAr!jYK0a9sQu7nl*tHQrZWX!ChfayFo6qS3!KlQayaMPcmxK9OaB1BMY34aSGit6o1ftVaaAy4a2!Myyul!A*VIXdWyZjnD45Ef8VtynYQ3l*EOAKVAzPleLJwH8WDciboiN6sDjBqsiaQmkKKCooKVzuwbLu00HxI8FAp0pBKFvHDtdMRalUHdz*a94eS7pQUXb!GeNOyMZnSa82PF5YJ5ayakh!guAVHncYaXDxM0OQBZttVadDVADAULI52RmWQdIvA*XNLOAy1cYPmSA4ylUKV"

async function getODAccessToken() {
    // 1. Buscamos si tenemos un token guardado (el que se renovó ayer)
    let currentRefreshToken = localStorage.getItem("od_refresh_token");

    // 2. Si no hay nada guardado en el navegador, usamos el inicial del código
    if (!currentRefreshToken) {
        currentRefreshToken = OD_CONFIG.initialRefreshToken;
    }

    const params = new URLSearchParams({
        client_id: OD_CONFIG.clientId,
        refresh_token: currentRefreshToken,
        grant_type: 'refresh_token',
        // CAMBIO CLAVE: Agregamos 'offline_access' para que Microsoft nos permita renovar siempre
        scope: 'Files.ReadWrite.All offline_access'
    });

    try {
        const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params
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

        // --- RENOVACIÓN AUTOMÁTICA ---
        // Si la respuesta trae un nuevo refresh token, lo guardamos para mañana.
        if (data.refresh_token) {
            console.log("🔄 Guardando token renovado para el futuro...");
            localStorage.setItem("od_refresh_token", data.refresh_token);
        }
        // -----------------------------

        return data.access_token;

    } catch (error) {
        console.error("❌ Error obteniendo token:", error);
        throw error;
    }
}

// Función global de subida (Esta queda igual, pero usa la nueva lógica de token)
window.uploadToOneDrive = async function(fileName, fileBlob, folderPath) {
    try {
        console.log(`☁️ Iniciando subida de: ${fileName}...`);
        
        // Aquí es donde ocurre la magia de la renovación automática
        const token = await getODAccessToken();
        
        const encodedPath = encodeURIComponent(folderPath + '/' + fileName);
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
            throw new Error(await response.text());
        }
    } catch (error) {
        console.error("❌ Falló la subida a OneDrive:", error);
        throw error;
    }
};