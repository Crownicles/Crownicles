import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { LogsFightsResults } from "../../../../core/database/logs/models/LogsFightsResults";
import {
	HasOne, Op
} from "sequelize";
import {
	getNextSaturdayMidnight, millisecondsToSeconds, msDiff
} from "../../../../../../Lib/src/utils/TimeUtils";
import { LogsPlayers } from "../../../../core/database/logs/models/LogsPlayers";
import { Players } from "../../../../core/database/game/models/Player";
import { TimeConstants } from "../../../../../../Lib/src/constants/TimeConstants";

export const commandInfo: ITestCommand = {
	name: "resetbo3",
	commandFormat: "<keycloakId>",
	typeWaited: { keycloakId: TypeKey.ID },
	description: "Remet à zéro le Best of 3 (série de combats PvP) contre un joueur spécifique."
};

/**
 * Reset the BO3 against a player
 */
const bo3TestCommand: ExecuteTestCommandLike = async (player, args) => {
	const otherPlayer = (await Players.getByKeycloakId(args[0]))!;
	const fightsBO3 = await LogsFightsResults.findAll({
		where: {
			[Op.or]: [
				{
					"$LogsPlayer1.keycloakId$": otherPlayer.keycloakId,
					"$LogsPlayer2.keycloakId$": player.keycloakId
				},
				{
					"$LogsPlayer1.keycloakId$": player.keycloakId,
					"$LogsPlayer2.keycloakId$": otherPlayer.keycloakId
				}
			],
			date: {
				[Op.gt]: Math.floor(millisecondsToSeconds(msDiff(getNextSaturdayMidnight(), TimeConstants.MS_TIME.WEEK)))
			},
			friendly: false
		},
		include: [
			{
				model: LogsPlayers,
				association: new HasOne(LogsFightsResults, LogsPlayers, {
					sourceKey: "fightInitiatorId",
					foreignKey: "id",
					as: "LogsPlayer1"
				})
			}, {
				model: LogsPlayers,
				association: new HasOne(LogsFightsResults, LogsPlayers, {
					sourceKey: "player2Id",
					foreignKey: "id",
					as: "LogsPlayer2"
				})
			}
		]
	});

	for (const fightBO3 of fightsBO3) {
		await fightBO3.destroy();
	}

	return `Reset du BO3 contre ${args[0]}`;
};

commandInfo.execute = bo3TestCommand;
