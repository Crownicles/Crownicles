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
import { ItemCategory } from "../../../../../../Lib/src/constants/ItemConstants";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";

export const commandInfo: ITestCommand = {
	name: "generatePlayers",
	commandFormat: "<level>",
	typeWaited: {
		level: TypeKey.INTEGER
	},
	description: "Génère un ensemble de joueurs dans la base de données pour chaque classe disponible au niveau donné. Crée 20 joueurs par classe avec des pets et inventaires aléatoires."
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
 * Generate a random inventory setup (one armor, one weapon, one object, no potion)
 */
function generateRandomInventory(): {
	weaponId: number;
	armorId: number;
	objectId: number;
} {
	const weapon = generateRandomItem({ itemCategory: ItemCategory.WEAPON });
	const armor = generateRandomItem({ itemCategory: ItemCategory.ARMOR });
	const object = generateRandomItem({ itemCategory: ItemCategory.OBJECT });

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

	// Generate 20 random pets
	const pets: PetEntity[] = [];
	for (let i = 0; i < 20; i++) {
		const pet = PetEntities.generateRandomPetEntity(level);
		pet.nickname = `TestPet_${i + 1}`;
		pets.push(await pet.save());
	}

	// Generate 20 random inventories
	const inventories: {
		weaponId: number;
		armorId: number;
		objectId: number;
	}[] = [];
	for (let i = 0; i < 20; i++) {
		inventories.push(generateRandomInventory());
	}

	// Create players for each class
	let totalPlayersCreated = 0;
	for (const classData of availableClasses) {
		for (let i = 0; i < 20; i++) {
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
		+ `• Groupe de classes : ${classGroup}\n`
		+ `• Classes disponibles : ${availableClasses.length}\n`
		+ `• Joueurs créés : ${totalPlayersCreated} (${20} par classe)\n`
		+ `• Pets générés : ${pets.length}\n`
		+ `• Inventaires générés : ${inventories.length}\n\n`
		+ `Classes concernées : ${availableClasses.map(c => `${c.id}`).join(", ")}`;
};

commandInfo.execute = generatePlayersTestCommand;
