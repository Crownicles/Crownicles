import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { TravelTime } from "../../../../core/maps/TravelTime";

export const commandInfo: ITestCommand = {
	name: "advancetravel",
	aliases: ["atravel"],
	commandFormat: "<time>",
	typeWaited: { time: TypeKey.INTEGER },
	description: "Fait avancer le temps de voyage du joueur de X minutes, ou son séjour en ville s'il y est arrêté. Permet de simuler la fin d'un déplacement ou un long séjour en ville sans attendre"
};

/**
 * Quick travel your travel of a given time
 */
const advanceTravelTestCommand: ExecuteTestCommandLike = async (player, args) => {
	await TravelTime.timeTravel(player, parseInt(args[0], 10), NumberChangeReason.TEST);
	await player.save();
	return player.insideCity
		? `Vous avez avancé votre séjour en ville de ${args[0]} minutes !`
		: `Vous avez avancé votre voyage de ${args[0]} minutes !`;
};

commandInfo.execute = advanceTravelTestCommand;
