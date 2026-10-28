// Pendant qu'on écrit un article : tous les produits qui correspondent, en une seule liste. Ceux en
// promo y sont avec leur promo, les autres sans. Si rien ne correspond (un mot mal écrit), les
// produits qui ressemblent à ce qu'on a écrit. Sans Firebase ni réseau : facile à tester.

import { comparerProximite, motsCles, rechercherPromos } from "./promos.js";
import { rechercherProduits } from "./produits.js";
import { approcher, ecartPermis, rangerParLongueur } from "./ressemblance.js";

/**
 * Tout ce qui correspond à `texte` : les promos (`promos`, voir indexerPromos) et tous les produits
 * (`produits`, voir indexerProduits ; null tant qu'ils ne sont pas chargés), les plus proches
 * d'abord ; à égalité, la promo d'abord. Un produit en promo n'est montré qu'une fois, avec sa promo,
 * même quand c'est son nom dans la base des produits qui correspond. Renvoie { resultats, ressemblants } :
 * `resultats` [{ offre, aVenir } | { produit }], `ressemblants` vrai quand ce sont des produits qui
 * ressemblent à ce qu'on a écrit, faute de mieux.
 */
export function rechercherTout(texte, { promos, produits, aujourdhui }) {
  const trouves = chercher(texte, promos, produits, aujourdhui);
  if (trouves.length) return { resultats: trouves, ressemblants: false };
  // Rien : un mot mal écrit ? On cherche avec les mots connus qui lui ressemblent.
  const mots = motsCles(texte).filter((mot) => ecartPermis(mot) > 0);
  const sources = [produits, motsDesPromos(promos)].filter((source) => source?.vocabulaire);
  const approches = mots.length && sources.length ? approcher(mots, sources.map(versSource)) : new Map();
  if (!approches.size) return { resultats: [], ressemblants: false };
  const ressemblants = chercher(texte, promos, produits, aujourdhui, approches);
  return { resultats: ressemblants, ressemblants: ressemblants.length > 0 };
}

const versSource = ({ mots, vocabulaire }) => ({ connus: mots, vocabulaire });

function chercher(texte, promos, produits, aujourdhui, approches) {
  const enPromo = promos ? rechercherPromos(promos, texte, aujourdhui, { approches }) : [];
  const resultats = enPromo.map(({ offre, aVenir, proximite }) => ({ offre, aVenir, proximite }));
  const montres = new Set(enPromo.flatMap(({ eans }) => eans));
  if (produits) {
    const promoDuCode = promosParCode(promos, aujourdhui);
    for (const { produit, proximite } of rechercherProduits(produits, texte, { approches })) {
      if (montres.has(produit.ean)) continue;
      montres.add(produit.ean);
      const promo = promoDuCode.get(produit.ean);
      resultats.push(promo ? { ...promo, proximite } : { produit, proximite });
    }
  }
  // Le tri garde l'ordre d'arrivée à égalité : les promos d'abord, puis les produits les plus sûrs.
  resultats.sort((a, b) => comparerProximite(a.proximite, b.proximite));
  return resultats.map(({ proximite: _, ...resultat }) => resultat);
}

/** Les promos pas encore finies, par code-barres : celle en cours avant celle à venir. */
function promosParCode(promos, aujourdhui) {
  const parCode = new Map();
  for (const { offre } of promos ?? []) {
    if (!offre.ean || (offre.date_fin && offre.date_fin < aujourdhui)) continue;
    const aVenir = Boolean(offre.date_debut && offre.date_debut > aujourdhui);
    const deja = parCode.get(offre.ean);
    if (!deja || (deja.aVenir && !aVenir)) parCode.set(offre.ean, { offre, aVenir });
  }
  return parCode;
}

/** Les mots des promos, pour les mots mal écrits (gardés tant que les promos ne changent pas). */
const motsParPromos = new WeakMap();
function motsDesPromos(promos) {
  if (!promos) return null;
  if (!motsParPromos.has(promos)) {
    const mots = new Map();
    for (const { motsProduit, motsMarque } of promos) {
      for (const mot of new Set([...motsProduit, ...motsMarque])) mots.set(mot, (mots.get(mot) ?? 0) + 1);
    }
    motsParPromos.set(promos, { mots, vocabulaire: rangerParLongueur(mots.keys()) });
  }
  return motsParPromos.get(promos);
}

/** Ce que dit la ligne au-dessus des résultats : « 12 produits, dont 3 en promo ». */
export function phraseResultats(resultats, { ressemblants = false, texte = "" } = {}) {
  const nombre = resultats.length;
  if (nombre === 0) return "Aucun produit · + pour l'ajouter tel quel";
  const enPromo = resultats.filter((resultat) => resultat.offre).length;
  const produits = `${nombre} produit${nombre > 1 ? "s" : ""}`;
  let phrase = produits;
  if (enPromo === nombre) phrase = `${produits} en promo`;
  else if (enPromo > 0) phrase = `${produits}, dont ${enPromo} en promo`;
  if (!ressemblants) return phrase;
  const qui = nombre > 1 ? "qui ressemblent" : "qui ressemble";
  return `Rien pour « ${texte.trim()} » · ${phrase} ${qui}`;
}
