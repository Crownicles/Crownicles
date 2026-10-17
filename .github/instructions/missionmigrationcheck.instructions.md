---
applyTo: '**/migrations/**campaign*.ts,**/campaign.json'
---
# Mission Migration Verification Guide

## Purpose
This prompt helps verify that campaign mission migrations have correct position indices based on the changes made to `campaign.json`.

## How Campaign Migrations Work

### The Algorithm
The `addCampaignMissionList` function:
1. **Sorts positions in DESCENDING order** (highest first)
2. Inserts missions one by one from highest position to lowest
3. Each insertion shifts all subsequent positions by +1

### Critical Rule for Consecutive Missions
When two missions must be inserted consecutively (mission B right after mission A):
- **WRONG**: Use positions `X` and `X+1` (e.g., 39 and 40)
- **CORRECT**: Use the **SAME position** `X` twice (e.g., 39 and 39)

**Why?** Because the algorithm processes in descending order:
1. If you use 40 then 39: position 40 is inserted first (pointing to wrong mission), then 39
2. If you use 39 twice: both are inserted at the same original position, in the correct order

### Position Calculation Formula
To find the correct position for a migration:
```
original_position = final_position - (number_of_new_missions_before_this_one)
```

## Verification Steps

### Step 1: Identify New Missions
Compare `campaign.json` changes between master and develop:
```bash
git diff master..develop -- Core/resources/campaign.json
```

### Step 2: Find Final Positions
For each new mission added, note its final position (1-indexed) in the updated `campaign.json`.

### Step 3: Calculate Original Positions
For each new mission:
1. Count how many other new missions appear BEFORE it in the final list
2. Subtract that count from the final position
3. Result = the position to use in the migration

### Step 4: Handle Consecutive Missions
If two new missions are consecutive in the final campaign (e.g., positions 40 and 41):
- They should both use the SAME original position in the migration
- The algorithm will insert them in the order they appear in the array

## Example Verification

Given new missions at final positions: 26, 40, 41, 78, 86, 87, 95, 96, 102, 106

| Final Pos | Mission                | New missions before | Original Pos |
|-----------|------------------------|---------------------|--------------|
| 26        | meetVelanna            | 0                   | 26           |
| 40        | doExpeditions          | 1                   | 39           |
| 41        | buyTokensFromShop      | 2                   | 39 ← SAME!   |
| 78        | longExpedition 120     | 3                   | 75           |
| 86        | longExpedition 300     | 4                   | 82           |
| 87        | dangerousExpedition 30 | 5                   | 82 ← SAME!   |
| 95        | expeditionStreak       | 6                   | 89           |
| 96        | maxTokensReached       | 7                   | 89 ← SAME!   |
| 102       | dangerousExpedition 50 | 8                   | 94           |
| 106       | showCloneToTalvar      | 9                   | 97           |

## Simulation Script

Use this Python script to verify migration positions:

```python
def simulate_migration(blob_length: int, positions: list[int]) -> list[int]:
    """
    Simulate the migration and return final positions of '0's in the blob.
    """
    blob = "1" * blob_length
    positions_sorted = sorted(positions, reverse=True)
    
    for pos in positions_sorted:
        before = blob[:pos-1]
        after = blob[pos-1:]
        blob = before + "0" + after
    
    return [i+1 for i, c in enumerate(blob) if c == '0']

# Example: verify migration positions
original_missions = 96  # Number of missions BEFORE migration
migration_positions = [26, 39, 39, 75, 82, 82, 89, 89, 94, 97]

result = simulate_migration(original_missions, migration_positions)
print(f"Positions of new missions in final blob: {result}")
# Should match the final positions in campaign.json
```

## Common Mistakes to Avoid

1. **Using +1 for consecutive missions**: Always use the same position
2. **Wrong mission count**: Double-check the number of missions in the original campaign
3. **Forgetting the down() function**: Update both `up()` and `down()` with correct positions
4. **Not handling completed campaign players**: Include UPDATE query for players with `campaignProgression = 0`

## Checklist Before Committing

- [ ] Original mission count in comment matches actual count on master/main branch
- [ ] All consecutive mission pairs use the SAME position
- [ ] Simulated blob positions match final positions in campaign.json
- [ ] `down()` function uses the same positions as `up()`
- [ ] UPDATE query sets correct first new mission position for completed players
