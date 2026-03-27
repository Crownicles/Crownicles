import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { Homes } from "../../../../core/database/game/models/Home";
import { HomePlantStorages } from "../../../../core/database/game/models/HomePlantStorage";
import { PlantConstants, PlantId } from "../../../../../../Lib/src/constants/PlantConstants";

export const commandInfo: ITestCommand = {
	name: "fillplantstorage",
	commandFormat: "",
	typeWaited: {},
	description: "Remplit le stockage de plantes de la maison au maximum pour chaque type de plante."
};

const fillPlantStorageTestCommand: ExecuteTestCommandLike = async player => {
	const home = await Homes.getOfPlayer(player.id);
	if (!home) {
		throw new Error("Vous n'avez pas de maison !");
	}

	const maxCapacity = home.level;

	await HomePlantStorages.initializeStorage(home.id);

	for (let plantId = 1; plantId <= PlantConstants.PLANT_COUNT; plantId++) {
		await HomePlantStorages.addPlant(home.id, plantId as PlantId, maxCapacity, maxCapacity);
	}

	return `Stockage de plantes rempli au max (${maxCapacity} par type) pour les ${PlantConstants.PLANT_COUNT} types de plantes.`;
};

commandInfo.execute = fillPlantStorageTestCommand;
