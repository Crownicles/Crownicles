# Équilibrage PvP des classes de niveau 100+ (octobre–novembre 2026)

Ce document retrace le travail fait du 27 octobre au 6 novembre 2026 sur les combats PvP de haut niveau :
les objectifs, ce qui a été livré, comment c'est mesuré, ce qui a été essayé puis abandonné, et ce qui reste ouvert.
Il complète les descriptions des PR ; les chiffres sont ceux mesurés à chaque étape.

- PR principale : [#5062](https://github.com/Crownicles/Crownicles/pull/5062), équilibrage, IA de défense, `/defense` et familiers (mergée le 06/11 dans `develop`).
- Familiers : issue [#5063](https://github.com/Crownicles/Crownicles/issues/5063), traitée dans #5062.
- Gardes du roi : [#5065](https://github.com/Crownicles/Crownicles/pull/5065), réseau de neurones, reportée sur `develop` par [#5082](https://github.com/Crownicles/Crownicles/pull/5082).
- Idée suivante : compétences de classe, issue [#5081](https://github.com/Crownicles/Crownicles/issues/5081).
- Outils : `Crownicles/Tools`, dossier `scripts/class-pet-study` (étude classes × familiers), et dépôt privé
  `Crownicles/Fight-Simulator-30000` (solver, réseau des gardes, note `CONNAISSANCES.md`).

## 1. Objectifs

Ils ont été posés au fil des sessions et n'ont pas changé :

- **Le plaisir de jeu d'abord.** Pas de tours perdus, peu de nuls, pas d'IA « cancer » qui contrôle l'attaquant tout le combat.
  Les vrais joueurs sont les **attaquants** : c'est leur expérience qu'on optimise. L'attaquant doit gagner assez souvent pour
  rester motivé, sans que ce soit acquis.
- **Aucune classe dominante**, et des contres lisibles entre les classes (pierre-feuille-ciseaux), pour que tout le monde
  ne joue pas la même classe. Aujourd'hui 45 % des joueurs 100+ sont Chevaliers.
- **Garder la personnalité de chaque classe** : Tank mur, Canonnier canon de verre, Fantassin brute, Mage à altérations,
  Chevalier endurant, Paladin sacré, Vétéran opportuniste. On équilibre de préférence avec les attaques exclusives de chaque
  classe, ce qui renforce son identité.
- **Peu de changements par rapport à la prod**, et un changelog court.
- **Le Tank est une classe d'aventure** : il peut être la plus faible en PvP, sans être trop bas. Il doit en revanche être
  bon en PvE.
- **Écouter les joueurs plus que les simulations.** Les retours de la communauté ont fait annuler plusieurs nerfs.
- Uniquement les classes du dernier palier (18 à 24) ; les traductions ne se modifient qu'en français.

## 2. Chronologie

### 27–28 octobre : étude des taux de victoire et premières IA
- Étude des combats classés 100+ (peu nombreux) : le Mage, le Tank et le Paladin perdent, le Chevalier valeureux gagne
  (et représente 57 % des combats). Un simulateur réutilisant le vrai moteur compilé du Core est construit.
- Demande : équilibrer avec les **attaques exclusives** de chaque classe. Un thread modifie les attaques, un autre étudie
  les IA : bugs et erreurs de jeu trouvés (bouclier du Tank et du Paladin sous-utilisé, course aux actions divines du
  Chevalier, compteur de canons du Canonnier jamais remis à zéro, vérifications de souffle erronées).
- L'utilisateur demande d'équilibrer **IA et attaques ensemble**. Premiers commits sur `balance/pvp-class-exclusive-attacks`.
- **Personnalités d'IA** : 1 à 3 styles par classe quand la classe s'y prête (un style « aléatoire » a été rejeté : −5 à −13 points).
  Elles deviennent **choisissables par le joueur** avec `/defense`, invisibles pour l'attaquant.
- Le style « Canonnier » du Canonnier est renommé « Bombardier » (conflit de nom avec la classe).

### 28 octobre : rework du Mage
- Constat : l'attaque sombre aveugle, le joueur perd 19,7 % de ses tours contre l'IA Mage, et une seule ligne de jeu est viable.
- L'attaque sombre **n'aveugle plus** et **s'use** à chaque utilisation (×1,7 puis −0,3 par usage jusqu'à ×0,3), et se recharge
  quand le Mage s'en passe. Idée de l'utilisateur pour que la classe reste technique ; le bonus « +45 % contre une cible
  altérée » a été retiré à sa demande.
- **Retours des joueurs, négatifs** : les nerfs de l'ultime du Paladin et de l'attaque lourde du Chevalier sont refusés,
  et annulés (commit `2acfcfcc1`). Consigne : tenir compte des stratégies réelles des joueurs plus que des simulations.

### 28–29 octobre : un moteur au niveau humain
- MCTS puis **expectimax en boucle fermée + réseau d'évaluation** : le moteur d'attaque gagne 62 à 66 % sur la prod,
  contre 62,8 % pour les vrais joueurs. Il sert d'« attaquant humain » dans toutes les mesures « terrain réel ».
- Le 29, journée autonome : IA du Tank, concentration ×1,55, IA du Canonnier, refactorings pour CodeScene, PR #5062 ouverte.
- Changement de classe : un pic net à exactement 21–22 jours (23 % des changements) montrait que le délai de 3 semaines
  bloquait. Passé à **1 semaine pour tous les niveaux**.
- Retour joueur : le sabotage paralyse le Canonnier, et le Tank qui spamme le bouclier est toxique. Ajout d'une mesure
  de « contrôle subi » et du rythme du bouclier (`ShieldAttackPacing`, une fois par combat).

### 29–30 octobre : réseau de neurones des gardes du roi
- Le serveur de prod n'a presque pas de marge CPU : seul un réseau de politique (0,02 ms par décision) est possible.
- Entraînement **en self-play** (à la AlphaZero), 11 générations la première nuit, puis fine-tunes après chaque changement de règles.
- PR #5065 : le garde joué par le réseau fait 33,0 contre 22,0 pour l'IA scriptée face à un attaquant qui le connaît (+11 ± 1,3).

### 2–3 novembre : familiers (#5063)
- Le Jack-o'-lantern pétrifie une seconde fois en milieu de combat.
- **Seconds pouvoirs** : mammouth (élan, +4 % de dégâts au corps à corps par tour jusqu'à +16 %, perdu si le maître est
  immobilisé), ours polaire (affût après un repos), aigle (piqué sous 15 % d'énergie), requin (odeur du sang, saignement).
- Renforcement des pouvoirs faibles : riposte (kangourou, gorille), corne (rhinocéros, cerf), écrasement (diplodocus),
  bombe (canard écarlate), morsure.

### 4–5 novembre : étude classes × familiers et paquet d'équilibrage
- Outil `Tools/scripts/class-pet-study` : toutes les combinaisons classe + familier (7 × 104), le réseau des gardes joue les
  deux côtés, 3,2 millions de combats en 4 minutes, page HTML (méta, classe contre classe, familiers, attaques jouées).
- Mode `auto` : chaque classe choisit son équipement parmi 3 armes, 3 armures, 3 objets et 3 potions portés en prod
  (rareté 7, +5, enchantements `pvpAttack3` et `defense3` uniquement), sélection faite avec le seul familier Lion.
- Constat avec cet équipement : **Tank dominant** (65,6 avec potion), **Canonnier le plus faible** (~36).
- Paquet appliqué en minimisant les changements : riposte du Tank ×1,4 annulée ; Tank à 150 d'énergie de départ en moins ;
  canon qui compte toute la vitesse et fait 10 % de dégâts en plus ; boomerang à 7 de souffle et lancer +11 % ; attaque
  puissante +6 % ; attaque sombre à pleine puissance contre un adversaire maudit ; Paladin plus économe en souffle.
- Le nerf de la chauve-souris a été annulé par l'utilisateur (jugé injustifié).

### 5–6 novembre : IA de défense scriptées (pas de réseau en PvP)
- Décision : **pas de réseau de neurones pour le PvP** (trop lourd à maintenir et à réentraîner). On améliore les IA scriptées.
- Chaque règle d'IA est mesurée contre le moteur humain, avec des écarts appariés sur deux graines (gains de +5 à +9 points
  de défense selon la classe), sans augmenter le contrôle subi par l'attaquant.
- `/defense` affiche les défenses des 7 derniers jours par classe d'attaquant et le point fort mesuré de certains styles.

### 6 novembre : derniers réglages et merge
- Ultime du Paladin : +20 % essayé, le Paladin devenait la classe la plus forte à équipement égal ; **+10 %** livré.
- Tank en PvE : en prod il gagne 88 % de ses combats PvE (93–97 % pour les autres) et ne joue sa riposte que dans 5 % d'entre
  eux. La riposte frappe **×2 contre les monstres** (×2,5 jugé trop fort par l'utilisateur).
- Concentration du Vétéran remise à ×1,6 (valeur de la prod) : « c'est ok si le Vétéran passe premier ».
- Discussion de fond sur la qualité du système de combat (métriques de fun, prévisibilité, profondeur). Le matchmaking par
  gloire rend déjà 83 % des combats serrés (le favori n'y gagne que 54,5 %). Idée retenue pour plus tard : compétences de classe (#5081).
- #5062 mergée dans `develop`. #5065 avait été mergée dans la branche d'équilibrage : reportée sur `develop` par #5082.
- Les outils non commitables ont été poussés dans `Crownicles/Fight-Simulator-30000` avec la note `CONNAISSANCES.md`.

## 3. Ce qui a changé par rapport à la prod 6.1.1

Les stats ne changent que pour les classes de niveau 100+, les attaques pour toute la lignée.

| Classe | Changement | Valeurs |
|---|---|---|
| Tank (19) | énergie de départ | `fightPoint` 550 → 400 |
| | riposte contre les monstres | ×2 (`COUNTER_ATTACK_MONSTER_DAMAGE_MULTIPLIER`), inchangée en PvP |
| Canonnier (20) | attaque canon | compte 100 % de la vitesse (au lieu de 80 %), dégâts 20/120/250 → 22/123/259 |
| | boomerang | souffle 9 → 7, lancer +11 % |
| Fantassin (18) | attaque puissante | +6 % de dégâts |
| Mage (24) | attaque sombre | souffle 8 → 6, n'aveugle plus, usure ×1,7 → ×0,3 (−0,3 par usage, +1 cran tous les 2 coups sans elle), pleine puissance contre un maudit |
| | malédiction | soins de l'adversaire ×0,7 (`CURSED_HEALING_MULTIPLIER`) |
| | vol de souffle | jusqu'à 2 points |
| Vétéran (23) | attaque énergique | ×1,25 contre un adversaire qui vient de se reposer |
| | concentration | ×1,6, comme en prod (passée par ×1,55 puis rétablie) |
| Paladin (22) | énergie de départ | `fightPoint` 395 → 330 |
| | ultime | souffle 10 → 7, dégâts 100/325/400 → 110/358/440 |
| | divine | souffle 9 → 8 |
| | bélier | renvoie deux fois moins de dégâts au lanceur |
| Chevalier (21) | — | inchangé (attaque lourde gardée à la demande des joueurs) |
| Toutes | changement de classe | 1 semaine à tous les niveaux (au lieu de 2–3 semaines) |

Familiers : voir la section 2 (2–3 novembre). IA de défense et `/defense` : voir la description de #5062.

## 4. Comment c'est mesuré

Trois mesures complémentaires, à ne jamais lire seules (détails et pièges dans `CONNAISSANCES.md`).

1. **Terrain réel** (`solver/tools/rf.sh`) : les ~130 vrais joueurs 100+ avec leur équipement et leur familier ; le moteur
   au niveau humain attaque les IA de défense scriptées ; les matchups sont pondérés comme les vrais combats ; l'écart entre
   les humains et le moteur, mesuré sur la prod, est appliqué. C'est ce que vivent les joueurs aujourd'hui, **avec leur
   équipement actuel**.
2. **Équipement égal** (`class-pet-study`, mode `auto`) : 7 classes × 104 familiers au niveau 157, le réseau des gardes des
   deux côtés, avec et sans potion. C'est l'équilibre des règles, indépendamment de qui joue quoi.
3. **Méta** : équilibre de Nash entre les 12 meilleurs familiers de chaque classe. Très sensible au bruit
   (une combinaison au seuil passe de 8 % à 0 % pour 0,3 point).

Toujours des **écarts appariés** (mêmes graines, un seul changement), à confirmer sur une deuxième graine.

### Limites connues de ces mesures (avant le 07/11)
- Le mode `auto` ne choisissait qu'entre 3 objets par emplacement, avec un seul familier (Lion), et seulement les enchantements
  `pvpAttack3` / `defense3`.
- Le terrain réel prend l'équipement actuel des joueurs : une classe dont les joueurs sont mal équipés (après un changement
  de classe, par exemple) y paraît plus faible qu'elle n'est.
- Le réseau des deux côtés n'adapte pas ses choix aux règles changées sans réentraînement.

L'étude du 07/11 ([etude-equipement-optimal-2026-11-07.md](etude-equipement-optimal-2026-11-07.md)) reprend la mesure avec
l'équipement et les familiers optimaux de chaque classe.

## 5. Chiffres de référence au merge (06/11)

| Classe | Égal, avec potion : avant → après | Égal, sans potion : avant → après | Réel, prod → branche |
|---|---|---|---|
| Fantassin | 43,1 → 47,8 | 44,2 → 45,9 | 50,0 → 57,3 |
| Tank | 58,8 → 49,1 | 56,5 → 48,6 | 43,8 → 42,5 |
| Canonnier | 36,8 → 44,3 | 35,9 → 45,3 | 49,0 → 52,8 |
| Chevalier | 56,7 → 52,6 | 58,9 → 54,2 | 52,9 → 49,1 |
| Paladin | 51,6 → 50,8 | 55,6 → 55,0 | 46,9 → 48,5 |
| Vétéran | 51,4 → 53,0 | 52,7 → 51,6 | 50,1 → 49,3 |
| Mage | 51,7 → 52,2 | 46,2 → 49,5 | 39,1 → 51,4 |
| **Écart** | 21,9 → 8,7 | 22,9 → 9,7 | 13,8 → 14,8 |

Autres repères : l'attaquant gagne 66 % contre les IA de défense en prod, 62–63 % sur la branche ; contrôle subi 31 % face
au Paladin, 28 % face au Tank ; nuls ~20 % pour le Tank ; chauve-souris 37 % de la méta avec potion, 62 % sans.

## 6. Essayé puis abandonné

| Idée | Pourquoi abandonnée |
|---|---|
| Nerf de l'ultime du Paladin, de l'attaque lourde du Chevalier | refusé par les joueurs |
| Bonus de l'attaque sombre contre toute cible altérée (+45 %) | rend le Mage trop simple ; remplacé par l'usure |
| Riposte du Tank ×1,4 (puis ×1,3) en PvP | Tank dominant à équipement égal |
| Sabotage moins risqué, boomerang à 8 de souffle | effet nul ou contraire, annulés aussitôt |
| IA Canonnier qui préfère le sabotage | le sabotage paralyse le Canonnier : anti-fun, annulé |
| IA Paladin qui spamme le bélier | étourdit l'attaquant 70 % du temps : anti-fun |
| Personnalité « aléatoire » | −5 à −13 points |
| Nerf de la chauve-souris | jugé injustifié, annulé |
| Ultime du Paladin +20 % | Paladin premier à équipement égal ; +10 % livré |
| Riposte ×2,5 contre les monstres | jugée trop forte ; ×2 livré |
| Réseau de neurones pour les IA PvP | trop lourd à maintenir ; réservé aux gardes du roi |
| IA par rollouts (valeur) | +9,7 points en duel mais pas meilleure contre les humains, déséquilibre les classes |

## 7. Idées en attente
- Compétences de classe (#5081) : un pouvoir réactif de 3 tours par lignée, une fois par combat, déclenchement choisi dans `/defense`.
- Bonus de 6 % de l'attaque puissante : à retirer si le Fantassin reste au-dessus d'environ 55 en vrai après la sortie.
- Nuls du Tank : départage au 26e tour selon la part d'énergie restante.
- Diversité des classes : classement par classe, taux de victoire par classe adverse dans l'historique, vrai choix de classe au niveau 80.
- Synergies d'objets par lignée de classe (branche `design/lineage-affinities`, mise de côté le 27/10).

## 8. 7 novembre : l'équilibrage avec un équipement et des familiers optimaux
Détails : [etude-equipement-optimal-2026-11-07.md](etude-equipement-optimal-2026-11-07.md).
- L'étude « équipement égal » donnait déjà au Canonnier son équipement optimal ; seule la toute première étude (équipement du
  n°1 de la prod pour tous) le désavantageait.
- Avec équipement + familiers optimaux, dans le PvP réaliste (moteur humain contre IA scriptées), l'écart entre classes passe
  de 23,9 (prod) à 11,9 (develop) au niveau 157. Au niveau réaliste (115 en médiane), le Mage bien équipé domine (63 %).
- Les builds intuitifs (Canonnier « canon de verre », Tank « mur », Mage « attaque ») coûtent 16 à 19 points : l'optimum comble
  la faiblesse de la classe, à cause des rendements décroissants des stats.
- Le Mage bien équipé domine à tous les niveaux réalistes (58 à 65 %). Modification proposée sur la branche
  `balance/realistic-gear-meta-study` : l'attaque sombre compte 30 % / 10 % de la défense (au lieu de 15 % / 5 %) ; le Mage perd
  5 à 8 points bien équipé, 0,6 sur le terrain réel d'aujourd'hui.
- Le Paladin ne paraissait faible qu'avec un mauvais choix d'équipement de l'optimiseur ; le 2e bouclier essayé pour son IA a été annulé.
- Le Canonnier est faible aux niveaux bas quand tout le monde est bien équipé (39,6 au niveau 105) : son armure est plafonnée à sa
  défense de base. Le meilleur buff testé (énergie de départ 30 → 100) le remet à 47,0, mais avec les vrais joueurs de niveau
  100 à 109 il gagne déjà (53,0) et passerait à 59,1 : écarté pour l'instant.
- Niveau 100 : bien équipé, develop est moins équilibré que la prod (écart 25,6 contre 18,9, Mage 64,6) ; avec les vrais
  joueurs de niveau 100 à 109 et leur vrai équipement, c'est l'inverse (écart 9,1 contre 21,1). La défense comptée deux fois
  ne suffit pas au niveau 100 bien équipé (Mage 56,9 à 61,6) : 2e modification proposée sur la branche, l'usure de l'attaque
  sombre démarre à ×1,6 au lieu de ×1,7 (Mage −5,6 à −6,2 au niveau 100 bien équipé, −1,4 à −1,9 sur les joueurs d'aujourd'hui).
