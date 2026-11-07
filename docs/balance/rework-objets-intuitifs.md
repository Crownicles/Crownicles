# Aperçu : rework pour des objets intuitifs (07/11/2026)

Objectif : qu'un joueur puisse miser sur une stat au détriment des autres (« Tank mur », « Canonnier canon de verre ») et que
ce soit un vrai choix, au lieu d'un piège. Mesures et raisonnement : §7 de `etude-equipement-optimal-2026-11-07.md`
(PR #5086).

## 1. Pourquoi les objets ne sont pas intuitifs aujourd'hui

La puissance d'une stat est `120·tanh(0,00123·stat − 0,03) + 3`
(`FightActionController.statToStatPower`). La courbe s'aplatit : au niveau 100, +100 dans la stat faible d'une classe rapporte
2 à 3 fois plus que +100 dans sa stat forte. L'équipement optimal comble donc la faiblesse de la classe, et les builds
intuitifs coûtent 6 à 22 points de victoires.

Avec une courbe droite, l'optimiseur choisit tout seul les builds intuitifs : Tank défense 777, Canonnier attaque 772, Paladin
et Chevalier en défense. Mais cette courbe tient aujourd'hui l'équilibre des classes spécialistes : elle punit leur stat
faible. Sans elle, le Tank et le Paladin dominent (écart entre classes 35 au lieu de 21 avec le simulateur réseau, 21 au lieu
de 4 dans le protocole réaliste). Les réduire n'y suffit pas : même −50 % d'attaque et −25 % de défense les laissent à 64–67 %.

## 2. Formule cible

```
puissance(stat) = 0,304 × stat / (1 + niveau² / 4000)
ratio = (puissance(stat de l'attaquant) − puissance(stat du défenseur)) / 50   (inchangé)
```

- Droite : chaque point de stat vaut pareil, quelle que soit la classe et la stat.
- Divisée par le facteur de croissance des stats de base (`Class.getAttackValue` etc. : `stat × (1 + niveau²/4000)`) : une
  stat compte pareil à tous les niveaux. Aujourd'hui, la tanh sature vers le niveau 150 et les stats y comptent moins
  qu'au niveau 100.
- Le facteur 0,304 donne au niveau 100 la même pente moyenne qu'aujourd'hui entre 300 et 1 000.
- Les deux combattants sont divisés par le facteur du niveau de l'attaquant (comme `getLevelBonusRatio`).
- Plafonds des objets gardés (arme et armure ≤ stat de base, objet ≤ 2× la stat de base) : ils ne coupent presque rien au
  niveau 100+ avec un bon équipement, mais ils protègent les bas niveaux et l'identité des classes. Réduire la puissance des
  objets ou enlever les plafonds n'améliore pas l'équilibre (mesuré).

À trancher en premier : faut-il garder une saturation douce de l'**écart** (et non de chaque stat), par exemple
`ratio = tanh(écart / k)` ? Elle garde le choix des stats lisible (un point vaut pareil pour tout le monde) mais limite
l'avantage d'une défense énorme, ce qui pourrait réduire le rééquilibrage nécessaire. À mesurer avant tout le reste.

## 3. Ce qu'il faut retoucher

| Chantier | Où | Ampleur |
|---|---|---|
| Formule de puissance | `FightActionController.statToStatPower` / `getAttackDamageByStat` (passer le niveau) | petite |
| Stats de base des 7 classes 100+ et de leurs lignées | `Core/resources/classes/*.json` (attaque, défense, vitesse, `fightPoint`) | **grosse** : la défense et l'énergie du Tank et du Paladin, l'attaque du Vétéran et du Mage |
| Parts de stats des attaques | 109 attaques avec `defenderStats`, dont 19 qui pondèrent une stat (attaque sombre 0,3 / 0,1, poison 0,5, attaque intense défense ×2…) | moyenne : à revoir une par une, toutes réglées sur la tanh |
| Autres usages des stats | ratés du canon (vitesse / niveau), attaques des familiers, altérations qui multiplient une stat (défense, ralentissement) | moyenne |
| IA de défense | `aiClassBehaviors/*` : seuils réglés sur les dégâts actuels | moyenne, à revoir après les stats |
| PvE | 19 monstres (`Core/resources/monsters`), expéditions, gardes du roi | **grosse** : tous réglés sur la tanh |
| Gardes du roi | réseau `kingGuardAi/model.json` | réentraînement |
| Affichage | `getMaxStatsValue` (inventaire, objets), descriptions des attaques, des objets et des classes en français | petite |
| Tests | tests de dégâts des attaques (`__tests__/core/fights`) | moyenne |

## 4. Méthode proposée (rapide)

1. Implémenter la formule derrière une constante de `FightConstants`, pour comparer les deux courbes avec le même build.
2. Trancher la forme (droite pure ou saturation douce de l'écart) au simulateur réseau des deux côtés : 4 secondes par variante.
3. Boucle de rééquilibrage des classes au niveau 100 : réglage des stats de base au simulateur réseau, équipement
   ré-optimisé à chaque étape (2 minutes), confirmation au protocole réaliste (5 minutes).
4. Revoir les parts de stats des attaques et l'IA de défense des classes qui restent hors de 45–55.
5. Refaire l'étude du 07/11 : niveaux 100, 120 et 157, vrais joueurs, terrain réel, builds intuitifs (ils doivent coûter
   moins de 5 points), méta réaliste.
6. PvE : rejouer les monstres et les gardes du roi, réentraîner le réseau des gardes.
7. Communication : changement de règle visible, à annoncer comme tel (les joueurs devront refaire leur équipement).

Ordre de grandeur : quelques jours de travail, dont le rééquilibrage et le PvE comme gros morceaux. Version majeure, pas de
correctif.

## 5. Alternative sans rework

Garder la courbe actuelle et la rendre lisible : afficher pour chaque objet son gain réel pour la classe du joueur (le jeu
connaît la courbe et les plafonds), ou donner un conseil de build par classe. Le piège disparaît pour qui lit l'information,
sans toucher à l'équilibre. Miser sur une stat reste en revanche une erreur.
