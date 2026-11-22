# Reprise d'un brouillon de contributeur

Ces events ont été réécrits par un contributeur, Gabriel (GabrieLre). Son brouillon est dans `input/<id>.json`, champ `draft` (`lang` = textes, `data` = mécanique). Il est déjà commité tel quel. Ta tâche est de le **reprendre selon nos règles**. Ce n'est pas une réécriture à partir de zéro.

- **Garde ses idées** quand elles tiennent : ce sont les siennes, et beaucoup sont bonnes (le chef qui reprend les fourneaux, le perroquet qui insulte le gérant, le singe qui trahit le pillard, la colombe qui attendrit le bourreau…). Tu peux fusionner deux idées proches, ou en écarter une qui ne tient pas.
- **Garde ses possibilités** (mêmes noms), y compris celles qu'il a ajoutées. `original` reste la version de `develop` : elle sert à la comparaison sur le site.
- **Applique le skill `write-event-texts`** : `.github/skills/write-event-texts/SKILL.md`. Lis-le en entier : c'est la référence. Points qui reviennent dans son brouillon :
  - pas de religion structurée (Kyutisme, prêtre, Église, Minotaure, « envoyé divin », « sceau divin », résurrection) ; une superstition légère reste possible ;
  - pas de discours direct ni de guillemets dans le texte ;
  - issues de la longueur de ce qu'elles racontent (400 caractères au plus), intro de 200 à 300 (400 au plus) ; ses textes font souvent 300 à 600 caractères : resserre ce qui ne sert pas l'action ;
  - phrases simples, orthographe et accords corrects, apostrophe droite `'` (il utilise souvent `’`), pas de « ! » en série, pas de points de suspension finaux ;
  - pas de montant ni de durée chiffrée dans le texte (« après 45 minutes », « 15 minutes ») ;
  - le cas général d'abord : chaque possibilité a au moins une issue sans condition, ou une paire de conditions complémentaires ; une condition fait basculer la situation, elle ne pénalise jamais une force ;
  - au moins 3 issues par possibilité, et au plus 6 sans condition : il en a parfois 12 ou 13 générales, garde les meilleures (les issues rares, liées à un familier, un badge ou une classe, peuvent être nombreuses) ;
  - seuils de l'échelle des joueurs réguliers (`reference.md`) : un « vétéran », un joueur « expérimenté » c'est `level` `min` 130, pas 60 ou 80 ; karma `min` 0/50/80/100 et `max` -30/-50 ; karma ±1 à ±5 pour un petit geste, -10 à -20 pour un acte grave, +8 à +15 pour un acte vraiment généreux ;
  - chaque texte correspond à sa mécanique, et inversement ; effets valides seulement (`confused` n'existe pas, c'est `confounded`) ;
  - `validPetTypeIds: []` ne veut pas dire « sans familier » : une liste vide rend l'issue impossible. Pour « sans familier », il n'existe pas de condition : retire-la ;
  - `oneshot` (le joueur tombe à 0 PV) : au plus une issue par possibilité, et jamais dans le cas général ;
  - le familier est désigné par son vrai nom (`Lang/fr/models.json`, clé `pets`, `<id>_male` ; vérifie chaque id) et ce qu'il fait correspond à l'animal.
- **Tu peux utiliser les nouvelles conditions** (`cookingLevel`, `materials`, `enchantment`, `weaponLevel`, `armorLevel`) et `consumeMaterials` / `giveMaterials` si l'idée s'y prête vraiment : voir `reference.md`, section « Cuisine, matériaux et équipement ».
- **Canon du lieu** : voir `canonBlock`, `city`, `neighbours` de ton input et l'annexe A de la bible.
- **Icônes** : un emoji pour chaque possibilité absente d'`original` et pour chaque issue de `end` absente d'`original`, comme d'habitude. Si tu gardes les numéros d'issues de `end` de Gabriel, reprends ses emojis : 24 `end` 2 😊, 3 😒, 4 🤝, 5 🤝, 6 🐾, 7 😈, 8 🧙 ; 25 `end` 2 🐈, 3 👽, 4 💀 ; 26 `end` 1 🕊️, 2 👀, 3 😢, `tell` 🗣️. Adapte-les si tu changes le sens de l'issue.
- **Notes** : dans `notes`, dis ce que tu as gardé de Gabriel, ce que tu as écarté et pourquoi.
