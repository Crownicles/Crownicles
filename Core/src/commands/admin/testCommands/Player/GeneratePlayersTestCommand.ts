import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import {
	Players
} from "../../../../core/database/game/models/Player";
import { InventorySlot } from "../../../../core/database/game/models/InventorySlot";
import {
	PetEntity, PetEntities
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

export const commandInfo: ITestCommand = {
	name: "generatePlayers",
	commandFormat: "<level> [allPets:true/false]",
	typeWaited: {
		level: TypeKey.INTEGER,
		allPets: TypeKey.STRING
	},
	minArgs: 1,
	description: "Génère un ensemble de joueurs dans la base de données pour chaque classe disponible au niveau donné. Par défaut crée 20 joueurs par classe. Si allPets=true, crée un joueur pour chaque pet différent disponible par classe."
};

/**
 * Get the class group based on level
 * @param level
 */
function getClassGroupByLevel(level: number): number {
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
 * Get item rarity based on player level
 * @param level
 */
function getRarityByLevel(level: number): number {
	if (level >= 100) {
		return 6;
	}
	if (level >= 50) {
		return 5;
	}
	return 4;
}

/**
 * Generate a random inventory setup (one armor, one weapon, one object, no potion)
 * Objects will only have fight-related effects (attack, defense, speed)
 * @param level - Player level to determine item rarity
 */
function generateRandomInventory(level: number): {
	weaponId: number;
	armorId: number;
	objectId: number;
} {
	const rarity = getRarityByLevel(level);

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

	// For objects, pick a random fight-related nature (attack, defense, or speed)
	const fightNature = RandomUtils.crowniclesRandom.pick(FightItemNatures);
	const object = generateRandomItem({
		itemCategory: ItemCategory.OBJECT,
		minRarity: rarity,
		maxRarity: rarity,
		subType: fightNature
	});

	return {
		weaponId: weapon.id,
		armorId: armor.id,
		objectId: object.id
	};
}

/**
 * Generate players in the database
 */
const generatePlayersTestCommand: ExecuteTestCommandLike = async (_player, args) => {
	const level = parseInt(args[0], 10);
	const allPets = args.length > 1 ? args[1].toLowerCase() === "true" : false;

	if (level < ClassConstants.REQUIRED_LEVEL) {
		throw new Error(`Erreur generatePlayers : le niveau doit être au moins ${ClassConstants.REQUIRED_LEVEL} (niveau requis pour débloquer les classes) !`);
	}

	if (level > 200) {
		throw new Error("Erreur generatePlayers : le niveau ne peut pas dépasser 200 !");
	}

	// Get available classes at this level
	const classGroup = getClassGroupByLevel(level);
	const availableClasses = ClassDataController.instance.getByGroup(classGroup);

	if (availableClasses.length === 0) {
		throw new Error(`Erreur generatePlayers : aucune classe disponible pour le niveau ${level} !`);
	}

	let pets: PetEntity[];
	let inventories: {
		weaponId: number;
		armorId: number;
		objectId: number;
	}[];

	if (allPets) {
		// Generate one player per unique pet type
		const maxPetId = PetDataController.instance.getMaxId();
		const allPetTypes: Pet[] = [];

		for (let petId = 1; petId <= maxPetId; petId++) {
			const petType = PetDataController.instance.getById(petId);
			if (petType && petType.rarity !== 0) {
				allPetTypes.push(petType);
			}
		}

		pets = [];
		for (const petType of allPetTypes) {
			const pet = PetEntity.build({
				typeId: petType.id,
				sex: "m",
				nickname: `Pet_${petType.id}`,
				lovePoints: 100
			});
			pets.push(await pet.save());
		}

		// Generate as many inventories as pets
		inventories = [];
		for (let i = 0; i < pets.length; i++) {
			inventories.push(generateRandomInventory(level));
		}
	}
	else {
		// Generate 20 random pets (without duplicates)
		pets = [];
		const usedPetTypeIds = new Set<number>();

		while (pets.length < 20) {
			const pet = PetEntities.generateRandomPetEntity(level);

			// Skip if we already have this pet type
			if (usedPetTypeIds.has(pet.typeId)) {
				continue;
			}

			pet.sex = "m";
			pet.nickname = `TestPet_${pets.length + 1}`;
			usedPetTypeIds.add(pet.typeId);
			pets.push(await pet.save());
		}

		// Generate 20 random inventories
		inventories = [];
		for (let i = 0; i < 20; i++) {
			inventories.push(generateRandomInventory(level));
		}
	}

	// Create players for each class
	const playersPerClass = pets.length;
	let totalPlayersCreated = 0;
	for (const classData of availableClasses) {
		for (let i = 0; i < playersPerClass; i++) {
			// Generate unique keycloak ID
			const keycloakId = `test-player-${classData.id}-${i + 1}-${Date.now()}-${RandomUtils.crowniclesRandom.integer(1000, 9999)}`;

			// Create player
			const newPlayer = await Players.getOrRegister(keycloakId);

			// Set player properties
			newPlayer.level = level;
			newPlayer.class = classData.id;
			newPlayer.petId = pets[i].id;
			newPlayer.health = classData.getMaxHealthValue(level);
			newPlayer.experience = 0;
			newPlayer.money = 1000; // Give them some starting money
			newPlayer.score = 0;
			newPlayer.weeklyScore = 0;

			await newPlayer.save();

			// Create inventory slots for the player
			const inventory = inventories[i];

			// Weapon slot (equipped)
			await InventorySlot.create({
				playerId: newPlayer.id,
				itemCategory: ItemCategory.WEAPON,
				itemId: inventory.weaponId,
				slot: 0 // slot 0 means equipped
			});

			// Armor slot (equipped)
			await InventorySlot.create({
				playerId: newPlayer.id,
				itemCategory: ItemCategory.ARMOR,
				itemId: inventory.armorId,
				slot: 0 // slot 0 means equipped
			});

			// Potion slot (empty, default potion)
			await InventorySlot.create({
				playerId: newPlayer.id,
				itemCategory: ItemCategory.POTION,
				itemId: 0, // No potion
				slot: 0
			});

			// Object slot (equipped)
			await InventorySlot.create({
				playerId: newPlayer.id,
				itemCategory: ItemCategory.OBJECT,
				itemId: inventory.objectId,
				slot: 0 // slot 0 means equipped
			});

			totalPlayersCreated++;
		}
	}

	return `✅ Génération terminée !\n`
		+ `📊 Résumé :\n`
		+ `• Niveau : ${level}\n`
		+ `• Mode : ${allPets ? "Tous les pets" : "20 pets aléatoires"}\n`
		+ `• Groupe de classes : ${classGroup}\n`
		+ `• Classes disponibles : ${availableClasses.length}\n`
		+ `• Joueurs créés : ${totalPlayersCreated} (${playersPerClass} par classe)\n`
		+ `• Pets générés : ${pets.length}\n`
		+ `• Inventaires générés : ${inventories.length}\n\n`
		+ `Classes concernées : ${availableClasses.map(c => `${c.id}`).join(", ")}`;
};

commandInfo.execute = generatePlayersTestCommand;
