// Les rayons du magasin : la liste est rangée dans l'ordre où on les traverse, le frais et le
// surgelé à la fin pour qu'ils restent froids. Sans Firebase : facile à tester.
//
// Le rayon d'un article est trouvé d'après son nom : le premier mot connu l'emporte (« Chocolat au
// lait » est du chocolat, « Lait au chocolat » du lait), et à mot égal, le terme le plus précis
// (« crème glacée » plutôt que « crème »). Les marques des familles de produits (familles.js) sont
// connues aussi : « Pringles » va avec les chips. Une correction faite à la main (« Maggi » dans
// l'épicerie salée) est retenue pour le foyer et l'emporte toujours.

import { FAMILLES } from "./familles.js";
import { motsCles } from "./promos.js";

export const RAYONS = [
  {
    id: "fruits-legumes",
    nom: "Fruits et légumes",
    termes: `
      fruits, légumes, pomme, poire, banane, orange, clémentine, mandarine, citron, pamplemousse,
      kiwi, ananas, mangue, raisin, fraise, framboise, myrtille, cerise, abricot, pêche, nectarine,
      prune, melon, pastèque, avocat, tomate, tomates cerises, salade, laitue, mâche, roquette,
      épinards, carotte, pomme de terre, patate, oignon, échalote, ail, poireau, courgette, aubergine,
      poivron, concombre, radis, chou, chou-fleur, brocoli, haricots verts, champignon, céleri, navet,
      betterave, fenouil, endive, artichaut, asperge, potiron, citrouille, butternut, courge, patate
      douce, gingembre, persil, basilic, coriandre, ciboulette, menthe, herbes, grenade, figue
    `,
  },
  {
    id: "boulangerie",
    nom: "Boulangerie",
    termes: `
      pain, baguette, brioche, croissant, pain au chocolat, chocolatine, viennoiserie, pain de mie,
      pain burger, pain hot dog, pain complet, ficelle, bretzel
    `,
  },
  {
    id: "epicerie-salee",
    nom: "Épicerie salée",
    termes: `
      pâtes, spaghetti, tagliatelle, penne, coquillettes, macaroni, lasagnes, riz, semoule, couscous,
      quinoa, boulgour, lentilles, pois chiches, haricots, conserve, maïs, petits pois, sauce, sauce
      tomate, concentré de tomate, tomates pelées, ketchup, mayonnaise, moutarde, vinaigre,
      vinaigrette, huile, sel, poivre, épices, curry, paprika, cumin, bouillon, cube, maggi, soupe,
      velouté, purée, chips, crackers, biscuits apéritif, cacahuètes, pistaches, olives, cornichons,
      thon, sardines, maquereau, croûtons, chapelure, nouilles, ramen, tortilla, wraps, raviolis,
      cassoulet, chili, plat cuisiné, pesto, sauce soja, lait de coco, apéro, popcorn
    `,
  },
  {
    id: "epicerie-sucree",
    nom: "Épicerie sucrée",
    termes: `
      café, thé, infusion, chocolat, cacao, chocolat en poudre, céréales, muesli, biscuits, gâteaux,
      cookies, madeleines, confiture, miel, pâte à tartiner, sucre, farine, levure, compote, bonbons,
      confiseries, chewing-gum, barres chocolatées, cake, crêpes, gaufres, lait concentré, biscottes,
      pain d'épices, fruits secs, amandes, noisettes, noix, raisins secs, dattes, flocons d'avoine,
      sucre vanillé, nappage
    `,
  },
  {
    id: "boissons",
    nom: "Boissons",
    termes: `
      eau, eau gazeuse, soda, cola, coca, limonade, jus, jus d'orange, nectar, sirop, bière, vin,
      rosé, champagne, crémant, cidre, whisky, rhum, vodka, pastis, gin, apéritif, liqueur, ice tea,
      thé glacé, boisson, smoothie
    `,
  },
  {
    id: "hygiene",
    nom: "Hygiène et beauté",
    termes: `
      shampooing, shampoing, après-shampooing, gel douche, douche, savon, déodorant, dentifrice,
      brosse à dents, bain de bouche, rasoir, mousse à raser, coton, coton-tige, crème hydratante,
      crème visage, crème mains, maquillage, serviettes hygiéniques, tampons, protège-slips,
      mouchoirs, parfum, vernis, gel coiffant, laque, masque cheveux, démaquillant, crème solaire,
      lingettes démaquillantes, eau micellaire, eau de toilette
    `,
  },
  {
    id: "entretien",
    nom: "Entretien",
    termes: `
      lessive, adoucissant, liquide vaisselle, lave-vaisselle, tablettes lave-vaisselle, pastilles
      lave-vaisselle, éponge, sacs poubelle, nettoyant, javel, désinfectant, papier toilette, essuie-
      tout, sopalin, papier aluminium, film alimentaire, papier cuisson, ampoule, piles, allumettes,
      bougie, anticalcaire, désodorisant, insecticide, eau de javel, sel lave-vaisselle, liquide de rinçage,
      détachant, serpillière
    `,
  },
  {
    id: "bebe",
    nom: "Bébé",
    termes: `
      couches, changes, lait infantile, lait bébé, petits pots, biberon, tétine, bébé
    `,
  },
  {
    id: "animaux",
    nom: "Animaux",
    termes: `
      chat, chien, croquettes, litière, animaux, friandises pour chat
    `,
  },
  {
    id: "boucherie",
    nom: "Viande, poisson, charcuterie",
    termes: `
      viande, bœuf, steak, steak haché, veau, porc, agneau, poulet, dinde, canard, lapin, côtes,
      escalope, rôti, filet, saucisses, merguez, chipolatas, lardons, jambon, bacon, saucisson,
      chorizo, pâté, rillettes, terrine, charcuterie, knacks, cordon bleu, nuggets, poisson, saumon,
      cabillaud, colin, merlu, crevettes, moules, truite, surimi, fruits de mer, blanc de poulet,
      cuisse de poulet
    `,
  },
  {
    id: "frais",
    nom: "Frais",
    termes: `
      lait, beurre, crème, crème fraîche, yaourt, yogourt, fromage, fromage blanc, petits suisses,
      skyr, kéfir, œufs, mozzarella, emmental, comté, camembert, brie, raclette, feta, parmesan,
      chèvre, gruyère, reblochon, mascarpone, ricotta, dessert, flan, crème dessert, pâte feuilletée,
      pâte brisée, pâte à pizza, quiche, houmous, taboulé, margarine, gnocchis, lait demi-écrémé, lait
      entier, fromage râpé, pizza
    `,
  },
  {
    id: "surgeles",
    nom: "Surgelés",
    termes: `
      surgelés, glace, glaces, crème glacée, sorbet, esquimau, cônes, frites, bâtonnets de poisson
    `,
  },
];

export const AUTRES = { id: "autres", nom: "Autres" };

/** Ces mots, où qu'ils soient dans le nom, décident du rayon : « Légumes surgelés », « Pâtée pour chien »… */
const MARQUEURS = [
  { mots: ["surgele"], rayon: "surgeles" },
  { mots: ["bebe"], rayon: "bebe" },
  { mots: ["chat", "chien", "animaux"], rayon: "animaux" },
];

/** La clé d'un nom d'article, pour retenir une correction : « Tomato  Ketchup » → « tomato ketchup ». */
export const cleRayon = (nom) => motsCles(nom).join(" ");

let termesPrets;
/** Tous les termes connus, réduits à leurs mots-clés : [{ mots, rayon }]. */
function termes() {
  if (termesPrets) return termesPrets;
  const liste = RAYONS.flatMap(({ id, termes: texte }) =>
    texte.split(",").map((terme) => ({ mots: motsCles(terme), rayon: id })),
  );
  const rayonDuTerme = (cle) => liste.find((t) => t.mots.join(" ") === motsCles(cle).join(" "))?.rayon;
  // Les marques des familles de produits vont dans le rayon de leur famille : « Pringles » → chips.
  for (const { cles, termes: marques } of FAMILLES) {
    const rayon = cles.map(rayonDuTerme).find(Boolean);
    if (rayon) for (const marque of marques) liste.push({ mots: motsCles(marque), rayon });
  }
  termesPrets = liste.filter(({ mots }) => mots.length);
  return termesPrets;
}

/**
 * Le rayon d'un article : { id, nom }. `corrections` : { cleRayon(nom): id } retenues pour le foyer.
 */
export function rayonDe(nom, corrections = {}) {
  const mots = motsCles(nom);
  const corrige = corrections[mots.join(" ")];
  const parId = (id) => RAYONS.find((r) => r.id === id) ?? AUTRES;
  if (corrige) return parId(corrige);
  const marqueur = MARQUEURS.find((m) => m.mots.some((mot) => mots.includes(mot)));
  if (marqueur) return parId(marqueur.rayon);

  // Le terme dont le premier mot arrive le plus tôt dans le nom ; à égalité, le plus long.
  let meilleur = null;
  for (const terme of termes()) {
    if (!terme.mots.every((mot) => mots.includes(mot))) continue;
    const position = mots.indexOf(terme.mots[0]);
    if (
      !meilleur ||
      position < meilleur.position ||
      (position === meilleur.position && terme.mots.length > meilleur.longueur)
    ) {
      meilleur = { position, longueur: terme.mots.length, rayon: terme.rayon };
    }
  }
  return meilleur ? parId(meilleur.rayon) : AUTRES;
}

/** Les articles rangés par rayon, dans l'ordre du magasin : [{ rayon, articles }], sans rayon vide. */
export function rangerParRayon(articles, corrections = {}) {
  const groupes = new Map([...RAYONS, AUTRES].map((rayon) => [rayon.id, { rayon, articles: [] }]));
  for (const article of articles) groupes.get(rayonDe(article.nom, corrections).id).articles.push(article);
  return [...groupes.values()].filter((groupe) => groupe.articles.length);
}
