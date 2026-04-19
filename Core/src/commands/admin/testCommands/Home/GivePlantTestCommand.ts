import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { PlayerPlantSlots } from "../../../../core/database/game/models/PlayerPlantSlot";
import { InventoryInfos } from "../../../../core/database/game/models/InventoryInfo";
import {
	PlantConstants, PlantId
} from "../../../../../../Lib/src/constants/PlantConstants";

export const commandInfo: ITestCommand = {
	name: "giveplant",
	commandFormat: "<plant id [1-10]>",
	typeWaited: { "plant id [1-10]": TypeKey.INTEGER },
	description: "Donne une plante récoltée au joueur. IDs : 1=Herbe commune, 2=Trèfle doré, 3=Mousse lunaire, 4=Racine de fer, 5=Champignon nocturne, 6=Feuille venimeuse, 7=Bulbe de feu, 8=Plante carnée, 9=Fleur de cristal, 10=Arbre ancestral"
};

const givePlantTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const plantId = parseInt(args[0], 10) as PlantId;
	const plant = PlantConstants.getPlantById(plantId);
	if (!plant) {
		throw new Error("ID de plante invalide. Utilisez un ID entre 1 et 10.");
	}

	const invInfo = await InventoryInfos.getOfPlayer(player.id);
	await PlayerPlantSlots.initializeSlots(player.id, invInfo.plantSlots);

	const emptySlot = await PlayerPlantSlots.findEmptyPlantSlot(player.id);
	if (!emptySlot) {
		throw new Error("Aucun emplacement de plante vide disponible.");
	}

	await PlayerPlantSlots.setPlant(player.id, emptySlot.slot, plantId);

	return `Vous avez reçu une plante récoltée (ID: ${plantId}).`;
};

commandInfo.execute = givePlantTestCommand;
