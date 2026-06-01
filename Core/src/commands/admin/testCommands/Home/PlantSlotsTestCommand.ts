import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { InventoryInfos } from "../../../../core/database/game/models/InventoryInfo";
import { PlayerPlantSlots } from "../../../../core/database/game/models/PlayerPlantSlot";
import { PlantConstants } from "../../../../../../Lib/src/constants/PlantConstants";

export const commandInfo: ITestCommand = {
	name: "plantslots",
	commandFormat: "<count [1-3]>",
	typeWaited: { "count [1-3]": TypeKey.INTEGER },
	description: "Change le nombre d'emplacements de plantes (simule achat tanneur). Min 1, max 3."
};

const plantSlotsTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const count = parseInt(args[0], 10);
	if (count < 1 || count > PlantConstants.MAX_PLANT_SLOTS) {
		throw new Error(`Le nombre doit être entre 1 et ${PlantConstants.MAX_PLANT_SLOTS}.`);
	}

	const invInfo = await InventoryInfos.getOfPlayer(player.id);
	invInfo.plantSlots = count;
	await invInfo.save();

	await PlayerPlantSlots.ensureSlotsForCount(player.id, count);

	return `Nombre d'emplacements de plantes changé à ${count}.`;
};

commandInfo.execute = plantSlotsTestCommand;
