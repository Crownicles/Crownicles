import { MissionsController } from "../../../../core/missions/MissionsController";
import { MissionDifficulty } from "../../../../core/missions/MissionDifficulty";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { MissionSlots } from "../../../../core/database/game/models/MissionSlot";
import { MissionDataController } from "../../../../data/Mission";

export const commandInfo: ITestCommand = {
	name: "giveRandomMission",
	aliases: ["grm"],
	commandFormat: "<difficulty>",
	typeWaited: {
		difficulty: TypeKey.STRING
	},
	description: "Attribue une mission aléatoire avec la difficulté spécifiée. Difficultés : easy (e), medium (m), hard (h). Nécessite un slot de mission libre",
	argSuggestions: {
		difficulty: ["easy", "medium", "hard", "e", "m", "h"]
	}
};

/**
 * Give a random mission
 */
const giveRandomMissionTestCommand: ExecuteTestCommandLike = async (player, args) => {
	if (!player.hasEmptyMissionSlot(await MissionSlots.getOfPlayer(player.id))) {
		throw new Error("Les slots de mission du joueur sont tous pleins");
	}
	const difficulty = args[0];
	if (!difficulty || difficulty !== "e" && difficulty !== "m" && difficulty !== "h") {
		throw new Error("Difficulté incorrecte, elle doit être easy (e), medium (m) ou hard (h)");
	}
	const missionSlot = await MissionsController.addRandomMissionToPlayer(
		player,
		difficulty === "e" ? MissionDifficulty.EASY : difficulty === "m" ? MissionDifficulty.MEDIUM : MissionDifficulty.HARD
	);
	const mission = MissionDataController.instance.getById(missionSlot.missionId);

	return `Vous avez reçu la mission suivante:
**Mission ID :** ${mission.id}
**Objectif :** ${missionSlot.missionObjective}`;
};

commandInfo.execute = giveRandomMissionTestCommand;
