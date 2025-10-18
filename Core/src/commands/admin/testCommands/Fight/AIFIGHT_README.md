# Commande de Test : AI Fight

## Description

La commande `aifight` permet de lancer un combat entre deux joueurs contrôlés entièrement par l'intelligence artificielle (IA). Cette commande est utile pour tester le système de combat sans intervention humaine.

## Utilisation

```
/test aifight <player1Id> <player2Id>
```

### Paramètres

- `player1Id` : L'ID du premier joueur dans la table Player (nombre entier)
- `player2Id` : L'ID du deuxième joueur dans la table Player (nombre entier)

### Aliases

- `/test aif <player1Id> <player2Id>`
- `/test aivs <player1Id> <player2Id>`

## Exemples

```
/test aifight 1 2
/test aif 42 156
/test aivs 10 25
```

## Prérequis

- Les deux joueurs doivent exister dans la base de données
- Les deux joueurs doivent être au moins niveau 8 (défini par `FightConstants.REQUIRED_LEVEL`)
- Les joueurs doivent avoir une classe valide

## Fonctionnement

1. **Récupération des joueurs** : La commande récupère les deux joueurs depuis la base de données
2. **Validation** : Vérifie que les joueurs existent et ont le niveau minimum requis
3. **Création des combattants** :
   - Joueur 1 : `PlayerFighter` (car `FightController` nécessite que `fighter1` soit un `PlayerFighter`)
   - Joueur 2 : `AiPlayerFighter`
4. **Chargement des stats** : Les statistiques des combattants sont chargées (PV, attaque, défense, vitesse, etc.)
5. **Démarrage du combat** : Le combat est lancé avec le comportement `END_FIGHT_DRAW` (match nul après 40 tours)
6. **Déroulement** : Les deux IA choisissent automatiquement leurs actions en fonction de leur comportement de classe
7. **Résultat** : À la fin du combat, un message récapitulatif est affiché avec :
   - Le gagnant ou match nul
   - Les PV restants de chaque joueur
   - Le nombre de tours

## Sortie

### Message de début
```
⚔️ Combat lancé entre Joueur 1 et Joueur 2 !

Le combat se déroule...
```

### Pendant le combat
Tous les packets de combat sont envoyés (introduction, statut, actions, etc.) et affichés dans le channel Discord.

### Message de fin
```
🏆 Joueur 1 a vaincu Joueur 2 !

**Statistiques finales :**
Joueur 1 : 125/350 PV
Joueur 2 : 0/320 PV

Nombre de tours : 18
```

Ou en cas de match nul :
```
⚔️ Match nul entre Joueur 1 et Joueur 2 !

**Statistiques finales :**
Joueur 1 : 50/350 PV
Joueur 2 : 75/320 PV

Nombre de tours : 40
```

## Comportement IA

Chaque joueur utilise le comportement IA défini pour sa classe dans `Core/src/core/fights/aiClassBehaviors/`. Par exemple :
- **Knight** : Équilibre entre attaques et défenses
- **Gunner** : Préfère les attaques à distance
- **Mystic Mage** : Utilise des sorts magiques

## Différences avec un combat normal

| Aspect | Combat Normal | Combat Test IA vs IA |
|--------|---------------|----------------------|
| **Initiateur** | Joueur humain | IA (PlayerFighter) |
| **Adversaire** | IA trouvée automatiquement | IA spécifiée |
| **Sélection d'action** | Joueur clique sur une réaction | IA décide automatiquement |
| **Blocage** | Joueur bloqué pendant le combat | Aucun blocage |
| **Récompenses** | Argent, score, ELO | Aucune |
| **Validation** | Énergie, cooldown, BO3 | Seulement niveau minimum |

## Notes techniques

- Le premier joueur est créé en tant que `PlayerFighter` car l'architecture nécessite que `fighter1` soit toujours un `PlayerFighter` dans `FightController`
- Le deuxième joueur est créé en tant que `AiPlayerFighter`
- Les deux combattants utilisent leur comportement IA pour choisir leurs actions
- Aucune récompense n'est distribuée (pas de changement d'ELO, d'argent ou de score)
- Le combat se termine en match nul après 40 tours (`FightConstants.MAX_TURNS`)

## Utilisation pour le débogage

Cette commande est idéale pour :
- Tester l'équilibrage des classes
- Vérifier le comportement des IA
- Observer des combats sans intervention
- Déboguer des problèmes de combat
- Effectuer des tests automatisés de performance

## Commandes associées

- `/test setlevel <level>` : Modifier le niveau d'un joueur
- `/test glory <points> <type>` : Modifier les points de gloire
- `/test addmoney <amount>` : Ajouter de l'argent à un joueur

## Comment trouver l'ID d'un joueur ?

Les IDs des joueurs sont visibles dans la base de données. Vous pouvez :
1. Consulter la table `players` directement
2. Utiliser des outils de gestion de base de données (HeidiSQL, DBeaver, etc.)
3. Créer une commande test supplémentaire pour afficher votre ID joueur
