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
 * Forced class of the guard, none when the argument is missing or 0
 * @param arg
 */
function parseClassOverride(arg: string | undefined): number | undefined {
	const classId = arg ? parseInt(arg, 10) : 0;
	if (classId === 0) {
		return undefined;
	}
	if (!ClassDataController.instance.getById(classId)) {
		throw new Error(`Classe ${classId} inconnue`);
	}
	return classId;
}

/**
 * Forced level of the guard, none when the argument is missing
 * @param arg
 */
function parseLevelOverride(arg: string | undefined): number | undefined {
	if (!arg) {
		return undefined;
	}
	const level = parseInt(arg, 10);
	if (level < FightConstants.REQUIRED_LEVEL) {
		throw new Error(`Le niveau doit être au moins ${FightConstants.REQUIRED_LEVEL}`);
	}
	return level;
}

/**
 * Forced class and level of the guard read from the arguments
 * @param args
 */
function parseOverrides(args: string[]): KingGuardOverrides {
	const classId = parseClassOverride(args[0]);
	const level = parseLevelOverride(args[1]);
	return {
		...classId === undefined ? {} : { classId },
		...level === undefined ? {} : { level }
	};
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
