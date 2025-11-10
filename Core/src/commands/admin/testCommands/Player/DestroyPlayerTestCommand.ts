import InventoryInfo from "../../../../core/database/game/models/InventoryInfo";
import InventorySlot from "../../../../core/database/game/models/InventorySlot";
import Player from "../../../../core/database/game/models/Player";
import MissionSlot from "../../../../core/database/game/models/MissionSlot";
import PlayerMissionsInfo from "../../../../core/database/game/models/PlayerMissionsInfo";
import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { DwarfPetsSeen } from "../../../../core/database/game/models/DwarfPetsSeen";

export const commandInfo: ITestCommand = {
	name: "destroyplayer",
	aliases: ["destroy"],
	description: "Détruit la session actuelle du joueur. Il sera requis de réaliser /report ou /test skiptuto pour continuer les tests nécessitant un joueur initialisé"
};

/**
 * Reset the player
 */
const destroyPlayerTestCommand: ExecuteTestCommandLike = async player => {
	await MissionSlot.destroy({
		where: { playerId: player.id }
	});
	await PlayerMissionsInfo.destroy({
		where: { playerId: player.id }
	});
	await InventorySlot.destroy({
		where: { playerId: player.id }
	});
	await InventoryInfo.destroy({
		where: { playerId: player.id }
	});
	await MissionSlot.destroy({
		where: { playerId: player.id }
	});
	await PlayerMissionsInfo.destroy({
		where: { playerId: player.id }
	});
	await Player.destroy({
		where: { id: player.id }
	});
	await DwarfPetsSeen.destroy({ where: {
		playerId: player.id
	} });
	return "Vous avez été réinitialisé !";
};

commandInfo.execute = destroyPlayerTestCommand;
