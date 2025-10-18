# Commande AI Tournament

## Vue d'ensemble
La commande `aitournament` permet de simuler un tournoi complet entre tous les joueurs éligibles de la base de données, avec des statistiques détaillées sur les performances des classes, des familiers et des joueurs individuels.

## Utilisation

```
/test aitournament [fightsPerPair] [minLevel] [maxLevel]
```

### Paramètres

- `fightsPerPair` (optionnel, défaut: 5000) : Nombre de combats à simuler entre chaque paire de joueurs (100-10000)
- `minLevel` (optionnel, défaut: niveau requis pour combattre) : Niveau minimum des joueurs participants
- `maxLevel` (optionnel, défaut: 100) : Niveau maximum des joueurs participants

### Exemples

```bash
# Tournoi avec 5000 combats par paire (défaut)
/test aitournament

# Tournoi avec 1000 combats par paire
/test aitournament 1000

# Tournoi avec joueurs niveau 10-20, 2000 combats par paire
/test aitournament 2000 10 20

# Tournoi rapide avec 100 combats par paire
/test aitournament 100
```

## Fonctionnalités

### 1. Statistiques par joueur
Pour chaque participant, le rapport affiche :
- **Informations de base** : ID, niveau, classe, familier
- **Stats de combat** : ⚡ PV max, ⚔️ Attaque, 🛡️ Défense, 🚀 Vitesse
- **Résultats** : Victoires, Défaites, Matchs nuls, Taux de victoire (WR)
- **Performance offensive** :
  - Dégâts moyens par combat (DPF)
  - Dégâts moyens par tour (DPT)
  - Médiane des dégâts par tour
- **Performance défensive** : Dégâts moyens subis par combat
- **Dominance** : Nombre d'adversaires battus sur le total

### 2. Top 10 des joueurs
Classement des 10 meilleurs joueurs basé sur :
- Nombre total de victoires
- Taux de victoire
- Performance offensive (DPF et DPT)

### 3. Matchups Classe vs Classe
Statistiques détaillées pour chaque combinaison de classes :
- Nombre de victoires pour chaque classe
- Taux de victoire (WR)
- Nombre de matchs nuls
- Identification des contre-picks et synergies

**Exemple de rapport :**
```
• Combattant vs Tank
  Combattant : 2450V (49.0%) | Tank : 2480V (49.6%) | Nuls : 70
```

### 4. Matchups Familier vs Familier
Statistiques pour chaque combinaison de familiers :
- Performances relatives entre types de familiers
- Identification des familiers dominants
- Équilibrage du système de familiers

**Exemple de rapport :**
```
• Chien vs Renard
  Chien : 3200V (64.0%) | Renard : 1750V (35.0%) | Nuls : 50
```

## Architecture technique

### Processus de simulation
1. **Récupération des joueurs** : Filtrage par niveau dans la base de données
2. **Initialisation** : Création des statistiques pour chaque joueur
3. **Combats en mode silencieux** : Pas de spam Discord, simulation rapide
4. **Collecte de données** : Enregistrement de toutes les métriques par combat
5. **Agrégation** : Calcul des moyennes, médianes, et taux de victoire
6. **Génération du rapport** : Rapport complet avec toutes les statistiques

### Métriques calculées
- **DPF (Damage Per Fight)** : Dégâts moyens infligés par combat
- **DPT (Damage Per Turn)** : Dégâts moyens infligés par tour
- **WR (Win Rate)** : Taux de victoire en pourcentage
- **Médiane DPT** : Valeur médiane des dégâts par tour (plus résistante aux outliers)

## Performance

### Temps d'exécution estimé
Le temps dépend de plusieurs facteurs :
- Nombre de joueurs participants
- Nombre de combats par paire
- Performance du serveur

**Exemples :**
- 10 joueurs × 5000 combats/paire = 225 000 combats → ~5-10 minutes
- 20 joueurs × 1000 combats/paire = 190 000 combats → ~4-8 minutes
- 50 joueurs × 100 combats/paire = 122 500 combats → ~2-5 minutes

### Optimisations
- ✅ Mode silencieux : Pas de génération de packets Discord
- ✅ Combats IA vs IA : Pas de délais d'attente utilisateur
- ✅ Statistiques en mémoire : Pas d'accès base de données pendant les combats

## Cas d'usage

### 1. Équilibrage des classes
Identifier les classes sur/sous-performantes et ajuster leurs statistiques :
```bash
/test aitournament 5000 20 20
```
→ Compare des joueurs de même niveau pour isoler l'impact de la classe

### 2. Test de nouvelles features
Valider l'impact d'un changement sur l'équilibre global :
```bash
# Avant changement
/test aitournament 1000

# Après changement  
/test aitournament 1000

# Comparer les rapports
```

### 3. Analyse des familiers
Identifier les familiers dominants ou faibles :
```bash
/test aitournament 2000 30 40
```
→ Focus sur une tranche de niveau avec beaucoup de familiers

### 4. Validation d'équilibrage par niveau
Tester différentes tranches de niveaux :
```bash
/test aitournament 1000 1 20   # Early game
/test aitournament 1000 20 40  # Mid game
/test aitournament 1000 40 60  # Late game
```

## Limitations

1. **Temps d'exécution** : Peut être long avec beaucoup de joueurs/combats
2. **Mémoire** : Stocke toutes les statistiques en RAM pendant l'exécution
3. **Pas de sauvegarde** : Les résultats ne sont pas persistés en base de données
4. **IA uniquement** : Ne reflète pas nécessairement le comportement des joueurs réels

## Notes de développement

### Structures de données
```typescript
interface PlayerStats {
    playerId: number;
    wins: number;
    losses: number;
    draws: number;
    totalDamageDealt: number;
    totalDamageTaken: number;
    damagePerTurnList: number[];
    // ... autres champs
}

interface ClassMatchup {
    wins: number;
    losses: number;
    draws: number;
}
```

### Extensions futures possibles
- [ ] Export des résultats en JSON/CSV
- [ ] Visualisation graphique des matchups
- [ ] Sauvegarde historique des tournois
- [ ] Support pour combats par équipes
- [ ] Simulation de tournoi à élimination directe
- [ ] Prédiction de résultats avec machine learning
