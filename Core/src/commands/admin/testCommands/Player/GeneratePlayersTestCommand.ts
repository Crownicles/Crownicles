import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { Players } from "../../../../core/database/game/models/Player";
import { InventorySlot } from "../../../../core/database/game/models/InventorySlot";
import { PetEntity } from "../../../../core/database/game/models/PetEntity";
import { ClassDataController } from "../../../../data/Class";
import { ClassConstants } from "../../../../../../Lib/src/constants/ClassConstants";
import { generateRandomItem } from "../../../../core/utils/ItemUtils";
import {
	FightItemNatures, ItemCategory
} from "../../../../../../Lib/src/constants/ItemConstants";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
import {
	Pet, PetDataController
} from "../../../../data/Pet";
import { WeaponDataController } from "../../../../data/Weapon";
import { ArmorDataController } from "../../../../data/Armor";
import { ObjectItemDataController } from "../../../../data/ObjectItem";

/**
 * Command configuration parameters
 */
type CommandConfig = {
	level: number;
	playersPerClass: number;
	useFixedItems: boolean;
	generatePets: boolean;
	specificPetId: number | null;
};

/**
 * Inventory items configuration
 */
type InventoryItems = {
	weaponId: number;
	armorId: number;
	objectId: number;
};

/**
 * Pet generation result
 */
type PetGenerationResult = {
	pets: PetEntity[];
	actualPlayersPerClass: number;
	maxUniquePets: number;
};

/**
 * Inventory generation parameters
 */
type InventoryGenerationParams = {
	level: number;
	classId?: number;
	useFixedItems: boolean;
};

/**
 * Pet generation configuration
 */
type PetGenerationConfig = {
	generatePets: boolean;
	playersPerClass: number;
	specificPetId: number | null;
};

export const commandInfo: ITestCommand = {
	name: "generatePlayers",
	commandFormat: "<level> [playersPerClass] [fixedItems] [generatePets] [petId]",
	typeWaited: {
		level: TypeKey.INTEGER,
		playersPerClass: TypeKey.INTEGER,
		fixedItems: TypeKey.STRING,
		generatePets: TypeKey.STRING,
		petId: TypeKey.INTEGER
	},
	minArgs: 1,
	description: "Génère un ensemble de joueurs dans la base de données pour chaque classe disponible au niveau donné.\n\n"
		+ "**Paramètres:**\n"
		+ "• `level` (requis) - Niveau des joueurs\n"
		+ "• `playersPerClass` (optionnel, défaut: 20) - Nombre de joueurs par classe\n"
		+ "• `fixedItems` (optionnel, défaut: false) - true/false - Items prédéfinis par groupe de classe\n"
		+ "• `generatePets` (optionnel, défaut: true) - true/false - Générer des pets\n"
		+ "• `petId` (optionnel) - ID du pet spécifique à donner à tous les joueurs\n\n"
		+ "**Exemples:**\n"
		+ "• Positionnels: `test generatePlayers 100`\n"
		+ "• Positionnels: `test generatePlayers 100 10 true false`\n"
		+ "• Nommés: `test generatePlayers --level=100 --playersPerClass=10`\n"
		+ "• Mixte: `test generatePlayers 100 --petId=5 --fixedItems=true`"
};

/**
 * Fixed items configuration by class behavior group
 * Format: [weaponId, armorId, objectId]
 */
const FIXED_ITEMS_BY_CLASS_GROUP: Record<string, [
	number,
	number,
	number
]> = {
	// Canonnier group (GunnerFightBehavior): FORMIDABLE_GUNNER, GUNNER, ARCHER, SLINGER, ROCK_THROWER
	gunner: [
		85,
		46,
		5
	],

	// Paladin group (PaladinFightBehavior): PALADIN, LUMINOUS_PALADIN
	paladin: [
		70,
		18,
		37
	],

	// Chevalier group (KnightFightBehavior): KNIGHT, VALIANT_KNIGHT, PIKEMAN, HORSE_RIDER, ESQUIRE
	knight: [
		46,
		62,
		23
	],

	// Fantassin group (InfantryManFightBehavior): POWERFUL_INFANTRYMAN, INFANTRYMAN, SOLDIER, FIGHTER, RECRUIT
	infantryman: [
		46,
		12,
		37
	],

	// Vétéran group (VeteranFightBehavior): VETERAN, EXPERIENCED_VETERAN
	veteran: [
		84,
		58,
		5
	],

	// Mage group (MysticMageFightBehavior): MYSTIC_MAGE
	mage: [
		81,
		32,
		67
	],

	// Tank group (TankFightBehavior): TANK, IMPENETRABLE_TANK, ENMESHED, HELMETED, GLOVED
	tank: [
		70,
		32,
		37
	]
};

/**
 * Get the class behavior group for a given class ID
 * @param classId
 */
/**
 * Mapping of class IDs to behavior groups
 */
const CLASS_TO_GROUP_MAP: Record<number, string> = {
	// Gunner group
	[ClassConstants.CLASSES_ID.FORMIDABLE_GUNNER]: "gunner",
	[ClassConstants.CLASSES_ID.GUNNER]: "gunner",
	[ClassConstants.CLASSES_ID.ARCHER]: "gunner",
	[ClassConstants.CLASSES_ID.SLINGER]: "gunner",
	[ClassConstants.CLASSES_ID.ROCK_THROWER]: "gunner",

	// Paladin group
	[ClassConstants.CLASSES_ID.PALADIN]: "paladin",
	[ClassConstants.CLASSES_ID.LUMINOUS_PALADIN]: "paladin",

	// Knight group
	[ClassConstants.CLASSES_ID.KNIGHT]: "knight",
	[ClassConstants.CLASSES_ID.VALIANT_KNIGHT]: "knight",
	[ClassConstants.CLASSES_ID.PIKEMAN]: "knight",
	[ClassConstants.CLASSES_ID.HORSE_RIDER]: "knight",
	[ClassConstants.CLASSES_ID.ESQUIRE]: "knight",

	// Infantryman group
	[ClassConstants.CLASSES_ID.POWERFUL_INFANTRYMAN]: "infantryman",
	[ClassConstants.CLASSES_ID.INFANTRYMAN]: "infantryman",
	[ClassConstants.CLASSES_ID.SOLDIER]: "infantryman",
	[ClassConstants.CLASSES_ID.FIGHTER]: "infantryman",
	[ClassConstants.CLASSES_ID.RECRUIT]: "infantryman",

	// Veteran group
	[ClassConstants.CLASSES_ID.VETERAN]: "veteran",
	[ClassConstants.CLASSES_ID.EXPERIENCED_VETERAN]: "veteran",

	// Tank group
	[ClassConstants.CLASSES_ID.TANK]: "tank",
	[ClassConstants.CLASSES_ID.IMPENETRABLE_TANK]: "tank",
	[ClassConstants.CLASSES_ID.ENMESHED]: "tank",
	[ClassConstants.CLASSES_ID.HELMETED]: "tank",
	[ClassConstants.CLASSES_ID.GLOVED]: "tank",

	// Mage group
	[ClassConstants.CLASSES_ID.MYSTIC_MAGE]: "mage"
};

/**
 * Get the class behavior group for a given class ID
 */
function getClassBehaviorGroup(classId: number): string | null {
	return CLASS_TO_GROUP_MAP[classId] || null;
}

/**
 * Validate that all fixed items exist in the database
 * ```
 *
 * /**
 * Validate that all fixed items exist in the database
 */
function ensureFixedItemsExist(params: {
	weaponId: number;
	armorId: number;
	objectId: number;
	classGroup: string;
	classId: number;
}): void {
	const weapon = WeaponDataController.instance.getById(params.weaponId);
	const armor = ArmorDataController.instance.getById(params.armorId);
	const object = ObjectItemDataController.instance.getById(params.objectId);

	if (!weapon) {
		throw new Error(`Erreur generatePlayers : Arme ${params.weaponId} introuvable pour le groupe ${params.classGroup} (classId: ${params.classId})`);
	}
	if (!armor) {
		throw new Error(`Erreur generatePlayers : Armure ${params.armorId} introuvable pour le groupe ${params.classGroup} (classId: ${params.classId})`);
	}
	if (!object) {
		throw new Error(`Erreur generatePlayers : Objet ${params.objectId} introuvable pour le groupe ${params.classGroup} (classId: ${params.classId})`);
	}
}

/**
 * Validate and retrieve fixed items for a class
 * @param classId - Class ID
 */
function getFixedItemsForClass(classId: number): InventoryItems {
	const classGroup = getClassBehaviorGroup(classId);

	if (!classGroup || !FIXED_ITEMS_BY_CLASS_GROUP[classGroup]) {
		throw new Error(`Erreur generatePlayers : Aucun item fixe défini pour la classe ${classId} (groupe: ${classGroup || "non trouvé"})`);
	}

	const [
		weaponId,
		armorId,
		objectId
	] = FIXED_ITEMS_BY_CLASS_GROUP[classGroup];

	ensureFixedItemsExist({
		weaponId,
		armorId,
		objectId,
		classGroup,
		classId
	});

	return {
		weaponId,
		armorId,
		objectId
	};
}

/**
 * Generate random items based on level
 * @param level - Player level
 */
function generateRandomItemsByLevel(level: number): InventoryItems {
	// Get item rarity based on player level
	const rarity = level >= 100 ? 6 : level >= 50 ? 5 : 4;

	const weapon = generateRandomItem({
		itemCategory: ItemCategory.WEAPON,
		minRarity: rarity,
		maxRarity: rarity
	});

	const armor = generateRandomItem({
		itemCategory: ItemCategory.ARMOR,
		minRarity: rarity,
		maxRarity: rarity
	});

	const fightNature = RandomUtils.crowniclesRandom.pick(FightItemNatures);
	const object = generateRandomItem({
		itemCategory: ItemCategory.OBJECT,
		minRarity: rarity,
		maxRarity: rarity,
		subType: fightNature
	});

	const allItemsGenerated = weapon && armor && object;
	if (!allItemsGenerated) {
		throw new Error(`Erreur generatePlayers : Impossible de générer des items aléatoires de rareté ${rarity} (weapon:${weapon?.id}, armor:${armor?.id}, object:${object?.id})`);
	}

	return {
		weaponId: weapon.id,
		armorId: armor.id,
		objectId: object.id
	};
}

/**
 * Generate a random inventory setup (one armor, one weapon, one object, no potion)
 * Objects will only have fight-related effects (attack, defense, speed)
 * @param params - Inventory generation parameters
 */
function generateRandomInventory(params: InventoryGenerationParams): InventoryItems {
	if (params.useFixedItems && params.classId) {
		return getFixedItemsForClass(params.classId);
	}

	return generateRandomItemsByLevel(params.level);
}

/**
 * Validate level range
 */
function ensureLevelIsValid(level: number): void {
	if (level < ClassConstants.REQUIRED_LEVEL) {
		throw new Error(`Erreur generatePlayers : le niveau doit être au moins ${ClassConstants.REQUIRED_LEVEL} (niveau requis pour débloquer les classes) !`);
	}
	if (level > 200) {
		throw new Error("Erreur generatePlayers : le niveau ne peut pas dépasser 200 !");
	}
}

/**
 * Validate specific pet existence and rarity
 */
function ensurePetIsValid(specificPetId: number): void {
	const specificPetType = PetDataController.instance.getById(specificPetId);
	if (!specificPetType) {
		throw new Error(`Erreur generatePlayers : Le pet avec l'ID ${specificPetId} n'existe pas !`);
	}
	if (specificPetType.rarity === 0) {
		throw new Error(`Erreur generatePlayers : Le pet avec l'ID ${specificPetId} a une rareté de 0 et ne peut pas être utilisé !`);
	}
}

/**
 * Validate command configuration
 * @param config - Command configuration
 */
function validateCommandConfig(config: CommandConfig): void {
	ensureLevelIsValid(config.level);

	if (config.playersPerClass < 1) {
		throw new Error("Erreur generatePlayers : le nombre de joueurs par classe doit être au moins 1 !");
	}

	if (config.specificPetId !== null) {
		ensurePetIsValid(config.specificPetId);
	}
}

/**
 * Get all valid pet types
 */
function getAllValidPetTypes(): Pet[] {
	const maxPetId = PetDataController.instance.getMaxId();
	const allPetTypes: Pet[] = [];

	for (let petId = 1; petId <= maxPetId; petId++) {
		const petType = PetDataController.instance.getById(petId);
		if (petType && petType.rarity !== 0) {
			allPetTypes.push(petType);
		}
	}

	return allPetTypes;
}

/**
 * Create specific pets (all the same type)
 */
async function createSpecificPets(specificPetId: number, count: number): Promise<PetEntity[]> {
	const specificPetType = PetDataController.instance.getById(specificPetId);
	const pets: PetEntity[] = [];

	for (let i = 0; i < count; i++) {
		const pet = PetEntity.build({
			typeId: specificPetType.id,
			sex: "m",
			nickname: `Pet_${specificPetType.id}_${i + 1}`,
			lovePoints: 100
		});
		pets.push(await pet.save());
	}

	return pets;
}

/**
 * Create varied pets (one of each type)
 */
async function createVariedPets(count: number): Promise<{
	pets: PetEntity[];
	maxUniquePets: number;
}> {
	const allPetTypes = getAllValidPetTypes();
	const maxUniquePets = allPetTypes.length;
	const actualCount = Math.min(count, allPetTypes.length);
	const pets: PetEntity[] = [];

	for (let i = 0; i < actualCount; i++) {
		const petType = allPetTypes[i];
		const pet = PetEntity.build({
			typeId: petType.id,
			sex: "m",
			nickname: `Pet_${petType.id}`,
			lovePoints: 100
		});
		pets.push(await pet.save());
	}

	return {
		pets,
		maxUniquePets
	};
}

/**
 * Generate pets for players
 * @param config - Pet generation configuration
 */
async function generatePetsForPlayers(config: PetGenerationConfig): Promise<PetGenerationResult> {
	if (!config.generatePets) {
		return {
			pets: [],
			actualPlayersPerClass: config.playersPerClass,
			maxUniquePets: 0
		};
	}

	if (config.specificPetId !== null) {
		const pets = await createSpecificPets(config.specificPetId, config.playersPerClass);
		return {
			pets,
			actualPlayersPerClass: config.playersPerClass,
			maxUniquePets: 0
		};
	}

	const {
		pets,
		maxUniquePets
	} = await createVariedPets(config.playersPerClass);
	return {
		pets,
		actualPlayersPerClass: pets.length,
		maxUniquePets
	};
}

/**
 * Create inventory slots for a player
 * @param playerId - Player ID
 * @param inventory - Inventory items
 */
/**
 * Create a single player with inventory
 * @param params - Player creation parameters
 */
async function createPlayer(params: {
	classData: {
		id: number;
		getMaxHealthValue: (level: number) => number;
	};
	level: number;
	petId: number | null;
	index: number;
	useFixedItems: boolean;
}): Promise<void> {
	const keycloakId = `test-player-${params.classData.id}-${params.index + 1}-${Date.now()}-${RandomUtils.crowniclesRandom.integer(1000, 9999)}`;
	const newPlayer = await Players.getOrRegister(keycloakId);

	newPlayer.level = params.level;
	newPlayer.class = params.classData.id;
	newPlayer.petId = params.petId;
	newPlayer.setHealthNoCheck(params.classData.getMaxHealthValue(params.level));
	newPlayer.experience = 0;
	newPlayer.money = 1000;
	newPlayer.score = 0;
	newPlayer.weeklyScore = 0;

	await newPlayer.save();

	const inventory = generateRandomInventory({
		level: params.level,
		classId: params.classData.id,
		useFixedItems: params.useFixedItems
	});

	// Create player inventory
	await InventorySlot.create({
		playerId: newPlayer.id,
		itemCategory: ItemCategory.WEAPON,
		itemId: inventory.weaponId,
		slot: 0
	});

	await InventorySlot.create({
		playerId: newPlayer.id,
		itemCategory: ItemCategory.ARMOR,
		itemId: inventory.armorId,
		slot: 0
	});

	await InventorySlot.create({
		playerId: newPlayer.id,
		itemCategory: ItemCategory.POTION,
		itemId: 0,
		slot: 0
	});

	await InventorySlot.create({
		playerId: newPlayer.id,
		itemCategory: ItemCategory.OBJECT,
		itemId: inventory.objectId,
		slot: 0
	});
}

/**
 * Format class display for result message
 */
function formatClassDisplay(availableClasses: unknown[]): string {
	const classIds = (availableClasses as Array<{
		id: number;
	}>).map(c => `${c.id}`).join(", ");
	return classIds.length > 100 ? `${availableClasses.length} classes` : classIds;
}

/**
 * Get pet limit message
 */
function getPetLimitMessage(params: {
	generatePets: boolean;
	actualPlayersPerClass: number;
	playersPerClass: number;
	specificPetId: number | null;
	maxUniquePets: number;
}): string {
	const isLimited = params.generatePets
		&& params.actualPlayersPerClass < params.playersPerClass
		&& params.specificPetId === null;

	return isLimited ? ` (limité à ${params.maxUniquePets} pets uniques)` : "";
}

/**
 * Get pet information summary
 */
function getPetInfoSummary(params: {
	generatePets: boolean;
	specificPetId: number | null;
	petsCount: number;
}): string {
	if (!params.generatePets) {
		return "Aucun";
	}

	if (params.specificPetId !== null) {
		return `${params.petsCount} générés (pet ID ${params.specificPetId})`;
	}

	return `${params.petsCount} générés (variés)`;
}

/**
 * Format the result message
 */
function formatResultMessage(params: {
	level: number;
	actualPlayersPerClass: number;
	playersPerClass: number;
	useFixedItems: boolean;
	generatePets: boolean;
	specificPetId: number | null;
	pets: PetEntity[];
	maxUniquePets: number;
	classGroup: number;
	availableClasses: unknown[];
	totalPlayersCreated: number;
}): string {
	const classesDisplay = formatClassDisplay(params.availableClasses);
	const limitMessage = getPetLimitMessage({
		generatePets: params.generatePets,
		actualPlayersPerClass: params.actualPlayersPerClass,
		playersPerClass: params.playersPerClass,
		specificPetId: params.specificPetId,
		maxUniquePets: params.maxUniquePets
	});
	const petInfo = getPetInfoSummary({
		generatePets: params.generatePets,
		specificPetId: params.specificPetId,
		petsCount: params.pets.length
	});

	return "✅ Génération terminée !\n"
		+ "📊 Résumé :\n"
		+ `• Niveau : ${params.level}\n`
		+ `• Joueurs par classe : ${params.actualPlayersPerClass}${limitMessage}\n`
		+ `• Items : ${params.useFixedItems ? "Fixes par groupe de classe" : "Aléatoires par niveau"}\n`
		+ `• Pets : ${petInfo}\n`
		+ `• Groupe de classes : ${params.classGroup}\n`
		+ `• Classes disponibles : ${params.availableClasses.length}\n`
		+ `• Joueurs créés : ${params.totalPlayersCreated} (${params.actualPlayersPerClass} par classe)\n\n`
		+ `Classes concernées : ${classesDisplay}`;
}

/**
 * Calculate class group based on level
 */
function calculateClassGroup(level: number): number {
	const ranges = [
		[ClassConstants.REQUIRED_LEVEL, ClassConstants.GROUP1LEVEL],
		[ClassConstants.GROUP1LEVEL, ClassConstants.GROUP2LEVEL],
		[ClassConstants.GROUP2LEVEL, ClassConstants.GROUP3LEVEL],
		[ClassConstants.GROUP3LEVEL, ClassConstants.GROUP4LEVEL]
	];
	const index = ranges.findIndex(([min, max]) => level >= min && level < max);
	return index >= 0 ? index : ranges.length;
}

/**
 * Create all players for all classes
 */
async function createAllPlayers(params: {
	availableClasses: Array<{
		id: number;
		getMaxHealthValue: (level: number) => number;
	}>;
	actualPlayersPerClass: number;
	level: number;
	generatePets: boolean;
	pets: PetEntity[];
	useFixedItems: boolean;
}): Promise<number> {
	let totalPlayersCreated = 0;
	for (const classData of params.availableClasses) {
		for (let i = 0; i < params.actualPlayersPerClass; i++) {
			await createPlayer({
				classData,
				level: params.level,
				petId: params.generatePets ? params.pets[i].id : null,
				index: i,
				useFixedItems: params.useFixedItems
			});
			totalPlayersCreated++;
		}
	}
	return totalPlayersCreated;
}

/**
 * Parse command arguments
 * @param args - Command arguments
 */
function parseCommandArguments(args: string[]): CommandConfig {
	return {
		level: parseInt(args[0], 10),
		playersPerClass: args.length > 1 ? parseInt(args[1], 10) : 20,
		useFixedItems: args.length > 2 ? args[2].toLowerCase() === "true" : false,
		generatePets: args.length > 3 ? args[3].toLowerCase() === "true" : true,
		specificPetId: args.length > 4 ? parseInt(args[4], 10) : null
	};
}

/**
 * Generate players in the database
 */
const generatePlayersTestCommand: ExecuteTestCommandLike = async (_player, args) => {
	const config = parseCommandArguments(args);

	validateCommandConfig(config);

	const classGroup = calculateClassGroup(config.level);
	const availableClasses = ClassDataController.instance.getByGroup(classGroup);

	if (availableClasses.length === 0) {
		throw new Error(`Erreur generatePlayers : aucune classe disponible pour le niveau ${config.level} !`);
	}

	const {
		pets,
		actualPlayersPerClass,
		maxUniquePets
	} = await generatePetsForPlayers({
		generatePets: config.generatePets,
		playersPerClass: config.playersPerClass,
		specificPetId: config.specificPetId
	});

	const totalPlayersCreated = await createAllPlayers({
		availableClasses,
		actualPlayersPerClass,
		level: config.level,
		generatePets: config.generatePets,
		pets,
		useFixedItems: config.useFixedItems
	});

	return formatResultMessage({
		level: config.level,
		actualPlayersPerClass,
		playersPerClass: config.playersPerClass,
		useFixedItems: config.useFixedItems,
		generatePets: config.generatePets,
		specificPetId: config.specificPetId,
		pets,
		maxUniquePets,
		classGroup,
		availableClasses,
		totalPlayersCreated
	});
};

commandInfo.execute = generatePlayersTestCommand;
