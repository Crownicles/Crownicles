# Étude du 07/11/2026 : l'équilibrage tient-il avec un équipement et des familiers optimaux ?

Question posée : dans les mesures qui ont servi à l'équilibrage de #5062, le Canonnier avait-il un équipement inadapté
(« un stuff de Chevalier ») ? Que donne l'équilibrage quand **chaque classe a son équipement optimal et ses meilleurs
familiers** ? Et quelles modifications faire ?

Build mesuré : `develop` du 07/11 (#5062 et #5082 mergées), comparé à la prod 6.1.1 quand c'est possible.
Branche `balance/realistic-gear-meta-study` : sauf mention contraire, « la branche » désigne la modification 1 de l'attaque
sombre seule (défense ×2) ; la modification 2 (usure de départ ×1,6) a été ajoutée à la fin, après les mesures du niveau 100 (§4.5).
Historique complet du travail : [historique-equilibrage-pvp-2026.md](historique-equilibrage-pvp-2026.md).

## Résumé

1. **Dans l'étude « équipement égal » qui a guidé l'équilibrage, les classes n'avaient pas toutes leur meilleur équipement**
   (mode `auto` : 3 objets par emplacement, enchantements `pvpAttack3` / `defense3` seulement, choisi avec le seul familier Lion).
   Le Canonnier et le Chevalier avaient déjà leur optimum ; les 5 autres non. Avec l'optimum de chaque classe, à niveau égal :
   **le Tank était sous-estimé de 4,5 points** (49,1 → 53,6), le Chevalier surestimé de 3 (52,6 → 49,6), les autres bougent de
   1,4 point au plus (§2). Le Canonnier reste le plus faible à niveau égal (44,3 → 43,4) : ce n'était pas un problème d'équipement.
2. **L'équilibrage de #5062 tient avec un équipement et des familiers optimaux.** Dans le protocole le plus proche du jeu
   (un humain attaque l'IA de défense d'un autre joueur), l'écart entre classes passe de 23,9 à 11,9 points (avec potion) et
   de 26,8 à 8,8 (sans potion) entre la prod et develop, au niveau 157. En prod, le Chevalier est le seul choix rationnel ;
   sur develop, 3 à 5 classes le sont selon le scénario.
3. **Mais toutes les études étaient au niveau 157, alors que les joueurs 100+ sont au niveau 115 en médiane.** À un niveau
   réaliste, les objets pèsent plus lourd et **le Mage bien équipé domine** : 63 % de victoires contre 51 % aujourd'hui
   (ses joueurs sont mal équipés). C'est le principal risque de l'équilibrage. **Au niveau 100 bien équipé, develop est même
   moins équilibré que la prod** (écart 25,6 contre 18,9, Mage 64,6 ; §4.5). Avec les vrais joueurs de niveau 100 à 109 et leur
   vrai équipement, c'est l'inverse : develop est bien plus équilibré que la prod (écart 9,1 contre 21,1, Mage 49,5 contre 37,8).
4. **Les builds intuitifs sont des pièges** : rendements décroissants obligent, l'optimum comble la faiblesse de la classe.
   Un Canonnier « canon de verre » perd 16 points, un Tank « mur » 16, un Mage « attaque » 19. La plupart des vrais Canonniers,
   Tanks et Mages jouent ces builds.
5. **Deux modifications proposées, commitées sur cette branche** (détails §6), toutes deux sur l'attaque sombre :
   - elle compte 30 % et 10 % de la défense de la cible au lieu de 15 % et 5 % : le Mage bien équipé au niveau 120 perd 5 à 8
     points selon l'équipement mesuré (63,1 → 55,1), il ne perd que 0,6 point sur le terrain réel d'aujourd'hui ;
   - son usure démarre à ×1,6 au lieu de ×1,7 : au niveau 100 bien équipé, le Mage perd encore 5,6 à 6,2 points (il restait à
     56,9 à 61,6 après la première modification), pour 1,4 à 1,9 point sur les joueurs d'aujourd'hui. Avec les deux, les vrais
     Mages de niveau 100 à 109 passent de 49,5 (develop) à 46,1 (37,8 en prod) : un arbitrage à trancher ensemble.
6. **Le Paladin n'est pas faible** : il ne le paraissait qu'avec l'équipement choisi par l'optimiseur au niveau 120. Avec
   potion d'attaque et objet de vitesse, il gagne 52,3 % au lieu de 44,6 %. La modification de son IA essayée cette nuit
   (2e bouclier) a été annulée.
7. **Le Canonnier n'est faible que si tous ses adversaires sont équipés de façon optimale** (39,6 au niveau 105, ~40 au
   niveau 100, 42,5 à 47,0 au niveau 120), parce que son armure est plafonnée à sa très faible défense de base. Avec les vrais
   joueurs, il gagne déjà : 52,9 sur le terrain réel, 53,0 au niveau 100 à 109. L'énergie de départ 30 → 100 le remettrait à
   46,6 au niveau 100 bien équipé, mais à **59,1 et 68 % de la méta pour les vrais joueurs de niveau 100** : à ne pas faire
   maintenant, à reprendre quand les joueurs s'équiperont mieux.

## 1. Méthode

### 1.1 Équipement optimal de chaque classe
- **Espace exploré** : tous les objets du jeu de rareté ≤ 7, arme et armure +5, en appliquant les plafonds du jeu
  (arme et armure plafonnées à la stat de base de la classe, objet à 2 fois, potion sans plafond). On ne garde que les objets
  non dominés pour la classe : 9 armes, 10 à 12 armures, 3 objets, 3 potions (+ « pas de potion »).
- **Enchantements** : tous ceux utiles en PvP. Arme : `pvpAttack3`, `baseBreath2`, `burnedDamage1`, `frozenDamage1`,
  `poisonedDamage1`. Armure : `defense3`, `speed3`, `maxEnergy3`, `maxBreath1`. (L'ancien mode `auto` n'autorisait que
  `pvpAttack3` et `defense3`, et 3 objets par emplacement.)
- **Recherche** : descente par blocs (arme × enchantement, armure × enchantement, objet + potion), chaque classe jouée avec
  ses 3 meilleurs familiers contre un terrain de toutes les classes elles-mêmes optimisées, jusqu'à ce qu'un round ne change
  plus rien. Chaque bloc est évalué sur des combats appariés (mêmes tirages pour chaque candidat), puis les 5 meilleurs
  candidats sont rejoués sur 12 000 combats chacun.
- **Familiers** : avec cet équipement, toutes les combinaisons classe × familier (3,2 millions de combats), puis
  ré-optimisation de l'équipement avec les nouveaux meilleurs familiers, puis méta entre les 12 meilleurs familiers de chaque classe.
- Deux scénarios : **avec potion** (chacun a la meilleure potion de combat) et **sans potion**.

### 1.2 Trois protocoles de combat
| Protocole | Attaquant | Défenseur | Ce qu'il mesure |
|---|---|---|---|
| **Équilibre des règles** | réseau des gardes | réseau des gardes | les classes à niveau de jeu égal et élevé des deux côtés |
| **PvP réaliste** | moteur au niveau humain (expectimax) | IA de défense scriptées de develop (personnalité au hasard) | ce que vivent les joueurs : un humain attaque l'IA d'un autre joueur |
| **Terrain réel** (méthode de la PR) | moteur au niveau humain | IA de défense scriptées | les vrais joueurs 100+ avec leur vrai équipement, pondérés comme les vrais combats, écart humain de la prod appliqué |

Le PvP réaliste et le terrain réel utilisent le même moteur ; la seule différence est l'équipement (optimal contre réel).
Les scores sont la moyenne attaque/défense, en % de victoires (nul = ½). Sauf mention, chaque classe pèse autant
(pondération « uniforme ») ; la pondération « terrain réel » donne aux adversaires leur part dans les vrais combats
(46 % de Chevaliers).

## 2. Les classes avaient-elles un mauvais équipement dans les mesures de l'équilibrage ?

Il y a eu trois mesures successives :

1. La toute première étude classes × familiers (04/11) donnait à **tout le monde l'équipement du n°1 de la prod**
   (un Fantassin : arme 89 `pveAttack3`, armure 13 `defense3`, potion et objet de vitesse). Aucune classe sauf le Fantassin
   n'avait le sien. Tu l'avais relevé et elle avait été refaite avant de décider quoi que ce soit.
2. L'étude « équipement égal » de la PR (mode `auto`), celle qui a guidé l'équilibrage : chaque classe choisissait parmi
   3 armes, 3 armures, 3 objets et 3 potions portés en prod, avec `pvpAttack3` et `defense3` seulement et le familier Lion.
   Comparaison avec l'optimum de cette nuit (tous les objets non dominés, tous les enchantements, meilleurs familiers, terrain
   lui-même optimisé), même build, même réseau, tous familiers, avec potion :

   | Classe | Équipement `auto` (PR) → optimal | Score PR (`auto`) | Score optimal | Écart |
   |---|---|---|---|---|
   | Fantassin | armure 13 `defense3` → armure 61 `maxEnergy3` ; objet vitesse → attaque ; potion attaque → vitesse | 47,8 | 46,6 | −1,2 |
   | Tank | Sabre → Plothammer ; armure 13 → Armure électrifiée (94) ; **objet défense → attaque** | 49,1 | **53,6** | **+4,5** |
   | Canonnier | identique | 44,3 | 43,4 | −0,9 |
   | Chevalier | identique (sans potion aussi) | 52,6 | 49,6 | **−3,0** |
   | Paladin | `defense3` → `maxEnergy3` ; objet défense → vitesse | 50,8 | 52,2 | +1,4 |
   | Vétéran | armure 62 → 37 ; objet vitesse → défense ; potion défense → vitesse | 53,0 | 53,3 | +0,3 |
   | Mage | objet défense → vitesse ; potion vitesse → défense | 52,2 | 51,2 | −1,0 |
   | **Écart** | | 8,7 | 10,2 | |

   - **Le Tank était le plus mal équipé** : avec objet et potion d'attaque, il gagne 4,5 points à niveau égal.
   - Le Chevalier perd 3 points sans avoir changé d'équipement : ce sont les autres classes, mieux équipées, qui le battent plus.
   - Pour les autres, l'écart reste dans 1,4 point : le classement de la PR à niveau égal tenait, sauf pour le Tank.
3. Le terrain réel prend l'équipement actuel des joueurs. **Toutes les classes** sont loin de leur optimum (armes et armures
   surtout à +0, peu d'enchantements), et chacune dans sa stat faible : Canonnier 40 % de la défense optimale, Mage 28 % de la
   vitesse, Tank 56 % de l'attaque, Chevalier et Vétéran 56 à 59 % de la défense, Paladin 70 % de l'attaque. Quand tout le monde
   passe à l'optimum (même protocole, §4.2), **le Mage gagne 12 points**, le Chevalier en perd 5, le Paladin et le Fantassin 3,
   les autres bougent de 1,6 point au plus.

### Pourquoi l'optimum comble la faiblesse de chaque classe
La puissance d'une stat en combat est `120·tanh(0,00123·stat − 0,03) + 3` (`FightActionController.statToStatPower`) :
les rendements sont décroissants. Un bonus plat d'objet ou de potion vaut donc le plus **sur la stat la plus faible de la classe**.
L'équipement optimal comble les faiblesses au lieu de renforcer les points forts :

| Classe | Point faible de base (niv. 157) | Ce que l'optimum y met |
|---|---|---|
| Canonnier | défense 215 | armure défense, objet et potion de défense |
| Tank | attaque 430 | objet (Diamant Kéraunique) et potion (Huile de ghost pepper) d'attaque |
| Mage | vitesse 179 | objet de vitesse (Fleur de l'espoir) |
| Paladin | vitesse 107 | objet de vitesse, potion d'attaque |

C'est l'inverse de ce que font les joueurs (ils renforcent l'identité de leur classe), et ça dilue cette identité :
un Canonnier optimal est blindé, un Tank optimal frappe fort.

## 3. Équipement optimal de chaque classe

Toutes les armes et armures à +5. Avec potion (puis sans, si différent) :

| Classe | Arme | Armure | Objet | Potion | Ancien `auto` (PR) |
|---|---|---|---|---|---|
| Fantassin | Épée du Dragon (89) `pvpAttack3` (sans potion : Electektron 96) | Cri UwUrlant (61) `maxEnergy3` (sans : Pare-feu 70) | Diamant Kéraunique (3, attaque) (sans : Fleur de l'espoir 4) | Grande Potion (4, vitesse) | armure 13 `defense3`, objet vitesse, potion attaque |
| Tank | Plothammer (87) `pvpAttack3` (sans : Sabre 27) | Armure électrifiée (94) `defense3` | Diamant Kéraunique (3, attaque) | Huile de ghost pepper (46, attaque) | Sabre, armure 13, **objet défense** |
| Canonnier | Épée du Dragon (89) `pvpAttack3` | Cri UwUrlant (61) `defense3` | Amulette cyclonique (38, défense) | Jus de kiwi (52, défense) | **identique** |
| Chevalier | Épée du Dragon (89) `pvpAttack3` | Cri UwUrlant (61) `defense3` (sans : Bouclier ultime 13) | Fleur de l'espoir (4, vitesse) | Jus de kiwi (52, défense) | identique |
| Paladin | Épée du Dragon (89) `pvpAttack3` | Bouclier ultime (13) `maxEnergy3` (sans : Armure électrifiée 94) | Fleur de l'espoir (4, vitesse) | Huile de ghost pepper (46, attaque) | armure `defense3`, **objet défense** |
| Vétéran | Épée du Dragon (89) `pvpAttack3` | Conventions de Genève (37) `defense3` | Amulette cyclonique (38, défense) (sans : Fleur de l'espoir 4) | Grande Potion (4, vitesse) | armure 62, objet vitesse, potion défense |
| Mage | Épée du Dragon (89) `pvpAttack3` | Bouclier ultime (13) `defense3` | Fleur de l'espoir (4, vitesse) (sans : Amulette 38) | Jus de kiwi (52, défense) | objet défense, potion vitesse |

- L'enchantement d'arme optimal est **toujours `pvpAttack3`** ; `baseBreath2` et les enchantements d'altération ne gagnent jamais.
- `speed3` n'est jamais optimal (même pour le Canonnier) ; `maxEnergy3` l'est pour le Fantassin et le Paladin.
- Les différences entre deux options proches sont souvent de moins d'un point : l'optimum est plat.

Meilleurs familiers avec cet équipement (avec potion) : Fantassin Élan, Mammouth, Féetaud ; Tank Chauve-souris, Tortue,
Gorille ; Canonnier Féetaud, Chauve-souris, Raton laveur ; Chevalier Chauve-souris, Corbeau, Tigre ; Paladin Élan, Tortue,
Rhinocéros ; Vétéran Chauve-souris, Mammouth, Lion ; Mage Canard écarlate, Colombe, Tortue.

### L'équipement des vrais joueurs 100+ (prod du 07/11)
- Armes et armures surtout à **+0** (5 armes sur 130 à +5) ; 89 armures sur 130 sans enchantement ; 31 joueurs sans potion,
  les autres surtout des potions de faible rareté ou hors combat.
- Par rapport à l'optimum de leur classe, à niveau égal : Canonnier 40 % de la défense, Mage 28 % de la vitesse,
  Tank 56 % de l'attaque, Chevalier et Vétéran 56 à 59 % de la défense, Paladin 70 % de l'attaque.

## 4. Résultats

### 4.1 PvP réaliste avec équipement et familiers optimaux (le plus proche du jeu)
Moteur au niveau humain contre les IA de défense scriptées, chaque classe avec son équipement optimal et ses 3 meilleurs
familiers, niveau 157, 100 combats par duel et par build, mêmes combats sur la prod 6.1.1 et sur develop.

| Classe | Sans potion : prod → develop | Avec potion : prod → develop | Avec potion, pondération terrain réel : prod → develop |
|---|---|---|---|
| Fantassin | 45,0 → 48,2 | 49,5 → 51,4 | 44,6 → 54,2 |
| Tank | 54,5 → **45,0** | 51,8 → 48,2 | 46,5 → 44,2 |
| Canonnier | 50,5 → 48,9 | 50,8 → 49,5 | 45,8 → 51,7 |
| Chevalier | 63,0 → 52,8 | 62,9 → 47,7 | 56,3 → 48,4 |
| Paladin | 46,2 → 51,4 | 43,2 → **45,8** | 34,8 → **43,6** |
| Vétéran | 54,6 → 49,9 | 52,9 → 49,7 | 50,9 → 57,9 |
| Mage | 36,2 → 53,8 | 38,9 → **57,7** | 34,8 → **59,0** |
| **Écart** | **26,8 → 8,8** | **23,9 → 11,9** | **21,5 → 15,4** |
| Victoires de l'attaquant | 72,1 → 67,0 | 74,1 → 68,6 | |

- **L'équilibrage tient avec un équipement optimal** : l'écart est divisé par 2 à 3, et sans potion toutes les classes sont
  entre 45 et 54, le Tank le plus faible, comme voulu.
- Une deuxième graine (autres combats) donne les mêmes chiffres à 1,3 point près.
- **Avec potion, le Mage sort du lot** (57,7) : sa potion de défense comble sa faiblesse, et son IA de défense est la meilleure
  (42,5 % de défenses réussies). Le **Paladin est le plus faible** (45,8) : son IA de défense ne gagne que 18,6 % de ses défenses.

### 4.2 Même protocole, équipement réel contre équipement optimal (develop)
| Classe | Équipement réel (terrain réel non pondéré) | Optimal avec potion | Optimal sans potion | Terrain réel (méthode PR) |
|---|---|---|---|---|
| Fantassin | 54,4 | 51,4 | 48,2 | 57,2 |
| Tank | 46,7 | 48,2 | 45,0 | 42,3 |
| Canonnier | 51,1 | 49,5 | 48,9 | 52,9 |
| Chevalier | 52,5 | 47,7 | 52,8 | 48,9 |
| Paladin | 49,1 | 45,8 | 51,4 | 48,2 |
| Vétéran | 50,8 | 49,7 | 49,9 | 53,3 |
| Mage | 45,4 | **57,7** | 53,8 | 51,4 |
| **Écart** | 8,9 | 11,9 | 8,8 | 14,9 |

**La classe qui gagne le plus à optimiser son équipement est le Mage** (+12 avec potion), pas le Canonnier (−1,6).
Les vrais Mages n'ont que 28 % de la vitesse de leur optimum : quand ils s'équiperont mieux, le Mage montera.

### 4.3 Équilibre des règles (réseau des deux côtés)
Combinaisons classe × familier, équipement optimal ; « top 12 » = chaque classe avec ses 12 meilleurs familiers contre
les 12 meilleurs des autres.

| Classe | Avec potion : tous familiers | Avec potion : top 12 | Sans potion : tous familiers | Sans potion : top 12 | PR (équipement `auto`, avec potion) |
|---|---|---|---|---|---|
| Fantassin | 46,6 | 44,5 | 43,6 | 42,2 | 47,8 |
| Tank | 53,6 | **54,6** | 52,6 | 52,8 | 49,1 |
| Canonnier | 43,4 | 44,1 | 44,5 | 45,3 | 44,3 |
| Chevalier | 49,6 | 48,3 | 52,6 | 50,8 | 52,6 |
| Paladin | 52,2 | 53,9 | 54,3 | **56,8** | 50,8 |
| Vétéran | 53,3 | 51,9 | 54,5 | 53,4 | 53,0 |
| Mage | 51,2 | 52,6 | 48,0 | 48,8 | 52,2 |
| **Écart** | 10,2 | 10,5 | 10,9 | 14,6 | 8,7 |

- Méta (équilibre de Nash du top 12), avec potion : Mage 42 %, Paladin 28 %, Vétéran 23 %, Tank 6 %, les autres ≈ 0.
  Sans potion : Vétéran 32 %, Chevalier 26 %, Tank 22 %, Paladin 18 %, Mage 2 %. La chauve-souris domine toujours les familiers.
- **Contres durs** : le Fantassin ne gagne que 12 à 15 % (avec potion) et 7 % (sans) contre le Tank et le Paladin.
- Le Tank optimal (objet + potion d'attaque, armure lourde) gagne **5 points** par rapport à l'équipement `auto` de la PR.

**Pourquoi ce protocole diverge du PvP réaliste pour le Tank et le Paladin** : le réseau joue le Paladin en enchaînant
l'attaque bouclier (3,35 fois par combat) et le bélier (2 fois) ; dans le PvP réaliste, le moteur qui attaque avec un Paladin
fait pareil (3,2 boucliers, l'IA adverse passe 46 % de ses tours sous contrôle). Mais quand le Paladin et le Tank défendent,
leurs IA scriptées n'ont droit qu'à un bouclier affaiblissant par combat (choix de #5062 contre les IA « cancer ») :
22 à 26 % de contrôle seulement. Leur force « à niveau égal » vient donc du contrôle en chaîne, que seul un humain
peut jouer. C'est voulu côté IA ; ça explique que ces deux classes soient fortes à niveau égal, fortes en attaque, et faibles en défense.

### 4.4 Le niveau change tout : au niveau réaliste, le Mage domine
Les joueurs 100+ sont au niveau **115 en médiane** (25 % sous 106, 75 % sous 125, un seul au-dessus de 150) ; toutes les études
précédentes étaient au niveau 157. Les stats de base des classes croissent comme le carré du niveau, pas les objets : à 120, les
objets pèsent 1,6 fois plus lourd qu'à 157, et les plafonds d'arme et d'armure (= stat de base) mordent davantage.

Niveau 120, équipement ré-optimisé pour ce niveau, avec potion :

| Classe | PvP réaliste : prod → develop | Pondéré terrain réel : prod → develop | Équilibre des règles (top 12) |
|---|---|---|---|
| Fantassin | 51,1 → 47,8 | 53,4 → 56,2 | 41,6 |
| Tank | 56,4 → 51,4 | 48,3 → 44,4 | 54,1 |
| Canonnier | 41,8 → 47,0 | 39,6 → 49,3 | **39,4** |
| Chevalier | 57,8 → 46,5 | 53,5 → 47,7 | 52,1 |
| Paladin | 45,6 → 44,6 | 38,4 → **40,1** | 55,1 |
| Vétéran | 52,7 → 49,6 | 55,8 → 59,2 | 50,0 |
| Mage | 44,5 → **63,1** | 42,5 → **65,9** | **57,7** |
| **Écart** | 16,0 → 18,4 | 17,4 → 25,8 | 18,3 |

- **Le Mage est le principal risque de l'équilibrage.** Bien équipé à un niveau réaliste, il gagne 63 % (66 % sur le terrain réel)
  et son IA de défense gagne plus de la moitié de ses défenses. Aujourd'hui, ses joueurs sont mal équipés (28 % de la vitesse
  optimale) et le terrain réel le met à 51,4 ; ça changera dès que les Mages s'équiperont mieux.
- **Pourquoi le Mage** : l'attaque sombre compare l'attaque (la sienne puis celle de la cible) à seulement 15 % et 5 % de la
  défense de la cible. Elle ignore presque la défense, et elle frappe à pleine puissance (×1,7, sans usure) tant que la cible est
  maudite. Quand les autres s'équipent en défense (équipement optimal, ou niveau plus bas où les objets pèsent plus), leurs dégâts
  baissent, pas ceux du Mage.
- Le Canonnier est le plus faible à niveau égal au niveau 120 (39,4), et faible dans le PvP réaliste dès que le niveau baisse
  (voir ci-dessous).

**Contrôles de robustesse au niveau réaliste** (develop) :

| Classe | Niv. 120, équipement A | Niv. 120, équipement B | Niv. 105 (équipement A) | Niv. 120 sans potion |
|---|---|---|---|---|
| Fantassin | 47,8 | 49,1 | 48,9 | 50,3 |
| Tank | 51,4 | 48,8 | 50,3 | 43,4 |
| Canonnier | 47,0 | **42,5** | **39,6** | 47,0 |
| Chevalier | 46,5 | 45,3 | 48,7 | 48,7 |
| Paladin | **44,6** | 52,7 | 49,6 | 49,9 |
| Vétéran | 49,6 | 46,4 | 48,4 | 52,9 |
| Mage | **63,1** | **65,2** | **64,5** | **57,9** |
| **Écart** | 18,4 | 22,7 | 24,9 | 14,4 |

L'équipement A est l'optimum trouvé pour develop, l'équipement B celui trouvé après les modifications de cette branche.
Le réseau les juge presque équivalents, mais face aux IA scriptées certaines options valent ±5 à 8 points : le Paladin
avec l'équipement A (Conventions de Genève `maxEnergy3`, objet de défense, potion de vitesse) fait 44,6 ; seul avec
l'équipement B (Bouclier ultime `maxEnergy3`, objet de vitesse, potion d'attaque) il fait **52,3** (défense 18,6 → 30,9 %).
- **Robuste** : le Mage domine dans tous ces scénarios (58 à 65), le Canonnier est faible dès que le niveau baisse ou que les
  adversaires s'équipent en attaque (39,6 à 47,0).
- **Pas robuste** : la faiblesse du Paladin (44,6) ne vient que de l'équipement choisi pour lui.

### 4.5 Niveau 100 : bien équipé, develop y est moins équilibré que la prod
Le niveau 100 est l'entrée du dernier palier, là où les objets pèsent le plus lourd. Même protocole réaliste, équipement
optimal de niveau 120, avec potion, mêmes combats pour chaque build :

| Classe | Prod 6.1.1 | Develop | Défense ×2 (modification 1) | Modification 1 + énergie du Canonnier 30 → 100 | Modifications 1 + 2 (état final de la branche) |
|---|---|---|---|---|---|
| Fantassin | 53,6 | 48,8 | 48,5 | 47,5 | 49,9 |
| Tank | 54,5 | 49,5 | 51,6 | 50,8 | 52,9 |
| Canonnier | **39,9** | **39,0** | **40,6** | 46,6 | **40,9** |
| Chevalier | **58,7** | 48,2 | 50,2 | 48,8 | 51,2 |
| Paladin | 51,8 | 51,9 | 52,9 | 52,0 | 53,6 |
| Vétéran | 49,0 | 48,0 | 49,4 | 48,4 | 49,8 |
| Mage | 42,5 | **64,6** | 56,9 | 55,9 | 51,8 |
| **Écart** | 18,9 | **25,6** | 16,4 | **9,2** | 12,7 |
| Écart pondéré terrain réel | 20,4 | 31,5 | 21,3 | 15,8 | 21,2 |
| Méta réaliste (Nash) | Chevalier 61 %, Fantassin 23 %, Paladin 16 % | Mage 100 % | Mage 62 %, Canonnier 20 %, Vétéran 18 % | Mage 35 %, Canonnier 28 %, Vétéran 17 %, Paladin 11 %, Fantassin 9 % | Mage 54 %, Canonnier 14 %, Chevalier 10 %, Vétéran 7 %, Tank 6 %, Fantassin 5 %, Paladin 3 % |

- **Au niveau 100 bien équipé, develop est moins équilibré que la prod** : les buffs du Mage de #5062 le font passer de 42,5 à
  64,6. Les modifications de l'attaque sombre ramènent l'écart sous celui de la prod et le Mage dans la moyenne (51,8).
- **Le buff du canon de #5062 n'aide pas le Canonnier au niveau 100** (39,9 → 39,0) : il avait été mesuré au niveau 157.
  L'énergie de départ 30 → 100 le remet à 46,6, mais elle ne tient pas avec les vrais joueurs (ci-dessous).

**Contrôles de robustesse au niveau 100**

1. *Équipement ré-optimisé au niveau 100* (équipement C : l'optimiseur relancé au niveau 100 sur les règles de la branche,
   réseau des deux côtés). À niveau égal, réseau des deux côtés (top 12) : Paladin 57,9, Tank 54,9, Chevalier 53,4, Mage 52,9,
   Vétéran 48,5, Fantassin 42,4, Canonnier 40,1 ; méta Paladin 38 %, Canonnier 21 %, Tank 16 %, Chevalier 15 %, Vétéran 10 %.
   Le même équipement dans le protocole réaliste :

   | Classe | Develop | Modification 1 (défense ×2) |
   |---|---|---|
   | Fantassin | 50,6 | 50,6 |
   | Tank | 51,6 | 53,2 |
   | Canonnier | 44,9 | 44,9 |
   | Chevalier | 44,8 | 45,8 |
   | Paladin | 48,9 | 49,3 |
   | Vétéran | 44,3 | 44,5 |
   | Mage | **65,0** | **61,6** |
   | **Écart** | 20,6 | 17,1 |
   | Méta réaliste (Nash) | Mage 50 %, Canonnier 46 % | Mage 54 %, Canonnier 38 %, Paladin 8 % |

   Le Mage domine toujours sur develop (65,0). Avec cet équipement, l'attaque sombre modifiée ne lui retire que 3,4 points,
   tous en défense : en attaque, le moteur gagne 76 % de ses combats dans les deux cas (97,5 % contre le Tank, 99 % contre le
   Paladin). Il passe par l'attaque empoisonnée (2,6 par combat, 90 % de critiques les deux premiers tours), le vol de souffle
   (2,4) et l'attaque sombre (1,9).

2. *Vrais joueurs de niveau 100 à 109 de la prod du 07/11, avec leur vrai équipement et leur familier* (52 joueurs,
   mêmes combats pour chaque build) :

   | Classe | Prod 6.1.1 | Develop | Modification 1 (défense ×2) | Modifications 1 + 2 (état final) |
   |---|---|---|---|---|
   | Fantassin | 49,0 | 49,9 | 50,0 | 50,1 |
   | Tank | 51,0 | **43,9** | 44,6 | **45,0** |
   | Canonnier | 49,3 | 53,0 | 53,0 | 54,0 |
   | Chevalier | **58,9** | 52,5 | 52,5 | 52,5 |
   | Paladin | 49,3 | 51,1 | 51,0 | 51,7 |
   | Vétéran | 54,8 | 50,1 | 50,5 | 50,7 |
   | Mage | **37,8** | 49,5 | 48,3 | 46,1 |
   | **Écart** | **21,1** | **9,1** | **8,4** | **9,0** |
   | Méta réaliste (Nash) | Chevalier 66 %, Canonnier 27 %, Vétéran 7 % | Vétéran 38 %, Paladin 25 %, Chevalier 19 %, Canonnier 9 %, Mage 8 % | Vétéran 39 %, Paladin 25 %, Chevalier 22 %, Mage 9 %, Canonnier 5 % | Vétéran 61 %, Paladin 23 %, Chevalier 15 % |

   **Pour les joueurs de niveau 100 d'aujourd'hui, develop est bien plus équilibré que la prod** (écart 21,1 → 9,1). Le Mage
   ne déborde que si ses joueurs et leurs adversaires s'équipent de façon optimale. Le Tank y est le plus faible (43,9).

3. *Leviers mesurés au niveau 100*, appariés (mêmes combats), sur la branche :

   | Variante | Équipement A (niv. 120 optimal) | Équipement C (niv. 100 optimal) | Vrais joueurs 100–109 | Terrain réel (méthode PR) |
   |---|---|---|---|---|
   | Branche avec la modification 1 (défense ×2) | Mage 56,9 ; Canonnier 40,6 ; écart 16,4 | Mage 61,6 ; Canonnier 44,9 ; écart 17,1 | Mage 48,3 ; Canonnier 53,0 ; écart 8,4 | Mage 50,8 ; Canonnier 52,8 |
   | + Canonnier énergie 30 → 100 | Canonnier **+6,1** (46,6) ; écart 9,2 | Canonnier **+4,1** (49,0) ; écart 17,1 | Canonnier **+6,1 (59,1)** ; écart 8,4 → **15,7** ; méta Canonnier 68 % | Canonnier +2,9 (55,7, 2e) |
   | + attaque sombre : défense ×2,5 au lieu de ×2 | | Mage −2,5 | Mage −0,6 | Mage −1,4 (49,4) |
   | **+ attaque sombre : usure de départ ×1,6 au lieu de ×1,7** | **Mage −5,6 (50,3) ; écart 9,2 → 5,4** | **Mage −6,2 (55,0) ; écart 17,1 → 10,1** | Mage −1,4 | Mage −1,9 |
   | **État final de la branche** (défense ×2 + usure ×1,6, sans l'énergie du Canonnier, Core compilé) | Mage 51,8 ; Canonnier 40,9 ; écart **12,7** | | Mage **46,1** (develop 49,5) ; écart 9,0 (develop 9,1) | |

   Les lignes ×2,5 et ×1,6 sont mesurées avec l'énergie du Canonnier à 100 et appariées avec elle (sauf ×2,5 sur le terrain
   réel, apparié avec la branche).

   - **L'usure de départ ×1,6 est le levier qui manquait au niveau 100.** Avec l'équipement C, la défense comptée deux fois
     ne touche que la défense du Mage ; ×1,6 baisse aussi son attaque (75,7 → 67,7). Avec les deux modifications de l'attaque
     sombre et l'énergie du Canonnier, au niveau 100 avec l'équipement A, les 7 classes sont entre 47,4 et 52,7 et la méta
     réaliste les joue toutes (Mage 22 %, Tank 17 %, Vétéran 17 %, Chevalier 15 %, Canonnier 13 %, Paladin 9 %, Fantassin 7 %).
   - Sans l'énergie du Canonnier (état final de la branche), le Mage est dans la moyenne au niveau 100 bien équipé (51,8) et
     c'est le Canonnier qui fixe l'écart (40,9). La méta réaliste y joue encore le Mage à 54 % : il bat les classes qui battent
     les autres (équilibre sensible au bruit, ±1,3 point par duel).
   - Son coût sur les joueurs d'aujourd'hui : −1,4 à −1,9 mesuré seul. Avec les deux modifications, les vrais Mages de niveau 100
     à 109 passent de 49,5 (develop) à 46,1, 2e plus faible derrière le Tank (45,0), mais toujours bien au-dessus de la prod
     (37,8). L'écart entre classes ne bouge pas (9,1 → 9,0).
   - **L'énergie du Canonnier ne tient pas avec les vrais joueurs de niveau 100** : bien équipés ou non, ils gagnent déjà
     (53,0), et +70 d'énergie les mettrait à 59,1 et à 68 % de la méta. Le Canonnier n'est faible que si tous ses adversaires
     s'équipent de façon optimale.

### 4.6 Le build intuitif du Canonnier est mauvais
Même protocole réaliste, en ne changeant que l'équipement d'une classe (mêmes combats) :

| Build | Score |
|---|---|
| Canonnier optimal (défense : Cri UwUrlant `defense3`, Amulette cyclonique, Jus de kiwi) | 49,5 |
| Canonnier avec objet et potion de vitesse | 42,2 (−7,3) |
| Canonnier « attaque » (Sabre, objet et potion d'attaque) | 35,4 (−14,1) |
| Canonnier « canon de verre » (Sabre, armure de vitesse `speed3`, objet et potion de vitesse) | 33,3 (−16,2) |
| Mage « attaque » (Sabre, objet et potion d'attaque) au lieu de vitesse + défense | 39,1 (−18,6) |

C'est le build que portent la plupart des vrais Canonniers. Ce n'est donc pas la mesure qui sous-estimait le Canonnier : ce sont
ses joueurs qui s'équipent à l'inverse de ce qui marche, parce que le jeu ne le dit nulle part et que l'intuition (« canon de verre »
→ attaque et vitesse) est trompeuse avec des rendements décroissants.

### 4.7 Méta réaliste : quelle classe choisirait un joueur qui sait tout ?
Équilibre de Nash sur le choix de classe (une classe pour attaquer et défendre), protocole réaliste :

| Scénario | Prod 6.1.1 | Develop |
|---|---|---|
| Équipement réel | Chevalier 100 % | Chevalier 43 %, Fantassin 34 %, Vétéran 23 % |
| Optimal sans potion, niveau 157 | Chevalier 100 % | **Chevalier 29 %, Vétéran 23 %, Paladin 21 %, Mage 15 %, Fantassin 12 %** |
| Optimal avec potion, niveau 157 | Chevalier 48 %, Vétéran 48 % | Fantassin 54 %, Mage 43 % |
| Optimal avec potion, niveau 120 | — | Mage 100 % |

En prod, le Chevalier est la seule réponse rationnelle, ce qui colle avec la réalité (45 % des joueurs 100+, 14 des 20 meilleurs).
Develop ouvre nettement le jeu, sauf aux niveaux réalistes avec un bon équipement, où le Mage prend toute la place.

## 5. Variantes testées

Chaque variante est rejouée **sur les mêmes combats** que develop (écart apparié). Bruit : environ ±1,3 point par classe
dans le PvP réaliste (vérifié sur une deuxième graine), ±0,3 sur l'équilibre des règles.

### 5.1 Mage
| Variante | Niveau 120 optimal | Niveau 157 optimal | Terrain réel (méthode PR) | Réseau (157) |
|---|---|---|---|---|
| **Attaque sombre : défense comptée à 30 % et 10 % (au lieu de 15 % et 5 %)** | **63,1 → 55,1** ; écart 18,4 → **9,4** | 57,7 → 53,5 ; écart 11,9 → **6,3** | **51,4 → 50,8** | −2,7 |
| Défense comptée à 37,5 % et 12,5 % (×2,5 au lieu de ×2) | équipement B : 65,2 → 57,4 (−7,8 au lieu de −5,3) | | 51,4 → 49,4 | |
| **Usure de départ ×1,6 au lieu de ×1,7 (en plus de la défense ×2)** | niveau 100 : −5,6 (équipement A), −6,2 (équipement C) | | −1,9 ; vrais joueurs 100–109 : −1,4 | |
| Attaque sombre ×1,65 au lieu de ×1,7 | 63,1 → 60,0 | | | |
| Attaque sombre ×1,6 | | | | −6,0 |
| Contre un maudit : ×1,4 au lieu de pleine puissance | 63,1 → 60,7 | | | −2,3 |

La défense comptée à 30 % / 10 % est le levier qui **vise exactement le problème** : elle coupe le Mage là où il déborde
(adversaires bien équipés, niveaux réalistes) et ne touche presque pas les Mages d'aujourd'hui face aux joueurs d'aujourd'hui.
Elle ne suffit pas au niveau 100 bien équipé (§4.5) : le Mage y gagne encore en attaque grâce au poison et au vol de souffle.
L'usure de départ ×1,6 complète : son effet est 3 à 4 fois plus fort au niveau 100 bien équipé (−5,6 à −6,2) que sur les
joueurs d'aujourd'hui (−1,4 à −1,9).

### 5.2 Paladin
| Variante | Niveau 120 optimal | Niveau 157 optimal | Terrain réel (méthode PR) | Réseau, niveau égal (157 / 120)* |
|---|---|---|---|---|
| Énergie de départ 330 → 365 | 44,6 → 45,9 | 45,8 → 48,0 | 48,2 → 49,3 | ≈ +2,2 / +1,7 (Paladin premier) |
| **IA : 2e bouclier affaiblissant à 50 % (au lieu d'un seul)** | 44,6 → 47,2 (défense 18,6 → 24,0 ; contrôle infligé 22 → 27 %) | | 48,2 → 48,2 (non pondéré 49,1 → 49,5) ; contrôle infligé 21 → 27 % | aucun effet (IA seulement) |
| Attaque divine +30 % | 44,6 → 47,7 (défense 18,6 → 24,5, attaque inchangée) | | 48,2 → 49,9 (attaque +1,7) | ≈ +5,1 / +1,1 (Paladin premier) |

\* mesuré avec l'attaque sombre modifiée, moins l'effet de l'attaque sombre seule.

**Conclusion : aucune de ces modifications n'est nécessaire.** Le Paladin ne paraissait faible qu'avec l'équipement choisi
par l'optimiseur au niveau 120 ; avec potion d'attaque et objet de vitesse, il gagne 52,3 % (défense 30,9 %) sans rien changer
(§4.4). Le 2e bouclier, commité cette nuit, a été annulé sur la branche.

Dans le PvP réaliste, la divine semblait n'aider que l'IA (le moteur attaquant la joue 0,21 fois par combat, l'IA 1,45 fois),
mais le réseau, qui joue mieux, s'en sert beaucoup plus, et le terrain réel montre aussi un gain en attaque : des joueurs qui
s'adaptent en profiteraient. Seule la modification d'IA ne peut pas profiter aux Paladins humains.

### 5.3 Autres classes (réseau des deux côtés, niveau 157, top 12, avec potion)
| Variante | Effet sur la classe visée |
|---|---|
| Tank : énergie 400 → 350 / 300 | −3,4 / −7,0 |
| Tank : attaque 60 → 50 | −3,2 |
| Attaque perçante +20 % | Fantassin +3,0 mais Vétéran +4,5 (attaque partagée) : à éviter |
| Attaque puissante +12 % au lieu de +6 % | Fantassin +3,8 |
| Ultime du Paladin comme en prod | Paladin −2,9 |
| Canon +5 % | Canonnier +3,3 |

Attaque puissante sans les +6 % de #5062 (PvP réaliste) : Fantassin 51,4 → 46,9 bien équipé au niveau 157, 57,2 → 55,6 sur
le terrain réel.

### 5.4 Le paquet mesuré : attaque sombre + IA du Paladin
Mesuré dans tous les scénarios réalistes, apparié avec develop (moyenne attaque/défense, chaque classe pèse autant). La partie
IA du Paladin a ensuite été annulée (§5.2) : elle ne bouge que le Paladin (+2 à +3,5), les chiffres du Mage et des autres
classes viennent de l'attaque sombre (seule, au niveau 120 avec potion : Mage −8,0, écart 18,4 → 9,4, §5.1).

| Classe | Niv. 120, potion | Niv. 120, sans potion | Niv. 157, potion | Niv. 157, sans potion | Terrain réel (méthode PR) |
|---|---|---|---|---|---|
| Fantassin | 47,8 → 47,3 | 50,3 → 49,6 | 51,4 → 50,9 | 48,2 → 47,5 | 57,2 → 57,1 |
| Tank | 51,4 → 53,4 | 43,4 → 45,6 | 48,2 → 49,9 | 45,0 → 46,7 | 42,3 → 43,1 |
| Canonnier | 47,0 → 47,2 | 47,0 → 45,8 | 49,5 → 49,4 | 48,9 → 47,2 | 52,9 → 52,8 |
| Chevalier | 46,5 → 48,0 | 48,7 → 49,0 | 47,7 → 48,4 | 52,8 → 53,2 | 48,9 → 48,9 |
| Paladin | 44,6 → **48,1** | 49,9 → 53,0 | 45,8 → 47,8 | 51,4 → 54,0 | 48,2 → 48,4 |
| Vétéran | 49,6 → 50,8 | 52,9 → 53,6 | 49,7 → 50,0 | 49,9 → 49,9 | 53,3 → 53,2 |
| Mage | 63,1 → **55,1** | 57,9 → **53,3** | 57,7 → **53,7** | 53,8 → 51,3 | 51,4 → 50,6 |
| **Écart** | **18,4 → 7,9** | **14,4 → 8,0** | **11,9 → 5,9** | 8,8 → 7,3 | 14,9 → 14,0 |
| Écart pondéré terrain réel | 25,8 → 16,6 | 17,7 → 16,0 | 15,4 → 14,1 | 14,1 → 12,6 | |

Méta réaliste (Nash sur le choix de classe) avec le paquet : niveau 120 avec potion Mage 35 %, Canonnier 23 %, Vétéran 22 %,
Tank 17 % (au lieu de Mage 100 %) ; niveau 157 sans potion Vétéran 36 %, Paladin 24 %, Chevalier 18 %, Mage 13 %, Fantassin 9 %.

- Partout où le Mage débordait, l'écart est divisé par 2 ; sur le terrain réel d'aujourd'hui, rien ne bouge de plus d'un point.
- Le Tank reste le plus faible sur le terrain réel et sans potion.
- Côté réseau (niveau égal), l'attaque sombre baisse le Mage de 2,7 à 5,5 points ; la modification d'IA n'y joue pas.


### 5.5 Canonnier : un buff pour les niveaux réalistes ?
Le Canonnier est faible quand tout le monde est bien équipé à bas niveau (39,6 au niveau 105) : son armure est plafonnée à sa
défense de base (113 au niveau 105, 215 au niveau 157). Variantes mesurées sur la branche (avec l'attaque sombre modifiée),
appariées avec elle :

| Variante | Niveau 105 optimal | Niveau 120 optimal | Niveau 100 optimal (A / C) | Vrais joueurs 100–109 | Terrain réel (méthode PR) |
|---|---|---|---|---|---|
| Canon +8 % | 39,9 → 45,1 ; écart 17,6 → 11,1 | 47,2 → 51,9 | | | 52,8 → **57,1** (à égalité en tête) |
| Énergie de départ 30 → 100 | 39,9 → **47,0** ; écart 17,6 → **9,1** | 47,2 → 51,5 | 40,6 → 46,6 / 44,9 → 49,0 | 53,0 → **59,1** (méta 68 %) | 52,8 → 55,7 (2e) |
| Énergie de départ 30 → 65 | 39,9 → 42,9 ; écart 17,6 → 14,0 | | | | 52,8 → 54,6 |

L'énergie aide plus là où il en a besoin (bas niveau, adversaires bien équipés) et moins sur le terrain réel que le canon.
Les deux le font passer devant presque tout le monde sur le terrain réel d'aujourd'hui, où ses joueurs gagnent déjà grâce
à leur build offensif contre des adversaires peu défendus. Les vrais joueurs de niveau 100 à 109 tranchent : il y gagne déjà
(53,0), et l'énergie à 100 le rendrait dominant.

## 6. Liste des modifications proposées

### À faire
1. **Mage — l'attaque sombre compte 30 % et 10 % de la défense de la cible (au lieu de 15 % et 5 %)** (`de4fe896a`, commité).
   - Problème : à un niveau réaliste et bien équipé, le Mage gagne 63 à 65 % de ses combats et son IA plus de la moitié de ses
     défenses ; la méta réaliste le choisit à 100 %. L'attaque sombre ignore presque la défense : plus les adversaires
     s'équipent en défense (ou plus le niveau est bas, où les objets pèsent plus), plus le Mage domine.
   - Effet : −8,0 au niveau 120 (équipement A), −5,3 (équipement B), −7,0 au niveau 105, −4,0 au niveau 157 ;
     **−0,6 seulement sur le terrain réel** (51,4 → 50,8), parce que les adversaires d'aujourd'hui ont peu de défense.
     L'identité est gardée : elle utilise toujours l'attaque de la cible, s'use, se recharge et frappe un maudit à pleine puissance.
   - Au niveau 100 bien équipé, il reste premier (56,9 à 61,6) : la défense ne pèse pas assez dans ses victoires en attaque.
     D'où la modification 2. À ×2,5 (37,5 % et 12,5 %), le Mage ne perdait que 2,5 points de plus au niveau 100 (équipement C)
     pour 1,4 sur le terrain réel : l'usure de départ fait mieux pour le même coût.
   - Description française : « Ignore la défense » → « Tient peu compte de la défense ».
   - Le réseau des gardes du roi n'a pas besoin d'être réentraîné (banc des gardes, mêmes combats : 33,1 sur develop, 33,3
     avec la modification 1, 32,6 avec les deux, ±1,2).
2. **Mage — l'usure de l'attaque sombre démarre à ×1,6 au lieu de ×1,7** (`7f69ba647`, commité, une constante :
   `FightConstants.DARK_ATTACK_WEAR.BASE_MULTIPLIER`).
   - Problème : au niveau 100, là où les objets pèsent le plus, le Mage bien équipé gagne encore 56,9 à 61,6 % de ses combats
     après la modification 1, et 76 % de ses attaques (97 à 99 % contre le Tank et le Paladin).
   - Effet, mesuré avec l'énergie du Canonnier à 100 et apparié : niveau 100 bien équipé −5,6 (équipement A, écart 9,2 → 5,4,
     les 7 classes jouées par la méta réaliste) et −6,2 (équipement C, écart 17,1 → 10,1) ; vrais joueurs de niveau 100 à 109
     −1,4 ; terrain réel −1,9. État final de la branche (les deux modifications, Core compilé) : au niveau 100 bien équipé,
     Mage 56,9 → 51,8 et écart 16,4 → 12,7 ; pour les vrais joueurs de niveau 100 à 109, Mage 49,5 (develop) → 46,1, écart
     inchangé (9,1 → 9,0).
   - **C'est un arbitrage à trancher ensemble** : la modification 2 règle le Mage pour des joueurs bien équipés, mais coûte
     environ 3 points aux vrais Mages de niveau 100 par rapport à develop (ils restent 8 points au-dessus de la prod). Si l'on
     préfère ne pas toucher aux joueurs d'aujourd'hui, garder la modification 1 seule et suivre le Mage par tranche de niveau
     après la sortie ; le commit est isolé pour pouvoir le retirer.
   - Le Mage reste bien au-dessus de la prod pour ses vrais joueurs (37,8 en prod au niveau 100 à 109).
   - L'identité ne change pas : la séquence devient ×1,6, ×1,3, ×1,0, ×0,7… L'IA du Mage lance toujours l'attaque sombre fraîche
     puis une seconde fois (seuil ×1,3) avant de la laisser reposer ; elle la juge usée un usage plus tôt (seuil ×0,8).
     La description française ne cite pas de chiffre, rien à traduire.
   - Ce que j'avais écarté cette nuit (« ×1,65 : −3 seulement là où il domine, et le même effet partout ») était mesuré au
     niveau 120 sans la modification 1 ; au niveau 100, l'effet est 3 à 4 fois plus fort bien équipé que sur les joueurs
     d'aujourd'hui.

Vérification : le Core compilé avec la modification 1 (et le 2e bouclier, annulé depuis) rejoue **exactement** les combats
simulés sans recompiler (0 combat différent sur 4 900, niveau 120 avec potion). Même contrôle pour la modification 2
(0 combat différent sur 4 900, niveau 100, équipement C). Tests Core (1 953) et Lib (636)
passent, lint propre sur les fichiers modifiés.

### À ne pas faire maintenant
- **Canonnier : énergie de départ 30 → 100** (une ligne dans `Core/resources/classes/20.json`, non commitée).
  - Pour : quand tous ses adversaires sont équipés de façon optimale à un niveau réaliste, il est de loin le plus faible
    (39,0 à 44,9 au niveau 100, 39,6 au niveau 105, 42,5 à 47,0 au niveau 120) ; +70 d'énergie le remet à 46,6 à 49,0 au
    niveau 100, 47,0 au niveau 105 et 51,5 au niveau 120, et garde son identité (moins de défense, frappe le plus vite).
  - Contre, et décisif : **avec les vrais joueurs de niveau 100 à 109, il gagne déjà (53,0) et passerait à 59,1, choisi à 68 %
    par la méta réaliste** ; sur le terrain réel, il passerait 2e (55,7). La valeur 65 et le canon +8 % ont le même défaut.
  - À reprendre quand les joueurs s'équiperont mieux (voir « Apprendre aux joueurs à s'équiper ») : c'est à ce moment que sa
    faiblesse apparaîtra.
- **Tank** : pas de nerf. Il est le plus faible sur le terrain réel (42,3) et sans potion (45), comme voulu. Sa force à niveau
  égal (52 à 55) vient de l'objet et de la potion d'attaque et du bouclier en chaîne, que son IA n'a pas le droit de jouer :
  elle ne concerne que les gardes du roi.
- **Fantassin** : le bonus de 6 % de l'attaque puissante reste en observation, comme prévu dans #5062. Le terrain réel le met
  premier (57,2), mais bien équipé il est dans la moyenne (47 à 52). Les retirer ne
  coûterait que 1,6 point sur le terrain réel (57,2 → 55,6) mais 4,5 points bien équipé (51,4 → 46,9) : le Fantassin deviendrait
  faible dès que ses joueurs s'équiperont bien. À décider sur les vrais combats après la sortie.
- **Paladin** : rien. Sa faiblesse apparente venait de l'équipement choisi pour lui (§4.4). Ni énergie, ni divine +30 %,
  ni 2e bouclier de l'IA (essayé puis annulé) : ces leviers le rendraient premier à niveau égal ou ajouteraient du contrôle.
- **Mage** : pas de nerf du bonus contre un maudit (×1,4 : −2,4 au niveau 120, moins ciblé que l'usure de départ).

### Hors chiffres
- **Apprendre aux joueurs à s'équiper.** Rendements décroissants obligent, le meilleur équipement comble la faiblesse de la
  classe. Les builds intuitifs coûtent 16 à 19 points (§4.6) et ce sont ceux de la plupart des joueurs. Une ligne de conseil
  dans la description de chaque classe, ou chez le forgeron, changerait plus l'équilibre réel que n'importe quel chiffre.
  L'idée des affinités d'objets par lignée (branche `design/lineage-affinities`) irait dans le même sens.
- **Mesurer au bon niveau.** Les prochains équilibrages doivent se mesurer au niveau 115–120 avec un équipement optimal, et
  sur le terrain réel ; le niveau 157 ne représente qu'un joueur.
- **Les potions amplifient les écarts** (Mage +4, Paladin −6 au niveau 157 selon qu'on les compte) : à surveiller si les
  potions de combat de haute rareté se répandent.
- **Après la sortie**, suivre par tranche de niveau (100–130) : la part et le taux de victoire du Mage, le taux de victoire
  réel du Fantassin (au-dessus de 55 : retirer les 6 %), le taux de défenses gagnées du Paladin.

## 7. Limites
- Le moteur au niveau humain attaque à pleine énergie et joue un peu mieux que la moyenne des joueurs (66 % contre 63,8 %
  en prod) ; les chiffres « optimal » ne sont pas recalés sur les vrais joueurs, ce sont des écarts entre classes.
- L'équipement optimal a été trouvé avec le réseau des deux côtés ; les tests de builds dans le protocole réaliste (§4.6)
  confirment qu'il y est aussi le meilleur, avec une large marge.
- Les familiers sont les 3 meilleurs de chaque classe selon le réseau ; la chauve-souris domine toujours.
- 100 combats par duel et par scénario : ±1,3 point par classe (vérifié sur une 2e graine). Les équilibres de Nash sont
  sensibles au bruit : à lire comme des tendances.
- Le réseau des gardes du roi n'a pas été réentraîné : les règles changées ne touchent ni son vocabulaire ni ses entrées,
  et le banc des gardes ne bouge pas au-delà du bruit (33,1 → 32,6 ± 1,2 avec les deux modifications de l'attaque sombre).

## 8. Reproduire
Outils : `Crownicles/Tools`, branche `class-pet-study/optimal-gear` (`scripts/class-pet-study`), et `Crownicles/Fight-Simulator-30000`
(`solver/`, note `CONNAISSANCES.md`).

```bash
# 1. équipement + familiers optimaux, puis méta (≈ 15 min par scénario, jamais deux en parallèle)
python3 loadoutSweep.py <checkout>/Core .work/lo.json --pets '{"18": [98, 61, 102], ...}' --level 120 [--potions none]
ITERATIONS=1 ./optimalStudy.sh <checkout>/Core .work/opt120 .work/lo.json best 120
# 2. PvP réaliste avec ces joueurs (≈ 6 min par build)
python3 makeRoster.py .work/opt120/loadouts.json /tmp/roster120 --pets 3 --level 120
cd <Fight-Simulator-30000>/solver
SOLVER_DATA_DIR=/tmp/roster120 node run.js --core <prod>/Core --core <branche>/Core --mode br --engine expectimax \
	--value models/vmix.json --depth 3 --samples 8,3,2 --n 100 --chunk 2 --full-energy --out opt120
node tools/uniformScores.js opt120:0 opt120:1 [--real-weights] [--matrix]; node tools/classNash.js opt120:1
# 3. terrain réel (méthode de la PR) : CORE=<branche>/Core tools/rf.sh <nom> [variante]
# 4. une variante sans recompiler : --set, --class-stat, --dmg, --patch ai/darkDefensePatch.js --patch-options '{...}',
#    --ai ai/shieldChances.js (SHIELD_PALADIN=1,0.5)
```





