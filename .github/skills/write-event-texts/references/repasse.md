# Repasse sur un event déjà réécrit

L'event a déjà été réécrit, mais avant que les règles actuelles existent. La version actuelle de la branche est dans `input/<id>.json`, champ `draft` (`lang` = textes, `data` = mécanique). `original` est la version de `develop`, qui sert seulement à la comparaison sur le site.

Ta tâche : **reprendre la version actuelle (`draft`) selon les règles actuelles** et écrire le résultat dans `out/<id>.json`. Ce n'est pas une réécriture à partir de zéro : garde ce qui est bon, corrige le reste.

La référence est le skill `write-event-texts` : `.github/skills/write-event-texts/SKILL.md`. Lis-le en entier, y compris son « Journal des retours du propriétaire ». Les défauts qu'on trouve dans ces premières réécritures :

- **Trop lourd** : jusqu'à 13 issues générales par possibilité. Garde au plus 6 issues sans condition ; les issues rares (familier, badge, classe) peuvent rester nombreuses si chacune apporte quelque chose. Retire les doublons (deux familiers avec le même texte), les issues sans effet ni intérêt, les possibilités ajoutées juste pour remplir (« se reposer et observer », « contempler »).
- **Prévisibilité** : quand le joueur clique, il sait à peu près ce qui va se passer. Les issues d'un choix sont des variantes du résultat annoncé par le libellé ; une surprise par choix au plus.
- **Le cas général d'abord** : chaque possibilité a au moins une issue sans condition, ou une paire de conditions complémentaires. Une condition fait basculer la situation ; elle ne pénalise jamais une force (pas d'issue négative réservée aux joueurs forts, rapides ou bien défendus).
- **Paliers** : un malus ou un bonus lié à une stat se gradue en trois paliers (faible / moyen / fort, table du skill), au lieu d'un seuil binaire. Varie les seuils : pas tous tout en haut.
- **Seuils de l'ancien barème** : `level` `min` 40, 60, 70, 80, 100… avec des textes de « vétéran » ou de « voyageur chevronné ». Recale sur l'échelle (`reference.md`) et accorde le mot du texte au seuil.
- **Karma** :
  - seuils `min` 0, 50, 80 ou 100 et `max` -30 ou -50 seulement (pas 20, 150, -10, -100, -230, -280…) ;
  - gain ou perte seulement pour un **choix moral du joueur** : jamais pour un hasard, une trouvaille, un spectacle ou une réaction de familier ;
  - ±1 à ±5 pour un petit geste, -10 à -20 pour un acte grave, +8 à +15 pour un acte vraiment généreux ;
  - **le karma n'est pas de la chance** : la nature ou un animal ne punit pas un joueur au karma bas ; seuls les gens qui le reconnaissent réagissent.
- **Religion** : pas de prière pour l'âme, de bénédiction, de chapelain, de pèlerin, d'objet béni, de « remercier les dieux ». Une expression ou une superstition légère reste possible.
- **Style** : vocabulaire « IA » (« émotions contradictoires », « logique implacable », « temps précieux », « cœur endurci »), morale finale (« la mort fait partie du cycle naturel »), « ! » et « Miracle ! », phrases qui s'enchaînent mal, sentiments disproportionnés, décor inutile, illogismes (un renard mort qui se relève pour mordre).
- **Texte et mécanique** : chaque texte correspond à sa mécanique (une issue où l'on perd son argent a un `money` négatif, etc.), et inversement.

Garde les possibilités actuelles (mêmes noms), sauf une possibilité de pur remplissage absente d'`original`, que tu peux retirer : dans ce cas, retire aussi son emoji dans `icons` en ne l'y mettant pas. Tu peux renuméroter les issues. Pour `icons`, mets un emoji pour chaque possibilité absente d'`original` et chaque issue de `end` absente d'`original`, en reprenant ceux de `draft` quand le sens ne change pas : ils sont dans `Lib/src/CrowniclesIcons.ts` (second bloc `events: {`).

Dans `notes`, dis en 3 à 8 puces ce que tu as retiré, recalé ou réécrit, et pourquoi.
