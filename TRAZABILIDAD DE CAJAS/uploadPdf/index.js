
const msal = require("@azure/msal-node");
const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");
const Busboy = require("busboy");

// Configuración de MSAL
const msalConfig = {
    auth: {
        clientId: process.env.CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
        clientSecret: process.env.CLIENT_SECRET,
    },
};

const cca = new msal.ConfidentialClientApplication(msalConfig);

// --- Nueva función para parsear que devuelve un Buffer ---
function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        const busboy = Busboy({ headers: req.headers });
        const fileData = { buffer: null, name: null, mimeType: null };
        const chunks = [];

        busboy.on("file", (fieldname, file, { filename, mimeType }) => {
            fileData.name = filename;
            fileData.mimeType = mimeType;
            file.on('data', (chunk) => {
                chunks.push(chunk);
            });
            file.on('end', () => {
                fileData.buffer = Buffer.concat(chunks);
            });
        });

        busboy.on("finish", () => {
            if (fileData.buffer) {
                resolve(fileData);
            } else {
                reject(new Error("No se encontró ningún archivo en la solicitud o el archivo está vacío."));
            }
        });

        busboy.on("error", (err) => reject(err));

        busboy.end(req.body);
    });
}

// --- Función principal de Azure ---
module.exports = async function (context, req) {
    context.log("Función 'uploadPdf' procesando una solicitud con nueva lógica de buffer.");

    const siteId = "m365x63639251.sharepoint.com,99bec355-c27b-412a-bd2b-515e818490e0,92ce2085-1c97-4587-9d6c-2e4350a4b0d3";
    const tipo = req.query.tipo;

    if (!tipo || (tipo.toLowerCase() !== 'entrada' && tipo.toLowerCase() !== 'salida')) {
        context.res = { status: 400, body: "Por favor, especifica un 'tipo' en la URL (ej: ?tipo=Entrada o ?tipo=Salida)." };
        return;
    }

    try {
        // 1. Parsear el archivo de la solicitud a un buffer
        const { buffer: fileBuffer, name: fileName } = await parseMultipart(req);
        context.log(`Archivo recibido en buffer: ${fileName} (${(fileBuffer.length / 1024).toFixed(2)} KB). Tipo: ${tipo}`);

        // 2. Obtener token de autenticación
        const authResponse = await cca.acquireTokenByClientCredential({ scopes: ["https://graph.microsoft.com/.default"] });
        if (!authResponse.accessToken) {
            throw new Error("No se pudo obtener el token de acceso.");
        }
        context.log("Token de acceso obtenido con éxito.");

        // 3. Inicializar el cliente de Microsoft Graph
        const graphClient = Client.initWithMiddleware({
            authProvider: { getAccessToken: async () => authResponse.accessToken },
        });

        // 4. Definir la ruta de subida en SharePoint
        const uploadPath = `/sites/${siteId}/drive/root:/${tipo}/${fileName}:/content`;
        context.log(`Ruta de subida en SharePoint: ${uploadPath}`);

        // 5. Subir el buffer del archivo
        const response = await graphClient.api(uploadPath).put(fileBuffer);

        context.log("Archivo subido a SharePoint con éxito.");
        context.res = {
            status: 200,
            body: {
                message: "Archivo subido a SharePoint con éxito.",
                fileName: fileName,
                sharepoint_response: response,
            },
            headers: { 'Content-Type': 'application/json' }
        };

    } catch (error) {
        context.log.error("Ocurrió un error en el bloque principal:", error);
        context.res = {
            status: 500,
            body: {
                message: "Error interno al procesar la solicitud.",
                error: error.message,
                stack: error.stack
            },
            headers: { 'Content-Type': 'application/json' }
        };
    }
};
