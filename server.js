const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const QRCode = require("qrcode");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

function generateOrderCode(nom) {
  const prefix = nom.substring(0, 3).toUpperCase();
  const number = Math.floor(Math.random() * 9000 + 1000);
  return `CMD-${prefix}-${number}`;
}

async function createTicketPDF(nom, cat, tel, code, index) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([300, 200]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const qrText = `${nom} - ${cat} - ${tel} - ${code} - Ticket ${index + 1}`;

  const qrImageDataURL = await QRCode.toDataURL(qrText);
  const qrImageBytes = Buffer.from(qrImageDataURL.split(",")[1], "base64");
  const qrImage = await pdf.embedPng(qrImageBytes);

  page.drawText(`🎟️ Ticket - ${cat}`, { x: 20, y: 170, size: 14, font });
  page.drawText(`👤 ${nom}`, { x: 20, y: 150, size: 12, font });
  page.drawText(`📞 ${tel}`, { x: 20, y: 135, size: 12, font });
  page.drawText(`#${code} - N°${index + 1}`, { x: 20, y: 120, size: 12, font });
  page.drawImage(qrImage, { x: 20, y: 20, width: 100, height: 100 });

  return await pdf.saveAsBase64({ dataUri: false });
}

app.post("/api/payer", async (req, res) => {
  const { nom, tel, cat1, qt1, cat2, qt2, cat3, qt3, code } = req.body;
  const commandCode = generateOrderCode(nom);
  const billets = [];

  if (cat1 && qt1) billets.push({ cat: cat1, qt: parseInt(qt1) });
  if (cat2 && qt2) billets.push({ cat: cat2, qt: parseInt(qt2) });
  if (cat3 && qt3) billets.push({ cat: cat3, qt: parseInt(qt3) });

  const attachments = [];

  for (const billet of billets) {
    for (let i = 0; i < billet.qt; i++) {
      const pdf = await createTicketPDF(nom, billet.cat, tel, commandCode, i);
      attachments.push({
        filename: `ticket-${billet.cat}-${i + 1}.pdf`,
        content: pdf,
        encoding: "base64"
      });
    }
  }

  // Envoi du webhook à WAautoChat
  const webhookURL = "https://wautochat.com/webhook?privateKey=PL-e...."; // Remplace par ton vrai lien complet ici
  await axios.post(webhookURL, {
    tel: `${tel}@c.us`,
    nom_client: nom,
    code_commande: commandCode,
    billets,
    status: "payé",
    fichiers: attachments
  });

  res.json({ message: "Paiement validé, tickets générés." });
});

app.listen(PORT, () => {
  console.log("Serveur en ligne sur le port", PORT);
});
