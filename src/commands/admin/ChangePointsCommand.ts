import {ICommand} from "../ICommand";
import {CommandInteraction} from "discord.js";
import {ChangeValueAdminCommands} from "../ChangeValueAdminCommands";
import {NumberChangeReason} from "../../core/constants/LogsConstants";
import Player from "../../core/database/game/models/Player";

/**
 * Change the score of a player
 * @param playerToEdit
 * @param amount
 * @param interaction
 * @param language
 */
function givePointsTo(playerToEdit: Player, amount: number, interaction: CommandInteraction, language: string): void {
	if (interaction.options.get("mode").value as string === "set") {
		playerToEdit.addScore({
			amount: amount - playerToEdit.score,
			channel: interaction.channel,
			language,
			reason: NumberChangeReason.ADMIN
		}).then();
	}
	else if (interaction.options.get("mode").value as string === "add") {
		playerToEdit.addScore({
			amount,
			channel: interaction.channel,
			language,
			reason: NumberChangeReason.ADMIN
		}).then();
	}
	else {
		throw new Error("wrong parameter");
	}
}

export const commandInfo: ICommand = ChangeValueAdminCommands.getCommandInfo("points", givePointsTo);