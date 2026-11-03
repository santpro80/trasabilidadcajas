// Placeholder para la URL de la Cloud Function. Actualízalo con la URL real tras el despliegue (ej: https://refrescartokenonedrive-xyz-uc.a.run.app)
const CLOUD_FUNCTION_URL = "https://us-central1-cajas-secuela.cloudfunctions.net/refrescarTokenOneDrive";

const OD_CONFIG = {
    clientId: "56c7f9c1-d4df-41f8-af09-3c3561ccb35a",
    // Asegúrate de que este sea el TOKEN NUEVO que generaste recién con PowerShell
    initialRefreshToken: "M.C501_BL2.0.U.MsaArtifacts.-CqObiN744T10f4vcaQjWbLIt!IpYYGVMKpbBQKxbqh4HyaAgUGSKPz*Lmmt8nqEm3u5UG8HKMJouHsZEtQyI8rjD*4rG4EHey!TxTedIQIeuigRDdXMUBKi8FKKAEuVpV34lrfAkzpbIvcaOajL9Ibr4OqhEcIw0P3IYoXRIIp!7j*SDXGGpRBeqn7SpiUes7QR!k2EAJn*2muW1Bvu1maQ*6gSzW3Z!64CNca6WfBaUHuLHfJiHHeTqJAGrYsxwBl3qwHtFb4nJRL0C2b3E2z9VjJ5ujaY9J3au9NpmfKhhQ3PDVcG9GGAMRd!WISvJvjZfYACN3SG5ogMuzxKAPU7jyVGnmtgcXNfTmOy7xzRt",
    tokenSeedDate: "2026-11-03"
};

async function leerTokenDesdeFirebase() {
    try {
        const { db, doc, getDoc } = await import('./firebase-config.js');
        const snap = await getDoc(doc(db, 'system', 'onedrive_config'));
        if (snap.exists()) {
            const d = snap.data();
            if (d && d.refreshToken) {
                return d;
            }
        }
    } catch (_) {
        // Fallback silencioso a localStorage / initialRefreshToken
    }
    return null;
}

async function guardarTokenEnFirebase(newRefreshToken) {
    try {
        const { db, doc, setDoc } = await import('./firebase-config.js');
        await setDoc(doc(db, 'system', 'onedrive_config'), {
            refreshToken: newRefreshToken,
            seedToken: OD_CONFIG.initialRefreshToken,
            updatedAt: Date.now(),
            updatedIso: new Date().toISOString()
        }, { merge: true });
    } catch (_) {
        // Fallback silencioso para no afectar nunca la subida del reporte
    }
}

async function getODAccessToken(forceInitial = false) {
    // Si el initialRefreshToken del código fue actualizado, limpiamos el token viejo de localStorage
    const savedInitialSeed = localStorage.getItem("od_initial_token_seed");
    if (savedInitialSeed !== OD_CONFIG.initialRefreshToken) {
        localStorage.removeItem("od_refresh_token");
        localStorage.setItem("od_initial_token_seed", OD_CONFIG.initialRefreshToken);
    }

    let currentRefreshToken = null;

    if (!forceInitial) {
        // 1. Intentamos leer primero el último token auto-renovado compartido en Firebase
        const fbData = await leerTokenDesdeFirebase();
        if (fbData && fbData.refreshToken && (fbData.seedToken === OD_CONFIG.initialRefreshToken || fbData.manualOverride === true)) {
            currentRefreshToken = fbData.refreshToken;
            try {
                localStorage.setItem("od_refresh_token", currentRefreshToken);
            } catch (_) {}
        }

        // 2. Si no hubo token en Firebase, buscamos en localStorage
        if (!currentRefreshToken) {
            currentRefreshToken = localStorage.getItem("od_refresh_token");
        }
    }

    // 3. Si no hay nada guardado o se pidió forzar el inicial, usamos el del código
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
            // Si el token compartido/guardado falló, probamos inmediatamente con el initialRefreshToken del código
            if (!forceInitial && currentRefreshToken !== OD_CONFIG.initialRefreshToken) {
                console.warn("⚠️ Token guardado vencido. Intentando recuperar con el token inicial...");
                localStorage.removeItem("od_refresh_token");
                return getODAccessToken(true); 
            }
            // Si llegamos aquí, es que ni el guardado ni el inicial funcionan.
            throw new Error("❌ Error fatal: Ambos tokens han caducado. Actualiza el token de OneDrive desde el Panel Supervisor.");
        }

        // --- RENOVACIÓN AUTOMÁTICA (LOCALSTORAGE + FIREBASE COMPARTIDO) ---
        if (data.refresh_token) {
            console.log("🔄 Microsoft nos dio un token nuevo. Guardando en LocalStorage y Firebase...");
            
            try {
                localStorage.setItem("od_refresh_token", data.refresh_token);
            } catch (storageError) {
                console.error("❌ Error escribiendo en localStorage:", storageError);
            }

            // Guardamos en segundo plano en Firebase para que todos los usuarios usen el token renovado
            guardarTokenEnFirebase(data.refresh_token);
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
