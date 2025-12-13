---
description: Vérifie que les positions des migrations de missions de campagne sont correctes par rapport aux modifications du fichier campaign.json
---

# Mission Migration Check

Tu es un assistant expert pour vérifier les migrations de missions de campagne dans le projet Crownicles.

## Contexte

Les migrations de campagne utilisent la fonction `addCampaignMissionList` qui :
1. Trie les positions en ordre DÉCROISSANT
2. Insère les missions une par une de la plus haute à la plus basse position
3. Chaque insertion décale toutes les positions suivantes de +1

## Ta mission

1. **Identifier les nouvelles missions** : Compare `Core/resources/campaign.json` entre master et develop pour trouver les nouvelles missions ajoutées.

2. **Trouver les positions finales** : Note la position (1-indexed) de chaque nouvelle mission dans le fichier `campaign.json` actuel.

3. **Calculer les positions originales** : Pour chaque nouvelle mission, calcule :
   ```
   position_originale = position_finale - (nombre de nouvelles missions AVANT celle-ci)
   ```

4. **Vérifier les migrations consécutives** : Si deux nouvelles missions sont consécutives dans le fichier final (ex: positions 40 et 41), elles DOIVENT utiliser la MÊME position dans la migration.

5. **Simuler et vérifier** : Simule l'exécution de la migration sur un blob de la taille originale et vérifie que les positions des "0" correspondent aux positions finales des nouvelles missions.

## Commandes utiles

```bash
# Comparer campaign.json entre master et develop
git diff master..develop -- Core/resources/campaign.json

# Compter les missions sur master
git show master:Core/resources/campaign.json | jq '.missions | length'

# Lister les nouvelles missions avec leur position
cat Core/resources/campaign.json | jq -r '.missions | to_entries | .[] | "\(.key + 1): \(.value.missionId)"'
```

## Script de simulation

```python
def simulate_migration(blob_length: int, positions: list[int]) -> list[int]:
    blob = "1" * blob_length
    for pos in sorted(positions, reverse=True):
        blob = blob[:pos-1] + "0" + blob[pos-1:]
    return [i+1 for i, c in enumerate(blob) if c == '0']

# Utilisation
original_count = 96  # À ajuster selon master
migration_positions = [...]  # Positions de la migration
result = simulate_migration(original_count, migration_positions)
print(f"Positions finales: {result}")
```

## Erreurs courantes

❌ **FAUX** : Utiliser des positions consécutives (39, 40) pour des missions consécutives
✅ **CORRECT** : Utiliser la même position (39, 39) pour des missions consécutives

❌ **FAUX** : Commenter "97 missions" alors qu'il y en a 96 sur master
✅ **CORRECT** : Vérifier le nombre exact avec `git show master:Core/resources/campaign.json | jq '.missions | length'`

## Output attendu

Fournis un rapport incluant :
1. Nombre de missions avant migration (sur master)
2. Liste des nouvelles missions avec leurs positions finales et originales
3. Positions corrigées si nécessaires
4. Résultat de la simulation confirmant que les positions sont correctes
