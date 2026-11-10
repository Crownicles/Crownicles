import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { ClassDataController } from "../../../../data/Class";
import { KingGuardDataController } from "../../../../data/KingGuard";
import { startKingGuardFight } from "../../../player/KingGuardFightCommand";

export const commandInfo: ITestCommand = {
	name: "kingguard",
	aliases: ["kg", "garde"],
	commandFormat: "[guardId]",
	typeWaited: {
		guardId: TypeKey.INTEGER
	},
	minArgs: 0,
	description: "Lance immédiatement un combat contre un garde du roi, sans chercher d'adversaire réel. "
		+ "Sans argument, le garde est choisi comme d'habitude selon la cote cachée du joueur ; sinon, c'est le garde de la bibliothèque portant cet id. "
		+ "Le combat met à jour la cote cachée du joueur et celle du garde."
};

/**
 * Start a fight against a king guard
 */
const kingGuardTestCommand: ExecuteTestCommandLike = async (player, args, response, context) => {
	const playerClass = ClassDataController.instance.getById(player.class);
	if (!playerClass) {
		throw new Error("Class not found for player");
	}
	const guardId = args[0] ? parseInt(args[0], 10) : undefined;
	if (guardId !== undefined && !KingGuardDataController.instance.getById(guardId)) {
		throw new Error(`Garde ${guardId} inconnu`);
	}
	await startKingGuardFight({
		player,
		playerClass,
		...guardId === undefined ? {} : { guardId }
	}, context, response);
	return `Combat contre un garde du roi lancé (garde ${guardId ?? "choisi selon la cote"})`;
};

commandInfo.execute = kingGuardTestCommand;
