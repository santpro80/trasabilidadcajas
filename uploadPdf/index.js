const msal = require("@azure/msal-node");
const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch"); // Polifill para la API Fetch
const Busboy = require("busboy");

// Configuración de MSAL para la autenticación.
const msalConfig = {
    auth: {
        clientId: process.env.CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
        clientSecret: process.env.CLIENT_SECRET,
    },
};

const cca = new msal.ConfidentialClientApplication(msalConfig);

// --- Función para parsear el formulario multipart/form-data ---
function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        const busboy = Busboy({ headers: req.headers });
        let fileData = { stream: null, name: null, mimeType: null };

        busboy.on("file", (fieldname, file, { filename, mimeType }) => {
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

        busboy.end(req.body);
    });
}


// --- Función principal de Azure ---
module.exports = async function (context, req) {
    context.log("Función 'uploadPdf' procesando una solicitud.");

    // ID del sitio de SharePoint obtenido del Explorador de Graph.
    const siteId = "m365x63639251.sharepoint.com,99bec355-c27b-412a-bd2b-515e818490e0,92ce2085-1c97-4587-9d6c-2e4350a4b0d3";

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

        // 4. Definir la ruta de subida en el Drive del sitio de SharePoint
        // ¡Esta es la línea que corregimos!
        const uploadPath = `/sites/${siteId}/drive/root:/${tipo}/${fileName}:/content`;
        context.log(`Ruta de subida en SharePoint: ${uploadPath}`);

        // 5. Subir el archivo
        const response = await graphClient.api(uploadPath).put(fileStream);

        context.log("Archivo subido a SharePoint con éxito.");
        context.res = {
            status: 200,
            body: {
                message: "Archivo subido a SharePoint con éxito.",
                fileName: fileName,
                sharepoint_response: response,
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