# Système de Cuisine — Spécification d'Implémentation

> Document de référence pour l'implémentation du système de cuisine.
> Basé sur le design original (`cooking.md`) + analyse complète de la codebase.

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Déblocage et Slots de Fourneaux](#2-déblocage-et-slots-de-fourneaux)
3. [Système de Niveau de Cuisine (Cooking XP)](#3-système-de-niveau-de-cuisine-cooking-xp)
4. [Grades de Cuisine et Buffs](#4-grades-de-cuisine-et-buffs)
5. [Recettes — Structure et Données](#5-recettes--structure-et-données)
6. [Découverte de Recettes](#6-découverte-de-recettes)
7. [Rotation des Recettes par Slot](#7-rotation-des-recettes-par-slot)
8. [Mécanique d'Allumage du Fourneau](#8-mécanique-dallumage-du-fourneau)
9. [Mécanique de Craft](#9-mécanique-de-craft)
10. [Calcul d'XP de Cuisine](#10-calcul-dxp-de-cuisine)
11. [Recettes Détaillées — Potions](#11-recettes-détaillées--potions)
12. [Recettes Détaillées — Nourriture de Familier](#12-recettes-détaillées--nourriture-de-familier)
13. [Intégration Codebase — Fichiers à Modifier](#13-intégration-codebase--fichiers-à-modifier)
14. [Fichiers à Créer](#14-fichiers-à-créer)
15. [Code Legacy à Supprimer](#15-code-legacy-à-supprimer)
16. [Schéma Base de Données](#16-schéma-base-de-données)
17. [Packets MQTT](#17-packets-mqtt)
18. [Plan d'Implémentation](#18-plan-dimplémentation)

---

## 1. Vue d'ensemble

La cuisine est une **feature de la maison** (comme le jardin, le coffre, la station d'amélioration). Le joueur utilise des plantes (du jardin) et des matériaux pour préparer des potions ou de la nourriture pour familier.

**Flux principal :**
1. Le joueur va dans sa maison → sélectionne "Fourneau"
2. Paye du bois (matériau de type `WOOD`) pour allumer le fourneau
3. Voit les recettes disponibles dans ses slots débloqués
4. Choisit une recette → le jeu vérifie les ingrédients
5. Résultat : succès (potion/nourriture) ou échec (potion sans effet + XP réduit)
6. Gain d'XP de cuisine → potentiel level up de cuisine

---

## 2. Déblocage et Slots de Fourneaux

### Déblocage
La cuisine se débloque **en même temps que le jardin**, c'est-à-dire au **niveau 3 de maison** (`HomeLevel.LEVEL_3`, qui a `gardenPlots: 3`).

### Progression des Slots

| Slot | Déblocage (comment) | Niveaux de recette |
|------|---------------------|-------------------|
| 1 | Déblocage initial (maison niv 3) | 1–3 |
| 2 | Amélioration maison niv 4 | 1–5 |
| 3 | Amélioration maison niv 5 | 1–8 |
| 4 | Amélioration maison niv 6 | 3–8 (potions uniquement, pas de bouffe) |
| 5 | Amélioration maison niv 7 | 4–8 |

> **Implémentation :** Ajouter un champ `cookingSlots: number` dans `HomeFeatures` (interface dans `Lib/src/types/HomeFeatures.ts`), et le définir par niveau de maison dans `HomeLevel.ts`.

### Mapping HomeLevel → Cooking Slots

| HomeLevel | cookingSlots |
|-----------|-------------|
| LEVEL_1 | 0 |
| LEVEL_2 | 0 |
| LEVEL_3 | 1 |
| LEVEL_4 | 2 |
| LEVEL_5 | 3 |
| LEVEL_6 | 4 |
| LEVEL_7 | 5 |
| LEVEL_8 | 5 |

---

## 3. Système de Niveau de Cuisine (Cooking XP)

### Modèle XP
La progression suit **la même formule** que l'XP joueur classique :

```
XP nécessaire pour level up = round(BASE_VALUE * COEFFICIENT^(level+1)) - MINUS
```

Avec les constantes existantes (`Constants.XP`) :
- `BASE_VALUE = 325`
- `COEFFICIENT = 1.041`
- `MINUS = 188`

### Exemples de seuils

| Niveau | XP cumulé approximatif |
|--------|----------------------|
| 1 | 150 |
| 10 | ~2 200 |
| 25 | ~6 900 |
| 50 | ~22 000 |
| 75 | ~65 000 |
| 100 | ~185 000 |

### Calibration
**Objectif :** Un joueur cuisinant **3 fois par jour** devrait atteindre le niveau max (~100) en **environ 1 an** (365 jours × 3 = ~1095 crafts).

Cela donne : ~185 000 XP / 1095 crafts ≈ **170 XP par craft en moyenne**.

Les recettes de bas niveau donneront ~30-60 XP et celles de haut niveau ~300-500 XP, la moyenne pondérée devant tendre vers ~170.

### Affichage
- **Profil joueur** : Afficher le niveau de cuisine + le nom du grade (pas l'XP exacte)
- **Embed cuisine** : Afficher le grade complet + barre de progression XP
- **Level up cuisine** : Notification dans la réponse (similaire au level up joueur), sans détail de la quantité d'XP gagnée

### Champs DB joueur à ajouter
- `cookingLevel: number` (default 0)
- `cookingExperience: number` (default 0)

---

## 4. Grades de Cuisine et Buffs

### Table des Grades

| Grade | Niveaux | Emoji (proposition) | Buffs spéciaux |
|-------|---------|---------------------|----------------|
| Aide-cuisine | 0–10 | 🥄 | 10% d'échec ; 20% de recettes secrètes |
| Marmiton | 11–20 | 🍳 | 5% d'échec ; 10% de recettes secrètes |
| Cuisinier | 21–30 | 🔪 | 5% de chance de sauver un matériau secondaire |
| Rôtisseur | 31–40 | 🍖 | 5% de recettes secrètes |
| Saucier | 41–50 | 🍲 | — |
| Maître d'office | 51–60 | 📋 | — |
| Chef de table | 61–70 | 🍽️ | 5% de chance de ne pas consommer de bois |
| Chef des fourneaux | 71–80 | 🔥 | — |
| Maître des cuisines | 81–90 | 👨‍🍳 | — |
| Grand cuisinier royal | 91–100+ | 👑 | 1% d'échec en moins ; 0.5% de recettes secrètes |

### Détail du calcul de taux d'échec

**Taux d'échec base :**
- Aide-cuisine (niv 0–10) : **10%**
- Marmiton (niv 11–20) : **5%**
- Cuisinier à Chef des fourneaux (niv 21–80) : **5%** (inchangé depuis Marmiton)
- Maître des cuisines (niv 81–90) : **5%**
- Grand cuisinier royal (niv 91+) : **4%** (5% - 1% réduction)

**Malus si recette trop haut niveau :**
Si le joueur tente une recette dont le niveau dépasse le maximum autorisé par son grade de cuisine :
```
taux d'échec final = taux_base × (18 + niveau_recette)
```

Exemple : Un Aide-cuisine (taux base 10%) qui tente une recette de niveau 5 :
- Taux = 10% × (18 + 5) = 10% × 23 = **230%** → échec garanti

### Niveaux de recette accessibles sans malus par grade

| Grade | Niveaux de recette sans malus |
|-------|------------------------------|
| Aide-cuisine (0–10) | 1–2 |
| Marmiton (11–20) | 1–3 |
| Cuisinier (21–30) | 1–4 |
| Rôtisseur (31–40) | 1–5 |
| Saucier (41–50) | 1–5 |
| Maître d'office (51–60) | 1–6 |
| Chef de table (61–70) | 1–7 |
| Chef des fourneaux (71–80) | 1–7 |
| Maître des cuisines (81–90) | 1–8 |
| Grand cuisinier royal (91+) | 1–8 |

### Conséquence d'un échec
- Le joueur reçoit une **potion sans effet** (nature = `ItemNature.NONE`, ID de potion sans effet existante `rarity: 0, nature: 0`)
- Les ingrédients sont consommés normalement
- Le joueur reçoit de l'XP de cuisine : **montant fixe = 15 × niveau_recette_tentée**

### Mécanique de Recette Secrète

Quand une recette est **générée dans un slot** (à l'allumage ou au ravivage), il y a un pourcentage de chance (dépendant du grade) que la recette soit **secrète** :
- **Secrète** : le coût en ingrédients (plantes + matériaux) est affiché, mais **l'output est masqué** (le joueur ne sait pas ce qu'il va obtenir)
- Le joueur peut quand même la crafter
- L'output est révélé après le craft (succès ou échec)

**Taux de recettes secrètes par grade :**

| Grade | % Recettes secrètes |
|-------|---------------------|
| Aide-cuisine (0–10) | 20% |
| Marmiton (11–20) | 10% |
| Cuisinier (21–30) | 10% |
| Rôtisseur (31–40) | 5% |
| Saucier à Maître des cuisines (41–90) | 5% |
| Grand cuisinier royal (91+) | 0.5% |

> **Implémentation :** Le roll "secrète" se fait au moment de la génération du slot (pas au moment du craft). Le flag `isSecret` est envoyé dans le packet et l'UI masque l'output si `true`.

---

## 5. Recettes — Structure et Données

### Structure d'une Recette

```typescript
interface CookingRecipe {
  id: string;                     // Identifiant unique (ex: "potion_health_1")
  level: number;                  // Niveau 1–8 (même échelle que ItemRarity)
  
  // Ingrédients
  plants: CookingRecipePlant[];   // Plantes requises (1 type principal + complements possibles)
  materials: CookingRecipeMaterial[];  // Matériaux additionnels (1–5)
  
  // Output
  outputType: "potion" | "petFood";
  recipeType: RecipeType;         // Type de recette pour le cycle des slots (voir Section 7)
  
  // Si potion :
  potionNature?: ItemNature;      // HEALTH, ENERGY, TIME_SPEEDUP, DEFENSE, ATTACK, SPEED
  potionRarity?: ItemRarity;      // Rareté de la potion produite
  
  // Si petFood :
  petFoodType?: string;           // "commonFood", "herbivorousFood", "carnivorousFood", "ultimateFood"
  petFoodQuantity?: number;       // Quantité de nourriture produite
  petFoodLovePoints?: number;     // Points d'amour associés
  
  // Découverte
  discoveredByDefault: boolean;   // true = disponible dès le début
  discoverySource?: RecipeDiscoverySource;  // Comment la débloquer si !discoveredByDefault
  
  // XP (calculé dynamiquement, pas stocké)
}

interface CookingRecipePlant {
  plantId: PlantId;
  quantity: number;
}

interface CookingRecipeMaterial {
  materialId: number;
  quantity: number;               // Toujours 1
}
```

### Principe des plantes

Chaque **type de recette** a une **plante de base** principale. Les recettes de nourriture de familier de haut niveau peuvent aussi utiliser des plantes complémentaires :

> **Note :** Il n'existe pas de potion de type MONEY (`ItemNature.MONEY`) dans le jeu, donc aucune recette de ce type n'existe.

**Les 10 types de recettes (RecipeType) :**

| Type de recette (`RecipeType`) | Plante de base |
|-------------------------------|----------------|
| `POTION_HEALTH` | Herbe commune (`COMMON_HERB`, ID 1) |
| `POTION_ENERGY` | Trèfle doré (`GOLDEN_CLOVER`, ID 2) |
| `POTION_TIME_SPEEDUP` | Mousse lunaire (`LUNAR_MOSS`, ID 3) |
| `POTION_DEFENSE` | Racine de fer (`IRON_ROOT`, ID 4) |
| `POTION_ATTACK` | Champignon nocturne (`NIGHT_MUSHROOM`, ID 5) |
| `POTION_SPEED` | Feuille venimeuse (`VENOMOUS_LEAF`, ID 6) |
| `PETFOOD_SALAD` (herbivorousFood) | Herbe commune (`COMMON_HERB`, ID 1) |
| `PETFOOD_CANDY` (commonFood) | Trèfle doré (`GOLDEN_CLOVER`, ID 2) |
| `PETFOOD_MEAT` (carnivorousFood) | Plante carnivore (`MEAT_PLANT`, ID 8) |
| `PETFOOD_ULTIMATE` (ultimateFood) | Arbre ancien (`ANCIENT_TREE`, ID 10) |

**Quantité de plante par tier :** La quantité de la plante de base varie par tier (1–3 exemplaires selon le niveau de la recette).

---

## 6. Découverte de Recettes

La plupart des recettes sont disponibles d'office. Certaines doivent être **découvertes** :

### Sources de découverte

| Source | Détail | Nombre de recettes |
|--------|--------|-------------------|
| **Boss d'île** | 1 recette par boss final d'île battu pour la 1ère fois | Dépend du nombre d'îles |
| **Campagne** | 1 recette toutes les 50 missions de campagne complétées | `CampaignData.getMissions().length / 50` |
| **Niveau joueur** | 1 recette tous les 50 niveaux du joueur (50, 100, 150) | 3 |
| **Gaspard Jo** | Quand rencontré avec tous les slots de nourriture pleins de soupe + 10% de chance → propose d'acheter 1 recette. 1 recette par grade de cuisine, coût progressif : 15 → 1500 argent | 10 (1 par grade) |
| **Fermière (farmer)** | Propose aussi l'achat de recettes, prix de 15 → 1000 argent | ~5-8 |
| **Niveau de cuisine** | Certaines s'activent automatiquement en atteignant certains niveaux de cuisine | Variable |

### Stockage des recettes découvertes
Nouvelle table DB `PlayerDiscoveredRecipes` :
- `playerId` (FK → Player)
- `recipeId` (string)
- `discoveredAt` (Date)

Ou bien : un **blob** dans le modèle `Player` / `PlayerMissionsInfo` qui stocke les IDs de recettes débloquées (similaire à `campaignBlob`).

### Gaspard Jo — Comportement modifié
**Conditions pour l'offre de recette :**
1. Le joueur rencontre Gaspard Jo (small event `petFood.ts` qui gère les rencontres avec le marchand de soupe)
2. Tous les slots de nourriture du joueur sont pleins de soupe
3. Roll 10% de chance
4. Si réussi : proposition d'achat d'une recette liée au grade de cuisine actuel

**Coût progressif :** Le coût de la recette augmente avec le grade :
| Grade | Coût |
|-------|------|
| Aide-cuisine | 15 |
| Marmiton | 50 |
| Cuisinier | 100 |
| Rôtisseur | 200 |
| Saucier | 350 |
| Maître d'office | 500 |
| Chef de table | 750 |
| Chef des fourneaux | 1000 |
| Maître des cuisines | 1250 |
| Grand cuisinier royal | 1500 |

### Fermière — Comportement modifié
Le small event `farmer.ts` (existe déjà) propose aussi quelques recettes à l'achat avec un coût progressif de 15 à 1000 argent (similaire à Gaspard Jo mais moins de recettes).

---

## 6b. NPC Bûcheron — Boutique de Bois

Nouvelle **boutique de ville** à **Coco Village** (`coco_village`), la ville adjacente à la forêt. Le bûcheron permet d'acheter du bois en grande quantité à prix modéré.

### Pourquoi
Le système de cuisine consomme beaucoup de bois (1 par allumage/ravivage, jusqu'à 10/jour). Les joueurs doivent pouvoir se réapprovisionner facilement sans que ça soit trop bon marché.

### Implémentation
- Ajouter `"lumberjack"` dans le tableau `shops` de `coco_village` (`Core/resources/cities/coco_village.json`)
- Créer le handler `openLumberjack()` dans `ReportCityService.ts` (même pattern que `openHerbalist()`)
- Utilise `ShopUtils.createAndSendShopCollector()` avec `ReactionCollectorShop`

### Offre du bûcheron
Le bûcheron vend principalement du **bois commun** (carburant par défaut du fourneau) et un peu de bois de meilleure qualité (utile dans des recettes) :

| Item | Rareté | Quantité | Prix |
|------|--------|----------|------|
| Lot de bois de chauffage | Common (Feuille d'érable / Branche de chêne / Pignon de pin — aléatoire) | 5 | 50 💰 |
| Lot de bois travaillé | Uncommon (Planche d'acacia / Écorce d'hêtre / Branche de noyer — aléatoire) | 3 | 100 💰 |
| Lot de bois précieux | Rare (Bois de cèdre / Écorce d'ébène / Planche de teck — aléatoire) | 2 | 200 💰 |

> Le bois commun est le carburant standard du fourneau (consommé automatiquement, sans confirmation). Les joueurs achèteront surtout celui-là.
> Les bois uncommon/rare servent surtout d'ingrédients dans des recettes de cuisine.
> Le bois spécifique dans chaque lot est choisi aléatoirement à l'achat.

### Fichiers impactés
- `Core/resources/cities/coco_village.json` — Ajouter `lumberjack` dans `shops`
- `Core/src/core/report/ReportCityService.ts` — Nouveau handler `openLumberjack()`
- `Lib/src/packets/interaction/ReactionCollectorCity.ts` — Ajouter `lumberjack` comme type de shop
- `Lang/fr/commands.json` — Traductions pour la boutique du bûcheron

---

## 7. Rotation des Recettes par Slot — Cycles Garantis par Type

Chaque slot affiche **une recette à la fois**. Le cycle de chaque slot **garantit que chaque type de recette (RecipeType) disponible apparaît une fois** avant que le cycle ne recommence. Cela évite les répétitions de type d'output consécutives lors du ravivage.

### Principe du cycle par type

1. Chaque slot a **sa propre permutation indépendante** de ses RecipeTypes éligibles
2. Les permutations sont différentes entre slots grâce à un **seed unique par slot** → un même ravivage affiche des **types différents** sur chaque slot
3. Pour chaque position du cycle, le type de recette est fixé, et le **tier spécifique** est déterminé par un seed secondaire
4. Quand le joueur ravive le feu → **tous les slots avancent d'une position** dans leur cycle respectif
5. Quand un slot a fait le tour de tous ses types → il recommence avec la même permutation (le seed change au jour suivant)

### Compteur de position

Chaque joueur a un compteur `furnacePosition: number` (default 0) stocké en DB. Chaque allumage/ravivage incrémente ce compteur. Ce compteur est **commun** à tous les slots (ils avancent ensemble), mais chaque slot a **son propre ordre** grâce à un seed distinct.

### Types éligibles par slot

**Slot 1 (niveaux 1–3) — 9 types :**
`POTION_HEALTH`, `POTION_ENERGY`, `POTION_TIME_SPEEDUP`, `POTION_DEFENSE`, `POTION_ATTACK`, `POTION_SPEED`, `PETFOOD_SALAD`, `PETFOOD_CANDY`, `PETFOOD_MEAT`
> (Pas `PETFOOD_ULTIMATE` car le tier minimum d'Ultime est niveau 4, hors range)

**Slot 2 (niveaux 1–5) — 10 types :**
Tous les 10 types (y compris `PETFOOD_ULTIMATE` qui a un tier novice au niveau 4)

**Slot 3 (niveaux 1–8) — 10 types :**
Tous les 10 types

**Slot 4 (niveaux 3–8, potions uniquement) — 6 types :**
`POTION_HEALTH`, `POTION_ENERGY`, `POTION_TIME_SPEEDUP`, `POTION_DEFENSE`, `POTION_ATTACK`, `POTION_SPEED`

**Slot 5 (niveaux 4–8) — 10 types :**
Tous les 10 types

### Algorithme de cycle

```typescript
// Seed unique par slot : le slot_index décale fortement le seed
// pour garantir des permutations différentes entre slots
const SLOT_SEED_OFFSETS = [0, 7919, 15881, 23857, 31847] as const; // nombres premiers bien espacés

// 1. Récupérer la permutation du jour pour ce slot
function getSlotCycle(slotIndex: number, daySeed: number): RecipeType[] {
    const eligibleTypes = SLOT_CONFIGS[slotIndex].eligibleTypes;
    // Chaque slot a un seed très différent → permutations indépendantes
    const slotSeed = daySeed + SLOT_SEED_OFFSETS[slotIndex];
    return deterministicShuffle([...eligibleTypes], slotSeed);
}

// 2. Déterminer la recette actuelle pour un slot
function getRecipeForSlot(
    slotIndex: number, 
    furnacePosition: number, 
    daySeed: number,
    playerDiscoveredRecipes: string[]
): CookingRecipe | null {
    const cycle = getSlotCycle(slotIndex, daySeed);
    const typeIndex = furnacePosition % cycle.length;
    const recipeType = cycle[typeIndex];
    
    // Trouver les recettes de ce type dans la range du slot
    const slotConfig = SLOT_CONFIGS[slotIndex];
    const candidates = ALL_RECIPES
        .filter(r => r.recipeType === recipeType)
        .filter(r => r.level >= slotConfig.minLevel && r.level <= slotConfig.maxLevel)
        .filter(r => r.discoveredByDefault || playerDiscoveredRecipes.includes(r.id));
    
    if (candidates.length === 0) return null;
    
    // Choisir le tier parmi les candidats (déterministe, seed distinct)
    const tierSeed = daySeed * 7 + furnacePosition * 13 + slotIndex * 97;
    const tierIndex = Math.abs(tierSeed) % candidates.length;
    return candidates[tierIndex];
}
```

### Exemple concret — Position 0, Jour J

Grâce aux seeds indépendants, à la position 0 chaque slot affiche un type différent :

| Slot | Permutation propre | Type à position 0 |
|------|-------------------|-------------------|
| 1 | `[POTION_ATTACK, PETFOOD_CANDY, ...]` | POTION_ATTACK |
| 2 | `[POTION_ENERGY, PETFOOD_ULTIMATE, ...]` | POTION_ENERGY |
| 3 | `[PETFOOD_SALAD, POTION_DEFENSE, ...]` | PETFOOD_SALAD |
| 4 | `[POTION_TIME_SPEEDUP, POTION_HEALTH, ...]` | POTION_TIME_SPEEDUP |
| 5 | `[POTION_SPEED, PETFOOD_MEAT, ...]` | POTION_SPEED |

Après ravivage (position 1), chaque slot avance à l'index 1 de **sa** permutation → types encore tous différents.

> **Note :** Si le joueur ravive le feu et passe au jour J+1, le `daySeed` change → nouvelles permutations pour tous les slots.

---

## 8. Mécanique du Fourneau (Allumage, Ravivage, Surchauffe)

### Sélection du Bois — Système de Priorité

Le fourneau consomme **1 matériau de type WOOD** (`MaterialType.WOOD`) par allumage/ravivage. Certains bois sont aussi utilisés dans des recettes de cuisine, donc il faut éviter de brûler du bois précieux par erreur.

**Matériaux de type WOOD existants :**

| Rareté | Matériaux |
|--------|-----------|
| Common (1) | Feuille d'érable (51), Branche de chêne (58), Pignon de pin (64) |
| Uncommon (2) | Planche d'acacia (2), Écorce d'hêtre (9), Branche de noyer (88) |
| Rare (3) | Bois de cèdre (18), Écorce d'ébène (31), Planche de teck (84) |

**Priorité de consommation :**
1. **Bois commun en priorité** — Le fourneau consomme automatiquement un bois de rareté COMMON (celui dont le joueur a le plus grand stock)
2. **Si plus de bois commun** → le jeu affiche une **confirmation** : "Vous n'avez plus de bois commun. Utiliser 1× [Planche d'acacia] (peu commun) ?" avec ✅/❌
3. **Si plus de bois peu commun non plus** → même confirmation avec bois rare
4. **Si aucun bois** → message d'erreur

> **Logique Core :** `getWoodToConsume(player)` retourne `{ material: Material, needsConfirmation: boolean }`. Si rareté > COMMON → `needsConfirmation: true` → le packet de réponse demande la confirmation avant de consommer.

### Allumage initial
Quand le joueur sélectionne "Fourneau" dans le menu maison, il doit allumer le feu. Coûte **1 bois** (selon le système de priorité ci-dessus).

Si le joueur n'a pas de bois → message d'erreur.

L'allumage :
- Consomme 1 bois (sauf buff Chef de table) en respectant la priorité
- Positionne `furnacePosition` à 0 pour la session
- Affiche les recettes de tous les slots débloqués
- **Compte comme 1 utilisation** dans le compteur de surchauffe

### Bouton "Raviver le feu"

L'interface de cuisine affiche :
- **Un bouton par slot** (pour crafter la recette affichée)
- **Un bouton "Raviver le feu"** (🔥)

Quand le joueur clique sur "Raviver le feu" :
1. Consomme **1 bois** (selon le système de priorité, avec confirmation si non-commun)
2. Incrémente `furnacePosition` de 1
3. **Tous les slots avancent** à la position suivante dans leur cycle respectif
4. Les nouvelles recettes sont affichées
5. Incrémente le compteur de surchauffe

### Buff Chef de table
À partir du grade "Chef de table" (niv 61+), **5% de chance** que le bois ne soit pas consommé lors de l'allumage ou du ravivage.

### Surchauffe du Fourneau (Cooldown)

Après **10 utilisations** du fourneau en 24h (allumage initial + ravivages combinés), le fourneau **surchauffe** et ne peut plus être utilisé.

**Durée de blocage :** `max(temps restant jusqu'à demain, 6 heures)`
- Si le joueur atteint 10 utilisations à 23h → bloqué jusqu'à 5h le lendemain (6h, car "demain 0h" serait dans 1h < 6h)
- Si le joueur atteint 10 utilisations à 15h → bloqué jusqu'à 0h le lendemain (9h, car 9h > 6h)

**Champs DB à ajouter au joueur :**
- `furnaceUsesToday: number` (default 0)
- `furnaceLastUseDate: Date` (pour détecter le changement de jour et reset le compteur)
- `furnaceOverheatUntil: Date | null` (date de fin de surchauffe, null si pas en surchauffe)

**Message affiché :** "Le fourneau a surchauffé ! Il sera de nouveau utilisable dans X heures."

### Flux UI complet
1. Joueur sélectionne "Fourneau" dans le menu maison
2. Vérification surchauffe → si en surchauffe, message d'erreur + temps restant
3. Vérification bois → si pas de bois, message d'erreur
4. Allumage → consomme bois, affiche recettes des slots, incrémente compteur
5. Le joueur voit : [Recette Slot 1] [Recette Slot 2] ... [Raviver 🔥]
6. S'il clique sur un slot → flow de craft (Section 9)
7. S'il clique sur Raviver → consomme bois, avance le cycle, nouvelles recettes
8. Si compteur atteint 10 → surchauffe, fourneau désactivé

---

## 9. Mécanique de Craft

### Flux complet
1. Le joueur voit les recettes dans ses slots
2. Il clique sur le bouton d'un slot
3. **Écran de confirmation** : affiche le détail complet de la recette :
   - Output (sauf si recette secrète → "???" affiché)
   - Liste des plantes consommées (nom + quantité + quantité possédée par le joueur)
   - Liste des matériaux consommés (nom + quantité + quantité possédée par le joueur)
   - Bouton ✅ Confirmer / Bouton ❌ Annuler
4. Si le joueur annule → retour au menu des recettes
5. **Vérification des ingrédients :**
   - Plante de base en quantité suffisante (dans le stockage de plantes de la maison)
   - Matériaux en quantité suffisante (dans l'inventaire de matériaux)
   - Si pas assez → message d'erreur, pas de consommation
6. **Consommation des ingrédients** (buff Cuisinier peut sauver 1 matériau)
7. **Roll d'échec :**
   - Calcul du taux d'échec selon le grade + niveau de la recette
   - Roll aléatoire
8. **Résultat :**
   - **Succès** : Le joueur reçoit l'output (potion ajoutée à l'inventaire OU nourriture de familier ajoutée aux stocks)
   - **Échec** : Le joueur reçoit une potion sans effet
   - Si la recette était secrète → l'output réel est révélé dans le message de résultat
9. **XP de cuisine** :
   - Succès : XP calculé normalement (voir section 10)
   - Échec : XP fixe = `15 × niveau_recette`
10. **Vérification level up cuisine** → notification si level up

### Buff Cuisinier (grade 3+)
5% de chance de **ne pas consommer un** matériau secondaire aléatoire (parmi les matériaux de la recette, pas la plante de base).

---

## 10. Calcul d'XP de Cuisine

### Formule
```
xp_total = xp_plante * 0.8 + xp_materiaux * 0.2
```

### XP Plante (80% du total)
Basé sur le **temps de pousse** de la plante :

| Plante | Temps de pousse | XP base |
|--------|----------------|---------|
| Herbe commune | 10s | 10 |
| Trèfle doré | 30min | 30 |
| Mousse lunaire | 2h | 55 |
| Racine de fer | 8h | 90 |
| Champignon nocturne | 1j | 140 |
| Feuille venimeuse | 2j | 200 |
| Bulbe de feu | 4j | 280 |
| Plante carnivore | 6j | 360 |
| Fleur de cristal | 10j | 460 |
| Arbre ancien | 14j | 580 |

L'XP plante est multiplié par la quantité de plante consommée :
```
xp_plante = XP_BASE_PLANTE[plantId] × quantité
```

### XP Matériaux (20% du total)
Basé sur la **rareté** des matériaux :

| Rareté matériau (`MaterialRarity`) | XP par matériau |
|------------------------------------|----------------|
| COMMON (1) | 15 |
| UNCOMMON (2) | 40 |
| RARE (3) | 80 |

```
xp_materiaux = somme(XP_PAR_RARETE[mat.rarity]) pour chaque matériau de la recette
```

### XP total en échec
Montant fixe : `15 × niveau_recette`

### Calibration vérification
Recette typique milieu de gamme (niveau 4, Racine de fer ×2, 2 matériaux uncommon) :
- XP plante = 90 × 2 = 180
- XP matériaux = 40 × 2 = 80
- XP total = 180 × 0.8 + 80 × 0.2 = 144 + 16 = **160 XP**

3 crafts/jour × 160 XP = 480 XP/jour → ~365 000 XP/an
Niveau 100 nécessite ~185 000 XP → **atteignable en ~385 jours** avec des recettes moyennes ✓

---

## 11. Recettes Détaillées — Potions

> **Principe clé :** Chaque potion a **8 tiers** (1 par `ItemRarity` : BASIC → MYTHICAL).
> Chaque type de potion utilise **une seule plante** comme ingrédient de base.
> La quantité de plante et le nombre de matériaux augmentent avec le tier.

### Convention de nommage des IDs
`potion_{nature}_{tier}` (ex: `potion_health_1`, `potion_health_8`)

### Potion de Vie (HEALTH) — Plante : Herbe commune (ID 1)

| Tier | ItemRarity | Plantes | Matériaux | Potion obtenue |
|------|-----------|---------|-----------|---------------|
| 1 | BASIC (0) | 1× Herbe commune | Eau purifiée (68) | BASIC HEALTH |
| 2 | COMMON (1) | 1× Herbe commune | Eau purifiée (68), Herbe de prairie (52) | COMMON HEALTH |
| 3 | UNCOMMON (2) | 2× Herbe commune | Herbe de prairie (52), Lavande séchée (30) | UNCOMMON HEALTH |
| 4 | EXOTIC (3) | 2× Herbe commune | Mousses (54), Lavande séchée (30), Fil de lin (37) | EXOTIC HEALTH |
| 5 | RARE (4) | 2× Herbe commune | Mousses (54), Racines de gingembre (41), Herbe de prairie (52) | RARE HEALTH |
| 6 | SPECIAL (5) | 3× Herbe commune | Herbe de prairie (52), Lavande séchée (30), Racines de gingembre (41), Mousses (54) | SPECIAL HEALTH |
| 7 | EPIC (6) | 3× Herbe commune | Mousses (54), Racines de gingembre (41), Cristal d'améthyste (5) | EPIC HEALTH |
| 8 | LEGENDARY (7) | 3× Herbe commune | Mousses (54), Racines de gingembre (41), Cristal d'améthyste (5), Fil de lin (37) | LEGENDARY HEALTH |

> Note : Les matériaux sont choisis parmi ceux cohérents avec la nature de la potion. Les `compostMaterials` de l'Herbe commune sont [52, 54, 37] = Herbe de prairie, Mousses, Fil de lin.

### Potion d'Énergie (ENERGY) — Plante : Trèfle doré (ID 2)

| Tier | ItemRarity | Plantes | Matériaux |
|------|-----------|---------|-----------|
| 1 | BASIC | 1× Trèfle doré | Laiton doré (43) |
| 2 | COMMON | 1× Trèfle doré | Laiton doré (43), Feuilles de chêne (59) |
| 3 | UNCOMMON | 2× Trèfle doré | Poussière d'argent (77), Pierre de lune (53) |
| 4 | EXOTIC | 2× Trèfle doré | Laiton doré (43), Feuilles de chêne (59), Coton (25) |
| 5 | RARE | 2× Trèfle doré | Poussière d'argent (77), Pierre de lune (53), Feuilles de chêne (59) |
| 6 | SPECIAL | 3× Trèfle doré | Poussière d'argent (77), Pierre de lune (53), Laiton doré (43), Coton (25) |
| 7 | EPIC | 3× Trèfle doré | Rune enchantée (34), Poussière d'étoile (80), Pierre précieuse (67) |
| 8 | LEGENDARY | 3× Trèfle doré | Rune enchantée (34), Poussière d'étoile (80), Pierre précieuse (67), Laiton doré (43) |

### Potion de Temps (TIME_SPEEDUP) — Plante : Mousse lunaire (ID 3)

| Tier | ItemRarity | Plantes | Matériaux |
|------|-----------|---------|-----------|
| 1 | BASIC | 1× Mousse lunaire | Bougie blanche (89) |
| 2 | COMMON | 1× Mousse lunaire | Bougie blanche (89), Pierre de lune (53) |
| 3 | UNCOMMON | 1× Mousse lunaire | Encens de sauge (73), Résine d'oud (60) |
| 4 | EXOTIC | 2× Mousse lunaire | Bougie blanche (89), Encens de sauge (73), Résine d'oud (60) |
| 5 | RARE | 2× Mousse lunaire | Encens de sauge (73), Résine d'oud (60), Pierre de lune (53) |
| 6 | SPECIAL | 2× Mousse lunaire | Flamme éternelle (35), Bois de santal (74), Livre philosophique (61) |
| 7 | EPIC | 3× Mousse lunaire | Flamme éternelle (35), Bois de santal (74), Livre philosophique (61), Lavande séchée (30) |
| 8 | LEGENDARY | 3× Mousse lunaire | Flamme éternelle (35), Bois de santal (74), Livre philosophique (61), Bougie blanche (89), Lavande séchée (30) |

### Potion de Défense (DEFENSE) — Plante : Racine de fer (ID 4)

| Tier | ItemRarity | Plantes | Matériaux |
|------|-----------|---------|-----------|
| 1 | BASIC | 1× Racine de fer | Fer brut (70) |
| 2 | COMMON | 1× Racine de fer | Fer brut (70), Racines de gingembre (41) |
| 3 | UNCOMMON | 1× Racine de fer | Cuivre (24), Acier (81) |
| 4 | EXOTIC | 2× Racine de fer | Fer brut (70), Cuivre (24), Acier (81) |
| 5 | RARE | 2× Racine de fer | Cuivre (24), Acier (81), Racines de gingembre (41) |
| 6 | SPECIAL | 2× Racine de fer | Acier inoxydable (79), Acier trempé (85), Titane (86) |
| 7 | EPIC | 3× Racine de fer | Acier inoxydable (79), Acier trempé (85), Titane (86), Fer brut (70) |
| 8 | LEGENDARY | 3× Racine de fer | Acier inoxydable (79), Acier trempé (85), Titane (86), Fer brut (70), Acier (81) |

### Potion d'Attaque (ATTACK) — Plante : Champignon nocturne (ID 5)

| Tier | ItemRarity | Plantes | Matériaux |
|------|-----------|---------|-----------|
| 1 | BASIC | 1× Champignon nocturne | Champignon (55) |
| 2 | COMMON | 1× Champignon nocturne | Champignon (55), Champignon vénéneux (66) |
| 3 | UNCOMMON | 1× Champignon nocturne | Belladone (10), Champignon vénéneux (66) |
| 4 | EXOTIC | 2× Champignon nocturne | Champignon (55), Belladone (10), Champignon vénéneux (66) |
| 5 | RARE | 2× Champignon nocturne | Belladone (10), Champignon vénéneux (66), Champignon extrêmement vénéneux (36) |
| 6 | SPECIAL | 2× Champignon nocturne | Mûres de sureau (32), Tétrodotoxine de fugu (38), Champignon vénéneux (66) |
| 7 | EPIC | 3× Champignon nocturne | Mûres de sureau (32), Tétrodotoxine de fugu (38), Champignon extrêmement vénéneux (36) |
| 8 | LEGENDARY | 3× Champignon nocturne | Mûres de sureau (32), Tétrodotoxine de fugu (38), Champignon extrêmement vénéneux (36), Belladone (10) |

### Potion de Vitesse (SPEED) — Plante : Feuille venimeuse (ID 6)

| Tier | ItemRarity | Plantes | Matériaux |
|------|-----------|---------|-----------|
| 1 | BASIC | 1× Feuille venimeuse | Soufre (82) |
| 2 | COMMON | 1× Feuille venimeuse | Soufre (82), Belladone (10) |
| 3 | UNCOMMON | 1× Feuille venimeuse | Poudre de charbon (21), Poudre à canon (44) |
| 4 | EXOTIC | 2× Feuille venimeuse | Soufre (82), Poudre de charbon (21), Poudre à canon (44) |
| 5 | RARE | 2× Feuille venimeuse | Poudre de charbon (21), Poudre à canon (44), Graine de ricin (17) |
| 6 | SPECIAL | 2× Feuille venimeuse | Chlorate de potassium (1), Gaz comprimé (23), Nitroglycérine (56) |
| 7 | EPIC | 3× Feuille venimeuse | Chlorate de potassium (1), Gaz comprimé (23), Nitroglycérine (56), Soufre (82) |
| 8 | LEGENDARY | 3× Feuille venimeuse | Chlorate de potassium (1), Gaz comprimé (23), Nitroglycérine (56), Soufre (82), Poudre à canon (44) |

---

## 12. Recettes Détaillées — Nourriture de Familier

> 4 types de nourriture × 5 tiers = **20 recettes** au total
> Les 3 tiers détaillés dans le design original (Basique, Inter, Expert) sont conservés tels quels.
> 2 tiers supplémentaires (Novice et Maître) ont été extrapolés pour atteindre les 5 demandés.

### Salade / herbivorousFood — Plante : Herbe commune (ID 1)

| Tier | Niveau recette | Plantes | Matériaux | Output | Love pts |
|------|---------------|---------|-----------|--------|----------|
| Novice | 1 | 1× Herbe commune | Fil de lin (37) | 1 salade | 3 |
| Basique | 2 | 3× Herbe commune | Feuilles de chêne (59) | 2 salade | 6 |
| Inter | 4 | 4× Herbe commune + 1× Trèfle doré | Pignon de pin (64), Tige de bambou (8) | 4 salade | 12 |
| Expert | 6 | 4× Herbe commune + 2× Trèfle doré + 1× Mousse lunaire | Feuille d'érable (51), Cactus (15), Liane céleste (19) | 7 salade | 21 |
| Maître | 8 | 4× Herbe commune + 3× Trèfle doré + 2× Mousse lunaire | Herbe fantôme (40), Liane céleste (19), Rose du néant (87), Cactus (15) | 10 salade | 30 |

> Note : Les tiers supérieurs de la salade utilisent aussi d'autres plantes en complément. La plante "principale" pour le calcul d'XP reste l'Herbe commune.

### Friandise / commonFood — Plante : Trèfle doré (ID 2)

| Tier | Niveau recette | Plantes | Matériaux | Output | Love pts |
|------|---------------|---------|-----------|--------|----------|
| Novice | 1 | 1× Trèfle doré | Morceau de tissu (20) | 1 friandise | 1 |
| Basique | 2 | 1× Herbe commune + 1× Trèfle doré | Branche de chêne (58) | 3 friandise | 3 |
| Inter | 4 | 2× Trèfle doré + 1× Bulbe de feu | Coton (25), Écorce d'hêtre (9) | 7 friandise | 7 |
| Expert | 6 | 3× Trèfle doré + 2× Bulbe de feu | Bronze (14), Branche de noyer (88), Bois de cèdre (18) | 12 friandise | 12 |
| Maître | 8 | 3× Trèfle doré + 3× Bulbe de feu + 1× Fleur de cristal | Planche de teck (84), Écorce d'ébène (31), Bois de cèdre (18), Branche de noyer (88) | 18 friandise | 18 |

### Viande / carnivorousFood — Plante : Plante carnivore (ID 8)

| Tier | Niveau recette | Plantes | Matériaux | Output | Love pts |
|------|---------------|---------|-----------|--------|----------|
| Novice | 2 | 1× Plante carnivore | Cuir d'agneau (48) | 1 viande | 3 |
| Basique | 3 | 1× Plante carnivore | Cuir de chèvre (42) | 2 viande | 6 |
| Inter | 5 | 2× Plante carnivore + 1× Racine de fer | Cuir d'agneau (48), Cuir de vache (26) | 4 viande | 12 |
| Expert | 7 | 3× Plante carnivore + 1× Racine de fer + 1× Champignon nocturne | Cuir de porc (63), Cuir de serpent (78), Cuir de bison (11) | 7 viande | 21 |
| Maître | 8 | 3× Plante carnivore + 2× Racine de fer + 1× Champignon nocturne | Cuir de bison (11), Cuir de crocodile (27), Cuir synthétique (83), Cuir de serpent (78) | 10 viande | 30 |

### Ultime / ultimateFood — Plante : Arbre ancien (ID 10)

| Tier | Niveau recette | Plantes | Matériaux | Output | Love pts |
|------|---------------|---------|-----------|--------|----------|
| Novice | 4 | 1× Arbre ancien | Branche de chêne (58) | 1 ultime | 3 |
| Basique | 5 | 1× Arbre ancien | Flamme éternelle (35) | 1 ultime | 5 |
| Inter | 7 | 2× Arbre ancien + 1× Fleur de cristal | Poussière d'argent (77), Larme d'élémentaire (33) | 3 ultime | 15 |
| Expert | 8 | 3× Arbre ancien + 2× Fleur de cristal | Rune enchantée (34), Poussière d'étoile (80), Plume de phoenix (62) | 5 ultime | 25 |
| Maître | 8 | 3× Arbre ancien + 3× Fleur de cristal + 1× Mousse lunaire | Rune enchantée (34), Poussière d'étoile (80), Plume de phoenix (62), Flamme éternelle (35), Pierre précieuse (67) | 8 ultime | 40 |

---

## 13. Intégration Codebase — Fichiers à Modifier

### Lib

| Fichier | Modification |
|---------|-------------|
| `Lib/src/types/HomeFeatures.ts` | Ajouter `cookingSlots: number` à l'interface `HomeFeatures`. **Supprimer** `craftPotionMaximumRarity: ItemRarity` |
| `Lib/src/types/HomeLevel.ts` | Définir `cookingSlots` pour chaque niveau. **Supprimer** `craftPotionMaximumRarity` de chaque niveau |
| `Lib/src/constants/ItemConstants.ts` | Pas de changement direct, mais utiliser `ItemRarity` et `ItemNature` |
| `Lib/src/packets/commands/CommandProfilePacket.ts` | Ajouter `cookingLevel?: number` et `cookingGrade?: string` dans `playerData` |
| `Lib/src/packets/commands/CommandReportPacket.ts` | Ajouter packets pour cooking (ignite, craft, etc.) |
| `Lib/src/packets/interaction/ReactionCollectorCity.ts` | Ajouter données de cuisine dans `home.owned` |
| `Lib/src/CrowniclesIcons.ts` | Ajouter emojis pour les grades de cuisine et le fourneau |

### Core

| Fichier | Modification |
|---------|-------------|
| `Core/src/core/database/game/models/Player.ts` | Ajouter fields `cookingLevel`, `cookingExperience`, `furnaceUsesToday`, `furnaceLastUseDate`, `furnaceOverheatUntil`, `furnacePosition` |
| `Core/src/commands/player/ReportCommand.ts` | Ajouter données cuisine dans le packet de la maison |
| `Core/src/commands/player/ProfileCommand.ts` | Ajouter le grade de cuisine dans la réponse |
| `Core/src/core/report/ReportCityService.ts` | Nouveau handler `openLumberjack()` pour la boutique de bois |
| `Core/resources/cities/coco_village.json` | Ajouter `lumberjack` dans `shops` |
| `Core/src/core/smallEvents/petFood.ts` | Ajouter la logique Gaspard Jo (recette offerte si soupe pleine + 10% chance) |
| `Core/src/core/smallEvents/farmer.ts` | Ajouter la possibilité d'acheter des recettes |
| `Core/src/core/missions/Campaign.ts` | Hook lors de milestone 50 missions pour débloquer recette |

### Discord

| Fichier | Modification |
|---------|-------------|
| `Discord/src/commands/player/report/home/HomeFeatureRegistry.ts` | Enregistrer le `CookingFeatureHandler` |
| `Discord/src/commands/player/report/home/HomeMenuConstants.ts` | Ajouter les IDs de menu pour la cuisine |
| `Discord/src/commands/player/report/ReportCityMenu.ts` | **Supprimer** les références à `craftPotionMaximumRarity` dans `HOME_UPGRADES` |

### Lang

| Fichier | Modification |
|---------|-------------|
| `Lang/fr/commands.json` | Ajouter traductions cuisine (menu, descriptions, grades, messages succès/échec) |
| `Lang/fr/smallEvents.json` | Ajouter dialogues Gaspard Jo cuisine et fermière cuisine |

---

## 14. Fichiers à Créer

### Lib

| Fichier | Description |
|---------|------------|
| `Lib/src/constants/CookingConstants.ts` | Toutes les constantes cuisine (grades, XP, taux d'échec, cycles slots, coûts) |
| `Lib/src/types/CookingRecipe.ts` | Interface `CookingRecipe` + types associés |
| `Lib/src/types/CookingGrade.ts` | Définition des grades et mapping grade → buffs |

### Core

| Fichier | Description |
|---------|------------|
| `Core/src/core/cooking/CookingService.ts` | Logique principale : craft, XP, level up, échec |
| `Core/src/core/cooking/RecipeRegistry.ts` | Registre de toutes les recettes (chargé depuis fichier de données) |
| `Core/src/core/cooking/CookingSlotRotation.ts` | Logique de rotation déterministe des recettes par slot |
| `Core/src/core/report/ReportCookingService.ts` | Gestion des packets cooking (ignite, craft) côté rapport |
| `Core/resources/cooking/recipes.json` | Fichier de données avec toutes les recettes |
| `Core/src/core/database/game/models/PlayerCookingRecipes.ts` | Modèle Sequelize des recettes découvertes |
| Migration | Ajout `cookingLevel`, `cookingExperience` au joueur + table `PlayerCookingRecipes` |

### Discord

| Fichier | Description |
|---------|------------|
| `Discord/src/commands/player/report/home/features/CookingFeatureHandler.ts` | Handler UI complet : menu fourneau, sélection recette, affichage résultat |

---

## 15. Code Legacy à Supprimer

### `craftPotionMaximumRarity`

Ce champ dans `HomeFeatures` est l'ancien système de craft de potions qui sera remplacé par la cuisine.

**Fichiers à nettoyer :**

1. **`Lib/src/types/HomeFeatures.ts`** — Supprimer `craftPotionMaximumRarity: ItemRarity` de l'interface
2. **`Lib/src/types/HomeLevel.ts`** — Supprimer `craftPotionMaximumRarity` de chaque `HomeLevel.LEVEL_X`
3. **`Discord/src/commands/player/report/ReportCityMenu.ts`** — Supprimer le block dans `HOME_UPGRADES` qui référence `craftPotionMaximumRarity` (lignes ~580-585 : `hasChanged`, `isNew`, `newKey: "craftPotionStation"`, `upgradeKey: "betterCraftPotionStation"`)
4. **`Lang/fr/commands.json`** — Supprimer ou remplacer les clés `craftPotionStation` et `betterCraftPotionStation` (lignes ~1116-1117)
5. Chercher toute autre référence avec `grep -rn "craftPotion" .`

---

## 16. Schéma Base de Données

### Modifications table `players`
```sql
ALTER TABLE players ADD COLUMN cookingLevel INT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN cookingExperience INT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN furnaceUsesToday INT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN furnaceLastUseDate DATE NULL;
ALTER TABLE players ADD COLUMN furnaceOverheatUntil DATETIME NULL;
ALTER TABLE players ADD COLUMN furnacePosition INT NOT NULL DEFAULT 0;
```

### Nouvelle table `player_cooking_recipes`
```sql
CREATE TABLE player_cooking_recipes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    playerId INT NOT NULL,
    recipeId VARCHAR(64) NOT NULL,
    discoveredAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playerId) REFERENCES players(id),
    UNIQUE KEY unique_player_recipe (playerId, recipeId)
);
```

> Note : Les recettes `discoveredByDefault: true` ne sont PAS stockées dans cette table. Seules les recettes découvertes dynamiquement y sont.

---

## 17. Packets MQTT

### Nouveaux packets à créer

Ajoutés dans `Lib/src/packets/commands/CommandReportPacket.ts` :

```typescript
// Requête : allumer le fourneau
export class CommandReportCookingIgniteReq extends CrowniclesPacket {
    // Pas de paramètre, le Core vérifie le bois et la priorité
}

// Réponse : confirmation nécessaire (bois non-commun sera utilisé)
export class CommandReportCookingWoodConfirmReq extends CrowniclesPacket {
    woodMaterialId!: number;    // ID du bois qui sera consommé
    woodRarity!: number;        // Rareté du bois (pour info)
}

// Requête : le joueur confirme l'utilisation du bois non-commun
export class CommandReportCookingWoodConfirmRes extends CrowniclesPacket {
    accepted!: boolean;         // true = consommer, false = annuler
}

// Réponse : fourneau allumé avec les recettes disponibles
export class CommandReportCookingIgniteRes extends CrowniclesPacket {
    slots!: {
        slotIndex: number;
        recipe: {
            id: string;
            level: number;
            isSecret: boolean;          // Si true, l'output est masqué
            outputDescription: string;  // Description traduite (ou "???" si secret)
            ingredients: {
                plants: { plantId: PlantId; quantity: number; playerHas: number }[];
                materials: { materialId: number; quantity: number; playerHas: number }[];
            };
            canCraft: boolean;
        } | null;  // null si pas de recette éligible dans ce slot
    }[];
    woodConsumed: boolean;       // false si buff Chef de table activé
    woodMaterialId: number;      // ID du bois consommé (pour l'affichage)
    furnaceUsesRemaining: number; // 10 - usesToday (pour afficher au joueur)
    cookingGrade: string;
    cookingLevel: number;
}

// Erreur : pas de bois
export class CommandReportCookingNoWoodRes extends CrowniclesPacket {}

// Erreur : fourneau en surchauffe
export class CommandReportCookingOverheatRes extends CrowniclesPacket {
    overheatUntil!: number;     // Timestamp (epoch ms) de fin de surchauffe
}

// Requête : raviver le feu (avancer le cycle)
export class CommandReportCookingReviveReq extends CrowniclesPacket {
    // Même logique de priorité bois que l'allumage
}

// Réponse : feu ravivé (même structure que IgniteRes)
export class CommandReportCookingReviveRes extends CommandReportCookingIgniteRes {}

// Requête : préparer une recette
export class CommandReportCookingCraftReq extends CrowniclesPacket {
    slotIndex!: number;
}

// Réponse : résultat du craft
export class CommandReportCookingCraftRes extends CrowniclesPacket {
    success!: boolean;
    recipeId!: string;
    wasSecret!: boolean;        // Si la recette était secrète (pour révéler l'output)
    
    // Si succès
    outputType!: "potion" | "petFood";
    potionId?: number;          // ID de la potion obtenue
    petFoodType?: string;       // Type de nourriture
    petFoodQuantity?: number;   // Quantité obtenue
    
    // Si échec
    failedPotionId?: number;    // ID de la potion sans effet
    
    // XP
    cookingXpGained!: number;
    cookingLevelUp!: boolean;
    newCookingLevel?: number;
    newCookingGrade?: string;
    
    // Buff matériau économisé
    materialSaved?: number;     // materialId pas consommé (buff Cuisinier)
    
    // Recettes découvertes lors du level up cuisine
    discoveredRecipeIds?: string[];  // IDs des recettes nouvellement débloquées
}
```

---

## 18. Plan d'Implémentation

### Phase 1 — Fondations ✅
1. ✅ Supprimer le code legacy (`craftPotionMaximumRarity`)
2. ✅ Créer `CookingConstants.ts` avec grades, XP, taux d'échec
3. ✅ Créer `CookingRecipe.ts` (types)
4. ✅ Grades intégrés dans `CookingConstants.ts` (pas de fichier séparé)
5. ✅ Ajouter `cookingSlots` dans `HomeFeatures` et `HomeLevel`
6. ✅ Migration DB `054-cooking.ts` : 6 champs joueur + table `player_cooking_recipes`

### Phase 2 — Logique Core ✅
7. ✅ `RecipeRegistry.ts` (singleton, charge `resources/cooking/recipes.json`)
8. ✅ `CookingSlotRotation.ts` (LCG PRNG + Fisher-Yates)
9. ✅ `CookingService.ts` (craft, XP, level up, échec, buffs)
10. ✅ `ReportCookingService.ts` (4 handlers MQTT : ignite, woodConfirm, revive, craft)
11. ✅ `Player.ts` modifié (6 champs cuisine + hook level milestone)

### Phase 3 — UI Discord ✅
12. ✅ `HomeMenuConstants.ts` (COOKING_MENU, COOKING_IGNITE, etc.)
13. ✅ `CookingFeatureHandler.ts` (~590 lignes, UI complète)
14. ✅ Enregistré dans `HomeFeatureRegistry.ts`
15. ✅ Legacy `craftPotionMaximumRarity` supprimé

### Phase 4 — Découverte de Recettes ✅
16. ✅ `petFood.ts` (Gaspard Jo — achat payant progressif 15→1500💰)
17. ✅ `farmer.ts` (fermière — achat payant progressif 15→1000💰)
18. ✅ Hook campagne (`Campaign.ts` — milestone complétion)
19. ✅ Hook level joueur (`Player.ts` — à chaque level up)
20. ✅ Hook boss d'île (`ReportPveService.ts` — 1ère victoire, `sourceMapId`)
21. ✅ Hook sorcière (`witch.ts` — succès ou no-effect potion)
22. ✅ Hook niveau de cuisine (`CookingService.ts` — après level up)

### Phase 5 — Profil et Traductions ✅
23. ✅ `CommandProfilePacket.ts` + Core/Discord `ProfileCommand.ts` modifiés
24. ✅ Traductions FR complètes : 68 noms de recettes, 10 noms de grades, UI cuisine, profil, boutique bûcheron
25. ✅ 4 tests unitaires recettes (`CookingRecipeData.test.ts`)

### Phase 6 — Boutique Bûcheron ✅
26. ✅ `coco_village.json` — `lumberjack` dans `shops`
27. ✅ `ReportCityService.ts` — handler `openLumberjack()`
28. ✅ `LogsConstants.ts` — `WOOD_COMMON_BUNDLE`, `WOOD_UNCOMMON_BUNDLE`, `WOOD_RARE_BUNDLE`

### Phase 7 — Corrections et Polish ✅
29. ✅ Buff bois économisé (Chef de table `woodSaveChance`) implémenté dans `igniteOrReviveFurnace()`
30. ✅ `CommandReportCookingReviveRes` envoyé correctement (pas `IgniteRes`)
31. ✅ Message d'erreur si craft sur slot vide
32. ✅ Traduction des noms de grades (`models:cooking.grades.*`)
33. ✅ Traduction des noms de recettes dans craftSuccess/craftFailure
34. ✅ `RecipeRegistry` charge `recipes.json` relatif au CWD (pas `__dirname`)
