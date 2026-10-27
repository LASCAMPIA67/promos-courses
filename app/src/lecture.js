// Lecture automatique d'un ticket de caisse, sur le téléphone : le texte d'un PDF est lu directement ;
// celui d'une photo, avec Tesseract.js (https://tesseract.projectnaptha.com), dont les fichiers sont
// servis par l'appli (« ocr/ », voir vite.config.js). Rien n'est envoyé ailleurs. Chargé seulement à
// la première lecture : l'appli reste légère.

import { createWorker } from "tesseract.js";

const DOSSIER = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href;

/** Le texte d'une photo de ticket (Blob ou adresse d'image). `signal` arrête la lecture en cours. */
export async function texteDeLaPhoto(image, signal) {
  const lecteur = await createWorker("fra", 1, {
    workerPath: `${DOSSIER}worker.min.js`,
    workerBlobURL: false,
    corePath: DOSSIER,
    langPath: DOSSIER,
    gzip: true,
  });
  const arreter = () => lecteur.terminate();
  signal?.addEventListener("abort", arreter, { once: true });
  try {
    signal?.throwIfAborted();
    const { data } = await lecteur.recognize(image);
    return data.text;
  } finally {
    signal?.removeEventListener("abort", arreter);
    await lecteur.terminate();
  }
}
