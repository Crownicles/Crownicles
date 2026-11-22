# Réécriture d'un big event de Crownicles

Tu réécris **un seul** big event du jeu Crownicles (RPG textuel sur Discord, en français). Le joueur peut revoir cet event des dizaines de fois, dans n'importe quel ordre.

Toutes les règles de style, de lore et de seuils sont dans le skill `write-event-texts` (`.github/skills/write-event-texts/SKILL.md`). Ce brief les détaille pour l'atelier. Les chemins `input/` et `out/` sont relatifs au dossier de travail `.event-rewrites/`, à la racine du dépôt.

## Fichiers

- **Ton event** : `input/<id>.json`. Il contient :
  - `original` : textes actuels (`text` = introduction, `possibilities.<nom>.text` = libellé du choix, `possibilities.<nom>.outcomes.<id>` = texte de l'issue ; la possibilité `end` n'a pas de libellé : c'est ce qui arrive si le joueur ne répond pas) ;
  - `outcomeData` : la **mécanique** de chaque issue (perte ou gain de vie `health`, d'argent `money`, objet `randomItem`, temps perdu `lostTime` en minutes, altération `effect` comme `occupied`, `hurt`, `sick`, `sleeping`, `drunk`, `scared`, `confounded`, `starving`…, `forceStayInCity`, destinations `mapTypesDestination`, `tags`…) ;
  - le **canon du lieu** où l'event se déclenche : `place`, `placeDescription`, `neighbours` (seuls lieux qu'on peut supposer proches), `city` (menu de la ville si c'en est une), `canonBlock` (tout ce que le jeu dit du lieu).
- **La bible du lore** : la bible du lore, dans le dépôt Crownicles/Tools : `documents/crownicles-lore-proposition.md` (https://github.com/Crownicles/Tools/blob/master/documents/crownicles-lore-proposition.md). Lis au minimum : sections 0 à 7 (règles du présent permanent R1 à R8, cœur du monde, chronologie, Résonance, géographie et règles des villes, factions, personnages), 13 (migration du texte existant : vérifie si ton event y est cité) et 14 (guide de style et checklist). Lis aussi la fiche des personnages nommés de ton event.
- **La référence des données** : `references/reference.md` du skill (champs d'une issue, altérations, conditions, karma, classes, familiers, exemple réel), et dans le dépôt les familiers (`Core/resources/pets/<id>.json` pour la rareté, `Lang/fr/models.json` clé `pets` pour le nom `<id>_male`), les classes (`Lang/fr/models.json` clé `classes`) et les matériaux (`Core/resources/materials/<id>.json` pour le type et la rareté, `Lang/fr/models.json` clé `materials` pour le nom).
- **Ta sortie** : `out/<id>.json` (voir le format plus bas).
- **Validation** : `node .github/skills/write-event-texts/scripts/validate.mjs <id>` depuis la racine du dépôt. Corrige toutes les erreurs ; traite les avertissements autant que possible.

Ne modifie **aucun** autre fichier, et surtout pas le dépôt Crownicles.

## Ce qu'on attend

1. **Rester fidèle à l'event d'origine.** Même situation, mêmes personnages, même accroche. Garde **toutes les possibilités d'origine** (mêmes noms) et l'idée de chaque issue d'origine. Garde l'humour quand il y en a.
2. **Enrichir avec des issues conditionnelles, comme les events déjà réécrits.** Ils sont passés de 4 à 16 issues par event à 13 à 48 (2 à 4 fois plus), et les trois quarts de leurs issues sont conditionnelles. Fais de même :
   - pour chaque possibilité, ajoute des issues qui dépendent **du joueur** : son karma (réputation), son niveau (expérience), ses statistiques (attaque, défense, vitesse), sa classe, son familier, la rareté de celui-ci ou ses capacités (`petTags`), ses badges gagnés en jeu (`badges`), l'argent qu'il porte (`money` dans `requirements`), son niveau de cuisine, les matériaux de son sac, l'enchantement ou l'amélioration de son arme et de son armure (voir `reference.md`) ;
   - vise **3 à 6 issues par possibilité**, dont **au moins une sans condition** ; le joueur doit toujours avoir au moins une issue possible, quel que soit son profil (le validateur le vérifie, karma et familier compris) ;
   - tu peux ajouter **une ou deux possibilités** si l'event s'y prête (pas plus) ;
   - **le choix reste prévisible** : quand le joueur clique, il sait à peu près ce qui va se passer ; les issues d'un choix sont des variantes du résultat attendu, et une surprise par choix au plus ;
   - **des paliers plutôt qu'un seuil binaire** : un malus ou un bonus lié à une stat se gradue en trois paliers (faible / moyen / fort, voir le skill `write-event-texts`) ; ne mets pas tous les seuils tout en haut ;
   - la condition se **montre**, elle ne se nomme pas : un joueur rapide rattrape le voleur, un joueur au karma bas est reconnu et on se méfie de lui, un familier précis réagit à sa façon ;
   - équilibre gains et pertes : une bonne condition donne une meilleure issue, sans rendre l'event trivial ; ajoute un champ `karma` aux issues qui relèvent d'un choix moral (voir `reference.md`) ;
   - **chaque issue a son texte, et chaque texte son issue** ; le texte doit correspondre exactement à la mécanique (perte de vie = blessure, `money` = pièces, `randomItem` = objet, `lostTime` = temps perdu, `effect` plausible : `sleeping` = il dort, `drunk` = il est ivre, `occupied` = il est occupé un moment…). Aucune conséquence de texte sans mécanique, aucune mécanique sans texte.
3. **Être en cohérence avec le nouveau lore** (la bible) :
   - pas de religion structurée (pas de dieux qui agissent, pas de clergé, pas de panthéon kyutiste) ; des références légères restent possibles (une expression, une superstition) ;
   - le présent permanent : pas de « plus jamais », pas de « désormais », pas de mort d'un personnage récurrent, pas d'adoubement ou de sauvetage de la princesse par le joueur (échelle humaine, R5) ;
   - l'aléatoire est un trait de caractère (R3) ;
   - les personnages nommés suivent leur fiche dans la bible ; tu peux glisser un lien discret avec le lore (le Grand Livre, la Résonance, une faction…) si c'est naturel, sans en faire le sujet.
4. **Respecter le canon du lieu** : ne contredis pas la description, ne suppose comme proches que les voisins listés, et ne suppose pas la destination suivante du joueur. Dans une ville, ne nie pas ce que le menu propose (auberge du jeu, forgeron, boutiques), voir section 5 « Les villes : ce qu'un event peut en dire ».
5. **Style** (section 14) :
   - **pas de discours direct** : ni guillemets « » ou " ", ni « dit-il », ni réplique entre apostrophes ; les paroles passent au style indirect ;
   - introduction de 200 à 300 caractères (lieu, situation, accroche), jusqu'à 400 quand elle pose un personnage ou un enjeu que les choix utilisent ; jamais de points de suspension finaux ; issue de la longueur de ce qu'elle raconte, souvent 150 à 280 caractères, mais une ou deux phrases suffisent pour une issue sans histoire et jusqu'à 400 pour une scène avec un retournement (des longueurs variées, pas un gabarit) ; libellé de choix court (verbe à l'infinitif) ;
   - montrer la condition plutôt que la nommer ; registre sobre (pas de « héros de légende ») ; au plus un point d'exclamation par texte ;
   - typographie : apostrophe droite `'`, pas de tiret cadratin `—`, espace avant `: ; ! ?` ; on vouvoie le joueur ;
   - conserve tels quels les éventuels placeholders (`{{...}}`, `{emote:...}`, `$t(...)`).

## Format de sortie (`out/<id>.json`)

```json
{
  "eventId": "<id>",
  "model": "<ton modèle, repris de input>",
  "text": "Nouvelle introduction.",
  "possibilities": {
    "<nom>": { "text": "Libellé du choix.", "outcomes": { "0": "Texte de l'issue 0.", "1": "…" } },
    "end": { "outcomes": { "0": "…" } }
  },
  "data": {
    "triggers": "<identiques à input.triggers>",
    "possibilities": {
      "<nom>": { "outcomes": { "0": { "requirements": { "karma": { "min": 50 } }, "money": 120, "karma": 3 }, "1": { "health": -15, "effect": "hurt" } } }
    }
  },
  "icons": { "<nouvelle possibilité>": "🪵", "end": { "<nouvelle issue de end>": "😶" } },
  "notes": [
    "3 à 8 puces en français : ce que tu as changé et pourquoi (lore, canon, conditions ajoutées, style), et ce que tu as volontairement gardé."
  ]
}
```

- `data` est le contenu complet du fichier `Core/resources/events/<id>.json` réécrit : mêmes `triggers`, toutes les possibilités et issues, avec leur mécanique. Les clés de `possibilities` (textes) et de `data.possibilities` doivent être identiques, issue par issue.
- Numérote les issues `"0"`, `"1"`, `"2"`… dans chaque possibilité. Tu peux renuméroter les issues d'origine.
- `icons` : un emoji pour chaque **nouvelle** possibilité, et pour chaque **nouvelle** issue de `end` (le jeu en affiche un pour chacune). Rien pour ce qui existait déjà.

## Ce qu'on attend, par l'exemple (events déjà réécrits et validés)

Ces paires viennent des events 1, 12, 18 et 19, déjà réécrits. Elles montrent le niveau attendu. Ces events ont aussi gagné de nombreuses issues conditionnelles (voir l'exemple de données dans `reference.md`).

**Introductions**
- Avant : *Un arbre est tombé sur le chemin et bloque le passage !*
  Après : *Dans la pénombre de la Forêt Du Vieillard, un chêne déraciné barre le sentier. Son tronc fait bien deux mètres de diamètre, ses branches emmêlées forment un mur, et la terre encore fraîche sur ses racines dit que sa chute est récente.*
- Avant : *Vous voyez une rivière devant vous. De l'autre côté du rivage, vous apercevez un village.*
  Après : *Devant vous, la Rivière Vacarme charrie branches et écume dans un grondement assourdissant. Un vieux pont de bois l'enjambe encore : plusieurs planches manquent, d'autres pendent, et toute la structure grince au vent. Des sentiers longent les deux berges.*
- Avant : *La ville où vous mettez les pieds semble déserte, sans âme qui vive. En parcourant ses rues, votre regard s'arrête sur un chantier qui paraît tout aussi abandonné.*
  Après : *Dans les ruelles de Mergagnan, vous tombez sur un chantier à l'abandon : poutres noircies, échafauds grinçants, outils rouillés. Le baron Almerac y faisait bâtir une halle de pierre. Depuis sa mort, l'argent ne rentre plus, les compagnons ont déserté, et jusqu'aux registres sont restés sur place.*

**Issues**
- Avant : *Vous choisissez d'ignorer ce cadavre et de ne pas perdre de temps.... A peine l'avez-vous dépassé que le renard se lève et vous mord violemment !*
  Après : *Au moment précis où vous passez près de la dépouille, celle-ci est prise de spasmes. Surpris, vous reculez brusquement et vous cognez douloureusement contre un arbre.*
- Avant : *L'arbre a bien été coupé et la route est dégagée, mais malheureusement, des pillards ont volé quasiment tout ce que vous aviez récolté depuis votre dernier voyage !*
  Après : *Découragé par l'obstacle, vous montez un campement au pied du chêne. Très vite, des bruits suspects montent des fourrés. Quand vous revenez à votre sac, il a été fouillé et plusieurs objets de valeur ont disparu.*

**Ce que ces réécritures font**
1. L'introduction **nomme le lieu du jeu** (celui de `place`) et y pose **un ou deux détails concrets** tirés de son canon, puis l'accroche. Ce n'est plus « une ville » ou « une rivière ».
2. Le générique devient concret : un chêne déraciné, la terre fraîche sur les racines, des planches qui pendent.
3. Une issue est une **petite scène qui se tient** : ce que fait le joueur, ce qui se passe, la conséquence (qui colle à la mécanique).
4. Ce qui est **illogique dans l'original est corrigé en gardant l'idée** : le renard mort qui se relève pour mordre devient un spasme qui fait reculer le joueur contre un arbre (même perte de vie).
5. Deux issues au texte identique dans l'original sont **différenciées**, souvent par une condition.
6. Un **lien discret avec le lore** quand c'est naturel : le chantier d'Almerac et ses intérêts impayés renvoient au Grand Livre sans le nommer.
7. Plus de « ! » en série, plus de « ... », plus de « Vous voyez » en ouverture.

**Les dérives à éviter** (on les a dû corriger après coup sur ces mêmes events) :
- des introductions qui empilent les détails (plus de 400 caractères) ;
- la morale finale, comme *Après tout, la mort fait partie du cycle naturel* ;
- expliquer la mécanique (*Votre agilité vous permet de…*, *Votre réputation…*) au lieu de la montrer ;
- le registre gonflé (*héros de légende*, *gratitude éternelle*) ;
- le discours direct, même court.

## Retours de relecture (event 30) : à appliquer à tous les events

Le relecteur a lu l'event 30 réécrit. Voici ce qui ne va pas, et la règle générale qu'on en tire. Chaque réécriture doit être relue avec ces règles.

| Phrase relevée | Problème | Règle |
|---|---|---|
| *un château pavoisé* ; *On vous reconduit par la poterne* | Vocabulaire « trop IA » : mots rares ou recherchés que personne n'emploie | **Mots simples et courants.** Pas de vocabulaire rare pour faire « médiéval » (pavoisé, poterne, échauguette, oriflamme, mâchicoulis…). |
| *Vexé jusqu'à la moustache* | Tournure bizarre, expression inventée | **Pas d'expression fabriquée.** Une image doit être naturelle en français ; sinon, on dit les choses simplement (*Vexé, le duc…*). |
| *l'on vous pousse sur le talus boueux qui descend vers la rivière* | Trop descriptif : la géographie n'apporte rien à l'issue | **Dans une issue, le décor se limite à ce qui sert l'action.** Un détail concret au plus, et seulement s'il compte. |
| *Le duc rit aux éclats, le lui fait redire devant toute la salle et vous remet une bourse* | Phrase alambiquée, pronoms en cascade | **Phrases courtes, une action par phrase**, pronoms sans ambiguïté. Relis à voix haute : si on bute, on réécrit. |
| *Conquis, le duc veut l'acheter ; vous refusez, et il vous paie le spectacle d'une poignée de pièces.* | Interaction peu crédible | **Les réactions des personnages doivent être plausibles** et s'enchaîner logiquement. Si une scène sert juste à justifier un gain, simplifie-la. |
| *Les bras chargés de régimes* | Mot ambigu (« régimes » se lit d'abord comme une diète) | **Évite les mots à double sens qui font trébucher** (dis « bananes »). |
| *puis vous fait reconduire sans que vous ayez vu le duc* | Le relecteur a buté sur la négation (la phrase est correcte, mais elle fait douter) | **Préfère une tournure qui ne fait pas hésiter** (*… et vous fait reconduire. Vous n'aurez pas vu le duc.*). |
| *Le duc remarque vos cicatrices et votre équipement usé par les routes.* avec la condition `level: {min: 60}` | Niveau 60, c'est encore le début du jeu : le texte décrit un vétéran | **Une condition doit correspondre à ce que le texte raconte.** Un vétéran couvert de cicatrices, c'est le premier dixième des joueurs réguliers (`level` `min` 130) : suis l'échelle de `reference.md`. |

## Retours de relecture (Gabriel, events 1, 2, 10, 11, 12) : à appliquer à tous les events

| Relevé | Problème | Règle |
|---|---|---|
| *Prêter main-forte au pêcheur en difficulté* ; *Chercher un chemin pour contourner l'obstacle* | Libellé trop long, encombré de détails | **Libellé court** : l'action seule (*Aider le pêcheur*, *Contourner l'obstacle*). Les détails vont dans l'issue. |
| *Essayer de faire fuir le chien* ; *Traverser quand même par le sentier principal* | Le libellé annonce un essai, ou juge le choix | **Le libellé vise la réussite** (*Faire fuir le chien*, *Rester sur le sentier principal*). L'issue dit si ça marche. |
| Une entaille au bras avec `hurt` | `hurt` dure 5 heures : trop lourd pour une petite blessure | **`confounded` = étourdi** (pas « confus ») pour un coup, une chute, une morsure légère ; rien pour une égratignure ; `hurt` pour une vraie blessure. |
| *il vous mord au mollet, encore et encore* pour -25 PV ; un piège à loups pour -25 PV | La violence du texte ne colle pas à la perte de vie | **Le texte et le chiffre ont la même gravité.** On adoucit le texte ou on augmente la perte (-40 pour le piège). |
| Se perdre (`lost`) dans une auberge en ruine | Altération disproportionnée | **Une perte de temps (`occupied`) suffit** quand la situation est bénigne. |
| Tous les malus baissent quand la stat monte | Les stats jouent toujours dans le même sens | **Le revers d'une force** : le pont cède sous une lourde armure, une attaque trop forte casse la canne, un coureur trop rapide rate la marche. Petit malus, en plus des issues habituelles. |
| Un aigle et un corbeau seulement ; un chien seulement | Liste arbitraire, trop de chiens | **Toute la famille**, avec la condition `petTags` (`flying`, `keenNose`, `mount`, `heavy`, `intimidating`…) plutôt qu'une liste d'ids : tags dans `reference.md`. Le texte dit *votre familier*. |
| Trois paliers de vitesse complémentaires et rien d'autre | Chaque joueur voit toujours la même issue | **Une ou deux issues sans condition en plus**, pour la variété. |
| *Pour une fois, le raccourci en était bien un.* sans condition | Le commentaire suppose un joueur expérimenté | **Un commentaire qui suppose un profil va dans une issue conditionnée par ce profil** (ici `level` `min` 120). |
| *La terre dit que sa chute est récente* | Personnification gratuite | **Le verbe décrit ce qu'on voit** (*montre*). |
| *Le chien vous mord la jambe* ; *Ses hommes fouillent votre sac* | Réaction sans raison | **Un mot pour la motiver** : *Agacé, le chien…* ; *Méfiants, ses hommes…* |
| *Votre radeau vous semble solide. À mi-parcours, le courant le disloque.* | Le basculement tombe à plat | **Un mot de contraste** : *Mais à mi-parcours…* |
| *Il s'éloigne vers la salle commune* (dans des ruines) | Décor d'un lieu en activité | **Le décor suit l'état du lieu** : *vers les ruines*. |
| *Sans armure pour vous protéger* avec `defense` `max` 180 | Le joueur a une armure, juste mauvaise | **Le texte décrit la stat** : *sans bonne armure*. |
| *mais avec du retard* ; *bien plus longtemps que prévu* pour une heure | Le joueur n'a pas d'horaire ; mot trop fort pour la durée | **Le temps suit la durée** : *un moment*, *plus longtemps que prévu*, *des heures* (90 min et plus). |
| Un objet caché sous une planche du pont | Trouvaille sans raison | **Une trouvaille a une raison d'être là** : un objet abandonné sur la rive. |
| *Par méfiance, vous contournez le bois par l'est.* | Le choix « opposé aux conseils » ne se lit plus | **L'issue rappelle le choix** quand le libellé court ne suffit pas. |
| Joueur fort : même issue sans dégâts | Pas de récompense à la hauteur | **Une vraie conséquence pour les meilleurs** : initiative, prime, destination. |
| Rebrousser chemin vers un voisin au hasard | Ce n'est pas un demi-tour | **`goBackToPreviousMap`** avec `mapTypesDestination` en secours. |
| *Attaquer le cadenas à coups de pioche* ; *Votre armure encaisse le plus gros* (défense moyenne) | Le joueur n'a peut-être ni pioche ni armure | **Pas d'équipement que le joueur ne porte pas vraiment** : une condition le garantit (`weaponTags`, `attack` `min` 600, `defense` `min` 520…), sinon une pierre trouvée sur place ou un texte neutre. |
| Refuser poliment l'invitation d'un pirate inconnu : il fait tirer au canon, en trois paliers de vitesse | Réaction disproportionnée, sans relation ni intérêt ; les paliers en font le cas normal | **Une réaction à la mesure de ce que fait le joueur** : trois questions (provocation, ce que sait le personnage, son intérêt), l'échelle de réaction du skill ; sans raison, changer la cause (accident, lieu, maladresse), et ne graduer qu'une prémisse plausible. |
| *Le suivre pour le voler*, et le joueur assomme l'ermite dans quatre issues sur sept ; en ne répondant pas, le joueur pousse l'ermite dans l'eau | Le joueur fait plus que ce qu'il a choisi, ou agit sans avoir choisi | **Le joueur ne fait que ce que son choix annonce**, et rien dans `end`. |
| *Votre scorpion se glisse sous le bol* ; *Au réveil, vous secouez un scorpion hors de votre botte* | Geste impossible à se représenter ; détail sans cause ni conséquence | **Un geste de familier naturel et visible** ; **pas de détail parasite**. |
| Un coffret *à demi enfoui dans le sable*, aux ferrures rouillées ; une issue où il est tombé d'une charrette le matin même | L'issue contredit l'état posé par l'intro | **L'intro fixe l'état des choses** : chaque issue reste vraie avec elle. |
| *Forcer le cadenas* : issue 0 *vous frappez le cadenas avec une grosse pierre*, issue 2 *La pierre ripe sur le cadenas*, issue 4 *Le vacarme attire les marchands* | Les issues s'appuient les unes sur les autres, mais le joueur n'en lit qu'une | **Chaque issue se lit seule** : elle pose elle-même ce qu'elle utilise. |
| Une bourse remplie de noyaux de dattes, découverte seulement en la vidant loin de la tente | Personne ne range des noyaux dans une bourse, et le joueur l'aurait senti tout de suite | **Une ruse tient debout des deux côtés** : qui l'a préparée et pourquoi, et une découverte au moment où elle aurait vraiment lieu. |
| *Votre chien renifle le sable et déterre la clef* | Le chien par réflexe, alors que d'autres familiers ont du flair | **Pas de chien par réflexe** : `petTags` pour une capacité partagée, le chien seul pour un comportement de chien (aboyer, laisse, hurler). |
| *un éclat de métal dans le sable. C'est la clef.* | Deux phrases courtes pour une seule idée | **Les lier** : *un éclat de métal dans le sable : c'est la clef.* |
