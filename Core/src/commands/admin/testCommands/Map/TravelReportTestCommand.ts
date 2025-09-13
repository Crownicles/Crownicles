import { Maps } from "../../../../core/maps/Maps";
import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "travelreport",
	aliases: ["tr"],
	description: "Remet à zéro la date de début du voyage actuel, permettant de déclencher immédiatement un nouvel événement via /report"
};

/**
 * Reset your current travel
 */
const travelReportTestCommand: ExecuteTestCommandLike = async player => {
	if (!Maps.isTravelling(player)) {
		throw new Error("Erreur travelreport : vous ne voyagez pas actuellement !");
	}
	player.startTravelDate = new Date();
	player.effectEndDate = new Date(0);
	await player.save();
	return "Vous avez réinitialisé votre parcours !";
};

commandInfo.execute = travelReportTestCommand;
