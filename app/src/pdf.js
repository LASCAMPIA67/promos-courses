// Affichage des tickets en PDF (ceux des applis E.Leclerc et Lidl Plus) avec PDF.js, de Mozilla :
// https://mozilla.github.io/pdf.js/. Chargé seulement à l'ouverture d'un PDF : l'appli reste légère.

import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import adresseTravailleur from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = adresseTravailleur;

/** Au-delà, l'iPhone refuse de dessiner l'image (environ 16 millions de pixels). */
const PIXELS_MAX = 16_000_000;
const PAGES_MAX = 20;

/** Dessine chaque page du PDF dans `conteneur`, à sa largeur. Renvoie de quoi tout libérer. */
export async function dessinerPdf(octets, conteneur) {
  // isEvalSupported : pas d'exécution de code venant du PDF, par prudence.
  const tache = getDocument({ data: octets, isEvalSupported: false });
  const pdf = await tache.promise;
  const largeur = conteneur.clientWidth || 360;
  const finesse = Math.min(window.devicePixelRatio || 1, 3);
  const pages = [];
  for (let numero = 1; numero <= Math.min(pdf.numPages, PAGES_MAX); numero += 1) {
    const page = await pdf.getPage(numero);
    const taille = page.getViewport({ scale: 1 });
    let echelle = (largeur / taille.width) * finesse;
    echelle = Math.min(echelle, Math.sqrt(PIXELS_MAX / (taille.width * taille.height)));
    const vue = page.getViewport({ scale: echelle });
    const toile = document.createElement("canvas");
    toile.className = "page-pdf";
    toile.width = Math.floor(vue.width);
    toile.height = Math.floor(vue.height);
    toile.setAttribute("role", "img");
    toile.setAttribute("aria-label", `Page ${numero} du ticket`);
    pages.push(toile);
    await page.render({ canvas: toile, viewport: vue }).promise;
  }
  conteneur.replaceChildren(...pages);
  return () => tache.destroy();
}
