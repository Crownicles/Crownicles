import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "addmoney",
	commandFormat: "<money>",
	typeWaited: { money: TypeKey.INTEGER },
	description: "Ajoute une somme d'argent au solde actuel du joueur testeur. Peut être négatif pour retirer de l'argent"
};

/**
 * Add money to the player
 */
const addMoneyTestCommand: ExecuteTestCommandLike = async (player, args, response) => {
	await player.addMoney({
		amount: parseInt(args[0], 10),
		response,
		reason: NumberChangeReason.TEST
	});
	await player.save();

	return `Vous avez maintenant ${player.money} :moneybag: !`;
};

commandInfo.execute = addMoneyTestCommand;
