// Les mots qui ressemblent à un mot mal écrit (« nutela », « magi », « cocacola ») : quand ce qu'on
// écrit ne trouve rien, l'appli propose les produits qui y ressemblent. Sans réseau : les mots connus
// sont ceux des produits et des promos du téléphone.

/** L'écart permis selon la longueur du mot : aucun en dessous de 4 lettres, trop d'homonymes. */
export function ecartPermis(mot) {
  if (mot.length < 4) return 0;
  return mot.length < 7 ? 1 : 2;
}

/**
 * Le nombre de fautes (lettre en trop, en moins, changée, ou deux lettres inversées) pour passer de
 * `a` à `b`, ou Infinity s'il en faut plus que `auPlus` (on s'arrête alors dès qu'on le sait).
 */
export function fautes(a, b, auPlus = Infinity) {
  if (Math.abs(a.length - b.length) > auPlus) return Infinity;
  let avantDerniere = null;
  let derniere = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const ligne = [i];
    let meilleur = i;
    for (let j = 1; j <= b.length; j += 1) {
      const change = a[i - 1] === b[j - 1] ? 0 : 1;
      let valeur = Math.min(derniere[j] + 1, ligne[j - 1] + 1, derniere[j - 1] + change);
      if (avantDerniere && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        valeur = Math.min(valeur, avantDerniere[j - 2] + 1); // deux lettres inversées
      }
      ligne.push(valeur);
      meilleur = Math.min(meilleur, valeur);
    }
    if (meilleur > auPlus) return Infinity;
    avantDerniere = derniere;
    derniere = ligne;
  }
  const total = derniere[b.length];
  return total > auPlus ? Infinity : total;
}

/**
 * Les mots connus les plus proches de `mot`, les plus proches d'abord : le mot entier mal écrit
 * (« nutela » → « nutella »), ou son début (« nutelz » → « nutella », quand on est en train d'écrire).
 * À égalité de fautes, les mots les plus courants d'abord (`frequence(mot)` : dans combien de produits).
 * `vocabulaires` : les mots connus, rangés par longueur (voir rangerParLongueur) ; un ou plusieurs.
 * Renvoie [mot].
 */
export function motsProches(mot, vocabulaires, { auPlus = 8, frequence = () => 0 } = {}) {
  const permis = ecartPermis(mot);
  if (!permis) return [];
  const trouves = new Map();
  for (const vocabulaire of [vocabulaires].flat().filter(Boolean)) {
    for (const [longueur, mots] of vocabulaire) {
      if (longueur < mot.length - permis) continue;
      const entier = Math.abs(longueur - mot.length) <= permis;
      for (const connu of mots) {
        if (connu === mot || trouves.has(connu)) continue;
        let ecart = entier ? fautes(mot, connu, permis) : Infinity;
        let debut = false;
        // Le début du mot connu, d'une longueur proche : « nutelz » contre « nutell(a) ». Seulement pour
        // les mots de même première lettre (rarement celle qu'on rate) : c'est bien plus rapide.
        if (ecart === Infinity && longueur > mot.length && connu[0] === mot[0]) {
          for (let n = Math.max(2, mot.length - 1); n <= Math.min(longueur - 1, mot.length + 1); n += 1) {
            ecart = Math.min(ecart, fautes(mot, connu.slice(0, n), permis));
          }
          debut = true;
        }
        if (ecart > 0 && ecart <= permis) trouves.set(connu, { connu, ecart, debut, nombre: frequence(connu) });
      }
    }
  }
  return [...trouves.values()]
    .sort(
      (a, b) =>
        a.ecart - b.ecart ||
        b.nombre - a.nombre ||
        Number(a.debut) - Number(b.debut) ||
        Math.abs(a.connu.length - mot.length) - Math.abs(b.connu.length - mot.length) ||
        a.connu.localeCompare(b.connu),
    )
    .slice(0, auPlus)
    .map(({ connu }) => connu);
}

/** Un mot collé en deux mots connus : « cocacola » → ["coca", "cola"], ou null. `connus` : une ou plusieurs Map (ou Set). */
export function decouper(mot, connus) {
  const listes = [connus].flat().filter(Boolean);
  const connu = (partie) => listes.some((liste) => liste.has(partie));
  if (mot.length < 6 || !listes.length) return null;
  for (let n = 3; n <= mot.length - 3; n += 1) {
    if (connu(mot.slice(0, n)) && connu(mot.slice(n))) return [mot.slice(0, n), mot.slice(n)];
  }
  return null;
}

/** Range des mots par longueur, pour ne comparer un mot qu'à ceux de longueur proche : Map(longueur → [mot]). */
export function rangerParLongueur(mots) {
  const parLongueur = new Map();
  for (const mot of mots) {
    if (!parLongueur.has(mot.length)) parLongueur.set(mot.length, []);
    parLongueur.get(mot.length).push(mot);
  }
  return parLongueur;
}

/**
 * Pour chaque mot cherché, les mots connus qui lui ressemblent, comme équivalents : Map(mot → [[mots]]),
 * ce que lisent rechercherPromos et rechercherProduits. `sources` : [{ connus, vocabulaire }], les
 * mots des produits et ceux des promos ; `connus` : Map(mot → nombre de produits qui l'ont).
 */
export function approcher(motsCherches, sources) {
  const connus = sources.map((source) => source.connus);
  const vocabulaires = sources.map((source) => source.vocabulaire);
  const frequence = (mot) => connus.reduce((total, liste) => total + (liste.get(mot) ?? 0), 0);
  const approches = new Map();
  for (const mot of new Set(motsCherches)) {
    const proches = motsProches(mot, vocabulaires, { frequence }).map((proche) => [proche]);
    const enDeux = decouper(mot, connus);
    if (enDeux) proches.unshift(enDeux);
    if (proches.length) approches.set(mot, proches);
  }
  return approches;
}
