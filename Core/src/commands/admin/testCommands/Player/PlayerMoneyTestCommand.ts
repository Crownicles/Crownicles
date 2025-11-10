import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "playermoney",
	aliases: ["money"],
	commandFormat: "<money>",
	typeWaited: { money: TypeKey.INTEGER },
	description: "Définit l'argent du joueur testeur à la valeur spécifiée. L'argent sert aux achats d'objets, d'améliorations et aux services de guilde"
};

/**
 * Set the money of the player
 */
const playerMoneyTestCommand: ExecuteTestCommandLike = async (player, args, response) => {
	const money = parseInt(args[0], 10);
	if (money < 0) {
		throw new Error("Erreur money : argent donné inférieur à 0 interdit !");
	}
	await player.addMoney({
		amount: money - player.money,
		response,
		reason: NumberChangeReason.TEST
	});
	await player.save();

	return `Vous avez maintenant ${player.money} :moneybag: !`;
};

commandInfo.execute = playerMoneyTestCommand;
