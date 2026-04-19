import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { Homes } from "../../../../core/database/game/models/Home";

export const commandInfo: ITestCommand = {
	name: "deletehome",
	description: "Supprime votre maison"
};

const deleteHomeTestCommand: ExecuteTestCommandLike = async player => {
	await Homes.deleteOfPlayer(player.id);

	return "Votre maison a été supprimée.";
};

commandInfo.execute = deleteHomeTestCommand;
