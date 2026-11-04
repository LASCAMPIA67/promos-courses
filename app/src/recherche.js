// Pendant qu'on écrit un article : les promos qui correspondent. Si rien ne correspond (un mot mal
// écrit), celles qui ressemblent à ce qu'on a écrit. Sans Firebase ni réseau : facile à tester.

import { motsCles, rechercherPromos } from "./promos.js";
import { approcher, ecartPermis, rangerParLongueur } from "./ressemblance.js";

/**
 * Les promos qui correspondent à `texte` (`promos` : voir indexerPromos), les plus proches d'abord.
 * Si aucune ne correspond, celles qui ressemblent à ce qu'on a écrit (« nutela » → Nutella), d'après
 * les mots des promos. Renvoie { resultats: [{ offre, aVenir }], ressemblants } : `ressemblants` vrai
 * quand ce sont des promos qui ressemblent, faute de mieux.
 */
export function rechercher(texte, { promos, aujourdhui }) {
  const trouvees = rechercherPromos(promos, texte, aujourdhui);
  if (trouvees.length || !promos) return { resultats: trouvees, ressemblants: false };
  // Rien : un mot mal écrit ? On cherche avec les mots connus qui lui ressemblent.
  const mots = motsCles(texte).filter((mot) => ecartPermis(mot) > 0);
  const approches = mots.length ? approcher(mots, [motsDesPromos(promos)]) : new Map();
  if (!approches.size) return { resultats: [], ressemblants: false };
  const ressemblantes = rechercherPromos(promos, texte, aujourdhui, { approches });
  return { resultats: ressemblantes, ressemblants: ressemblantes.length > 0 };
}

/**
 * Les mots des promos, et dans combien de promos (les plus courants d'abord pour un mot mal écrit),
 * gardés tant que les promos ne changent pas.
 */
const motsParPromos = new WeakMap();
function motsDesPromos(promos) {
  if (!motsParPromos.has(promos)) {
    const connus = new Map();
    for (const { motsProduit, motsMarque } of promos) {
      for (const mot of new Set([...motsProduit, ...motsMarque])) connus.set(mot, (connus.get(mot) ?? 0) + 1);
    }
    motsParPromos.set(promos, { connus, vocabulaire: rangerParLongueur(connus.keys()) });
  }
  return motsParPromos.get(promos);
}

/** Ce que dit la ligne au-dessus des résultats : « 4 promos », « Rien pour « nutela » · 1 promo qui ressemble ». */
export function phraseResultats(resultats, { ressemblants = false, texte = "" } = {}) {
  const nombre = resultats.length;
  if (nombre === 0) return "Aucune promo · + pour l'ajouter";
  const promos = `${nombre} promo${nombre > 1 ? "s" : ""}`;
  if (!ressemblants) return promos;
  return `Rien pour « ${texte.trim()} » · ${promos} qui ${nombre > 1 ? "ressemblent" : "ressemble"}`;
}
