const OD_CONFIG = {
    clientId: "56c7f9c1-d4df-41f8-af09-3c3561ccb35a",
    // Asegúrate de que este sea el TOKEN NUEVO que generaste recién con PowerShell
    initialRefreshToken: "M.C501_BL2.0.U.-CgbsN9JrfnFinBTCJG9cOe**jgaAOmN0feUBTo0VmdbHZy7nwvvsRa7q4mUErtPL5AwHfhKZnzQBI*p1xynXtud1gdoUGIoM57imCkW5biczj8WYTGmOOvBlhplYvwdwMEIl6VODKxYMjG2mzoLIQsF!e1NHevNjAqf*evIW!j*eoyUpWToN64SjizOxF7lI2bmLG2OONt9HTsWgGyR0FIBg3m737BVw*jf*YpzoKzuEB9rdZ*HmO8*c8JpuOK*bwdhBq74qk8bI3JSDJKSdTEeT2Ucjs2mWm!cdAQxA6UMU2!DVGndh4SvzhQV33jvSFFhTTjhmfKMcKIPg8BKJ1U!nPySHihtHSa1V1a5ESJU4"
}

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