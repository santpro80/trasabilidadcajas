
const msal = require("@azure/msal-node");
const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch"); // Polifill para la API Fetch
const Busboy = require("busboy");

// Configuración de MSAL para la autenticación.
// Lee las variables de entorno que configuramos en Azure.
const msalConfig = {
    auth: {
        clientId: process.env.CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
        clientSecret: process.env.CLIENT_SECRET,
    },
};

const cca = new msal.ConfidentialClientApplication(msalConfig);

// --- Función para parsear el formulario multipart/form-data ---
// Extrae el stream del archivo y su nombre.
function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        const busboy = Busboy({ headers: req.headers });
        let fileData = { stream: null, name: null, mimeType: null };

        busboy.on("file", (fieldname, file, { filename, mimeType }) => {
            // Solo procesamos el primer archivo encontrado
            if (!fileData.stream) {
                fileData.stream = file;
                fileData.name = filename;
                fileData.mimeType = mimeType;
            }
        });

        busboy.on("finish", () => {
            if (fileData.stream) {
                resolve(fileData);
            } else {
                reject(new Error("No se encontró ningún archivo en la solicitud."));
            }
        });

        busboy.on("error", (err) => reject(err));

        // Escribimos el body de la request en busboy para que lo procese
        busboy.end(req.body);
    });
}


// --- Función principal de Azure ---
module.exports = async function (context, req) {
    context.log("Función 'uploadPdf' procesando una solicitud.");

    const tipo = req.query.tipo;
    if (!tipo || (tipo.toLowerCase() !== 'entrada' && tipo.toLowerCase() !== 'salida')) {
        context.res = {
            status: 400,
            body: "Por favor, especifica un 'tipo' en la URL (ej: ?tipo=Entrada o ?tipo=Salida).",
        };
        return;
    }

    try {
        // 1. Parsear el archivo de la solicitud
        const { stream: fileStream, name: fileName } = await parseMultipart(req);
        context.log(`Archivo recibido: ${fileName}. Tipo: ${tipo}`);

        // 2. Obtener token de autenticación para Microsoft Graph
        const authResponse = await cca.acquireTokenByClientCredential({
            scopes: ["https://graph.microsoft.com/.default"],
        });

        if (!authResponse.accessToken) {
            throw new Error("No se pudo obtener el token de acceso.");
        }
        context.log("Token de acceso obtenido con éxito.");

        // 3. Inicializar el cliente de Microsoft Graph
        const graphClient = Client.initWithMiddleware({
            authProvider: {
                getAccessToken: async () => authResponse.accessToken,
            },
        });

        // 4. Definir la ruta de subida en OneDrive
        // Asumimos que los archivos se guardan en la carpeta raíz de OneDrive,
        // dentro de una carpeta "Entrada" o "Salida".
        const uploadPath = `/root:/${tipo}/${fileName}`;
        context.log(`Ruta de subida en OneDrive: ${uploadPath}`);

        // 5. Subir el archivo
        // Usamos `stream` para subir directamente el stream del archivo sin guardarlo en memoria.
        const response = await graphClient.api(uploadPath).put(fileStream);

        context.log("Archivo subido a OneDrive con éxito.");
        context.res = {
            status: 200,
            body: {
                message: "Archivo subido a OneDrive con éxito.",
                fileName: fileName,
                onedrive_response: response,
            },
            headers: {
                'Content-Type': 'application/json'
            }
        };

    } catch (error) {
        context.log.error("Ocurrió un error:", error);
        context.res = {
            status: 500,
            body: {
                message: "Error interno al procesar la solicitud.",
                error: error.message,
            },
            headers: {
                'Content-Type': 'application/json'
            }
        };
    }
};
