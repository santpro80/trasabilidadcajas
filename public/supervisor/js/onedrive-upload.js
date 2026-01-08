// Archivo: public/supervisor/js/onedrive-upload.js

const OD_CONFIG = {
    clientId: "56c7f9c1-d4df-41f8-af09-3c3561ccb35a",
    clientSecret: "WKn8Q~ZVvOccMtg1ykkxd4RGTa0J5yomAXSFFaVo",
    refreshToken: "M.C501_BAY.0.U.-Cj0ZFB8n7QCXM9NhORSKi*GpWXuG8tNx6o9uhLOVrw9KXXBy6OzAGh8*mtEy!26fshewy6cLAESKCohrqVWCNe1E5mILQxg1LRsy56yRfbFAJvIpaAxetnt9D22!jckQ310h94LWhsOOnC6h61ZRHm*8kvDZbx3Z9ILB8c2*QtMCQc2hpP4akEmPhYUhcTtnNwhXHs58aBWwTLDy9UrBkPdJxFIwXNlqjejliGGMbvJZkKKAlZIxouiNVf5auBpglL3e2AtbUbhZ*kRFrwNy47C4oziwPxRfNqX0uXMS1n!KimvRywZnaeTCpupy0eoKeQU*gFG9lUSMwIa0MIL9dKq!HBAFO4Vf!vV01NvEJbQd"
};

/**
 * 1. Obtiene un Token Temporal usando tu llave maestra (Refresh Token)
 */
async function getODAccessToken() {
    const params = new URLSearchParams({
        client_id: OD_CONFIG.clientId,
        client_secret: OD_CONFIG.clientSecret,
        refresh_token: OD_CONFIG.refreshToken,
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
        if(data.error) throw new Error(data.error_description);
        return data.access_token;
    } catch (error) {
        console.error("❌ Error renovando token OneDrive:", error);
        throw error;
    }
}

/**
 * 2. Sube el PDF a OneDrive (Exportada como módulo)
 */
export async function uploadToOneDrive(fileName, fileBlob, folderPath) {
    try {
        console.log(`☁️ Iniciando subida a OneDrive: ${fileName}`);
        const token = await getODAccessToken();
        
        // Codificamos cada parte de la ruta por separado para mantener las '/' puras
        const encodedPath = folderPath.split('/')
            .map(part => encodeURIComponent(part))
            .join('/') + '/' + encodeURIComponent(fileName);

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
            console.log("✅ ¡Subido a OneDrive con éxito!");
            return await response.json();
        } else {
            const err = await response.text();
            console.error("❌ Error OneDrive:", err);
            throw new Error(err);
        }
    } catch (error) {
        console.error("❌ Fallo crítico subida:", error);
        throw error;
    }
}