---
name: create-small-event
description: Step-by-step guide for creating a new Small Event (random encounter during player travel). Use this skill when asked to create, add, or implement a new small event in the Crownicles game.
---

# How to Create a New Small Event

## Overview
A Small Event is a random encounter that happens to players during travel reports. Each small event requires **6 files** across 4 services.

## Architecture: 6 Files Required

### 1. Packet Definition (Lib)
**Path:** `Lib/src/packets/smallEvents/SmallEvent{Name}Packet.ts`

Create a packet class that extends `SmallEventPacket` (no extra fields) or `SmallEventAddSomething` (if you need an `amount` field).

```typescript
import { SmallEventPacket } from "./SmallEventPacket";
import { PacketDirection, sendablePacket } from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEvent{Name}Packet extends SmallEventPacket {
    // Add any custom fields the Discord handler needs to display the event
    // Use `!` for definite assignment: myField!: number;
}
```

**Key rules:**
- Always use `@sendablePacket(PacketDirection.BACK_TO_FRONT)`
- Fields use `!` definite assignment assertion
- Extend `SmallEventAddSomething` if you only need an `amount` field
- For pet info, include `petTypeId!: number`, `petSex!: SexTypeShort`, `petNickname!: string | undefined`

### 2. Resource JSON (Core)
**Path:** `Core/resources/smallEvents/{name}.json`

```json
{
  "rarity": 1
}
```

**Rarity is a weighted probability** — higher = more frequent. Reference values:
- `1` = very rare (e.g., bigBad)
- `3` = rare (e.g., winHealth)
- `6` = uncommon (e.g., doNothing)
- `8` = moderate (e.g., fightPet)
- `40` = common (e.g., goToPVEIsland)
- `50` = very common (e.g., haunted)

### 3. Core Handler
**Path:** `Core/src/core/smallEvents/{name}.ts`

Must export `smallEventFuncs: SmallEventFuncs` with two functions:

```typescript
import { SmallEventFuncs } from "../../data/SmallEvent";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEvent{Name}Packet } from "../../../../Lib/src/packets/smallEvents/SmallEvent{Name}Packet";
import { Maps } from "../maps/Maps";

export const smallEventFuncs: SmallEventFuncs = {
    canBeExecuted: player => {
        // Return true/false if this event can trigger for this player
        // Common checks: Maps.isOnContinent(player), player.level >= X
        return Maps.isOnContinent(player);
    },
    executeSmallEvent: async (response, player): Promise<void> => {
        // Game logic here: modify player state, give rewards, etc.
        // Always push a packet at the end
        response.push(makePacket(SmallEvent{Name}Packet, { /* fields */ }));
    }
};
```

**Auto-discovery:** Core automatically loads all files from `dist/Core/src/core/smallEvents/*.js` — no manual registration needed.

**SmallEventFuncs interface:**
```typescript
type SmallEventFuncs = {
    canBeExecuted: (player: Player) => boolean | Promise<boolean>;
    executeSmallEvent: (response: CrowniclesPacket[], player: Player, context: PacketContext, testArgs?: string[]) => void | Promise<void>;
};
```

**Common patterns:**
- Give tokens: `await player.addTokens({ amount: 1, response, reason: NumberChangeReason.SMALL_EVENT }); await player.save();`
- Give health: `await player.addHealth({ amount, response, reason: NumberChangeReason.SMALL_EVENT }); await player.save();`
- Random number: `RandomUtils.rangedInt(SmallEventConstants.RANGE)` or `RandomUtils.randInt(min, maxExclusive)`
- Random pick from array: `array[RandomUtils.randInt(0, array.length)]`
- Player map info: `MapLinkDataController.instance.getById(player.mapLinkId)` → `{ startMap, endMap, tripDuration }`
- Check location: `Maps.isOnContinent(player)`, `Maps.isOnBoat(player)`, `Maps.isOnPveIsland(player)`

### 4. Icon (Lib)
**Path:** `Lib/src/CrowniclesIcons.ts`

Add an entry in the `smallEvents` object (around line 947+):

```typescript
smallEvents: {
    // ... existing entries ...
    {name}: "🎯"  // Pick an appropriate emoji
},
```

The `smallEventId` used in `CrowniclesSmallEventEmbed` must match this key.

### 5. Discord Handler
**Path:** `Discord/src/packetHandlers/handlers/SmallEventsHandler.ts`

Add a new `@packetHandler` method in the `SmallEventsHandler` class:

```typescript
// Add import at the top of the file
import { SmallEvent{Name}Packet } from "../../../../Lib/src/packets/smallEvents/SmallEvent{Name}Packet";

// Add method in SmallEventsHandler class
@packetHandler(SmallEvent{Name}Packet)
async smallEvent{Name}(context: PacketContext, packet: SmallEvent{Name}Packet): Promise<void> {
    const interaction = DiscordCache.getInteraction(context.discord!.interaction);
    const lng = interaction!.userLanguage;
    await interaction?.editReply({
        embeds: [
            new CrowniclesSmallEventEmbed(
                "{name}",  // Must match CrowniclesIcons.smallEvents key
                getRandomSmallEventIntro(lng)
                + StringUtils.getRandomTranslation("smallEvents:{name}.stories", lng, { /* template vars */ }),
                interaction.user,
                lng
            )
        ]
    });
}
```

**Key imports available:**
- `DiscordCache.getInteraction(context.discord!.interaction)` — get Discord interaction
- `getRandomSmallEventIntro(lng)` — random intro phrase
- `StringUtils.getRandomTranslation(key, lng, vars)` — pick random translation
- `CrowniclesSmallEventEmbed(eventId, description, user, lng)` — embed builder
- `PetUtils.petToShortString(lng, nickname, typeId, sex)` — format pet name with emote
- `DisplayUtils.getPetIcon(typeId, sex)` — get pet emoji

### 6. French Translations
**Path:** `Lang/fr/smallEvents.json`

Add a new entry at the end of the JSON (before the closing `}`):

```json
"{name}": {
    "stories": [
        "description narrative de ce qui se passe... **effet en gras** {emote:unitValues.health}",
        "autre variante du texte...",
        "encore une autre variante..."
    ]
}
```

**Translation rules:**
- Write at least 3-5 story variants
- Use `{{variable}}` for template variables (e.g., `{{pet}}`, `{{health, number}}`)
- Use `{emote:path}` for emojis (e.g., `{emote:unitValues.token}`, `{emote:unitValues.health}`)
- Bold important info with `**text**`
- ONLY edit French translations — other languages are synced via Crowdin
- NEVER use direct speech (no dialogue with quotes)
- Stories are appended to a random intro phrase, so start with lowercase

## Useful Data Models

### Player
- `player.mapLinkId` → current travel link
- `player.level` → player level
- `player.petId` → player's pet ID (null if no pet)
- `player.health` / `player.getMaxHealth()`
- `player.guildId` → guild ID (null if no guild)

### PetExpedition
- `PetExpedition.findAll({ where: { mapLocationId, status: ExpeditionConstants.STATUS.IN_PROGRESS } })` — find active expeditions on a map
- `PetExpeditions.getActiveExpeditionForPlayer(playerId)` — get player's active expedition

### PetEntity
- `PetEntities.getById(id)` → `PetEntity`
- `petEntity.getBasicInfo()` → `{ petTypeId, petSex, petNickname }`
- `petEntity.isFeisty()` — check if pet is feisty

### MapLink
- `MapLinkDataController.instance.getById(mapLinkId)` → `{ startMap, endMap, tripDuration }`

## Checklist Before Committing

- [ ] Packet class in `Lib/src/packets/smallEvents/` with `@sendablePacket(PacketDirection.BACK_TO_FRONT)`
- [ ] Resource JSON in `Core/resources/smallEvents/` with appropriate rarity
- [ ] Core handler in `Core/src/core/smallEvents/` exporting `smallEventFuncs`
- [ ] Icon added to `CrowniclesIcons.smallEvents` in `Lib/src/CrowniclesIcons.ts`
- [ ] Discord handler method in `Discord/src/packetHandlers/handlers/SmallEventsHandler.ts`
- [ ] French translations in `Lang/fr/smallEvents.json` with 3+ story variants
- [ ] ESLint passes on all modified files
- [ ] TypeScript compiles with `npx tsc --noEmit` in Core, Lib, and Discord
- [ ] All tests pass with `pnpm test` in Core
