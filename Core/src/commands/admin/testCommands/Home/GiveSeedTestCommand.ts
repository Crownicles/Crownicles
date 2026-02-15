import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { PlayerPlantSlots } from "../../../../core/database/game/models/PlayerPlantSlot";
import {
	PlantConstants, PlantId
} from "../../../../../../Lib/src/constants/PlantConstants";

export const commandInfo: ITestCommand = {
	name: "giveseed",
	commandFormat: "<plant id [1-10]>",
	typeWaited: { "plant id [1-10]": TypeKey.INTEGER },
	description: "Donne une graine au joueur. IDs : 1=Herbe commune, 2=Trèfle doré, 3=Mousse lunaire, 4=Racine de fer, 5=Champignon nocturne, 6=Feuille venimeuse, 7=Bulbe de feu, 8=Plante carnée, 9=Fleur de cristal, 10=Arbre ancestral"
};

const giveSeedTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const plantId = parseInt(args[0], 10) as PlantId;
	const plant = PlantConstants.getPlantById(plantId);
	if (!plant) {
		throw new Error("ID de plante invalide. Utilisez un ID entre 1 et 10.");
	}

	await PlayerPlantSlots.initializeSlots(player.id, 1);

	const seedSlot = await PlayerPlantSlots.getSeedSlot(player.id);
	if (seedSlot && !seedSlot.isEmpty()) {
		throw new Error(`Vous avez déjà une graine (plante ${seedSlot.plantId}). Plantez-la d'abord.`);
	}

	await PlayerPlantSlots.setSeed(player.id, plantId);

	return `Vous avez reçu une graine de ${plant.fallbackEmote} (ID: ${plantId}).`;
};

commandInfo.execute = giveSeedTestCommand;
