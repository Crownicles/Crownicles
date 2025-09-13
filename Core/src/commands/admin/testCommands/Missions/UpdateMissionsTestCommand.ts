import { MissionsController } from "../../../../core/missions/MissionsController";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { MissionDataController } from "../../../../data/Mission";

export const commandInfo: ITestCommand = {
	name: "updateMissions",
	aliases: ["updateMission", "um"],
	commandFormat: "<mission id> <count>",
	typeWaited: {
		"mission id": TypeKey.STRING,
		"count": TypeKey.INTEGER
	},
	description: "Met à jour le progrès d'une mission spécifique avec le nombre d'unités donné. Voir Core/resources/missions/ pour les IDs valides"
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
