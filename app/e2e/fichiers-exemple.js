// Des fichiers de ticket d'exemple, fabriqués à la volée pour les scénarios réels : une image PNG
// (comme une capture d'écran) et un PDF d'une page (comme le ticket de l'appli d'un magasin).

import { crc32, deflateSync } from "node:zlib";

function blocPng(type, donnees) {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const typeEtDonnees = Buffer.concat([Buffer.from(type, "ascii"), donnees]);
  const controle = Buffer.alloc(4);
  controle.writeUInt32BE(crc32(typeEtDonnees));
  return Buffer.concat([longueur, typeEtDonnees, controle]);
}

/** Une image en niveaux de gris : fond blanc, et des lignes noires comme celles d'un ticket. */
export function pngExemple({ largeur = 300, hauteur = 700 } = {}) {
  const lignes = [];
  for (let y = 0; y < hauteur; y += 1) {
    const ligne = Buffer.alloc(largeur + 1, 255);
    ligne[0] = 0; // pas de filtre
    if (y % 40 >= 20 && y % 40 < 28) ligne.fill(0, 20, largeur - 20 - (y % 120));
    lignes.push(ligne);
  }
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(largeur, 0);
  entete.writeUInt32BE(hauteur, 4);
  entete[8] = 8; // 8 bits par pixel
  entete[9] = 0; // niveaux de gris
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    blocPng("IHDR", entete),
    blocPng("IDAT", deflateSync(Buffer.concat(lignes))),
    blocPng("IEND", Buffer.alloc(0)),
  ]);
}

/** Un PDF d'une page, étroite et longue comme un ticket, avec quelques lignes de texte. */
export function pdfExemple() {
  const texte = ["MAGASIN EXEMPLE", "Lait 0,89", "Pain 1,65", "TOTAL 2,54"]
    .map((ligne, rang) => `BT /F1 14 Tf 20 ${560 - rang * 30} Td (${ligne}) Tj ET`)
    .join("\n");
  const objets = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 226 600] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${texte.length} >>\nstream\n${texte}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const positions = objets.map((objet, rang) => {
    const position = pdf.length;
    pdf += `${rang + 1} 0 obj\n${objet}\nendobj\n`;
    return position;
  });
  const debutTable = pdf.length;
  pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  pdf += positions.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${debutTable}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

/**
 * Un ticket de caisse fictif, net comme une capture d'écran, à dessiner dans le navigateur :
 * `page.evaluate(dessinerTicket, { enTete, date })` renvoie l'image PNG en base64.
 */
export function dessinerTicket({ enTete = "MAGASIN EXEMPLE", date = "" } = {}) {
  const toile = document.createElement("canvas");
  toile.width = 560;
  toile.height = 900;
  const dessin = toile.getContext("2d");
  dessin.fillStyle = "#ffffff";
  dessin.fillRect(0, 0, toile.width, toile.height);
  dessin.fillStyle = "#222222";
  dessin.font = "bold 30px monospace";
  dessin.textAlign = "center";
  dessin.fillText(enTete, 280, 70);
  dessin.font = "22px monospace";
  dessin.fillText("Ticket fictif pour la documentation", 280, 110);
  dessin.textAlign = "left";
  const lignes = [
    ["LAIT DEMI-ECREME 2 L", "1,78"],
    ["PAIN COMPLET", "1,65"],
    ["BANANES 1 KG", "1,29"],
    ["BEURRE DOUX", "2,49"],
    ["CAFE MOULU 1 KG", "9,99"],
    ["PATES SPAGHETTI x2", "1,90"],
    ["CHOCOLAT AU LAIT", "2,15"],
    ["YAOURTS NATURE x8", "2,20"],
  ];
  lignes.forEach(([produit, prix], rang) => {
    const y = 190 + rang * 52;
    dessin.fillText(produit, 40, y);
    dessin.fillText(prix, 440, y);
  });
  dessin.fillRect(40, 640, 480, 3);
  dessin.font = "bold 30px monospace";
  dessin.fillText("TOTAL", 40, 700);
  dessin.fillText("23,45 EUR", 340, 700);
  dessin.font = "22px monospace";
  if (date) dessin.fillText(`${date}  14:32`, 40, 770);
  dessin.fillText("Merci de votre visite", 140, 830);
  return toile.toDataURL("image/png").split(",")[1];
}

/** Choisit un fichier comme sur l'iPhone : touche le bouton, puis donne le fichier au sélecteur. */
export async function choisirFichier(page, bouton, fichier) {
  const [selecteur] = await Promise.all([page.waitForEvent("filechooser"), bouton.click()]);
  await selecteur.setFiles(fichier);
}
