import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { ClassDataController } from "../../../../data/Class";
import { startKingGuardFight } from "../../../player/KingGuardFightCommand";
import { KingGuardOverrides } from "../../../../core/fights/kingGuards/KingGuardGenerator";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";

export const commandInfo: ITestCommand = {
	name: "kingguard",
	aliases: ["kg", "garde"],
	commandFormat: "[classId] [level]",
	typeWaited: {
		classId: TypeKey.INTEGER,
		level: TypeKey.INTEGER
	},
	minArgs: 0,
	description: "Lance immédiatement un combat contre un garde du roi, sans chercher d'adversaire réel. "
		+ "La classe et le niveau du garde sont optionnels (0 pour garder la classe tirée au hasard). "
		+ "Le combat compte dans la progression des gardes du joueur."
};

/**
 * Forced class and level of the guard read from the arguments
 * @param args
 */
function parseOverrides(args: string[]): KingGuardOverrides {
	const overrides: KingGuardOverrides = {};
	const classId = args[0] ? parseInt(args[0], 10) : 0;
	if (classId !== 0) {
		if (!ClassDataController.instance.getById(classId)) {
			throw new Error(`Classe ${classId} inconnue`);
		}
		overrides.classId = classId;
	}
	if (args[1]) {
		const level = parseInt(args[1], 10);
		if (level < FightConstants.REQUIRED_LEVEL) {
			throw new Error(`Le niveau doit être au moins ${FightConstants.REQUIRED_LEVEL}`);
		}
		overrides.level = level;
	}
	return overrides;
}

/**
 * Start a fight against a king guard
 */
const kingGuardTestCommand: ExecuteTestCommandLike = async (player, args, response, context) => {
	const playerClass = ClassDataController.instance.getById(player.class);
	if (!playerClass) {
		throw new Error("Class not found for player");
	}
	const guardOverrides = parseOverrides(args);
	await startKingGuardFight({
		player, playerClass, guardOverrides
	}, context, response);
	return `Combat contre un garde du roi lancé (classe ${guardOverrides.classId ?? "aléatoire"}, niveau ${guardOverrides.level ?? "habituel"})`;
};

commandInfo.execute = kingGuardTestCommand;
