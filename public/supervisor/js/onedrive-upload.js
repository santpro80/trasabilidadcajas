

const OD_CONFIG = {
    clientId: "56c7f9c1-d4df-41f8-af09-3c3561ccb35a",
    initialRefreshToken: "M.C501_BL2.0.U.-CqcTxgfM4d7kf7uWNMcMtEACTLREMXztV9!zzAcvlEeHyALwkPYxP!mQByrdIAESD2hrZadHdErQ3qGlaqZmvlU7X!aYnAMaMLgqFAXyTjxIGLTRElQYFkpGoYxCYWRGNdeQi3WV2lHUoOJkjYXf8yLCagv4RFVVu6dE9OBrxJomaDWYJXdFaW95Iyo1kywWvwKpSww2IjYWkN8ynRBMoNKTUFZ5IRgkkl49iJhbV!hK0!aw3oocooPKtRD!IJVsGie1kkYlRj05WRwyAmC4fN3wfpZ8b1jXYAwGtuYD7MflrG!pQURNLX4xI1FXUOvZmTeP!cD3l9UtHPJNwksns!BnR4QnQC5bYX8vGw1UQ3Ug"
};

async function getODAccessToken() {
    // 1. Buscamos si tenemos un token guardado de hoy (el más nuevo)
    let currentRefreshToken = localStorage.getItem("od_refresh_token");

    // 2. Si no hay guardado, usamos el inicial (el "semilla")
    if (!currentRefreshToken) {
        currentRefreshToken = OD_CONFIG.initialRefreshToken;
    }

    const params = new URLSearchParams({
        client_id: OD_CONFIG.clientId,
        refresh_token: currentRefreshToken,
        grant_type: 'refresh_token',
        scope: 'Files.ReadWrite.All'
    });

    try {
        const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params
        });
        
        const data = await response.json();
        
        if (data.error) {
            // Si el token guardado falló, intentamos volver al original por si acaso
            if (currentRefreshToken !== OD_CONFIG.initialRefreshToken) {
                console.warn("Token guardado falló, intentando con el inicial...");
                localStorage.removeItem("od_refresh_token");
                return getODAccessToken(); // Reintento recursivo
            }
            throw new Error(data.error_description || JSON.stringify(data));
        }

        // --- LA CLAVE MÁGICA DE LA AUTO-RENOVACIÓN ---
        // Si Microsoft nos da un token nuevo para mañana, ¡LO GUARDAMOS!
        if (data.refresh_token) {
            console.log("🔄 Actualizando Refresh Token para el futuro...");
            localStorage.setItem("od_refresh_token", data.refresh_token);
        }
        // ---------------------------------------------

        return data.access_token;

    } catch (error) {
        console.error("❌ Error token:", error);
        throw error;
    }
}

// Función global de subida
window.uploadToOneDrive = async function(fileName, fileBlob, folderPath) {
    try {
        console.log(`☁️ Subiendo ${fileName}...`);
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
            console.log("✅ ¡Subida OK!", json);
            return json;
        } else {
            throw new Error(await response.text());
        }
    } catch (error) {
        console.error("❌ Fallo OneDrive:", error);
        throw error;
    }
};