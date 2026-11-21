---
name: write-event-texts
description: Règles de style, de lore et de données pour écrire ou réécrire les textes d'un big event ou d'un small event de Crownicles (Lang/fr) et ses issues conditionnelles. À utiliser dès qu'on écrit, réécrit ou relit un texte d'event, une issue, un seuil de niveau, de statistique ou de karma.
---

# Écrire les textes d'un event de Crownicles

Le joueur revoit chaque event des dizaines de fois, dans n'importe quel ordre. Un bon texte reste vrai et agréable à la centième lecture. Ces règles viennent des relectures du propriétaire du jeu sur la branche `outcomerequirements` (PR #3329).

On n'édite que `Lang/fr` : les autres langues viennent de Crowdin.

## Sources à lire avant d'écrire

- **La bible du lore** : dépôt `Crownicles/Tools`, `documents/crownicles-lore-proposition.md`.
  - Sections 0 à 7 : les règles du présent permanent (R1 à R8), les personnages et la géographie.
  - Section 13.5 : les contradictions déjà relevées.
  - Section 14 : le guide de style.
  - Annexe A, le canon des lieux : tout ce que le jeu dit de chaque lieu, les voisins et le menu des villes.
- **L'atelier de réécriture** : `Crownicles/Tools`, `generators/event-rewrites/src/` (`brief.md`, `reference.md`, `validate.py`, `apply.py`).

## Style

### Les règles

- **Pas de discours direct.** Pas de guillemets « » ou " ", pas de « dit-il », pas de réplique entre apostrophes. Les paroles passent au style indirect : *Elle vous déconseille le sentier principal.*
- **Mots simples et courants.**
  - Pas de vocabulaire rare pour faire « médiéval » : pavoisé, poterne, échauguette, oriflamme, mâchicoulis…
  - Un mot que personne n'emploie sonne « IA ».
- **Pas d'expression inventée.** Une image doit exister en français. Sinon, on dit les choses simplement.
- **Phrases courtes, une action par phrase**, pronoms sans ambiguïté. Relis à voix haute : si on bute, on réécrit.
- **Pas de mot ou de tournure qui fait hésiter.**
  - Évite les mots à double sens : *régimes* se lit d'abord comme une diète, écris *bananes*.
  - Évite les négations alambiquées comme *sans que vous ayez vu*.
- **Des réactions plausibles.** Si une scène ne sert qu'à justifier un gain, simplifie-la.
- **Montrer la condition, ne pas la nommer.**
  - Pas de *Votre agilité vous permet de…*, de *votre réputation*, de *votre aura*.
  - Un joueur rapide rattrape le voleur ; un joueur au karma bas est reconnu et on se méfie de lui.
- **Registre sobre.**
  - Pas de *héros de légende*, de *gratitude éternelle*, de *noble quête*.
  - Un « ! » au plus par texte. Pas de points de suspension en fin d'introduction.
- **Pas de morale finale** (*Après tout, la mort fait partie du cycle naturel*).
- **Pas de montant dans le texte.** Le jeu affiche les pièces, les points de vie et le temps perdu : *une bourse*, *une poignée de pièces*.
- **Typographie.**
  - Apostrophe droite `'`, pas de tiret cadratin `—`.
  - Une espace avant `: ; ! ?`.
  - On vouvoie le joueur.
  - Garde tels quels les placeholders : `{{...}}`, `{emote:...}`, `$t(...)`.

### Exemples relevés en relecture

| Écrit | Problème | Mieux |
|---|---|---|
| *un château pavoisé* ; *on vous reconduit par la poterne* | Vocabulaire rare | *le château du duc* ; *on vous raccompagne à la sortie* |
| *Vexé jusqu'à la moustache* | Expression inventée | *Vexé, le duc…* |
| *on vous pousse sur le talus boueux qui descend vers la rivière* | Décor inutile à l'action | *on vous jette dehors* |
| *Le duc rit aux éclats, le lui fait redire devant toute la salle et vous remet une bourse* | Phrase alambiquée, pronoms en cascade | *Le duc éclate de rire. Il vous fait remettre une bourse.* |
| *Conquis, le duc veut l'acheter ; vous refusez, et il vous paie le spectacle* | Interaction peu crédible | Une seule réaction simple qui justifie le gain |
| *puis vous fait reconduire sans que vous ayez vu le duc* | Fait hésiter | *… et vous fait reconduire. Vous n'aurez pas vu le duc.* |
| *Le duc remarque vos cicatrices*, avec `level: {min: 60}` | Le texte décrit un vétéran, le seuil un débutant | Le seuil « vétéran » de l'échelle (`level` `min` 130) |

## Structure d'un event

- **Introduction : 200 à 300 caractères.**
  - Elle nomme le lieu du jeu où l'event se déclenche et donne un ou deux détails concrets tirés de son canon, puis l'accroche.
  - Elle peut aller jusqu'à 400 caractères quand elle pose ce que les choix utilisent : qui est le personnage, ce qu'il veut, ce que le joueur en pense.
  - Couper ces éléments pour gagner de la place appauvrit l'event. C'est arrivé avec Donia (event 69), dont on avait perdu le doute du joueur, et avec Parziter (event 76), qui avait perdu son *a besoin d'aide*.
  - Pas de « Vous voyez » en ouverture.
- **Issue : 150 à 280 caractères.** C'est une petite scène qui se tient : ce que fait le joueur, ce qui se passe, et la conséquence. Le décor se limite à ce qui sert l'action, avec un détail concret au plus.
- **Choix : un libellé court**, avec un verbe à l'infinitif.
- **Fidélité à l'original.**
  - Même situation, mêmes personnages, même humour, mêmes possibilités.
  - Ce qui est illogique se corrige en gardant l'idée. Par exemple, le renard mort qui se relève pour mordre devient un spasme qui fait reculer le joueur contre un arbre, pour la même perte de vie.

## Lore

- **Pas de religion structurée.**
  - Pas de dieu qui agit, de clergé, de panthéon ni de miracle avéré.
  - Une expression ou une superstition reste possible.
  - Il y a toujours une explication possible : la Résonance, un escroc, une drogue.
- **Présent permanent.**
  - Pas de « plus jamais » ni de « désormais ».
  - Pas de mort d'un personnage récurrent.
  - Le joueur ne sauve pas la princesse et n'est pas adoubé : on reste à échelle humaine.
  - L'aléatoire s'explique par un trait de caractère.
- **Personnages nommés** : on suit leur fiche dans la bible. Un lien discret avec le lore est bienvenu s'il est naturel (le Grand Livre de Liard, la Résonance, une faction), sans en faire le sujet.

## Canon des lieux

- **Les voisins de la carte sont les seuls lieux qu'on peut supposer proches.**
  - Ne suppose jamais la destination suivante du joueur.
  - `mapTypesDestination` doit viser un type présent chez un voisin, sinon l'event plante. C'est arrivé avec le type `mo` près de Claire de Ville.
- **Villes : ne contredis pas le menu affiché juste après l'event.**
  - L'auberge porte son nom du jeu (Halte des Braves, Auberge du Seigneur…).
  - Pas de forgeron ni de boutique que la ville n'a pas.
  - Mernil est itinérante.
- **`forceStayInCity`** : seulement dans une ville, et quand rester est naturel. Pas après une fuite.

## Issues conditionnelles

### Combien et lesquelles

- **Par possibilité :** 3 à 6 issues, dont au moins une sans condition.
- **Pour tout l'event :**
  - environ 2 à 4 fois plus d'issues que l'original ;
  - environ les trois quarts sont conditionnelles ;
  - une ou deux possibilités nouvelles au plus.
- **Chaque profil doit avoir au moins une issue possible**, karma et familier compris.
  - Le test `eventsRequirements.test.ts` ignore le karma et les familiers.
  - Or une liste d'issues valides vide fait planter `pickRandomOutcome` : `random-js` lève une erreur sur `pick([])`.

### Texte et mécanique

- **Chaque issue a son texte et chaque texte son issue.** La mécanique doit correspondre au texte :
  - une perte de vie est une blessure ;
  - `money` est un gain de pièces ;
  - `randomItem` est un objet ;
  - `lostTime` est du temps perdu ;
  - `effect` doit être plausible : `sleeping` quand le joueur dort, `drunk` quand il a bu.
- **Le mot du texte suit le seuil**, et inversement.

### L'échelle des seuils

L'échelle est calée sur les 130 joueurs réguliers en production, c'est-à-dire ceux qui ont joué au moins 3 jours sur 14. Les statistiques comptent l'équipement et la potion. Le niveau médian est 96.

| Le texte décrit… | `level` | `attack` | `defense` | `speed` | Part des joueurs |
|---|---|---|---|---|---|
| un débutant | `max` 30 | `max` 90 | `max` 60 | `max` 10 | 10 % |
| un joueur encore faible | `max` 55 | `max` 230 | `max` 180 | `max` 40 | 25 % |
| un joueur correct, pas nul | `min` 120 | `min` 600 | `min` 520 | `min` 350 | 25 % |
| un joueur fort, un vétéran | `min` 130 | `min` 700 | `min` 740 | `min` 500 | 10 % |
| un joueur exceptionnel | `min` 140 | `min` 780 | `min` 860 | `min` 560 | 5 % |

- **« Fort » veut dire vraiment fort**, le premier dixième. Être dans le premier quart, c'est juste « correct ».
- **Un niveau 60 est encore le début du jeu.**
- **Classes et familiers.** Une condition sur une seule classe ou un seul type de familier peut ne toucher que 1 à 2 % des joueurs : c'est voulu. Des issues rares, avec une part de joueurs concernés très variable, rendent l'event plus riche.
- **Karma.**
  - Il part de 0 et n'est pas encore en production.
  - Les seuils sont `min` 0, 50, 80 ou 100, et `max` -30 ou -50.
  - Une issue le change de ±1 à ±5 pour un petit geste, de -10 à -20 pour un acte grave, et de +8 à +15 pour un acte vraiment généreux.

## Workflow avec l'atelier (dépôt Tools)

1. **Préparer l'entrée.** `generators/event-rewrites/src/input/<id>.json` contient les textes d'origine, la mécanique et le canon du lieu.
2. **Écrire la sortie.** `out/<id>.json` contient `text`, `possibilities`, `data` (le contenu complet de `Core/resources/events/<id>.json`), `icons` et `notes`.
3. **Valider.** Lance `python3 validate.py <id>` depuis `src/`. Il vérifie le style, les longueurs, la parité entre textes et données, les destinations et la couverture de tous les profils.
4. **Appliquer.** Lance `python3 apply.py <dossier Crownicles> [ids]`. Il écrit `Lang/fr/events.json`, `Core/resources/events/<id>.json` et les emojis des nouvelles issues dans `Lib/src/CrowniclesIcons.ts`.
5. **Mettre à jour le site.** Lance `python3 ../build.py` pour régénérer le site avant/après.
6. **Tester dans Crownicles :**
   - `cd Core && npx vitest run __tests__/data/events __tests__/core/eventsRequirements.test.ts` ;
   - `cd Lib && npx eslint src/CrowniclesIcons.ts` ;
   - `node .github/scripts/generate-test-commands-skill.mjs` (la CI vérifie que ce skill est à jour).

## Relecture finale

Avant de rendre un texte, vérifie chaque point :

1. Il n'a pas de discours direct, pas de mot rare, pas d'expression inventée, pas de phrase où l'on bute.
2. Il se lit encore bien à la centième fois, et l'état du monde reste intact.
3. L'introduction nomme le lieu et garde ce dont les choix ont besoin.
4. Il ne contredit ni le canon du lieu ni le menu de la ville, et ne suppose pas la destination suivante.
5. Chaque condition se montre dans le texte, et chaque seuil correspond au mot de l'échelle.
6. Chaque issue a une mécanique qui correspond au texte, et chaque profil de joueur a au moins une issue.
