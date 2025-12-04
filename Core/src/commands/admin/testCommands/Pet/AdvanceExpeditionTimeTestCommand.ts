import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { PetExpeditions } from "../../../../core/database/game/models/PetExpedition";

export const commandInfo: ITestCommand = {
	name: "advanceexpedition",
	aliases: ["aexp"],
	commandFormat: "<time>",
	typeWaited: { time: TypeKey.INTEGER },
	description: "Fait avancer le temps d'une expédition de familier de <time> minutes. Permet de simuler la fin d'une expédition sans attendre"
};

/**
 * Advance expedition time by a given number of minutes
 */
const advanceExpeditionTimeTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const minutesToAdvance = parseInt(args[0], 10);

	const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
	if (!activeExpedition) {
		return "❌ Vous n'avez pas d'expédition en cours !";
	}

	/*
	 * Subtract time from both start and end dates to preserve the original duration
	 * This way the expedition duration stored in logs will remain correct
	 */
	const newStartDate = new Date(activeExpedition.startDate.getTime() - minutesToAdvance * 60 * 1000);
	const newEndDate = new Date(activeExpedition.endDate.getTime() - minutesToAdvance * 60 * 1000);
	activeExpedition.startDate = newStartDate;
	activeExpedition.endDate = newEndDate;
	await activeExpedition.save();

	const remainingMinutes = Math.max(0, Math.round((newEndDate.getTime() - Date.now()) / (60 * 1000)));

	if (remainingMinutes <= 0) {
		return "✅ L'expédition de votre familier est maintenant terminée ! Utilisez {command:pet} pour récupérer les récompenses.";
	}

	return `✅ L'expédition a été avancée de ${minutesToAdvance} minutes. Temps restant : ${remainingMinutes} minutes.`;
};

commandInfo.execute = advanceExpeditionTimeTestCommand;
