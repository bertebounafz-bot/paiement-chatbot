import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

let commandes = [];

app.post("/api/commande", async (req, res) => {
  const donnees = req.body;
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  const commande = { ...donnees, code, paye: false };
  commandes.push(commande);
  const lien = `https://paiement-chatbot.vercel.app/?nom=${donnees.nom}&tel=${donnees.tel}&cat1=${donnees.cat1}&qt1=${donnees.qt1}&cat2=${donnees.cat2}&qt2=${donnees.qt2}&cat3=${donnees.cat3}&qt3=${donnees.qt3}&code=${code}`;
  res.json({ lien_paiement: lien, code });
});

app.post("/api/payer", async (req, res) => {
  const { code } = req.body;
  const commande = commandes.find((c) => c.code === code);

  if (!commande) return res.status(404).json({ error: "Commande introuvable" });

  commande.paye = true;

  // Génération du ticket PDF avec QR code
  const doc = new PDFDocument();
  const filePath = path.join(__dirname, "public", `${commande.code}.pdf`);
  const writeStream = fs.createWriteStream(filePath);
  doc.pipe(writeStream);

  doc.fontSize(20).text("🎟️ Ticket d'entrée", { align: "center" });
  doc.moveDown();
  doc.fontSize(14).text(`Nom : ${commande.nom}`);
  doc.text(`Téléphone : ${commande.tel}`);
  doc.text(`Code de commande : ${commande.code}`);
  doc.moveDown();

  if (commande.qt1 && commande.cat1)
    doc.text(`→ ${commande.qt1} x ${commande.cat1}`);
  if (commande.qt2 && commande.cat2)
    doc.text(`→ ${commande.qt2} x ${commande.cat2}`);
  if (commande.qt3 && commande.cat3)
    doc.text(`→ ${commande.qt3} x ${commande.cat3}`);

  const qrText = `https://paiement-chatbot.vercel.app/${commande.code}`;
  const qrImage = await QRCode.toDataURL(qrText);
  const image = qrImage.split(",")[1];
  doc.image(Buffer.from(image, "base64"), {
    fit: [150, 150],
    align: "center",
  });

  doc.end();

  writeStream.on("finish", async () => {
    const url_pdf = `https://paiement-chatbot.vercel.app/${commande.code}.pdf`;

    // Envoi du webhook à WAautoChat
    const webhook = `https://wautochat.com/webhook?privateKey=PL-e...`; // à remplacer par ton vrai lien privé
    await axios.post(webhook, {
      nom: commande.nom,
      tel: commande.tel,
      cat1: commande.cat1,
      qt1: commande.qt1,
      cat2: commande.cat2,
      qt2: commande.qt2,
      cat3: commande.cat3,
      qt3: commande.qt3,
      code: commande.code,
      statut: "payé",
      ticket_pdf: url_pdf,
    });

    res.json({ valide: true, ticket_pdf: url_pdf });
  });
});

app.listen(PORT, () => {
  console.log("Serveur actif sur le port", PORT);
});

