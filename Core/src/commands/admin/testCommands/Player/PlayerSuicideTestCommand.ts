import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import { InventorySlots } from "../../../../core/database/game/models/InventorySlot";

export const commandInfo: ITestCommand = {
	name: "playerkill",
	aliases: ["kill", "suicide"],
	description: "Met instantanément la vie du joueur à 0 et le tue. Utile pour tester les mécaniques de mort, respawn et pénalités associées"
};

/**
 * Kill yourself
 */
const playerSuicideTestCommand: ExecuteTestCommandLike = async (player, _args, response) => {
	const activeObjects = await InventorySlots.getPlayerActiveObjects(player.id);
	await player.addHealth(-player.getHealth(activeObjects), response, NumberChangeReason.TEST, activeObjects, {
		overHealCountsForMission: true,
		shouldPokeMission: true
	});
	await player.killIfNeeded(response, NumberChangeReason.TEST);
	await Promise.all([player.save(), player.save()]);

	return "Vous vous êtes suicidé avec succès !";
};

commandInfo.execute = playerSuicideTestCommand;
