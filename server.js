const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

let commandes = [];

app.post("/api/commande", (req, res) => {
  const data = req.body;
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  const commande = { ...data, code, paye: false };
  commandes.push(commande);
  const lien = `https://paiement-render.onrender.com/payer.html?code=${code}`;
  res.json({ lien_paiement: lien });
});

app.post("/api/payer", (req, res) => {
  const { code, code_secret } = req.body;
  if (code_secret !== "123456") {
    return res.status(400).json({ message: "Code de paiement incorrect." });
  }

  const commande = commandes.find(c => c.code === code);
  if (!commande) return res.status(404).json({ message: "Commande introuvable." });

  commande.paye = true;

  fetch("https://wautochat.com/webhook?privateKey=TON_WEBHOOK_KEY", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(commande)
  }).catch(err => console.error("Erreur webhook:", err));

  res.json({ message: "✅ Paiement validé. Ton billet arrive sur WhatsApp." });
});

app.listen(PORT, () => console.log("✅ Serveur actif sur le port", PORT));
