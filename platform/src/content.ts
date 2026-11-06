export const themes = {
  forest: {
    name: "La forêt des possibles",
    emoji: "✿",
    color: "#dce9d9",
    hook: "La forêt a perdu ses couleurs. Vos héros pourront-ils réveiller l’arbre des souhaits ?",
    mission: "réveiller l’arbre des souhaits",
    prompts: [
      "Un animal inventé",
      "Un pouvoir qui aide les autres",
      "Un détail un peu rigolo",
    ],
    challenges: [
      "Mimez chacun un animal sans parler. Le groupe devine !",
      "Dessinez ensemble un pont pour traverser la rivière des couleurs.",
      "Inventez trois mots magiques et récitez-les tous ensemble.",
    ],
  },
  space: {
    name: "Mission constellation",
    emoji: "✧",
    color: "#e4dff8",
    hook: "Une étoile s’est égarée. Votre équipage embarque pour la ramener chez elle.",
    mission: "ramener une étoile dans sa constellation",
    prompts: [
      "Un explorateur de l’espace",
      "Un outil extraordinaire",
      "Une planète préférée",
    ],
    challenges: [
      "Construisez une fusée avec vos bras et comptez à rebours.",
      "Dessinez une carte de la planète sur une grande feuille.",
      "Inventez le message de bienvenue des habitants de cette planète.",
    ],
  },
  heroes: {
    name: "L’école des super-héros",
    emoji: "ϟ",
    color: "#fae9bd",
    hook: "Aujourd’hui, les nouveaux héros découvrent leur plus grand pouvoir : faire équipe.",
    mission: "réussir la mission de la tour des talents",
    prompts: [
      "Un héros original",
      "Un pouvoir qui rend service",
      "Une petite faiblesse attachante",
    ],
    challenges: [
      "Chaque héros invente sa pose et le groupe la reproduit.",
      "Imaginez une machine qui combine tous vos pouvoirs.",
      "Donnez un compliment à votre voisin : quel est son super-pouvoir ?",
    ],
  },
} as const;
export type ThemeKey = keyof typeof themes;
export const steps = [
  {
    title: "Bienvenue dans l’aventure",
    time: "15 min",
    read: "Bienvenue, les créateurs ! Aujourd’hui, vos idées deviennent des héros. Il n’y a pas de mauvais dessin : chaque trait raconte quelque chose.",
    action:
      "Présentez le thème. Chacun choisit un pseudonyme. Expliquez que l’IA peut se tromper et que les enfants restent les auteurs.",
  },
  {
    title: "Le laboratoire des héros",
    time: "25 min",
    read: "Imaginez un héros qui n’existe nulle part ailleurs. Quel est son pouvoir ? Quel petit défaut le rend attachant ?",
    action:
      "Distribuez papier et crayons. Dessinez sans nom complet, visage photographié ni information personnelle. Chacun présente son idée en une phrase.",
  },
  {
    title: "La métamorphose",
    time: "25 min",
    read: "Nous allons proposer nos dessins à une machine qui invente des images. Elle ne lit pas dans nos pensées : observons ce qu’elle a compris !",
    action:
      "Photographiez les dessins sur le téléphone. Lancez les créations une par une et validez les résultats avant de les montrer.",
  },
  {
    title: "La grande mission",
    time: "40 min",
    read: "Chaque héros possède quelque chose d’unique. Pour réussir cette mission, nous allons choisir et agir ensemble.",
    action:
      "Lisez les trois scènes, faites voter le groupe entre les deux chemins et lancez les défis. Acceptez leurs idées ; vous pouvez adapter le récit oralement.",
  },
  {
    title: "La galerie des créateurs",
    time: "15 min",
    read: "Mission accomplie ! Chaque héros a apporté quelque chose. Quel moment avez-vous préféré ?",
    action:
      "Invitez chacun à présenter son héros. Téléchargez le livret et transmettez-le aux familles. Les dessins originaux restent aux enfants.",
  },
];
export function fallbackStory(theme: ThemeKey, names: string[]) {
  const t = themes[theme];
  const team = names.length ? names.join(", ") : "Toute l’équipe";
  return [
    `${team} se réunissent pour ${t.mission}. Devant eux, deux chemins : le sentier lumineux ou le passage mystérieux. Le groupe vote : lequel emprunter ?`,
    "Un obstacle apparaît ! Chacun propose comment son pouvoir pourrait aider. Faut-il construire quelque chose ensemble ou demander de l’aide à un nouvel ami ? Choisissez puis jouez le défi.",
    "Grâce aux idées de chacun, la mission est accomplie. Chaque héros raconte ce qu’il a appris. Ensemble, inventez la dernière phrase de votre aventure.",
  ];
}
