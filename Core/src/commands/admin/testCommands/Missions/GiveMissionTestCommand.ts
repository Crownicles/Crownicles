import { MissionsController } from "../../../../core/missions/MissionsController";
import { MissionDifficulty } from "../../../../core/missions/MissionDifficulty";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { MissionDataController } from "../../../../data/Mission";

export const commandInfo: ITestCommand = {
	name: "giveMission",
	aliases: ["gm"],
	commandFormat: "<mission id> <difficulty>",
	typeWaited: {
		"mission id": TypeKey.STRING,
		"difficulty": TypeKey.STRING
	},
	description: "Permet de se donner une mission spécifique. Voir Core/resources/missions/ pour la liste des IDs disponibles. Difficultés : easy (e), medium (m), hard (h)"
};

/**
 * Set the weapon of the player
 */
const giveMissionTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const missionId = args[0];
	const mission = MissionDataController.instance.getById(missionId);
	if (!mission) {
		throw new Error("Id de mission inconnu !");
	}
	if (mission.campaignOnly) {
		throw new Error("Cette mission n'est disponible que pour la campagne !");
	}

	let difficulty = args[1];
	if (difficulty in [
		"easy",
		"medium",
		"hard"
	]) {
		difficulty = difficulty[0];
	}
	if (!difficulty || difficulty !== "e" && difficulty !== "m" && difficulty !== "h") {
		throw new Error("Difficulté incorrecte, elle doit être easy (e), medium (m) ou hard (h)");
	}

	const missionSlot = await MissionsController.addMissionToPlayer(
		player,
		missionId,
		difficulty === "e" ? MissionDifficulty.EASY : difficulty === "m" ? MissionDifficulty.MEDIUM : MissionDifficulty.HARD
	);

	return `Vous avez reçu la mission suivante:
**Mission ID :** ${mission.id}
**Objectif :** ${missionSlot.missionObjective}`;
};

commandInfo.execute = giveMissionTestCommand;
