import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { Homes } from "../../../../core/database/game/models/Home";
import { HomeLevel } from "../../../../../../Lib/src/types/HomeLevel";

export const commandInfo: ITestCommand = {
	name: "homeLevel",
	commandFormat: "<level>",
	typeWaited: { level: TypeKey.INTEGER },
	description: "Change le niveau de votre maison entre 1 et 8."
};

const homeLevelTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const home = await Homes.getOfPlayer(player.id);
	if (!home) {
		throw new Error("Vous n'avez pas de maison !");
	}

	const level = parseInt(args[0], 10);
	if (!HomeLevel.getByLevel(level)) {
		throw new Error("Niveau de maison invalide !");
	}

	home.level = level;
	await home.save();

	return `Le niveau de votre maison a été changé à ${level}.`;
};

commandInfo.execute = homeLevelTestCommand;
