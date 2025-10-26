import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import {
	Players
} from "../../../../core/database/game/models/Player";
import {
	InventorySlot
} from "../../../../core/database/game/models/InventorySlot";
import {
	PetEntities
} from "../../../../core/database/game/models/PetEntity";
import {
	readFileSync, existsSync
} from "fs";

export const commandInfo: ITestCommand = {
	name: "importPlayers",
	commandFormat: "<filename>",
	typeWaited: {
		filename: TypeKey.STRING
	},
	description: "Importe les joueurs depuis un fichier JSON exporté avec exportPlayers. Crée ou met à jour les joueurs, leurs pets et inventaires."
};

type ImportedPlayer = {
	keycloakId: string;
	level: number;
	class: number;
	health: number;
	experience: number;
	money: number;
	score: number;
	weeklyScore: number;
	pet: {
		typeId: number;
		sex: string;
		nickname: string;
		lovePoints: number;
	} | null;
	inventory: Array<{
		itemCategory: number;
		itemId: number;
		slot: number;
	}>;
};

type ImportData = {
	exportDate: string;
	pattern: string;
	totalPlayers: number;
	players: ImportedPlayer[];
};

/**
 * Read and parse import file
 */
function readImportFile(filename: string): ImportData {
	if (!existsSync(filename)) {
		throw new Error(`Erreur importPlayers : le fichier "${filename}" n'existe pas !`);
	}

	try {
		const fileContent = readFileSync(filename, "utf-8");
		return JSON.parse(fileContent) as ImportData;
	}
	catch (error) {
		throw new Error(`Erreur importPlayers : impossible de lire ou parser le fichier "${filename}" ! ${error.message}`);
	}
}

/**
 * Create pet from import data
 */
async function createPetFromData(petData: ImportedPlayer["pet"]): Promise<number | null> {
	if (!petData) {
		return null;
	}

	const pet = PetEntities.createPet(
		petData.typeId,
		petData.sex,
		petData.nickname
	);
	pet.lovePoints = petData.lovePoints;
	await pet.save();

	return pet.id;
}

/**
 * Import player inventory
 */
async function importPlayerInventory(playerId: number, inventory: ImportedPlayer["inventory"]): Promise<void> {
	// Clear existing inventory
	await InventorySlot.destroy({
		where: {
			playerId
		}
	});

	// Import inventory slots
	if (inventory && inventory.length > 0) {
		for (const invSlot of inventory) {
			await InventorySlot.create({
				playerId,
				itemCategory: invSlot.itemCategory,
				itemId: invSlot.itemId,
				slot: invSlot.slot
			});
		}
	}
}

/**
 * Import a single player
 */
async function importSinglePlayer(playerData: ImportedPlayer): Promise<{
	isNew: boolean;
	petCreated: boolean;
	inventoryCreated: boolean;
}> {
	const player = await Players.getOrRegister(playerData.keycloakId);
	const isNew = player.level === 0; // New players have level 0 by default

	// Update player properties
	player.level = playerData.level;
	player.class = playerData.class;
	player.health = playerData.health;
	player.experience = playerData.experience;
	player.money = playerData.money;
	player.score = playerData.score;
	player.weeklyScore = playerData.weeklyScore;

	// Handle pet
	const petId = await createPetFromData(playerData.pet);
	if (petId !== null) {
		player.petId = petId;
	}

	await player.save();

	// Import inventory
	await importPlayerInventory(player.id, playerData.inventory);

	return {
		isNew,
		petCreated: playerData.pet !== null,
		inventoryCreated: playerData.inventory && playerData.inventory.length > 0
	};
}

/**
 * Import players from a JSON file
 */
const importPlayersTestCommand: ExecuteTestCommandLike = async (_player, args) => {
	const filename = args[0];

	if (!filename || filename.trim() === "") {
		throw new Error("Erreur importPlayers : le nom du fichier ne peut pas être vide !");
	}

	const importData = readImportFile(filename);

	// Validate data structure
	if (!importData.players || !Array.isArray(importData.players)) {
		throw new Error("Erreur importPlayers : le fichier ne contient pas de données de joueurs valides !");
	}

	let playersCreated = 0;
	let playersUpdated = 0;
	let petsCreated = 0;
	let inventoriesCreated = 0;

	// Import each player
	for (const playerData of importData.players) {
		const result = await importSinglePlayer(playerData);

		if (result.isNew) {
			playersCreated++;
		}
		else {
			playersUpdated++;
		}

		if (result.petCreated) {
			petsCreated++;
		}

		if (result.inventoryCreated) {
			inventoriesCreated++;
		}
	}

	return "✅ Import terminé !\n"
		+ "📊 Résumé :\n"
		+ `• Fichier : ${filename}\n`
		+ `• Date d'export : ${importData.exportDate}\n`
		+ `• Pattern d'origine : "${importData.pattern}"\n`
		+ `• Joueurs créés : ${playersCreated}\n`
		+ `• Joueurs mis à jour : ${playersUpdated}\n`
		+ `• Pets créés : ${petsCreated}\n`
		+ `• Inventaires créés : ${inventoriesCreated}`;
};

commandInfo.execute = importPlayersTestCommand;
