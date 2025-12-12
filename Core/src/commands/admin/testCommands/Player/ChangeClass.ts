import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { ClassDataController } from "../../../../data/Class";
import { crowniclesInstance } from "../../../../index";

export const commandInfo: ITestCommand = {
	name: "changeClass",
	commandFormat: "<classId>",
	typeWaited: {
		classId: TypeKey.INTEGER
	},
	description: "Change votre classe pour la classe d'id donnée.",
	argSuggestions: { classId: ["1", "2", "3", "4", "5", "6", "7", "8"] }
};

/**
 * Change player's class
 */
const changeClassTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const newClassId = parseInt(args[0], 10);
	if (newClassId <= 0 || newClassId >= ClassDataController.instance.getClassMaxId()) {
		throw new Error("Erreur class : choisissez une classe qui existe !");
	}
	player.class = newClassId;
	crowniclesInstance.logsDatabase.logPlayerClassChange(player.keycloakId, newClassId).then();
	await player.save();
	return `Vous avez maintenant la classe d'id : ${newClassId} !`;
};

commandInfo.execute = changeClassTestCommand;
