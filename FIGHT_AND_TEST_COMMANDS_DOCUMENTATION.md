# Documentation Complète : Système de Test et de Combat de Crownicles

## Table des matières
1. [Architecture Générale](#architecture-générale)
2. [Système de Commandes Test](#système-de-commandes-test)
3. [Système de Combat (Fight)](#système-de-combat-fight)
4. [Guide pour Créer une Commande Test de Combat IA vs IA](#guide-pour-créer-une-commande-test-de-combat-ia-vs-ia)

---

## Architecture Générale

Crownicles utilise une architecture microservices avec communication MQTT :

- **Core** : Moteur de jeu (logique métier)
- **Discord** : Frontend Discord (affichage et interactions)
- **Lib** : Bibliothèque partagée (packets, types, constantes)

### Communication via MQTT

Les services communiquent via des **packets** fortement typés définis dans `Lib/src/packets/` :

```typescript
// Exemple : CommandTestPacketReq (Frontend → Backend)
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandTestPacketReq extends CrowniclesPacket {
    keycloakId!: string;
    command?: string;
}

// Exemple : CommandTestPacketRes (Backend → Frontend)
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTestPacketRes extends CrowniclesPacket {
    commandName!: string;
    result!: string;
    isError!: boolean;
}
```

---

## Système de Commandes Test

### Vue d'ensemble

Le système de test permet d'exécuter des commandes de développement/débogage sans passer par les contraintes normales du jeu.

### Architecture

```
/test <command> <args>
       ↓
Discord → CommandTestPacketReq via MQTT
       ↓
Core → TestCommand.execute()
       ↓
CommandsTest.getTestCommand() → charge la commande test
       ↓
CommandsTest.isGoodFormat() → valide les arguments
       ↓
ITestCommand.execute() → exécute la logique
       ↓
Core → CommandTestPacketRes via MQTT
       ↓
Discord → Affiche le résultat
```

### Composants Clés

#### 1. `CommandsTest` (Core/src/core/CommandsTest.ts)

Gestionnaire central des commandes test :

```typescript
export class CommandsTest {
    static testCommandsArray: { [commandName: string]: ITestCommand };
    static testCommType: string[];

    // Charge toutes les commandes test au démarrage
    static async init(): Promise<void> {
        CommandsTest.testCommandsArray = {};
        CommandsTest.testCommType = await readdir("dist/Core/src/commands/admin/testCommands");
        for (const type of CommandsTest.testCommType) {
            const commandsFiles = readdirSync(`dist/Core/src/commands/admin/testCommands/${type}`)
                .filter((command: string) => command.endsWith(".js"));
            for (const commandFile of commandsFiles) {
                this.initCommandTestFromCommandFile(type, commandFile);
            }
        }
    }

    // Valide le format des arguments
    static isGoodFormat(commandTest: ITestCommand, args: string[]): {
        good: boolean; 
        description: string;
    } {
        // Vérifie le nombre d'arguments
        // Vérifie le type de chaque argument (INTEGER, ID, STRING)
        // Retourne un message d'erreur détaillé si invalide
    }

    // Récupère une commande test par son nom ou alias
    static getTestCommand(commandName: string): ITestCommand {
        const commandTestCurrent = CommandsTest.testCommandsArray[commandName.toLowerCase()];
        if (!commandTestCurrent) {
            throw new Error(`Commande Test non définie : ${commandName}`);
        }
        return commandTestCurrent;
    }
}
```

#### 2. Interface `ITestCommand`

Définit la structure d'une commande test :

```typescript
export interface ITestCommand {
    name: string;                    // Nom de la commande
    aliases?: string[];              // Aliases optionnels
    commandFormat?: string;          // Format d'affichage des arguments
    typeWaited?: {                   // Types attendus pour chaque argument
        [argName: string]: TypeKey;
    };
    description: string;             // Description de la commande
    execute?: ExecuteTestCommandLike; // Fonction d'exécution
    category?: string;               // Catégorie (auto-assignée)
}

export type ExecuteTestCommandLike = (
    player: Player,           // Joueur qui exécute la commande
    args: string[],          // Arguments fournis
    response: CrowniclesPacket[], // Tableau de réponses à remplir
    context: PacketContext   // Contexte d'exécution
) => string | Promise<string>; // Message de retour
```

#### 3. Types d'Arguments

```typescript
export enum TypeKey {
    INTEGER = "INTEGER",  // Nombre entier
    ID = "ID",           // UUID (keycloakId, entityId, etc.)
    STRING = "STRING"    // Chaîne de caractères (défaut)
}
```

### Exemple de Commande Test : GloryPointsTestCommand

```typescript
// Core/src/commands/admin/testCommands/Fight/GloryPointsTestCommand.ts
export const commandInfo: ITestCommand = {
    name: "glorypoints",
    aliases: ["glory"],
    commandFormat: "<points> <type>",
    typeWaited: {
        "points": TypeKey.INTEGER,
        "type (0 = defensif 1 = attack)": TypeKey.INTEGER
    },
    description: "Permet de définir les points de gloire d'attaque ou de défense"
};

const gloryPointsTestCommand: ExecuteTestCommandLike = async (player, args, response) => {
    const gloryPoints = parseInt(args[0], 10);
    const type = parseInt(args[1], 10);

    if (gloryPoints < 0) {
        throw new Error("Erreur glory points : glory points inférieurs à 0 interdits !");
    }
    
    await player.setGloryPoints(gloryPoints, type === 0, NumberChangeReason.TEST, response);
    await player.save();

    return `Vous avez maintenant ${player.getGloryPoints()} :sparkles: !`;
};

commandInfo.execute = gloryPointsTestCommand;
```

### Chaînage de Commandes

Les commandes test supportent le chaînage avec `&&` :

```
/test command1 arg1 && command2 arg2 && command3
```

Cela exécute plusieurs commandes séquentiellement, pratique pour configurer des scénarios complexes.

---

## Système de Combat (Fight)

### Vue d'ensemble

Le système de combat permet à deux joueurs (ou un joueur vs IA) de s'affronter en tour par tour.

### Architecture du Combat

```
/fight
   ↓
Discord → CommandFightPacketReq
   ↓
Core → FightCommand.execute()
   ↓
Validation (énergie, localisation, niveau)
   ↓
ReactionCollectorFight (confirmation)
   ↓ [Accepté]
findOpponent() → Cherche un adversaire valide
   ↓
FightController.startFight()
   ↓
Boucle de combat (FightController)
   ↓
CommandFightEndOfFightPacket
   ↓
Calcul des récompenses et mise à jour ELO
   ↓
Discord → Affichage du résultat
```

### Composants Clés

#### 1. `FightController` (Core/src/core/fights/FightController.ts)

Contrôleur principal du combat :

```typescript
export class FightController {
    turn: number;                    // Numéro du tour actuel
    id: string;                      // ID unique du combat
    fighters: (PlayerFighter | MonsterFighter | AiPlayerFighter)[];
    fightInitiator: PlayerFighter;   // Joueur qui a initié le combat
    private state: FightState;       // État du combat (NOT_STARTED, RUNNING, FINISHED, BUG)
    private overtimeBehavior: FightOvertimeBehavior; // Comportement après MAX_TURNS

    // Démarre le combat
    async startFight(response: CrowniclesPacket[]): Promise<void> {
        // 1. Initialise les combattants (startFight sur chaque fighter)
        // 2. Affiche l'introduction (introduceFight)
        // 3. Détermine qui commence (speed le plus élevé)
        // 4. Lance le premier tour (prepareNextTurn)
    }

    // Prépare le prochain tour
    private async prepareNextTurn(response: CrowniclesPacket[]): Promise<void> {
        // 1. Augmente les dégâts en overtime si PVE
        // 2. Exécute l'assistance du pet si présent
        // 3. Applique les altérations actives
        // 4. Réduit les compteurs (poison, burn, etc.)
        // 5. Demande au combattant de choisir une action
    }

    // Exécute une action de combat
    async executeFightAction(
        fightAction: FightAction, 
        endTurn: boolean, 
        response: CrowniclesPacket[]
    ): Promise<void> {
        // 1. Vérifie que le combat n'est pas terminé
        // 2. Gère le souffle (breath) du combattant
        // 3. Exécute l'action (use sur la FightAction)
        // 4. Ajoute l'action à l'historique
        // 5. Met à jour le statut du combat
        // 6. Si endTurn : passe au tour suivant
    }

    // Termine le combat
    async endFight(response: CrowniclesPacket[], bug = false): Promise<void> {
        // 1. Change l'état du combat (FINISHED ou BUG)
        // 2. Vérifie les énergies négatives
        // 3. Détermine le gagnant
        // 4. Affiche l'outro
        // 5. Débloque les combattants
        // 6. Appelle endFight sur chaque fighter
        // 7. Exécute le callback de fin (récompenses, ELO)
    }
}
```

#### 2. Classes `Fighter`

Hiérarchie des combattants :

```
Fighter (abstract)
  ├── PlayerFighter      // Joueur humain
  ├── AiPlayerFighter    // Joueur IA (pour PvP)
  └── MonsterFighter     // Monstre (pour PvE)
```

**Fighter abstrait** (Core/src/core/fights/fighter/Fighter.ts) :

```typescript
export abstract class Fighter {
    // Propriétés
    nextFightAction: FightAction;              // Action à exécuter au prochain tour
    fightActionsHistory: (FightAction | FightAlteration)[]; // Historique des actions
    availableFightActions: Map<string, FightAction>; // Actions disponibles
    alteration: FightAlteration;               // Altération active (poison, burn, etc.)
    alterationTurn: number;                    // Tour de début de l'altération
    level: number;                             // Niveau du combattant
    protected stats: FighterStats;             // Statistiques de combat
    protected status: FighterStatus;           // Statut (ATTACKER, DEFENDER)
    
    // Méthodes abstraites (à implémenter)
    abstract chooseAction(fightView: FightView, response: CrowniclesPacket[]): Promise<void>;
    abstract startFight(fightView: FightView, startStatus: FighterStatus): Promise<void>;
    abstract endFight(winner: boolean, response: CrowniclesPacket[], bug: boolean): Promise<void>;
    abstract unblock(): void;

    // Méthodes de gestion des stats
    getAttack(): number;
    getDefense(): number;
    getSpeed(): number;
    getEnergy(): number;
    getBreath(): number;
    
    // Méthodes de combat
    useBreath(breathCost: number): boolean;
    regenerateBreath(firstTurns: boolean): void;
    takeDamage(damage: number): void;
    isDead(): boolean;
    
    // Méthodes d'altérations
    applyAlteration(alteration: FightAlteration, turn: number): void;
    removeAlteration(): void;
    hasFightAlteration(): boolean;
    
    // Modificateurs de stats
    applyAttackModifier(modifier: FightStatModifier): void;
    applyDefenseModifier(modifier: FightStatModifier): void;
    applySpeedModifier(modifier: FightStatModifier): void;
}
```

**PlayerFighter** (Core/src/core/fights/fighter/PlayerFighter.ts) :

```typescript
export class PlayerFighter extends Fighter {
    player: Player;
    pet?: PetEntity;
    private pveMembers: { attack: number; speed: number; }[];

    async startFight(fightView: FightView, startStatus: FighterStatus): Promise<void> {
        this.status = startStatus;
        await this.consumePotionIfNeeded([fightView.context]); // Consomme une potion de combat
        this.block(); // Bloque le joueur (ne peut pas faire d'autres actions)
    }

    async loadStats(): Promise<void> {
        // Charge les stats depuis le joueur, les objets équipés, la classe, etc.
        const playerActiveObjects = await InventorySlots.getMainSlotsItems(this.player.id);
        this.stats.energy = this.player.getCumulativeEnergy();
        this.stats.maxEnergy = this.player.getMaxCumulativeEnergy();
        this.stats.attack = this.player.getCumulativeAttack(playerActiveObjects);
        this.stats.defense = this.player.getCumulativeDefense(playerActiveObjects);
        this.stats.speed = this.player.getCumulativeSpeed(playerActiveObjects);
        this.stats.breath = this.player.getBaseBreath();
        this.stats.maxBreath = this.player.getMaxBreath();
        this.stats.breathRegen = this.player.getBreathRegen();
        // Charge le pet si présent
    }

    async chooseAction(fightView: FightView, response: CrowniclesPacket[]): Promise<void> {
        // Affiche l'interface de sélection d'action (ReactionCollector)
        // Le joueur clique sur une réaction pour choisir son action
        // L'action sélectionnée est stockée dans nextFightAction
    }

    async endFight(winner: boolean, response: CrowniclesPacket[], bug: boolean): Promise<void> {
        // Recharge le joueur depuis la DB
        // Applique la perte d'énergie
        // Met à jour les missions
        // Sauvegarde le joueur
    }

    unblock(): void {
        // Débloque le joueur (peut à nouveau faire des actions)
        BlockingUtils.unblockPlayer(this.player.keycloakId, BlockingConstants.REASONS.FIGHT);
    }
}
```

**AiPlayerFighter** (Core/src/core/fights/fighter/AiPlayerFighter.ts) :

```typescript
export class AiPlayerFighter extends Fighter {
    player: Player;
    pet?: PetEntity;
    private class: Class;
    private readonly classBehavior: ClassBehavior; // Comportement IA spécifique à la classe

    async loadStats(): Promise<void> {
        // Similaire à PlayerFighter, mais charge les stats à 100% énergie
        this.stats.energy = this.player.getMaxCumulativeEnergy();
        this.stats.maxEnergy = this.player.getMaxCumulativeEnergy();
        // ... autres stats
    }

    async chooseAction(fightView: FightView, response: CrowniclesPacket[]): Promise<void> {
        // Affiche un message "L'IA réfléchit..." avec un délai aléatoire
        fightView.displayAiChooseAction(response, RandomUtils.randInt(800, 2500));

        // Utilise le comportement IA de la classe pour choisir l'action
        let fightAction: FightAction;
        if (this.classBehavior) {
            fightAction = this.classBehavior.chooseAction(this, fightView);
        } else {
            fightAction = FightActionDataController.instance.getById("simpleAttack");
        }
        
        // Exécute immédiatement l'action
        await fightView.fightController.executeFightAction(fightAction, true, response);
    }

    async consumePotionIfNeeded(response: CrowniclesPacket[]): Promise<void> {
        // L'IA a une probabilité de ne pas consommer sa potion
        if (RandomUtils.crowniclesRandom.realZeroToOneInclusive() < 
            FightConstants.POTION_NO_DRINK_PROBABILITY.AI) {
            return;
        }
        // Consomme la potion si présente
    }

    endFight(): Promise<void> {
        // Rien à faire, le joueur IA n'a pas besoin de mise à jour
        return Promise.resolve();
    }

    unblock(): void {
        // Rien à faire, le joueur IA n'est pas bloqué
    }
}
```

#### 3. Comportements IA (AiBehaviorController)

Chaque classe a un comportement IA spécifique :

```typescript
export interface ClassBehavior {
    chooseAction(fighter: AiPlayerFighter, fightView: FightView): FightAction;
}

// Exemple : KnightFightBehavior
export default class KnightFightBehavior implements ClassBehavior {
    chooseAction(fighter: AiPlayerFighter, fightView: FightView): FightAction {
        const opponent = fightView.fightController.getDefendingFighter();
        
        // Logique de décision :
        // - Si peu d'énergie → action défensive
        // - Si altération active → essaye de guérir
        // - Si beaucoup de souffle → attaque puissante
        // - Sinon → attaque normale
        
        if (fighter.getEnergy() < fighter.stats.maxEnergy * 0.3) {
            return fighter.availableFightActions.get("defend");
        }
        
        if (fighter.hasFightAlteration()) {
            return fighter.availableFightActions.get("heal");
        }
        
        if (fighter.getBreath() >= 80) {
            return fighter.availableFightActions.get("powerfulAttack");
        }
        
        return fighter.availableFightActions.get("simpleAttack");
    }
}
```

Tous les comportements sont initialisés dans `AiBehaviorController.initializeAllClassBehaviors()` :

```typescript
export function initializeAllClassBehaviors(): void {
    registerClassBehavior(ClassConstants.CLASSES_ID.KNIGHT, KnightFightBehavior);
    registerClassBehavior(ClassConstants.CLASSES_ID.HORSE_RIDER, HorseRiderFightBehavior);
    registerClassBehavior(ClassConstants.CLASSES_ID.GUNNER, GunnerFightBehavior);
    // ... tous les autres
}
```

#### 4. Actions de Combat (FightAction)

Les actions sont définies dans des fichiers JSON (`Core/resources/fightActions/`) et chargées par `FightActionDataController` :

```typescript
export class FightAction {
    id: string;                    // ID unique de l'action
    name: string;                  // Nom affiché
    breath: number;                // Coût en souffle
    use(attacker: Fighter, defender: Fighter, turn: number, fight: FightController): FightActionResult;
}

export interface FightActionResult {
    damages?: number;              // Dégâts infligés
    healedHp?: number;            // PV soignés
    alteration?: FightAlteration; // Altération appliquée
    // ... autres effets
}
```

#### 5. Recherche d'Adversaire (findOpponent)

```typescript
async function findOpponent(player: Player): Promise<Player | null> {
    for (let offset = 0; offset <= FightConstants.MAX_OFFSET_FOR_OPPONENT_SEARCH; offset++) {
        // 1. Récupère des adversaires potentiels (proches en glory points)
        let validOpponents = await getInitialValidOpponents(offset, player);
        
        if (validOpponents.length === 0) continue;
        
        // 2. Mélange pour randomiser
        validOpponents.sort(() => Math.random() - 0.5);
        
        // 3. Filtre ceux qui ont défendu récemment (cache)
        validOpponents = checkPlayersInDefenderCacheMap(validOpponents);
        
        // 4. Filtre ceux qui ont défendu récemment (DB)
        const haveBeenDefenderRecently = await LogsReadRequests
            .hasBeenADefenderInRankedFightSinceMinutes(
                validOpponents.map(o => o.keycloakId),
                FightConstants.DEFENDER_COOLDOWN_MINUTES
            );
        
        const opponentsNotOnCooldown = validOpponents.filter(
            o => !haveBeenDefenderRecently[o.keycloakId]
        );
        
        if (opponentsNotOnCooldown.length === 0) continue;
        
        // 5. Vérifie les BO3 (Best Of 3) de la semaine
        const bo3Map = await LogsReadRequests.getRankedFightsThisWeek(
            player.keycloakId,
            opponentsNotOnCooldown.map(o => o.keycloakId)
        );
        
        // 6. Trouve le premier adversaire dont le BO3 n'est pas terminé
        for (const opponent of opponentsNotOnCooldown) {
            const results = bo3Map.get(opponent.keycloakId) ?? { won: 0, lost: 0, draw: 0 };
            if (!bo3isAlreadyFinished(results)) {
                return opponent;
            }
        }
    }
    return null; // Aucun adversaire trouvé
}
```

#### 6. Calcul des Récompenses et ELO

```typescript
async function fightEndCallback(fight: FightController, response: CrowniclesPacket[]): Promise<void> {
    // 1. Enregistre le combat dans les logs
    const fightLogId = await crowniclesInstance.logsDatabase.logFight(fight);
    
    // 2. Détermine les résultats (WIN, LOSS, DRAW)
    const player1GameResult = fight.isADraw() ? EloGameResult.DRAW : 
                             fight.getWinner() === 0 ? EloGameResult.WIN : EloGameResult.LOSS;
    const player2GameResult = /* inverse */;
    
    // 3. Identifie l'initiator et le defender
    const initiatorReference = /* 0 ou 1 */;
    const attacker = initiatorReference === 0 ? player1 : player2;
    const defender = initiatorReference === 0 ? player2 : player1;
    
    // 4. Calcule les bonus de score (premiers combats du jour)
    const scoreBonus = await calculateScoreReward(/* ... */);
    
    // 5. Calcule les bonus d'argent (plafonnés)
    const extraMoneyBonus = await calculateMoneyReward(/* ... */);
    
    // 6. Calcule les nouveaux ELO
    const player1KFactor = EloUtils.getKFactor(attacker);
    const player2KFactor = EloUtils.getKFactor(defender);
    const player1NewRating = EloUtils.calculateNewRating(
        attacker.attackGloryPoints, 
        defender.defenseGloryPoints, 
        attackerGameResult, 
        player1KFactor
    );
    const player2NewRating = /* similaire */;
    
    // 7. Applique les changements et sauvegarde
    await attacker.setGloryPoints(player1NewRating, false, NumberChangeReason.FIGHT, response, fightLogId);
    await defender.setGloryPoints(player2NewRating, true, NumberChangeReason.FIGHT, response, fightLogId);
    attacker.fightCountdown--;
    defender.fightCountdown--;
    await Promise.all([attacker.save(), defender.save()]);
    
    // 8. Envoie le packet de récompenses
    response.push(makePacket(FightRewardPacket, {
        points: scoreBonus,
        money: extraMoneyBonus,
        player1: { /* old/new glory, old/new league */ },
        player2: { /* idem */ },
        draw: player1GameResult === EloGameResult.DRAW
    }));
}
```

### Packets de Combat

Le combat utilise plusieurs packets pour communiquer entre Core et Discord :

1. **CommandFightIntroduceFightersPacket** : Introduction des combattants
   ```typescript
   {
       fightId: string,
       fightInitiatorKeycloakId: string,
       fightOpponentKeycloakId?: string,
       fightOpponentMonsterId?: string,
       fightInitiatorActions: Array<[string, number]>, // [actionId, breath]
       fightOpponentActions: Array<[string, number]>,
       fightInitiatorPet?: OwnedPet,
       fightOpponentPet?: OwnedPet
   }
   ```

2. **CommandFightStatusPacket** : Mise à jour du statut du combat
   ```typescript
   {
       fightId: string,
       turn: number,
       fighters: [{
           keycloakId?: string,
           monsterId?: string,
           energy: number,
           maxEnergy: number,
           breath: number,
           maxBreath: number,
           attack: number,
           defense: number,
           speed: number,
           alteration?: { id: string, turn: number }
       }],
       currentFighterIndex: number
   }
   ```

3. **CommandFightHistoryItemPacket** : Ajout d'une action à l'historique
   ```typescript
   {
       fightId: string,
       attackerIndex: number,
       actionId: string,
       actionType: "ACTION" | "ALTERATION" | "PET_ASSISTANCE",
       result: {
           damages?: number,
           healedHp?: number,
           alteration?: { id: string },
           // ... autres effets
       }
   }
   ```

4. **AIFightActionChoosePacket** : L'IA choisit une action
   ```typescript
   {
       fightId: string,
       ms: number  // Délai en millisecondes avant d'exécuter l'action
   }
   ```

5. **CommandFightEndOfFightPacket** : Fin du combat
   ```typescript
   {
       fightId: string,
       winner: 0 | 1,
       draw: boolean
   }
   ```

6. **FightRewardPacket** : Récompenses du combat
   ```typescript
   {
       points: number,
       money: number,
       player1: {
           keycloakId: string,
           oldGlory: number,
           newGlory: number,
           oldLeagueId: number,
           newLeagueId: number
       },
       player2: { /* idem */ },
       draw: boolean
   }
   ```

---

## Guide pour Créer une Commande Test de Combat IA vs IA

### Objectif

Créer une commande `/test aifight <player1Id> <player2Id>` qui fait combattre deux joueurs contrôlés par l'IA.

### Étape 1 : Créer le fichier de commande test

**Fichier** : `Core/src/commands/admin/testCommands/Fight/AiFightTestCommand.ts`

```typescript
import {
    ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { Players } from "../../../../core/database/game/models/Player";
import { ClassDataController } from "../../../../data/Class";
import { AiPlayerFighter } from "../../../../core/fights/fighter/AiPlayerFighter";
import { FightController } from "../../../../core/fights/FightController";
import { FightOvertimeBehavior } from "../../../../core/fights/FightOvertimeBehavior";
import { makePacket } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandTestPacketRes } from "../../../../../../Lib/src/packets/commands/CommandTestPacket";

export const commandInfo: ITestCommand = {
    name: "aifight",
    aliases: ["aif", "aivs"],
    commandFormat: "<player1Id> <player2Id>",
    typeWaited: {
        "player1Id": TypeKey.ID,
        "player2Id": TypeKey.ID
    },
    description: "Lance un combat entre deux joueurs contrôlés par l'IA. Les deux joueurs doivent exister et avoir au moins le niveau requis pour combattre."
};

/**
 * Execute an AI vs AI fight
 */
const aiFightTestCommand: ExecuteTestCommandLike = async (player, args, response, context) => {
    const player1Id = args[0];
    const player2Id = args[1];

    // 1. Récupérer les deux joueurs
    const player1 = await Players.getByKeycloakId(player1Id);
    const player2 = await Players.getByKeycloakId(player2Id);

    if (!player1) {
        throw new Error(`Joueur 1 introuvable avec l'ID : ${player1Id}`);
    }

    if (!player2) {
        throw new Error(`Joueur 2 introuvable avec l'ID : ${player2Id}`);
    }

    // 2. Vérifier que les joueurs peuvent combattre
    if (player1.level < 10) { // FightConstants.REQUIRED_LEVEL
        throw new Error(`Le joueur 1 (${player1.pseudo}) doit être au moins niveau 10 pour combattre.`);
    }

    if (player2.level < 10) {
        throw new Error(`Le joueur 2 (${player2.pseudo}) doit être au moins niveau 10 pour combattre.`);
    }

    // 3. Créer les combattants IA
    const fighter1 = new AiPlayerFighter(
        player1, 
        ClassDataController.instance.getById(player1.class)
    );
    await fighter1.loadStats();

    const fighter2 = new AiPlayerFighter(
        player2, 
        ClassDataController.instance.getById(player2.class)
    );
    await fighter2.loadStats();

    // 4. Créer le contrôleur de combat
    const fightController = new FightController(
        {
            fighter1: fighter1,
            fighter2: fighter2
        },
        FightOvertimeBehavior.END_FIGHT_DRAW, // Match nul après MAX_TURNS
        context
    );

    // 5. Définir un callback personnalisé pour la fin du combat
    fightController.setEndCallback(async (fight, endResponse) => {
        const winner = fight.getWinner(); // 0 ou 1
        const isDraw = fight.isADraw();

        let resultMessage = "";
        if (isDraw) {
            resultMessage = `⚔️ Match nul entre ${player1.pseudo} et ${player2.pseudo} !`;
        } else {
            const winnerPlayer = winner === 0 ? player1 : player2;
            const loserPlayer = winner === 0 ? player2 : player1;
            resultMessage = `🏆 ${winnerPlayer.pseudo} a vaincu ${loserPlayer.pseudo} !`;
        }

        resultMessage += `\n\n**Statistiques finales :**`;
        resultMessage += `\n${player1.pseudo} : ${Math.round(fighter1.getEnergy())}/${fighter1.stats.maxEnergy} PV`;
        resultMessage += `\n${player2.pseudo} : ${Math.round(fighter2.getEnergy())}/${fighter2.stats.maxEnergy} PV`;
        resultMessage += `\n\nNombre de tours : ${fight.turn}`;

        endResponse.push(makePacket(CommandTestPacketRes, {
            commandName: "aifight",
            result: resultMessage,
            isError: false
        }));
    });

    // 6. Lancer le combat
    await fightController.startFight(response);

    // 7. Message de début
    return `⚔️ Combat lancé entre ${player1.pseudo} et ${player2.pseudo} !\n\nLe combat se déroule en arrière-plan...`;
};

commandInfo.execute = aiFightTestCommand;
```

### Étape 2 : Comprendre le fonctionnement

#### Flux d'exécution

```
1. /test aifight <id1> <id2>
   ↓
2. Discord envoie CommandTestPacketReq
   ↓
3. Core récupère les deux joueurs depuis la DB
   ↓
4. Core crée deux AiPlayerFighter
   ↓
5. Core appelle fighter.loadStats() pour chaque combattant
   ↓
6. Core crée le FightController avec les deux combattants IA
   ↓
7. Core appelle fightController.startFight(response)
   ↓
8. FightController.startFight() :
   - Appelle startFight() sur chaque fighter
   - Envoie CommandFightIntroduceFightersPacket
   - Détermine qui commence (speed)
   - Appelle prepareNextTurn()
   ↓
9. prepareNextTurn() en boucle :
   - Applique les altérations/pet
   - Appelle fighter.chooseAction()
   - AiPlayerFighter.chooseAction() :
     * Envoie AIFightActionChoosePacket (délai visuel)
     * Utilise classBehavior.chooseAction() pour décider
     * Exécute immédiatement l'action
   - Envoie CommandFightHistoryItemPacket
   - Envoie CommandFightStatusPacket
   - Inverse les combattants
   - Recommence jusqu'à ce qu'un combattant meure ou MAX_TURNS atteint
   ↓
10. FightController.endFight() :
    - Envoie CommandFightEndOfFightPacket
    - Appelle le callback personnalisé
    - Envoie CommandTestPacketRes avec le résultat final
    ↓
11. Discord affiche tous les messages reçus dans le channel
```

#### Différences avec un combat normal

| Aspect | Combat Normal | Combat Test IA vs IA |
|--------|---------------|----------------------|
| **Initiateur** | PlayerFighter | AiPlayerFighter (configuré comme initiator) |
| **Adversaire** | AiPlayerFighter (trouvé) | AiPlayerFighter (spécifié) |
| **Sélection d'action** | Joueur clique sur une réaction | IA décide automatiquement |
| **Blocage** | Joueur bloqué pendant le combat | Aucun blocage (test) |
| **Récompenses** | Argent, score, ELO | Aucune (customisable dans callback) |
| **Validation** | Énergie, cooldown, BO3 | Seulement niveau minimum |
| **Callback de fin** | fightEndCallback (récompenses) | Callback personnalisé (statistiques) |


**Point important, il faut une option dans la commande qui permet de choisir si on veut que le combat soit fait en silencieux ou en visible. Si le combat est fait en silencieux alors aucun message n'est envoyé dans le channel discord sauf le résultat du fight**

### Étape 3 : Variantes et améliorations

#### Variante 1 : pouvoir faire plusieurs combats à la suite

```typescript
export const commandInfo: ITestCommand = {
    name: "aifight",
    commandFormat: "<player1Id> <player2Id> [maxTurns]",
    typeWaited: {
        "player1Id": TypeKey.ID,
        "player2Id": TypeKey.ID,
        "amountOfFight": TypeKey.INTEGER  // Optionnel
    },
    description: "Lance plusieurs combats entre ces deux joueurs et affiche directement un résumé des combats sans afficher les combats."
};



#### Variante 2 : Statistiques détaillées

```typescript
fightController.setEndCallback(async (fight, endResponse) => {
    const fighter1 = fight.fighters[0] as AiPlayerFighter;
    const fighter2 = fight.fighters[1] as AiPlayerFighter;

    // Analyser l'historique des actions
    const fighter1Actions = fighter1.fightActionsHistory;
    const fighter2Actions = fighter2.fightActionsHistory;

    // Compter les types d'actions
    const fighter1Attacks = fighter1Actions.filter(a => a.id.includes("attack")).length;
    const fighter1Defenses = fighter1Actions.filter(a => a.id.includes("defend")).length;

    let resultMessage = `**Statistiques détaillées :**\n\n`;
    resultMessage += `**${player1.pseudo}** (${player1.class})\n`;
    resultMessage += `- PV restants : ${Math.round(fighter1.getEnergy())}/${fighter1.stats.maxEnergy}\n`;
    resultMessage += `- Attaques : ${fighter1Attacks}\n`;
    resultMessage += `- Défenses : ${fighter1Defenses}\n`;
    resultMessage += `- Actions totales : ${fighter1Actions.length}\n\n`;

    resultMessage += `**${player2.pseudo}** (${player2.class})\n`;
    resultMessage += `- PV restants : ${Math.round(fighter2.getEnergy())}/${fighter2.stats.maxEnergy}\n`;
    // ... idem pour fighter2

    endResponse.push(makePacket(CommandTestPacketRes, {
        commandName: "aifight",
        result: resultMessage,
        isError: false
    }));
});
```


## Annexes

### A. Structure des Fichiers

```
Core/
├── src/
│   ├── commands/
│   │   ├── admin/
│   │   │   ├── TestCommand.ts           # Point d'entrée des commandes test
│   │   │   └── testCommands/            # Dossier des commandes test
│   │   │       ├── Fight/               # Catégorie Fight
│   │   │       │   ├── GloryPointsTestCommand.ts
│   │   │       │   └── AiFightTestCommand.ts  # VOTRE NOUVELLE COMMANDE
│   │   │       ├── Player/
│   │   │       ├── Inventory/
│   │   │       └── ...
│   │   └── player/
│   │       └── FightCommand.ts          # Commande fight normale
│   ├── core/
│   │   ├── CommandsTest.ts              # Gestionnaire des commandes test
│   │   └── fights/
│   │       ├── FightController.ts       # Contrôleur de combat
│   │       ├── FightView.ts             # Affichage du combat
│   │       ├── AiBehaviorController.ts  # Comportements IA
│   │       ├── fighter/
│   │       │   ├── Fighter.ts           # Classe abstraite
│   │       │   ├── PlayerFighter.ts     # Joueur humain
│   │       │   ├── AiPlayerFighter.ts   # Joueur IA
│   │       │   └── MonsterFighter.ts    # Monstre
│   │       └── aiClassBehaviors/
│   │           ├── KnightFightBehavior.ts
│   │           ├── GunnerFightBehavior.ts
│   │           └── ...
│   └── data/
│       ├── FightAction.ts               # Contrôleur des actions
│       └── FightAlteration.ts           # Contrôleur des altérations
├── resources/
│   ├── fightActions/                    # JSON des actions de combat
│   └── ...
└── __tests__/
    └── commands/
        └── admin/
            └── AiFightTestCommand.test.ts

Discord/
├── src/
│   ├── commands/
│   │   ├── admin/
│   │   │   └── TestCommand.ts           # Handler Discord pour /test
│   │   └── player/
│   │       └── FightCommand.ts          # Handler Discord pour /fight
│   └── packetHandlers/
│       └── handlers/
│           ├── admin/
│           │   └── TestCommandPacketHandlers.ts
│           └── FightHandler.ts          # Handler des packets de combat

Lib/
└── src/
    ├── packets/
    │   ├── commands/
    │   │   ├── CommandTestPacket.ts
    │   │   └── CommandFightPacket.ts
    │   └── fights/
    │       ├── FightIntroductionPacket.ts
    │       ├── FightStatusPacket.ts
    │       ├── FightHistoryItemPacket.ts
    │       ├── AIFightActionChoosePacket.ts
    │       ├── EndOfFightPacket.ts
    │       └── FightRewardPacket.ts
    └── constants/
        └── FightConstants.ts
```

### B. Constantes Importantes

```typescript
// FightConstants (Lib/src/constants/FightConstants.ts)
export const FightConstants = {
    REQUIRED_LEVEL: 10,                    // Niveau min pour combattre
    MAX_TURNS: 40,                         // Tours max avant match nul
    DEFENDER_COOLDOWN_MINUTES: 30,         // Cooldown défenseur
    ACTIVE_PLAYER_PER_OPPONENT_SEARCH: 5,  // Adversaires actifs à chercher
    PLAYER_PER_OPPONENT_SEARCH: 20,        // Adversaires totaux à chercher
    MAX_OFFSET_FOR_OPPONENT_SEARCH: 10,    // Offset max de recherche
    
    POTION_NO_DRINK_PROBABILITY: {
        AI: 0.3,    // 30% de chance que l'IA ne boive pas sa potion
        PLAYER: 0   // 0% pour les joueurs humains
    },
    
    OUT_OF_BREATH_FAILURE_PROBABILITY: 0.5, // 50% d'échec si pas assez de souffle
    
    REWARDS: {
        WIN_MONEY_BONUS: 200,
        DRAW_MONEY_BONUS: 100,
        LOSS_MONEY_BONUS: 50,
        MAX_MONEY_BONUS: 1000,              // Plafond journalier
        NUMBER_OF_WIN_THAT_AWARD_SCORE_BONUS: 3,
        SCORE_BONUS_AWARD: 50
    },
    
    GOD_MOVES: ["godAttack", "godHeal"],    // Actions puissantes
    
    FIGHT_ACTIONS: {
        ALTERATION: {
            OUT_OF_BREATH: "outOfBreath"
        }
    }
};
```

### C. Commandes Test Utiles

```bash
# Lister toutes les commandes test
/test list

# Aide sur une commande test
/test help <command>

# Obtenir vos IDs
/test myids

# Modifier les points de gloire
/test glory <points> <type>  # type: 0=défense, 1=attaque

# Réinitialiser le BO3
/test resetbo3

# Forcer un événement lors du prochain /report
/test forcereport <eventId>

# Ajouter de l'argent
/test addmoney <amount>

# Changer de niveau
/test setlevel <level>

# Téléporter
/test tp <mapId>

# Ajouter un objet
/test additem <itemId>
```

### D. Ressources Complémentaires

- **Documentation officielle** : Voir `README.md` à la racine du projet
- **Instructions de développement** : `.github/instructions/Draphtv1.instructions.md`
- **Tests existants** : `Core/__tests__/core/fights/fighter/Fighter.test.ts`
- **Exemples de comportements IA** : `Core/src/core/fights/aiClassBehaviors/`
- **Définitions d'actions** : `Core/resources/fightActions/`

### E. Glossaire

- **BO3 (Best Of 3)** : Système limitant les combats hebdomadaires entre deux joueurs
- **ELO / Glory Points** : Système de classement basé sur les victoires/défaites
- **Fighter** : Combattant (joueur ou monstre) dans un combat
- **Fight Action** : Action de combat (attaque, défense, soin, etc.)
- **Alteration** : Effet de statut (poison, brûlure, étourdissement, etc.)
- **Breath (Souffle)** : Ressource utilisée pour exécuter des actions
- **Overtime** : Période après MAX_TURNS tours (augmentation dégâts en PVE)
- **Context** : Objet contenant les informations de session (Discord channel, user, etc.)
- **Packet** : Message typé échangé entre services via MQTT
- **Reaction Collector** : Système de collecte de réactions Discord pour les interactions

---

## Conclusion

Ce document couvre :

1. ✅ **Architecture générale** : Comment les services communiquent via MQTT
2. ✅ **Système de test** : Comment créer et exécuter des commandes test
3. ✅ **Système de combat** : Fonctionnement détaillé du combat tour par tour
4. ✅ **Guide pratique** : Créer une commande test de combat IA vs IA

Votre stagiaire peut maintenant :
- Comprendre l'architecture complète du système
- Créer de nouvelles commandes test facilement
- Modifier le comportement des combats
- Tester différents scénarios de combat automatiquement

**Bon développement ! ⚔️**
