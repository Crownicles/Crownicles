import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { Homes } from "../../../../core/database/game/models/Home";
import { Apartments } from "../../../../core/database/game/models/Apartment";

export const commandInfo: ITestCommand = {
	name: "deletehome",
	description: "Supprime votre maison et tous vos appartements locatifs"
};

const deleteHomeTestCommand: ExecuteTestCommandLike = async player => {
	await Homes.deleteOfPlayer(player.id);
	await Apartments.deleteOfPlayer(player.id);

	return "Votre maison et vos appartements locatifs ont été supprimés.";
};

commandInfo.execute = deleteHomeTestCommand;
