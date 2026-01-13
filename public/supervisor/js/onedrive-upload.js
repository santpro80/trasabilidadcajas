// Archivo: public/supervisor/js/onedrive-upload.js

const OD_CONFIG = {
    clientId: "56c7f9c1-d4df-41f8-af09-3c3561ccb35a",
    // ✅ TU TOKEN NUEVO (Generado para SPA/Hotmail):
    refreshToken: "M.C501_BL2.0.U.-CqIWO4wju1nsFXKN9oem4zJjGwOl70VnmwqTr7aM1KYcSCpeN7oOi5OiYJ15EBg*TZSea3aQyFrY0o0he98aB1iu72P6LO0!UJPGh4B8WMQbeNMDQYQ9!l1rZX8jOzdmR*uBaPvRuAhmSZu3nc277CARVsTKWsGlC0dn0gMqoT4oAoH9tRHT!CenDz51hXNpNIXu1TVsXjvwDsuliM*2o**68mAdh28jQrXlqns9Itl9ZWpOPTFGkLHFwiuKOiuCSaBxNZopjWoREtcAX*b8zqnEXtBs7kGX0V*e6oTnShDxjezs1UNytDF7UzOp2UdPynoZGcRGCrJicspb7LxWMSTtdHzXVuVqmF1lXp*Vb23r"
};

/**
 * 1. Obtiene el Token de Acceso (Sin secreto, modo SPA)
 */
async function getODAccessToken() {
    const params = new URLSearchParams({
        client_id: OD_CONFIG.clientId,
        refresh_token: OD_CONFIG.refreshToken,
        grant_type: 'refresh_token',
        scope: 'Files.ReadWrite.All'
        // ⛔ IMPORTANTE: Aquí NO va client_secret. Si lo pones, falla.
    });

    try {
        const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params
        });
        
        const data = await response.json();
        
        if (data.error) {
            console.error("❌ Error Microsoft:", data);
            throw new Error(data.error_description || JSON.stringify(data));
        }
        return data.access_token;
    } catch (error) {
        console.error("❌ Error de red al renovar token:", error);
        throw error;
    }
}

/**
 * 2. Función Global de Subida
 */
window.uploadToOneDrive = async function(fileName, fileBlob, folderPath) {
    try {
        console.log(`☁️ Subiendo a OneDrive: ${fileName}...`);
        const token = await getODAccessToken();
        
        const encodedPath = encodeURIComponent(folderPath + '/' + fileName);
        // Usamos la API de Graph estándar
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
            console.log("✅ ¡Subida EXITOSA!", json);
            return json;
        } else {
            const errText = await response.text();
            console.error("❌ Error al subir archivo:", errText);
            throw new Error(errText);
        }
    } catch (error) {
        console.error("❌ Fallo crítico OneDrive:", error);
        throw error;
    }
};