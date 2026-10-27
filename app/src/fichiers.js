// Les fichiers des tickets de caisse, dans le navigateur : photo allégée avant l'envoi, affichage
// en grand (photo ou PDF), partage. La partie PDF n'est chargée qu'à l'ouverture d'un PDF.

import { TAILLE_MAX, dimensionsReduites, formaterTaille } from "./tickets.js";

const JPEG = "image/jpeg";
const PDF = "application/pdf";

/** Une photo ou une capture d'écran trop lourde après allègement (rare) : on baisse la qualité. */
const POIDS_VISE = 1_500_000;

const estPdf = (fichier) => fichier.type === PDF || /\.pdf$/i.test(fichier.name ?? "");

/**
 * Prépare le fichier choisi : une photo (ou capture d'écran) est allégée en JPEG lisible ; un PDF
 * est gardé tel quel. Renvoie { octets, type, apercu } ou lance une erreur au message clair.
 */
export async function preparerFichier(fichier) {
  if (estPdf(fichier)) {
    const octets = new Uint8Array(await fichier.arrayBuffer());
    if (new TextDecoder().decode(octets.subarray(0, 5)) !== "%PDF-")
      throw new Error("Ce fichier n'est pas un vrai PDF.");
    if (octets.length > TAILLE_MAX) throw new Error(`PDF trop lourd (${formaterTaille(octets.length)}, 5 Mo au plus).`);
    return { octets, type: PDF, apercu: null };
  }
  if (!fichier.type.startsWith("image/")) throw new Error("Choisissez une photo, une capture d'écran ou un PDF.");
  const jpeg = await alleger(fichier);
  return { octets: new Uint8Array(await jpeg.arrayBuffer()), type: JPEG, apercu: URL.createObjectURL(jpeg) };
}

async function alleger(fichier) {
  const adresse = URL.createObjectURL(fichier);
  try {
    const image = new Image();
    image.src = adresse;
    // Le navigateur tourne la photo dans le bon sens (informations de l'appareil photo).
    await image.decode().catch(() => {
      throw new Error("Image illisible : choisissez une autre photo.");
    });
    const { largeur, hauteur } = dimensionsReduites(image.naturalWidth, image.naturalHeight);
    const toile = document.createElement("canvas");
    toile.width = largeur;
    toile.height = hauteur;
    const dessin = toile.getContext("2d");
    dessin.fillStyle = "#ffffff"; // fond blanc pour les captures d'écran transparentes
    dessin.fillRect(0, 0, largeur, hauteur);
    dessin.drawImage(image, 0, 0, largeur, hauteur);
    let jpeg = await enJpeg(toile, 0.82);
    if (jpeg.size > POIDS_VISE) jpeg = await enJpeg(toile, 0.6);
    return jpeg;
  } finally {
    URL.revokeObjectURL(adresse);
  }
}

function enJpeg(toile, qualite) {
  return new Promise((resoudre, rejeter) =>
    toile.toBlob((blob) => (blob ? resoudre(blob) : rejeter(new Error("Photo impossible à préparer."))), JPEG, qualite),
  );
}

/**
 * Affiche le fichier d'un ticket dans `conteneur` : la photo, ou chaque page du PDF. Renvoie de quoi
 * tout libérer à la fermeture.
 */
export async function afficherFichier(blob, conteneur) {
  if (blob.type === PDF) {
    const { dessinerPdf } = await import("./pdf.js");
    return dessinerPdf(new Uint8Array(await blob.arrayBuffer()), conteneur);
  }
  const adresse = URL.createObjectURL(blob);
  const image = document.createElement("img");
  image.className = "image-ticket";
  image.alt = "Photo du ticket de caisse";
  image.src = adresse;
  conteneur.replaceChildren(image);
  return () => URL.revokeObjectURL(adresse);
}

/** Le nom du fichier quand on le partage ou l'enregistre : « ticket-leclerc-2026-10-27.pdf ». */
export const nomFichier = (ticket) =>
  `ticket-${ticket.magasin}-${ticket.date_achat}.${ticket.type === PDF ? "pdf" : "jpg"}`;

/**
 * Partage le fichier (feuille de partage de l'iPhone : Enregistrer dans Fichiers, AirDrop, Mail…),
 * ou, si le navigateur ne sait pas partager un fichier, le télécharge.
 */
export async function partagerFichier(blob, nom) {
  const fichier = new File([blob], nom, { type: blob.type });
  if (navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier] });
    } catch (erreur) {
      if (erreur.name !== "AbortError") throw erreur; // « Annuler » dans la feuille de partage
    }
    return;
  }
  const adresse = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = adresse;
  lien.download = nom;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(adresse), 60_000);
}

/**
 * Le texte d'un ticket préparé par preparerFichier : lu dans le PDF, ou sur la photo (plus long, de
 * quelques secondes, arrêtée par `signal`). Les outils de lecture ne sont chargés qu'à ce moment-là.
 */
export async function texteDuTicket({ octets, type, apercu }, signal) {
  if (type === PDF) {
    const { texteDuPdf } = await import("./pdf.js");
    return texteDuPdf(octets.slice()); // une copie : PDF.js garde celle qu'on lui donne
  }
  const { texteDeLaPhoto } = await import("./lecture.js");
  return texteDeLaPhoto(apercu, signal);
}
