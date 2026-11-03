import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { ClassDataController } from "../../../../data/Class";
import { startKingGuardFight } from "../../../player/KingGuardFightCommand";

export const commandInfo: ITestCommand = {
	name: "kingguard",
	aliases: ["kg", "garde"],
	description: "Lance immédiatement un combat contre un garde du roi, sans chercher d'adversaire réel."
};

/**
 * Start a fight against a king guard
 */
const kingGuardTestCommand: ExecuteTestCommandLike = async (player, _args, response, context) => {
	const playerClass = ClassDataController.instance.getById(player.class);
	if (!playerClass) {
		throw new Error("Class not found for player");
	}
	await startKingGuardFight(player, playerClass, context, response);
	return "Combat contre un garde du roi lancé";
};

commandInfo.execute = kingGuardTestCommand;
