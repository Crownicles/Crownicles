import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import Player from "../../../../core/database/game/models/Player";
import { InventorySlots } from "../../../../core/database/game/models/InventorySlot";
import { PetEntities } from "../../../../core/database/game/models/PetEntity";
import { writeFileSync } from "fs";
import { Op } from "sequelize";
import { makePacket } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandTestPacketRes } from "../../../../../../Lib/src/packets/commands/CommandTestPacket";

export const commandInfo: ITestCommand = {
	name: "exportPlayers",
	commandFormat: "<pattern>",
	typeWaited: {
		pattern: TypeKey.STRING
	},
	description: "Exporte les joueurs dont le keycloakId correspond au pattern (supporte les wildcards %), leurs pets et inventaires dans un fichier JSON."
};

type ExportPlayerData = {
	keycloakId: string;
	level: number;
	class: number;
	health: number;
	experience: number;
	money: number;
	score: number;
	weeklyScore: number;
	pet: unknown;
	inventory: unknown[];
};

/**
 * Export player pet data
 */
async function exportPlayerPet(petId: number | null): Promise<unknown> {
	if (!petId) {
		return null;
	}

	const pet = await PetEntities.getById(petId);
	if (!pet) {
		return null;
	}

	return {
		typeId: pet.typeId,
		sex: pet.sex,
		nickname: pet.nickname,
		lovePoints: pet.lovePoints
	};
}

/**
 * Export player inventory data
 */
async function exportPlayerInventory(playerId: number): Promise<unknown[]> {
	const inventorySlots = await InventorySlots.getOfPlayer(playerId);
	return inventorySlots.map(slot => ({
		itemCategory: slot.itemCategory,
		itemId: slot.itemId,
		slot: slot.slot
	}));
}

/**
 * Export single player with their data
 */
async function exportSinglePlayer(player: Player): Promise<ExportPlayerData> {
	const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);
	return {
		keycloakId: player.keycloakId,
		level: player.level,
		class: player.class,
		health: player.getHealth(playerActiveObjects),
		experience: player.experience,
		money: player.money,
		score: player.score,
		weeklyScore: player.weeklyScore,
		pet: await exportPlayerPet(player.petId),
		inventory: await exportPlayerInventory(player.id)
	};
}

/**
 * Export players matching a pattern to a JSON file
 */
const exportPlayersTestCommand: ExecuteTestCommandLike = async (_player, args, response) => {
	const pattern = args[0];

	if (!pattern || pattern.trim() === "") {
		throw new Error("Erreur exportPlayers : le pattern ne peut pas être vide !");
	}

	// Find all players matching the pattern (SQL LIKE)
	const players = await Player.findAll({
		where: {
			keycloakId: {
				[Op.like]: pattern
			}
		}
	});

	if (players.length === 0) {
		throw new Error(`Erreur exportPlayers : aucun joueur trouvé avec le pattern "${pattern}" !`);
	}

	// Prepare export data
	const exportData = {
		exportDate: new Date().toISOString(),
		pattern,
		totalPlayers: players.length,
		players: await Promise.all(players.map(exportSinglePlayer))
	};

	// Generate filename
	const timestamp = new Date().toISOString()
		.replace(/[:.]/g, "-");
	const filename = `players-export-${timestamp}.json`;

	// Write the export to a file
	writeFileSync(filename, JSON.stringify(exportData, null, 2), "utf-8");

	// Convert to base64 for Discord attachment
	const fileContentBase64 = Buffer.from(JSON.stringify(exportData, null, 2), "utf-8").toString("base64");

	// Push file packet to response array
	response.push(makePacket(CommandTestPacketRes, {
		commandName: "exportPlayers",
		result: `📄 Export généré : ${filename}`,
		isError: false,
		fileName: filename,
		fileContentBase64
	}));

	return `✅ Joueurs exportés avec succès !

📊 **Statistiques de l'export :**
- Pattern : \`${pattern}\`
- Nombre de joueurs : **${players.length}**
- Fichier : \`${filename}\`
- Date : ${new Date().toLocaleString("fr-FR")}`;
};

commandInfo.execute = exportPlayersTestCommand;

