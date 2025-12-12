import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { PlayerMissionsInfos } from "../../../../core/database/game/models/PlayerMissionsInfo";

export const commandInfo: ITestCommand = {
	name: "addgem",
	commandFormat: "<gem>",
	typeWaited: { gem: TypeKey.INTEGER },
	description: "Ajoute un nombre spécifique de gemmes au joueur testeur.",
	argSuggestions: { gem: ["1", "5", "10", "25", "50", "100"] }
};

/**
 * Add gems to the player
 */
const addGemsTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const missionInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
	await missionInfo.addGems(parseInt(args[0], 10), player.keycloakId, NumberChangeReason.TEST);
	await missionInfo.save();

	return `Vous avez maintenant ${missionInfo.gems} :gem: !`;
};

commandInfo.execute = addGemsTestCommand;
