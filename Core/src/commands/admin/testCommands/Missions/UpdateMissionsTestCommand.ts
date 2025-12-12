import { MissionsController } from "../../../../core/missions/MissionsController";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { Mission, MissionDataController } from "../../../../data/Mission";

const missionIds = MissionDataController.instance.getAll().map((m: Mission) => m.id);

// Sample mission IDs with common count values
const sampleMissionIds = missionIds.slice(0, 8);
const commonCounts = ["1", "5", "10"];
const updateMissionFullSuggestions = sampleMissionIds.flatMap(missionId =>
	commonCounts.map(count => `${missionId} ${count}`)
).slice(0, 25);

export const commandInfo: ITestCommand = {
	name: "updateMissions",
	aliases: ["updateMission", "um"],
	commandFormat: "<mission id> <count>",
	typeWaited: {
		"mission id": TypeKey.STRING,
		"count": TypeKey.INTEGER
	},
	description: "Met à jour le progrès d'une mission spécifique avec le nombre d'unités donné. Voir Core/resources/missions/ pour les IDs valides",
	argSuggestions: {
		"mission id": missionIds,
		"count": commonCounts
	},
	fullSuggestions: updateMissionFullSuggestions
};

/**
 * Update les missions du joueur d'un montant donné
 */
const updateMissionsTestCommand: ExecuteTestCommandLike = async (player, args, response): Promise<string> => {
	const mission = MissionDataController.instance.getById(args[0]);
	if (!mission) {
		throw new Error("mission id inconnu");
	}
	const count = parseInt(args[1], 10);
	await MissionsController.update(player, response, {
		missionId: args[0], count
	});

	return `Vous avez avancé de ${count} vos missions ${args[0]}`;
};

commandInfo.execute = updateMissionsTestCommand;
