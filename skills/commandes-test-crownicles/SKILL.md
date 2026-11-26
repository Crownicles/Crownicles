---
name: commandes-test-crownicles
description: "Trouve la commande /test Crownicles exacte pour faire quelque chose en jeu (donner un objet ou un familier, changer de niveau, avancer le temps, forcer un événement…), avec les bons IDs. À utiliser pour « comment je me donne… » ou « quelle commande test pour… »."
---

# Commandes test Crownicles

Tu aides les testeurs de Crownicles à trouver la commande `/test` exacte pour faire quelque chose en jeu, avec ses arguments et un exemple concret.

## Règle absolue : ne jamais inventer de commande

- La référence en bas de ce fichier contient toutes les commandes qui existent. Une commande absente de cette liste n'existe pas.
- Ne cite que des commandes de la liste, mot pour mot, avec la syntaxe indiquée.
- Si rien ne correspond, dis-le clairement (« cette commande n'existe pas ») et propose les commandes les plus proches qui existent.

## Trouver un ID

Le fichier `references/crownicles-ids.md` donne les IDs par nom : familiers, armes, armures, potions, objets, matériaux, plantes, classes, lieux, chemins de voyage, missions, grands événements et mini-événements.

- Cherche toujours l'ID dans ce fichier et donne-le directement dans l'exemple (« vampire » → `/test pet 101 m`).
- Pour un familier, le nom demandé donne aussi le sexe : `30 | Phoque (m) / Otarie (f)` signifie qu'une otarie s'obtient avec `/test pet 30 f`. Si le nom est le même pour les deux sexes, utilise `m` et précise que `f` donne la femelle.
- Si un nom est ambigu, propose les quelques IDs possibles.
- Si l'ID n'y est pas, renvoie vers le générateur : https://crownicles.github.io/Tools/generators/ckwalide.html
- Pour les IDs de joueur ou Keycloak (`resetbo3`, `jailplayer`, `aifight`), le testeur doit lancer `/test myids`.

## Utilisation en jeu

- Syntaxe Discord : `/test commande:<nom> <arguments>`. Le champ propose une autocomplétion. Sans argument, `/test` affiche la liste.
- On peut enchaîner plusieurs commandes avec ` && `, par exemple `/test commande:playerlevel 50 && playermoney 100000`.
- Chaque commande accepte aussi ses alias (`lvl 50` est équivalent à `playerlevel 50`).
- `/test help <commande>` affiche l'aide complète, avec la liste des valeurs possibles quand elle est générée par le jeu (`enchant`, `smallEvent`, `witch`, `playereffect`, `guildreward`).
- Les commandes test ne fonctionnent que sur un serveur en mode test, jamais en production.

## Format de réponse

**Commande** : `/test <nom> <arguments>`
**Description** : ce que fait la commande
**Exemple** : `/test <exemple concret avec de vrais IDs>`

Si le besoin demande plusieurs commandes, propose une seule ligne enchaînée avec ` && `. Signale explicitement les commandes de la catégorie Global action.

## Confusions fréquentes

Ces commandes **n'existent pas** :

- `additem`, `petadd`, `padd` → utiliser `giveitem` / `pet`
- `petlevel` → il n'y a pas de niveau de familier modifiable ; voir `petlovepoints`
- `petlove` → la commande s'appelle `petlovepoints`
- `playersuicide` → la commande s'appelle `playerkill` (alias `kill`, `suicide`)
- `resetfurnace` → supprimée
- Aucune commande ne donne une quantité d'objets d'un coup (sauf `givematerial`, et `setfood` pour la nourriture de guilde), et aucune ne cherche un objet par son nom : il faut un ID.

Les commandes de la catégorie **Global action** (`dailytimeout`, `forceweeklytimeout`, `forceseasonend`, `migration`) affectent tous les joueurs du serveur. `migration` peut corrompre les données.

## Référence (119 commandes)

Générée depuis le code du jeu (dépôt Crownicles/Crownicles).

<!-- generated-reference -->

### Blessing (8)

| Syntaxe | Alias | Description |
|---|---|---|
| `/test blessinginfo` | bi | Affiche l'état complet du système de bénédiction |
| `/test contribute <amount>` | cont | Contribue à la cagnotte sans dépenser d'argent (pour tester le déclenchement) |
| `/test resetblessing` | rb | Expire immédiatement la bénédiction active et remet la pool à zéro |
| `/test setpoolage <hours>` | spa | Recule la date de début de la cagnotte de X heures (ex: 84 pour 3j12h) |
| `/test setpool <amount>` | sp | Définit le montant actuel de la cagnotte de bénédiction |
| `/test setpoolthreshold <amount>` | spt | Définit le seuil de la cagnotte de bénédiction |
| `/test simulatethreshold <daysToFill>` | st | Simule le nouveau seuil si la cagnotte était remplie en X jours |
| `/test triggerblessing [type]` | tb | Force le déclenchement d'une bénédiction. Type 1-9, ou aléatoire si non spécifié |

### Event (1)

| Syntaxe | Alias | Description |
|---|---|---|
| `/test listevents` | listevent, le | Affiche tous les événements disponibles par lieu avec leurs IDs. Essentiel pour utiliser /test forcereport avec un ID spécifique |

### Fight (9)

| Syntaxe | Alias | Description |
|---|---|---|
| `/test aifight <player1Id> <player2Id> [amount:1-10000]` | aif, aivs | Lance un ou plusieurs combats entre deux joueurs contrôlés par l'IA (mode silencieux). Les IDs sont les IDs de la table Player (nombres). Paramètre optionnel : amount (1-10000, défaut 1) = nombre de combats. |
| `/test aitournament [fightsPerPair:3-10000] [showDetails:true/false]` | ait, tournament | Lance un tournoi IA entre tous les joueurs niveau 8+ de la base de données. Paramètres optionnels : fightsPerPair (3-10000, défaut 5000), showDetails (true/false, défaut false). |
| `/test clearFightCache` |  | Vide le cache des adversaires récemment attaqués en combat PvP. Permet de retester le matchmaking sans attendre le cooldown. |
| `/test fightcountdown <countdown>` | fcd | Définit le cooldown avant de pouvoir relancer un combat. Utile pour tester les restrictions de timing entre combats consécutifs |
| `/test fightpointslost <lostPoints>` | fpl | Permet de configurer le nombre de point d'énergie manquant au joueur. ex si un joueur a 100 d'énergie au max et execute cette commande avec la valeur 10 il aura 90/100 énergie |
| `/test glorypoints <points> <type>` | glory | Permet de définir les points de gloire d'attaque ou de défense d'un joueur pour tester les mécaniques PvP. Type : 0 = défensif, 1 = attaque |
| `/test kingguardglory [glory]` | kgg | Affiche la cote cachée du joueur face aux gardes du roi, ou la remplace par la valeur donnée. |
| `/test kingguard [guardId]` | kg, garde | Lance immédiatement un combat contre un garde du roi, sans chercher d'adversaire réel. |
| `/test resetbo3 <keycloakId>` |  | Remet à zéro le Best of 3 (série de combats PvP) contre un joueur spécifique. |

### Global action (4)

| Syntaxe | Alias | Description |
|---|---|---|
| `/test dailytimeout` |  | Déclenche manuellement les actions quotidiennes du serveur : actualise la potion du jour, retire des points d'amour des pets, etc. ATTENTION : affecte tous les joueurs |
| `/test forceseasonend` | forcesea | Force la fin de saison complète : réinitialise le classement glorieux, annonce le gagnant, distribue les récompenses et archive les résultats. ATTENTION : affecte tous les joueurs |
| `/test forceweeklytimeout` | forceweektimeout, weektlyimeout, weektimeout | Déclenche manuellement les actions hebdomadaires du serveur : calculs des classements, récompenses de fin de semaine, renouvellement des contenus. ATTENTION : affecte tous les joueurs |
| `/test migration <database> <number>` |  | Teste les migrations de base de données en effectuant un rollback (down) puis une remise à jour (up). Databases : 'logs' ou 'game'. DANGER : peut corrompre les données |

### Guild (12)

| Syntaxe | Alias | Description |
|---|---|---|
| `/test deletejoinguild` | djg | Supprime l'historique de la date d'adhésion à la guilde du joueur testeur. Utile pour tester les mécaniques liées à l'ancienneté en guilde |
| `/test forceguildowner` | fgo | Force le joueur testeur à devenir chef de sa guilde. Utile pour tester les fonctionnalités de leadership et de gestion de guilde |
| `/test forcejoinguild <guildToJoin>` | fjg | Force l'adhésion à une guilde spécifique (par nom de guilde). Quitte automatiquement l'ancienne guilde. Utile pour tester les mécaniques de guilde |
| `/test guildid` | gid, mygid | Affiche l'ID de la guilde du joueur testeur ainsi que des informations de debug sur la guilde (nom, niveau, membres). Utile pour les commandes nécessitant un ID de guilde |
| `/test guildlevel <level>` | glvl | Définit le niveau de la guilde du joueur. |
| `/test guildreward <reward>` | greward | Déclenche une récompense de guilde sans le cooldown (types : `/test help guildreward`) |
| `/test guildpoints <points>` | gpoints, guildscore, gscore | Définit le score total de la guilde du joueur testeur. |
| `/test guildtreasury <treasury>` | gtreasury, guildmoney, gmoney | Définit la trésorerie de la guilde du joueur testeur à la valeur spécifiée. La trésorerie sert aux achats du domaine de guilde (nourriture, améliorations). |
| `/test guildxp <experience>` | gxp | Définit l'expérience de la guilde du joueur testeur. |
| `/test resetjoinboat` | rjb | Remet à zéro le compteur de voyages vers l'île de guilde du joueur testeur. |
| `/test rollbackguildjoin` | rgj | Recule d'une semaine notre date d'adhésion à une guilde. |
| `/test setfood <foodType> <amount>` | sf | Définit la quantité d'un type de nourriture spécifique dans le stockage de la guilde. Types disponibles : voir les constantes de nourriture |

### Home (9)

| Syntaxe | Alias | Description |
|---|---|---|
| `/test cleargarden` |  | Vide le jardin (parcelles, stockage et graine). |
| `/test deletehome` |  | Supprime votre maison et tous vos appartements locatifs |
| `/test fillplantstorage` |  | Remplit le stockage de plantes de la maison au maximum pour chaque type de plante. |
| `/test givematerial <materialId> <quantity>` |  | Donne un matériau au joueur. Ex: bois commun=51,58,64 / bois peu commun=2,9,88 / bois rare=18,31,84 |
| `/test giveplant <plant id [1-10]>` |  | Donne une plante récoltée au joueur. IDs : 1=Herbe commune, 2=Trèfle doré, 3=Mousse lunaire, 4=Racine de fer, 5=Champignon nocturne, 6=Feuille venimeuse, 7=Bulbe de feu, 8=Plante carnée, 9=Fleur de cristal, 10=Arbre ancestral |
| `/test giveseed <plant id [1-10]>` |  | Donne une graine au joueur. IDs : 1=Herbe commune, 2=Trèfle doré, 3=Mousse lunaire, 4=Racine de fer, 5=Champignon nocturne, 6=Feuille venimeuse, 7=Bulbe de feu, 8=Plante carnée, 9=Fleur de cristal, 10=Arbre ancestral |
| `/test growplants` |  | Fait mûrir instantanément toutes les plantes de votre jardin. |
| `/test homeLevel <level>` |  | Change le niveau de votre maison entre 1 et 8. |
| `/test plantslots <count [1-3]>` |  | Change le nombre d'emplacements de plantes (simule achat tanneur). Min 1, max 3. |

### Infos (4)

| Syntaxe | Alias | Description |
|---|---|---|
| `/test clearLogs` |  | Vide toutes les données des tables de logs (les tables elles-mêmes sont conservées). Utile pour nettoyer avant des tests. |
| `/test help <command>` | h | Affiche l'aide détaillée pour une commande de test spécifiée : description, format, paramètres et aliases disponibles |
| `/test list` |  | Affiche la liste complète des commandes de test organisées par catégories avec leurs noms et aliases. Utilisez 'test help <command>' pour plus de détails |
| `/test myids` |  | Affiche vos identifiants de joueur (ID interne et Keycloak). Utile pour les commandes nécessitant un ID joueur comme resetbo3 |

### Inventory (7)

| Syntaxe | Alias | Description |
|---|---|---|
| `/test disenchant <weapon/armor>` |  | Permet de désenchanter l'objet équipé dans la catégorie donnée. |
| `/test enchant <weapon/armor> <enchant id>` |  | Permet d'enchanter l'objet équipé dans la catégorie donnée. Enchantements disponibles : voir `/test help enchant` |
| `/test finditem <category [0-3]> <item id>` |  | Fait découvrir et ajouter un objet spécifique à l'inventaire du joueur. Catégories : 0=armes, 1=armures, 2=potions, 3=objets. Voir Core/resources/[category]/ pour les IDs |
| `/test giveitem <category [0-3]> <item id>` |  | Donne un objet spécifique au joueur. Catégories : 0=armes, 1=armures, 2=potions, 3=objets. Voir Core/resources/[category]/ pour les IDs |
| `/test rarityshot <nbTirages> <rarityMin = 1> <rarityMax = 8>` | rs | Teste le générateur de rareté d'objets en effectuant X tirages entre les raretés min et max spécifiées. Raretés valides : 1-8. Affiche les statistiques de distribution |
| `/test slots <category [0-3]> <number>` |  | Modifie le nombre d'emplacements d'inventaire pour une catégorie d'objets. Catégories : 0=armes, 1=armures, 2=potions, 3=objets. |
| `/test upgradeitem <weapon/armor> <level [0-5]>` | upgrade, ui | Permet d'améliorer l'objet équipé dans la catégorie donnée. Niveaux disponibles : 0 à 5 (0 = pas d'amélioration, 5 = amélioration maximale) |

### Map (8)

| Syntaxe | Alias | Description |
|---|---|---|
| `/test forcereport <id>` | fr, forcer | Force un événement spécifique lors du prochain /report. Utile pour tester des événements précis. Utilisez -1 pour un événement aléatoire. Voir /test listevents pour les IDs |
| `/test mapinfo` |  | Affiche des informations de debug sur la position actuelle : cartes précédente et actuelle, statut de voyage, IDs et noms des lieux |
| `/test possibleEvents` |  | Affiche la liste des événements pouvant se déclencher sur la carte actuelle avec leurs conditions et leur statut de validation |
| `/test smallEvent <seName>` | se | Force un mini-événement précis (noms : `/test help smallEvent`) |
| `/test stopcurrenttravel` | stravel, stoptravel | Interrompt immédiatement le voyage en cours et place le joueur à sa destination finale |
| `/test travelreport` | tr | Remet à zéro la date de début du voyage actuel, permettant de déclencher immédiatement un nouvel événement via /report |
| `/test travel <idStart> <idEnd>` | tp | Téléporte le joueur sur un chemin spécifique entre deux lieux. Voir Core/resources/mapLinks/ pour les chemins valides ou /test mapinfo pour votre position |
| `/test witch <action1> <action2> <action3>` |  | Force le déclenchement du mini-événement de la sorcière avec 3 actions spécifiées. Permet de tester les différents choix et leurs conséquences. Liste des actions : voir `/test help witch` |

### Missions (12)

| Syntaxe | Alias | Description |
|---|---|---|
| `/test addgem <gem>` |  | Ajoute un nombre spécifique de gemmes au joueur testeur. |
| `/test clearMissions` |  | Supprime toutes les missions secondaires du joueur (préserve la mission de campagne). Utile pour nettoyer l'inventaire de missions avant de nouveaux tests |
| `/test debugMissions` | debugm, debm | Affiche un rapport détaillé des missions du joueur : slots actifs, gemmes, progression de campagne et informations de debug |
| `/test expireMissions` |  | Force l'expiration immédiate de toutes les missions non-campagne du joueur. Utile pour tester les mécaniques de renouvellement des missions |
| `/test giveMission <mission id> <difficulty>` | gm | Permet de se donner une mission spécifique. Voir Core/resources/missions/ pour la liste des IDs disponibles. Difficultés : easy (e), medium (m), hard (h) |
| `/test giveRandomMission <difficulty>` | grm | Attribue une mission aléatoire avec la difficulté spécifiée. Difficultés : easy (e), medium (m), hard (h). Nécessite un slot de mission libre |
| `/test newDailyMissions` | ndm | Génère une nouvelle mission quotidienne pour tous les joueurs et remet à zéro les compteurs de progression. Utile pour tester le système de missions quotidiennes |
| `/test resetCampaign` |  | Remet à zéro la progression de la campagne et repositionne le joueur à la mission 1. Utile pour tester le début du scénario principal |
| `/test resetDailyMission` | rdm | Remet à zéro le compteur de missions quotidiennes du joueur testeur, permettant de refaire la mission quotidienne actuelle |
| `/test setCampaignBlob <blob>` | scb | Modifie le blob de progression de campagne (chaîne binaire). Format requis : séquence de 0 et 1 correspondant chacun a une mission de la campagne, 0 = mission pas encore terminée et 1 = mission validée. Ex: sur une campagne de 5 missions, un joueur qui a terminé les 3 premières aura 11100. |
| `/test setCampaign <progression>` |  | Positionne le joueur à une étape spécifique de la campagne principale. Utile pour tester des missions de campagne avancées sans refaire tout le scénario |
| `/test updateMissions <mission id> <count>` | updateMission, um | Met à jour le progrès d'une mission spécifique avec le nombre d'unités donné. Voir Core/resources/missions/ pour les IDs valides |

### Pet (6)

| Syntaxe | Alias | Description |
|---|---|---|
| `/test advanceexpedition <time>` | aexp | Fait avancer le temps d'une expédition de familier de <time> minutes. Permet de simuler la fin d'une expédition sans attendre |
| `/test guildpet <id> <sex = m/f>` | gp | Ajoute un familier au refuge de guilde avec l'ID et le sexe spécifiés. Voir Core/resources/pets/ pour les IDs valides. Sexe: m=mâle, f=femelle |
| `/test petfree` | pf | Libère immédiatement le familier actuel sans attendre le cooldown normal. Le familier est retiré de l'inventaire du joueur |
| `/test pethungry` | hungry | Met le familier actuel dans l'état 'affamé', ce qui réduit ses performances jusqu'à ce qu'il soit nourri |
| `/test petlovepoints <lovePoints>` | petlp | Définit le niveau d'amour (love points) du familier actuel. Les points d'amour influencent les capacités et l'efficacité du pet |
| `/test pet <id> <sex = m/f>` |  | Donne un familier spécifique avec l'ID et le sexe choisis. Utilisez ID 0 pour supprimer le pet actuel. Sexe: m=mâle, f=femelle. Voir Core/resources/pets/ pour les IDs |

### Player (29)

| Syntaxe | Alias | Description |
|---|---|---|
| `/test addmoney <money>` |  | Ajoute une somme d'argent au solde actuel du joueur testeur. Peut être négatif pour retirer de l'argent |
| `/test changeClass <classId>` |  | Change votre classe pour la classe d'id donnée. |
| `/test claimid <playerId> [discordId]` |  | Associe un joueur (par ID en base de données) à votre keycloakId. |
| `/test claimscore <score> [discordId]` | claim | Associe un joueur (par score) à votre keycloakId, ou au keycloakId de l'utilisateur Discord spécifié. |
| `/test clearbadges` |  | Supprime tous les badges du joueur testeur. Utile pour tester les mécaniques d'obtention de badges et repartir à zéro |
| `/test cookinglevel <niveau>` | cooklvl | Définit le niveau de cuisine du joueur testeur et débloque les recettes associées. |
| `/test destroyplayer` | destroy | Détruit la session actuelle du joueur. Il sera requis de réaliser /report ou /test skiptuto pour continuer les tests nécessitant un joueur initialisé |
| `/test experience <experience>` | xp | Définit l'expérience du joueur testeur. |
| `/test exportPlayers <pattern>` |  | Exporte les joueurs dont le keycloakId correspond au pattern (supporte les wildcards %), leurs pets et inventaires dans un fichier JSON. |
| `/test generatePlayers <level> [playersPerClass] [fixedItems] [generatePets] [petId]` |  | Génère un ensemble de joueurs dans la base de données pour chaque classe disponible au niveau donné. |
| `/test givebadge <badge>` |  | Attribue un badge spécifique au joueur. Utilisez '*' pour tous les badges. La commande affiche la liste des badges disponibles en cas d'erreur |
| `/test givetokens <tokens>` | tokens, jetons, gtk | Ajoute ou retire des jetons au joueur testeur. Peut être négatif pour retirer des jetons |
| `/test importPlayers <filename>` |  | Importe les joueurs depuis un fichier JSON exporté avec exportPlayers. Crée ou met à jour les joueurs, leurs pets et inventaires. |
| `/test leaguereward` |  | Force l'exécution de la commande de récompense de ligue en ignorant les restrictions de date. Permet de tester les récompenses de classement |
| `/test markallpetsseendwarf` | mapsd | Marque tous les familiers comme ayant été montrés au nain Talvar (le nain du mini event qui donne 1 gemme / animal). |
| `/test playerhealth <health>` | health | Définit les points de vie actuels du joueur testeur. Ne peut pas dépasser les points de vie maximum. Utilisez 0 pour tuer le joueur |
| `/test playerkarma` | karma | Affiche votre karma actuel |
| `/test playerlevel <niveau>` | level, lvl | Définit le niveau du joueur testeur. Le niveau influence les points de vie, de puissance, et débloque de nouvelles fonctionnalités |
| `/test playermoney <money>` | money | Définit l'argent du joueur testeur à la valeur spécifiée. L'argent sert aux achats d'objets, d'améliorations et aux services de guilde |
| `/test playerscore <score>` | score | Définit le score total du joueur testeur. |
| `/test playerkill` | kill, suicide | Met instantanément la vie du joueur à 0 et le tue. Utile pour tester les mécaniques de mort, respawn et pénalités associées |
| `/test playerweeklyscore <weeklyscore>` | weeklyscore | Définit le score hebdomadaire du joueur testeur. (le nombre de points gagnés depuis le début de la semaine) indépendant du score du joueur /! Remet aussi à zéro les paliers du défi du roi déjà récompensés : le prochain gain de points paie tous les paliers atteints. |
| `/test resetpetseendwarf` | rpsd | Remet à zéro la liste des familiers montrés au nain Talvar. (Le nain qui donne une gemme chaque fois qu'il voit un animal dans le small event dédié). |
| `/test sendnotification <type>` | sendnotif | Envoie une notification de test au joueur. Types disponibles : 'report' (destination atteinte), 'guildDaily' (mission de guilde). Utile pour tester l'affichage des notifications |
| `/test setkarma <karma>` | setkarma | Définit votre karma à la valeur donnée |
| `/test setup` | setupplayer, fullsetup | Configure un joueur prêt à tester : niveau 30, argent, gemmes, pet aléatoire, équipement aléatoire, voyage en cours |
| `/test skiptutorial` | skiptuto, init | Alternative aux premiers /report. Permet de sauter le tutoriel et d'initialiser votre joueur au niveau 1 avec 2000 points |
| `/test talisman <type = anchor/clone/harvest> <action = give/remove>` |  | Donne ou retire un talisman. Types: anchor (ancrage), clone (clonage), harvest (cœur sylvestre). Actions: give (donner), remove (retirer) |
| `/test unblock` |  | Retire tous les blocages actifs de votre joueur. Utilisé quand une commande de test ou un bug vous a bloqué. Note : cette commande est prévue pour les tests |

### Time (10)

| Syntaxe | Alias | Description |
|---|---|---|
| `/test advanceguilddaily <time>` | agd | Récule la date de la dernière récompense quotidienne de guilde de X minutes. Permet de récupérer la récompense suivante X minutes plus tôt. |
| `/test advancelastmeal <time>` | alm | Avance l'heure du dernier repas de votre joueur d'une durée en minutes donnée |
| `/test advancepetfree <time>` | apfree | Avance la date du dernier 'pet free' de X minutes, permettant de libérer un animal plus tôt que prévu |
| `/test advanceplayerdaily <time>` | adaily | Avance la date de la dernière récompense quotidienne du joueur de X minutes, permettant de récupérer la récompense quotidienne plus tôt |
| `/test advancetravel <time>` | atravel | Fait avancer le temps de voyage du joueur de X minutes, ou son séjour en ville s'il y est arrêté. Permet de simuler la fin d'un déplacement ou un long séjour en ville sans attendre |
| `/test blockplayer <time>` | block | Bloque votre joueur pendant un temps donné (en secondes). Utile pour tester les mécaniques de blocage temporaire et les cooldowns |
| `/test jailplayer <id>` | jail | Applique l'effet 'emprisonné' au joueur spécifié par son ID. Bloque le joueur et l'empêche d'effectuer des actions |
| `/test playereffect <effect>` | effect | Applique l'effet spécifié au joueur testeur. Permet de tester les différents états de jeu et leurs conséquences Liste des effets : voir `/test help playereffect` |
| `/test removeplayereffect` | rmeffect | Retire immédiatement l'effet actuel du joueur testeur et le remet dans l'état normal |
| `/test shiftlogsdate <days>` | shiftlogs, logsshift, sld | Décale toutes les dates dans la base de données de logs de X jours dans le passé. Utile pour tester les limites hebdomadaires/journalières |
