# Référence des données d'un event

## Champs d'une issue (`Core/resources/events/<id>.json`)

- `requirements` : conditions pour que l'issue puisse tomber (voir plus bas). Sans `requirements`, l'issue est toujours possible.
- `health` (vie, négatif = blessure), `money` (argent), `fight` (combat contre un monstre, voir « Combats »), `lostTime` (minutes perdues), `karma` (entier, voir plus bas), `effect` (altération), `randomItem` (`{}` = objet au hasard ; `{"rarity": {"min": 3}}` ou `{"category": 0}` possibles), `energy`, `gems`, `tokens`, `bonusExperience`, `bonusPoints`, `randomPet`, `givePet`, `oneshot`, `nextEvent`, `mapTypesDestination` / `mapTypesExcludeDestination` (types des cartes voisines, voir `neighbours[].type` dans ton input), `mapLink`, `goBackToPreviousMap` (demi-tour vers la carte d'où vient le joueur ; exige `mapTypesDestination`, utilisé quand le demi-tour est impossible), `forceStayInCity` / `forceLeaveCity` (villes seulement), `tags` (garde ceux de l'original), `condition` (n'existe qu'avec `canAcceptPet` : garde-le s'il y est), `consumeMaterials` / `giveMaterials` (voir « Cuisine, matériaux et équipement »), `useBed` (le joueur dort dans un lit, voir « Dormir dans un lit »).

## Altérations (`effect`) et leur durée en minutes

`occupied` (durée = `lostTime`), `sleeping` 180, `drunk` 240, `freezing` 60, `feetHurt` 110, `hurt` 300, `sick` 330, `jailed` 1440, `injured` 660, `starving` 50, `confounded` 40, `scared` 15, `lost` 270, `fished` 5, `working` 75, `burning` 25. Utilise celles de l'original en priorité.

`confounded` veut dire **étourdi**, pas « confus » : c'est l'altération d'une petite blessure (un coup, une chute, une morsure légère). Préfère-la à `hurt`, qui dure 5 heures et doit rester pour une vraie blessure. Une simple égratignure n'a pas d'altération.

## Conditions (`requirements`)

Plages `{"min": x, "max": y}` (bornes incluses, l'une ou l'autre facultative) : `level`, `karma`, `health` (vie actuelle), `attack`, `defense`, `speed` (statistiques avec l'équipement). Listes : `validClassIds`, `validPetTypeIds` (le joueur doit avoir un familier de ce type), `petTags` (son familier a au moins un de ces tags, voir « Familiers »). `petRarity` : plage sur la rareté du familier (il en faut un). `campaignCurrentMissionId` : n'y touche pas. Cuisine, matériaux, enchantements et amélioration de l'équipement : voir plus bas.

### Seuils calés sur les joueurs réguliers en production

Mesuré le 21/11/2026 sur les **130 joueurs réguliers** (au moins 3 jours de jeu sur les 14 derniers), stats calculées par le code du jeu, équipement et potion compris. Médianes : niveau 96, attaque 440, défense 340, vitesse 135.

**L'échelle est exigeante** : être dans le premier quart, c'est juste « correct » ; « fort » veut dire vraiment fort (premier dixième) ; « exceptionnel », les tout meilleurs. Choisis le mot du texte en fonction du seuil, et inversement.

| Le texte décrit… | niveau | attaque | défense | vitesse | joueurs réguliers |
|---|---|---|---|---|---|
| un débutant | `max` 30 | `max` 90 | `max` 60 | `max` 10 | 10 % |
| un joueur encore faible | `max` 55 | `max` 230 | `max` 180 | `max` 40 | 25 % |
| un joueur correct, pas nul | `min` 120 | `min` 600 | `min` 520 | `min` 350 | 25 % |
| un joueur fort, un vétéran | `min` 130 | `min` 700 | `min` 740 | `min` 500 | 10 % |
| un joueur exceptionnel, une légende | `min` 140 | `min` 780 | `min` 860 | `min` 560 | 5 % |

Un niveau 60 est encore le début du jeu pour un joueur régulier : ne le décris jamais comme expérimenté.

Autres repères :
- **Beaucoup de joueurs sont encore Recrue** (classe 0). Une condition sur une seule classe avancée concerne 1 à 3 % des joueurs : c'est voulu, des issues rares rendent l'event plus riche.
- **51 % des joueurs ont un familier.** Un type précis (Chien, Perroquet, Singe…) concerne 0 à 2 % des joueurs : c'est voulu aussi, une part de joueurs concernés très variable d'une issue à l'autre est une bonne chose. Les plus fréquents chez les joueurs : Fantôme (100), Tigre (56), Vampire (101), Jack-o'-lantern (99), Licorne (63), Stitch (66), Bœuf (8), Lion (57), Caniche (2), Porc (9), T-Rex (65), Rongeur (5), Alien (70), Chat noir (4), Chauve-souris (27), Loup (28), Serpent (15), Léopard (60).
- **Le karma n'existe pas encore en production : tout le monde partira de 0.** Une issue rapporte en général 1 à 5 points. Les seuils de karma restent ceux des events déjà réécrits (`min` 0, 50, 80 ou 100, `max` -30 ou -50) : ces issues se débloquent avec le temps.
- Les seuils de niveau et de statistiques suivent l'échelle ci-dessus et correspondent au texte.
- **Chaque épreuve a sa difficulté** (facile, standard, difficile, très difficile) et ses paliers changent d'un event à l'autre : tableau dans `SKILL.md`, section « La difficulté change d'un event à l'autre ». Les paliers s'appuient sur les déciles mesurés : 10 % (attaque 90, défense 60, vitesse 10, niveau 30), 25 % (230, 180, 40, 55), médiane (440, 340, 135, 96), 75 % (600, 520, 350, 120), 90 % (700, 740, 500, 130), 95 % (780, 860, 560, 140).

## Cuisine, matériaux et équipement

Ces conditions s'ajoutent aux autres dans `requirements`. Elles ne consomment rien : un matériau de `requirements.materials` est seulement vérifié, jamais retiré. Le texte ne doit donc pas dire que le joueur l'use ou le perd. Pour qu'une issue utilise vraiment un matériau, voir « Consommer ou donner des matériaux » plus bas.

| Condition | Forme | Ce qu'elle vérifie |
|---|---|---|
| `cookingLevel` | plage `{"min": x, "max": y}` | le niveau de cuisine du joueur |
| `materials` | `{"type": "rope", "ids": [12, 47], "rarity": {"min": 3}, "quantity": {"min": 5}}`, chaque filtre est facultatif | la quantité totale des matériaux qui passent tous les filtres ; par défaut au moins 1 ; `"quantity": {"max": 0}` veut dire « n'en a aucun » |
| `enchantment` | `{"slot": "weapon", "types": ["magic"], "kinds": ["burnedDamage"], "level": {"min": 2}}`, chaque filtre est facultatif ; `{}` = n'importe quel enchantement | l'arme ou l'armure équipée (ou seulement `slot`) porte un enchantement qui passe tous les filtres |
| `weaponLevel`, `armorLevel` | plage | le niveau d'amélioration de l'arme ou de l'armure équipée, de 0 à 4 (forgeron) |
| `weaponTags` | liste de tags | l'arme équipée porte au moins un de ces tags : `blunt` (arme lourde qui frappe : marteau, pioche, masse, poêle, chaise…), `fire`, `ranged` (arc, pistolet, bombe), `metallic`, `holy` |

Les tags d'arme sont dans `Core/resources/weapons/<id>.json` (champ `tags`) et `ItemConstants.TAGS`. Même règle que pour les familiers : un tag pour une capacité partagée par plusieurs armes et utile à d'autres events (forcer, couper, tirer de loin), pas pour une arme isolée.

**Repères sur les 130 joueurs réguliers** (mesurés le 21/11/2026) :

| Le texte décrit… | Condition | Part des joueurs |
|---|---|---|
| quelqu'un qui ne sait pas cuisiner | `cookingLevel` `max` 0 | 47 % |
| un cuisinier correct | `cookingLevel` `min` 40 | 25 % |
| un bon cuisinier | `cookingLevel` `min` 70 | 10 % |
| un chef | `cookingLevel` `min` 90 | 5 % |
| un joueur qui a un matériau d'un type donné | `materials` `type` | 75 à 85 % |
| un joueur qui a un matériau précis | `materials` `ids` | 45 à 80 % selon le matériau (les rares autour de 50 %) |
| un joueur sans aucun matériau | `materials` `quantity` `max` 0 | 7 % |
| une arme enchantée / une armure enchantée | `enchantment` `slot` | 59 % / 40 % |
| un enchantement magique (feu, givre, venin) | `enchantment` `types` `["magic"]` | 6 % |
| un enchantement de niveau III | `enchantment` `level` `min` 3 | 33 % |
| une arme améliorée chez le forgeron / beaucoup améliorée | `weaponLevel` `min` 1 / `min` 3 | 52 % / 17 % |

Les matériaux sont très répandus : une condition de matériau ne raconte pas un joueur rare, elle raconte ce qu'il a dans son sac. Pour qu'elle reste crédible, vise des matériaux qui correspondent au texte. Le type `rope` regroupe les cordes et les tissus : pour une corde, utilise `ids` (12 Corde de chanvre tressé, 47 Corde de jute, 49 Corde tressée en cuir), pas le type entier. La liste complète : `Core/resources/materials/<id>.json` (type, rareté) et `Lang/fr/models.json`, clé `materials` (nom).

### Consommer ou donner des matériaux

Deux champs d'issue, avec les mêmes filtres que la condition (`type`, `ids`, `rarity`) et une `quantity` entière positive :

- `consumeMaterials` retire cette quantité parmi les matériaux du joueur qui passent les filtres, en commençant par ceux qu'il a en plus grand nombre. L'issue n'est possible que si le joueur en a assez : pas besoin d'ajouter la condition `materials`, mais il faut une autre issue pour ceux qui n'en ont pas. Exemple : `"consumeMaterials": {"ids": [12, 47, 49], "quantity": 1}`, le joueur sacrifie une corde pour descendre la falaise.
- `consumeMaterials` accepte aussi une **liste** de filtres, tous exigés, quand l'objet fabriqué demande plusieurs matériaux : `"consumeMaterials": [{"type": "wood", "quantity": 1}, {"type": "metal", "quantity": 2}]`, le joueur taille un manche et y fixe des dents de métal (event 9). Les filtres d'une liste ne doivent pas se recouvrir.
- **Ce qu'on fabrique doit être crédible avec ce qu'on consomme.** Une fourche demande un manche et des dents de métal, pas une branche fourchue trouvée par hasard ; un radeau demande du bois et de quoi le lier. Le joueur qui n'a pas les matériaux a sa propre issue, crédible elle aussi (réparer un vieil outil trouvé sur place, par exemple).
- `giveMaterials` donne cette quantité d'**un** matériau tiré au hasard parmi ceux qui passent les filtres. Exemple : `"giveMaterials": {"type": "wood", "quantity": 3}`, le joueur ramasse des branches. Le gain compte pour la mission « collecter des matériaux ».

Le jeu affiche le matériau utilisé ou obtenu sous l'issue : comme pour l'argent, le texte n'en donne ni le nom exact ni la quantité. Il dit ce que le joueur fait (*vous sacrifiez une corde*, *vous ramassez du bois sec*), et le matériau doit correspondre au texte. Garde le coût raisonnable : 1 à 3 matériaux courants, ou 1 rare quand l'issue rapporte beaucoup.

Types de matériaux : `metal` métal, `alloy` alliage, `nature` plantes, `spiritual` objets spirituels (encens, bougie, eau purifiée), `magic` magie (rune, plume de phénix), `leather` cuir, `rope` cordes et tissus, `poison` poisons et champignons, `explosive` poudres et produits chimiques, `wood` bois.

Enchantements : types `damage` (attaque), `defense`, `speed`, `health` (énergie max), `magic` (aspects de feu, de givre, de venin), `other` (souffle). Les `kinds` précis sont `pvpAttack`, `pveAttack`, `allAttack`, `defense`, `speed`, `maxEnergy`, `baseBreath`, `maxBreath`, `burnedDamage`, `frozenDamage`, `poisonedDamage`. Les armes portent les enchantements d'attaque, de magie et de souffle de base ; les armures ceux de défense, de vitesse, d'énergie et de souffle max.

## Argent du joueur (`money` dans `requirements`)

`"requirements": {"money": {"min": 100000}}` : une plage sur les pièces que le joueur porte au moment de l'event. À ne pas confondre avec le champ `money` de l'issue, qui donne ou retire des pièces.

Part des 187 joueurs actifs sur 14 jours (mesurée le 22/11/2026). La plupart ont beaucoup d'argent : la médiane est autour de 30 000.

| Le texte décrit… | `money` | Joueurs actifs |
|---|---|---|
| un joueur fauché | `max` 5 000 | 9 % |
| un joueur qui compte ses pièces | `max` 20 000 | 36 % |
| un joueur à l'aise | `min` 50 000 | 39 % |
| un joueur riche | `min` 100 000 | 19 % |
| un joueur très riche | `min` 200 000 | 7 % |
| une fortune | `min` 500 000 | 3 % |

- La richesse se **montre** : une bourse qui tinte, des vêtements fins, un marchand qui flaire le client, un pickpocket qui vous repère. Le texte ne donne jamais le montant.
- Elle sert aussi de garde-fou : une issue où le joueur **paie** (`money` négatif, tag `moneyUsage`) peut exiger qu'il ait de quoi payer, et une autre issue raconte le joueur qui n'a pas assez.
- Comme pour une stat, un riche n'a pas que des avantages : on lui gonfle les prix, on cherche à le détrousser.

## Combats (`fight`) et énergie (`energyPercent`)

`"requirements": {"energyPercent": {"min": 40}}` : l'énergie de combat qu'il reste au joueur, en pourcentage de son maximum (0 à 100). Elle baisse après chaque combat et remonte avec le temps.

Une issue peut déclencher un combat :

```json
"8": {
  "requirements": {"level": {"min": 20, "max": 79}, "energyPercent": {"min": 40}},
  "fight": {
    "monster": "bandit",
    "level": 40,
    "won": {"money": 150, "experience": 40},
    "lost": {"money": -150, "health": -15}
  }
}
```

- `monster` : un fichier de `Core/resources/monsters`. Les monstres sans île (`"maps": []`) sont réservés aux events : `bandit` (détrousseur rapide), `corruptGuard` (garde corrompu, bouclier), `mercenary` (épée à louer), `boar` (sanglier), `giantFish` (poisson géant). Les monstres des îles servent aussi quand la scène s'y prête (`skeleton` dans le château en ruine de l'event 16).
- Repères : un monstre de même niveau que le joueur fait un combat équilibré ; un écart de 30 niveaux le rend facile ou difficile. Varie les tranches et les niveaux selon l'adversaire, par exemple :

  | Adversaire | Joueurs | Monstre |
  |---|---|---|
  | brigand blessé (event 25), faux récolteur (event 50), sanglier ordinaire (event 17) | 10 à 49-64 | 15 à 20 |
  | brigand, garde, mercenaire ordinaire | 15-30 à 69-99 | 30 à 65 |
  | chef de bande, vieux mâle, garde chevronné | 50-90 et plus | 85 à 120 |
  | chef des mercenaires (event 47), vieux mercenaire (event 36), seigneur squelette (event 16) | 95-100 et plus | 125 à 140 |

  La récompense d'un combat gagné suit le niveau du monstre : environ 2 à 5 pièces et 0,8 point d'expérience par niveau.
- `level` : fixe. Un monstre au niveau du joueur est un vrai combat ; 20 niveaux de moins, une formalité. Borne `level` dans `requirements` pour que le combat reste à la mesure des joueurs qui le reçoivent.
- `won` / `lost` : `money`, `health`, `experience`, `effect` + `lostTime`, `randomItem`. Un nul compte comme une victoire (l'adversaire renonce). Un combat perdu vide déjà l'énergie du joueur : la perte reste modérée.
- `energyPercent.min` d'au moins 1 est obligatoire (validateur et tests) : sans énergie, le joueur perdrait d'office.
- Textes dans `possibilities.<choix>.fights.<issue>` : `{"won": "...", "lost": "..."}`. Le validateur exige les deux.

## Badges (`badges`)

`"badges": ["master_chef", "animal_lover"]` : le joueur possède au moins un de ces badges. Seuls les badges gagnés **dans le monde du jeu** sont permis, ceux qu'un personnage peut connaître ou deviner (`EVENT_OUTCOME_BADGES` dans `Lib/src/types/Badge.ts`) ; le validateur et les tests refusent les autres. Les badges hors fiction (équipe, donateurs, concours, bugs signalés, votes, anciens classements) n'entrent jamais dans un event. Le badge `rich`, acheté une fois à la Bourse, n'y entre pas non plus : la richesse se lit dans l'argent que le joueur porte (condition `money`, plus bas).

Part des 186 joueurs actifs sur 14 jours (mesurée le 22/11/2026) :

| Badge | Ce qu'il raconte dans le monde | Joueurs actifs |
|---|---|---|
| `powerful_guild` | membre d'une guilde puissante | 51 % |
| `very_powerful_guild` | membre d'une guilde très puissante | 33 % |
| `mission_completer` | badge acheté au Marché royal : un « maître des quêtes » | 28 % |
| `legendary_pet` | a dressé un familier puissant | 27 % |
| `expert_expediteur` | a mené de nombreuses expéditions avec son familier | 12 % |
| `sentimental_crafter` | a fait perfectionner au plus haut niveau, par le forgeron royal, un objet sans valeur | 7 % |
| `oracle_patron` | a beaucoup contribué aux bénédictions de l'Oracle | 4 % |
| `top_glory` | a remporté le plus de gloire d'une saison de combat : un combattant célèbre | 3 % |
| `master_chef` | cuisinier émérite, niveau 100 de cuisine | 2 % |
| `animal_lover` | a montré tous les familiers à Talvar le nain | 0 % (badge très rare) |

Comme pour le karma, le badge se **montre** : un personnage reconnaît le joueur, ou réagit à ce qu'il a fait (*le forgeron reconnaît celui qui a fait perfectionner une babiole sans valeur par le forgeron royal*, *un dresseur a entendu parler de votre familier*). Le texte ne nomme jamais le badge. Choisis un badge en lien avec la scène, et une issue à badge reste un bonus : il faut toujours une autre issue pour les joueurs qui ne l'ont pas.

## Dormir dans un lit (`useBed`)

Tous les lits du jeu partagent une recharge de 24 heures : le lit de la maison, celui de l'appartement et les chambres d'auberge. Une issue où le joueur dort dans un lit (une chambre ou un dortoir d'auberge, le lit ou la paillasse d'un hôte, la couchette d'un poste de garde) pose `"useBed": true`, avec `"effect": "sleeping"`.

- L'issue n'est possible que si le joueur n'a pas dormi dans un lit pendant la recharge, comme une issue qui consomme des matériaux : il faut une autre issue pour le joueur dont le lit est en recharge (le validateur le vérifie).
- Elle lance la recharge : le joueur ne pourra plus louer de chambre ni dormir chez lui avant 24 heures.
- Pas de `useBed` quand le joueur s'endort ailleurs que dans un lit (contre un arbre, sur un banc, sous une tente avec une couverture) : ce n'est pas un repos dans un lit.


Il commence à 0 et n'est pas borné. Une issue le change de -1 à -5 pour une petite faute, de -10 à -20 pour un acte grave, de +1 à +5 pour un geste correct, de +8 à +15 pour un acte vraiment généreux. Une issue conditionnée par le karma montre comment le monde traite le joueur selon sa réputation, sans la nommer : on le reconnaît, on se méfie de lui, on lui fait confiance.

**Presque chaque interaction avec un humain change le karma**, dans le sens de ce que fait le joueur : aider, partager, être aimable (+) ; voler, mentir, menacer, laisser tomber quelqu'un (-). Pas de karma quand le joueur est la victime, subit un accident ou ne fait que croiser quelqu'un. L'intention compte plus que le résultat : aider et échouer rapporte quand même un peu.

## Classes (`validClassIds`)

0 Recrue, 1 Combattant, 2 Soldat, 3 Fantassin, 4 Ganté, 5 Casqué, 6 Maillé, 7 Tank, 8 Lanceur de pierre, 9 Frondeur, 10 Archer, 11 Canonnier, 12 Écuyer, 13 Cavalier, 14 Piquier, 15 Chevalier, 16 Paladin, 17 Vétéran, 18 Fantassin puissant, 19 Tank impénétrable, 20 Canonnier redoutable, 21 Chevalier valeureux, 22 Paladin lumineux, 23 Vétéran chevronné, 24 Mage mystique

## Familiers (`validPetTypeIds`, rareté de 1 à 8)

Voir `Core/resources/pets/<id>.json` (rareté) et `Lang/fr/models.json`, clé `pets` (nom `<id>_male`). Exemples parlants : 1 Chien, 3 Chat, 15 Serpent, 20 Renard, 24 Singe, 28 Loup, 54 Perroquet, 58 Aigle, 64 Dragon, 65 T-Rex, 84 Diplodocus, 91 Gorille, 95 Corbeau.

**Familier en expédition.** Un familier parti en expédition ne compte pas pour les conditions de familier (`validPetTypeIds`, `petTags`, `petRarity`), sauf si le joueur a le talisman de clonage : le joueur est alors traité comme s'il n'avait pas de familier.

**Capacités : la condition `petTags`.** Quand l'issue repose sur une capacité que plusieurs familiers partagent, la condition vise le tag, pas une liste d'ids : `"petTags": ["flying"]`. Le familier doit avoir au moins un des tags listés. Le texte dit alors *votre familier*, et ce qu'il fait convient à chaque animal qui a le tag. Un nouveau familier tagué est pris en compte tout seul. Le joueur voit les tags de son familier chez le vétérinaire (ligne « Aptitudes ») : un nouveau tag demande son libellé dans `Lang/<langue>/models.json`, clé `petTags`.

| Tag | Capacité | Familiers (dans `Core/resources/pets/<id>.json`, champ `tags`) |
|---|---|---|
| `flying` | vole | 11 Oiseau, 12 Canard, 26 Hibou, 27 Chauve-souris, 33 Cygne, 34 Flamant rose, 54 Perroquet, 58 Aigle, 62 Colombe, 64 Dragon, 68 Canard écarlate, 83 Phénix, 94 Merle, 95 Corbeau, 97 Oie, 102 Féetaud |
| `keenNose` | a du flair (piste, cachette, guet-apens) | 1 Chien, 2 Caniche, 3 Chat, 4 Chat noir, 9 Porc, 20 Renard, 21 Ours, 28 Loup, 29 Sanglier, 37 Blaireau, 42 Ours polaire, 56 Tigre, 57 Lion, 60 Léopard |
| `climber` | grimpe aux arbres (cueillir, guetter, se mettre à l'abri en hauteur) | 3 Chat, 4 Chat noir, 21 Ours, 22 Koala, 24 Singe, 35 Raton laveur, 39 Paresseux, 40 Tamia, 43 Panda, 60 Léopard, 90 Orang-outan, 91 Gorille |
| `mount` | porte le joueur sur son dos | 13 Étalon, 47 Zèbre, 49 Dromadaire, 50 Chameau, 63 Licorne, 87 Cerf, 88 Buffle d'eau, 96 Âne, 98 Élan |
| `heavy` | très lourd (pont, glace, barque) | 31 Hippopotame, 46 Éléphant, 48 Rhinocéros, 61 Mammouth, 65 T-Rex, 84 Diplodocus, 89 Bison |
| `intimidating` | fait peur aux gens et aux bêtes | 21 Ours, 28 Loup, 42 Ours polaire, 45 Crocodile, 48 Rhinocéros, 56 Tigre, 57 Lion, 60 Léopard, 64 Dragon, 65 T-Rex |
| `aquatic` | vit dans l'eau | 71 Poulpe, 73 à 82 (poissons, Méduse, Requin, Baleine, Crevette, Homard, Dauphin), 85 Escargot, 86 Crabe, 103 Oursin |
| `nocturnal` | vit la nuit | 4 Chat noir, 20 Renard, 26 Hibou, 27 Chauve-souris, 28 Loup, 35 Raton laveur, 36 Putois, 37 Blaireau, 41 Hérisson, 93 Rat, 99 Jack-o'-lantern, 100 Fantôme, 101 Vampire |
| `fire` | crache ou porte le feu | 64 Dragon, 83 Phénix |

**Quand créer un tag.** Crée-le quand une capacité est partagée par plusieurs familiers (au moins 4 ou 5) et qu'elle peut resservir dans d'autres events : ajoute-le à `PetConstants.TAGS` (`Lib/src/constants/PetConstants.ts`) et dans le champ `tags` de chaque familier concerné, puis mets ce tableau à jour. Ne crée pas de tag pour un seul familier ou pour un comportement propre à quelques animaux : le chien qui aboie, les petits oiseaux qui se posent sur un instrument ou l'aileron du requin et du dauphin restent des `validPetTypeIds`. Pas de tag non plus quand une donnée existe déjà (le régime `diet`, la rareté `petRarity`).

## Exemple tiré de l'event 19 (réécrit) : la possibilité `butch` (dépecer un renard mort)

```json
{
 "outcomes": {
  "0": {
   "requirements": {
    "karma": {
     "max": -50
    }
   },
   "money": 520,
   "karma": -5,
   "effect": "occupied",
   "lostTime": 40
  },
  "1": {
   "requirements": {
    "attack": {
     "min": 250
    }
   },
   "money": 360,
   "karma": -5,
   "effect": "occupied",
   "lostTime": 25
  },
  "2": {
   "requirements": {
    "validPetTypeIds": [
     1
    ]
   },
   "money": 180,
   "karma": -1,
   "effect": "occupied",
   "lostTime": 45
  },
  "3": {
   "requirements": {
    "validPetTypeIds": [
     20
    ]
   },
   "karma": -6,
   "effect": "sick",
   "health": -10
  },
  "4": {
   "requirements": {
    "karma": {
     "min": 80
    }
   },
   "karma": 3,
   "effect": "occupied",
   "lostTime": 35
  },
  "5": {
   "requirements": {
    "level": {
     "max": 25
    }
   },
   "effect": "sick",
   "karma": -5,
   "health": -18,
   "lostTime": 30
  },
  "6": {
   "requirements": {
    "attack": {
     "min": 320
    },
    "defense": {
     "min": 260
    }
   },
   "randomItem": {},
   "money": 240,
   "karma": -2,
   "effect": "occupied",
   "lostTime": 30
  },
  "7": {
   "money": 140,
   "effect": "occupied",
   "karma": -5,
   "lostTime": 50
  },
  "8": {
   "requirements": {
    "level": {
     "min": 100
    }
   },
   "money": 480,
   "karma": -1,
   "effect": "occupied",
   "lostTime": 30
  },
  "9": {
   "requirements": {
    "level": {
     "max": 50
    }
   },
   "karma": -5,
   "effect": "occupied",
   "lostTime": 25
  }
 }
}
```

L'issue `7` n'a pas de condition : c'est elle qui garantit qu'il reste toujours une issue possible.
