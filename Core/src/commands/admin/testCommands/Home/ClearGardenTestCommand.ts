import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { Homes } from "../../../../core/database/game/models/Home";
import { HomeGardenSlots } from "../../../../core/database/game/models/HomeGardenSlot";
import { HomePlantStorages } from "../../../../core/database/game/models/HomePlantStorage";
import { PlayerPlantSlots } from "../../../../core/database/game/models/PlayerPlantSlot";

export const commandInfo: ITestCommand = {
	name: "cleargarden",
	commandFormat: "",
	typeWaited: {},
	description: "Vide le jardin (parcelles, stockage et graine)."
};

const clearGardenTestCommand: ExecuteTestCommandLike = async player => {
	const home = await Homes.getOfPlayer(player.id);
	if (!home) {
		throw new Error("Vous n'avez pas de maison !");
	}

	await HomeGardenSlots.deleteOfHome(home.id);
	await HomePlantStorages.deleteOfHome(home.id);
	await PlayerPlantSlots.clearSeed(player.id);

	return "Jardin, stockage et graine vidés.";
};

commandInfo.execute = clearGardenTestCommand;
