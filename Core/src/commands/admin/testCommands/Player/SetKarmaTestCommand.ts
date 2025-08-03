import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "setkarma",
	aliases: ["setkarma"],
	commandFormat: "<karma>",
	typeWaited: {
		karma: TypeKey.INTEGER
	},
	description: "Définit votre karma à la valeur donnée"
};

/**
 * Set the karma of the player to a specific value
 */
const setKarmaTestCommand: ExecuteTestCommandLike = async (player, args, _response) => {
	const karma = parseInt(args[0], 10);
	await player.setKarma(karma, NumberChangeReason.TEST);
	await player.save();

	return `Votre karma a été défini à ${player.karma} 🎭 !`;
};

commandInfo.execute = setKarmaTestCommand;
