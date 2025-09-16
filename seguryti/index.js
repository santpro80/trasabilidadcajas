/**
 * Import necessary modules.
 */
const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const PDFDocument = require("pdfkit");
const {Client} = require("@microsoft/microsoft-graph-client");
const logger = require("firebase-functions/logger");

// Initialize Firebase Admin SDK
admin.initializeApp();

/**
 * Scheduled function that runs every day at 23:59 to generate and upload a daily report.
 */
exports.dailyReport = onSchedule("59 23 * * *", async (event) => {
  logger.info("Starting daily report generation...", {structuredData: true});

  try {
    // 1. Fetch data from Firestore for the last 24 hours.
    // TODO: Implement data fetching logic.
    const dailyMovements = await getDailyBoxMovements();
    logger.info(`Fetched ${dailyMovements.length} movements for the report.`);

    // 2. Generate a PDF with the fetched data.
    // TODO: Implement PDF generation logic.
    const pdfBuffer = await createReportPDF(dailyMovements);
    logger.info("Successfully generated PDF buffer.");

    // 3. Authenticate and upload the PDF to OneDrive.
    // TODO: Implement OneDrive upload logic.
    // This will be the most complex part, requiring OAuth2 setup.
    await uploadToOneDrive(pdfBuffer);
    logger.info("Successfully uploaded report to OneDrive.");
  } catch (error) {
    logger.error("Error generating or uploading daily report:", error);
  }

  return null;
});

/**
 * Fetches box movements from the last 24 hours from Firestore.
 * @return {Promise<Array>} A promise that resolves to an array of movement documents.
 */
async function getDailyBoxMovements() {
  const db = admin.firestore();
  const now = new Date();
  const past24Hours = new Date(now.getTime() - (24 * 60 * 60 * 1000));

  // Assumption: Movements are stored in a collection named 'historial'.
  // Assumption: Each document has a 'fecha' field with a Firestore Timestamp.
  logger.info(`Querying 'historial' collection for documents after ${past24Hours.toISOString()}`);
  const snapshot = await db.collection("historial")
      .where("fecha", ">=", past24Hours)
      .orderBy("fecha", "desc")
      .get();

  if (snapshot.empty) {
    logger.info("No box movements found in the last 24 hours.");
    return [];
  }

  const movements = [];
  snapshot.forEach((doc) => {
    movements.push({id: doc.id, ...doc.data()});
  });

  return movements;
}

/**
 * Creates a PDF document from a list of box movements.
 * @param {Array} movements - The list of movements to include in the report.
 * @return {Promise<Buffer>} A promise that resolves to the PDF content as a Buffer.
 */
async function createReportPDF(movements) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({margin: 50});
    const buffers = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });
    doc.on("error", reject);

    // --- PDF Content ---

    // Title
    doc.fontSize(18).text("Reporte Diario de Movimientos de Cajas", {align: "center"});
    doc.moveDown();

    // Report Date
    const reportDate = new Date().toLocaleDateString("es-ES", {timeZone: "America/Argentina/Buenos_Aires"});
    doc.fontSize(12).text(`Fecha: ${reportDate}`, {align: "right"});
    doc.moveDown(2);

    // Table Header
    doc.fontSize(10).font("Helvetica-Bold");
    // Assuming fields: 'cajaId', 'accion', 'usuario', 'fecha'
    // Please verify these field names from your Firestore documents.
    doc.text("Fecha y Hora", 50, 150);
    doc.text("Caja ID", 200, 150);
    doc.text("Acción", 350, 150);
    doc.text("Usuario", 450, 150);
    doc.moveDown();
    doc.font("Helvetica");

    // Table Rows
    let y = 170;
    if (movements.length === 0) {
      doc.text("No se registraron movimientos en las últimas 24 horas.", 50, y);
    } else {
      movements.forEach((mov) => {
        const movementDate = mov.fecha.toDate().toLocaleString("es-ES", {timeZone: "America/Argentina/Buenos_Aires"});
        // Adjust field names if they are different in your database
        const cajaId = mov.cajaId || "N/A";
        const accion = mov.accion || "N/A";
        const usuario = mov.usuario || "N/A";

        doc.text(movementDate, 50, y);
        doc.text(cajaId, 200, y);
        doc.text(accion, 350, y);
        doc.text(usuario, 450, y);
        y += 20;
        if (y > 700) { // Simple pagination
          doc.addPage();
          y = 50;
        }
      });
    }

    // --- End of PDF Content ---
    doc.end();
  });
}

/**
 * Uploads a file to OneDrive.
 * @param {Buffer} fileBuffer - The file content to upload.
 */
async function uploadToOneDrive(fileBuffer) {
  // Placeholder implementation
  logger.warn("uploadToOneDrive is not implemented yet.");
  // NOTE: This will require setting up Microsoft Graph API authentication (OAuth2).
  // We will need to store credentials securely, likely in Firebase Function configuration.
}
