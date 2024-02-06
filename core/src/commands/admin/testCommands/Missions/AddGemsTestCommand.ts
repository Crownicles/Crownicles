import {NumberChangeReason} from "../../../../core/constants/LogsConstants";
import {ExecuteTestCommandLike, ITestCommand, TypeKey} from "../../../../core/CommandsTest";
import {PlayerMissionsInfos} from "../../../../core/database/game/models/PlayerMissionsInfo";

export const commandInfo: ITestCommand = {
	name: "addgem",
	commandFormat: "<gem>",
	typeWaited: {
		gem: TypeKey.INTEGER
	},
	description: "Ajoute la valeur donnée de gemmes à votre joueur"
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