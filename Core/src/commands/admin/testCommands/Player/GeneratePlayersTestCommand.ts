import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import {
	Players
} from "../../../../core/database/game/models/Player";
import { InventorySlot } from "../../../../core/database/game/models/InventorySlot";
import {
	PetEntity
} from "../../../../core/database/game/models/PetEntity";
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
	commandFormat: "<level> [playersPerClass:number] [fixedItems:true/false] [generatePets:true/false] [petId:number]",
	typeWaited: {
		level: TypeKey.INTEGER,
		playersPerClass: TypeKey.INTEGER,
		fixedItems: TypeKey.STRING,
		generatePets: TypeKey.STRING,
		petId: TypeKey.INTEGER
	},
	minArgs: 1,
	description: "Génère un ensemble de joueurs dans la base de données pour chaque classe disponible au niveau donné. Par défaut crée 20 joueurs par classe. Si playersPerClass est spécifié, crée ce nombre de joueurs par classe (limité au nombre de pets uniques disponibles). Si fixedItems=true, utilise des items prédéfinis par groupe de classe. Si generatePets=false, les joueurs sont créés sans pets. Si petId est spécifié, tous les joueurs auront ce pet spécifique au lieu de pets aléatoires."
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
function getClassBehaviorGroup(classId: number): string {
	// Gunner group (5 classes)
	if ([
		ClassConstants.CLASSES_ID.FORMIDABLE_GUNNER,
		ClassConstants.CLASSES_ID.GUNNER,
		ClassConstants.CLASSES_ID.ARCHER,
		ClassConstants.CLASSES_ID.SLINGER,
		ClassConstants.CLASSES_ID.ROCK_THROWER
	].includes(classId)) {
		return "gunner";
	}

	// Paladin group (2 classes)
	if ([
		ClassConstants.CLASSES_ID.PALADIN,
		ClassConstants.CLASSES_ID.LUMINOUS_PALADIN
	].includes(classId)) {
		return "paladin";
	}

	// Knight group (5 classes)
	if ([
		ClassConstants.CLASSES_ID.KNIGHT,
		ClassConstants.CLASSES_ID.VALIANT_KNIGHT,
		ClassConstants.CLASSES_ID.PIKEMAN,
		ClassConstants.CLASSES_ID.HORSE_RIDER,
		ClassConstants.CLASSES_ID.ESQUIRE
	].includes(classId)) {
		return "knight";
	}

	// Infantryman group (5 classes)
	if ([
		ClassConstants.CLASSES_ID.POWERFUL_INFANTRYMAN,
		ClassConstants.CLASSES_ID.INFANTRYMAN,
		ClassConstants.CLASSES_ID.SOLDIER,
		ClassConstants.CLASSES_ID.FIGHTER,
		ClassConstants.CLASSES_ID.RECRUIT
	].includes(classId)) {
		return "infantryman";
	}

	// Veteran group (2 classes)
	if ([
		ClassConstants.CLASSES_ID.VETERAN,
		ClassConstants.CLASSES_ID.EXPERIENCED_VETERAN
	].includes(classId)) {
		return "veteran";
	}

	// Tank group (5 classes)
	if ([
		ClassConstants.CLASSES_ID.TANK,
		ClassConstants.CLASSES_ID.IMPENETRABLE_TANK,
		ClassConstants.CLASSES_ID.ENMESHED,
		ClassConstants.CLASSES_ID.HELMETED,
		ClassConstants.CLASSES_ID.GLOVED
	].includes(classId)) {
		return "tank";
	}

	// Mage group (1 class)
	if (classId === ClassConstants.CLASSES_ID.MYSTIC_MAGE) {
		return "mage";
	}

	// Default to random items if class not recognized
	return null;
}

/**
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
		const specificPetType = PetDataController.instance.getById(config.specificPetId);
		const pets: PetEntity[] = [];

		for (let i = 0; i < config.playersPerClass; i++) {
			const pet = PetEntity.build({
				typeId: specificPetType.id,
				sex: "m",
				nickname: `Pet_${specificPetType.id}_${i + 1}`,
				lovePoints: 100
			});
			pets.push(await pet.save());
		}

		return {
			pets,
			actualPlayersPerClass: config.playersPerClass,
			maxUniquePets: 0
		};
	}

	const allPetTypes = getAllValidPetTypes();
	const maxUniquePets = allPetTypes.length;
	const actualPlayersPerClass = Math.min(config.playersPerClass, allPetTypes.length);
	const pets: PetEntity[] = [];

	for (let i = 0; i < actualPlayersPerClass; i++) {
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
		actualPlayersPerClass,
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
	newPlayer.health = params.classData.getMaxHealthValue(params.level);
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
	const classIds = (params.availableClasses as Array<{
		id: number;
	}>).map(c => `${c.id}`).join(", ");
	const classesDisplay = classIds.length > 100 ? `${params.availableClasses.length} classes` : classIds;

	const limitMessage = params.generatePets && params.actualPlayersPerClass < params.playersPerClass && params.specificPetId === null
		? ` (limité à ${params.maxUniquePets} pets uniques)`
		: "";

	const petInfo = params.generatePets
		? params.specificPetId !== null
			? `${params.pets.length} générés (pet ID ${params.specificPetId})`
			: `${params.pets.length} générés (variés)`
		: "Aucun";

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

	// Get the class group based on level
	const ranges = [
		[ClassConstants.REQUIRED_LEVEL, ClassConstants.GROUP1LEVEL],
		[ClassConstants.GROUP1LEVEL, ClassConstants.GROUP2LEVEL],
		[ClassConstants.GROUP2LEVEL, ClassConstants.GROUP3LEVEL],
		[ClassConstants.GROUP3LEVEL, ClassConstants.GROUP4LEVEL]
	];
	const index = ranges.findIndex(([min, max]) => config.level >= min && config.level < max);
	const classGroup = index >= 0 ? index : ranges.length;

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

	let totalPlayersCreated = 0;
	for (const classData of availableClasses) {
		for (let i = 0; i < actualPlayersPerClass; i++) {
			await createPlayer({
				classData,
				level: config.level,
				petId: config.generatePets ? pets[i].id : null,
				index: i,
				useFixedItems: config.useFixedItems
			});
			totalPlayersCreated++;
		}
	}

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
