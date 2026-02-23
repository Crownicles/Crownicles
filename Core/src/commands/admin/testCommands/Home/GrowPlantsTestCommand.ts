import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { Homes } from "../../../../core/database/game/models/Home";
import {
	HomeGardenSlot, HomeGardenSlots
} from "../../../../core/database/game/models/HomeGardenSlot";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";

export const commandInfo: ITestCommand = {
	name: "growplants",
	commandFormat: "",
	typeWaited: {},
	description: "Fait mûrir instantanément toutes les plantes de votre jardin."
};

const growPlantsTestCommand: ExecuteTestCommandLike = async player => {
	const home = await Homes.getOfPlayer(player.id);
	if (!home) {
		throw new Error("Vous n'avez pas de maison !");
	}

	const slots = await HomeGardenSlots.getOfHome(home.id);
	const plantedSlots = slots.filter((s: HomeGardenSlot) => !s.isEmpty());

	if (plantedSlots.length === 0) {
		throw new Error("Aucune plante dans votre jardin !");
	}

	/* Set plantedAt to a date far in the past so all plants are immediately ready */
	const pastDate = moment()
		.subtract(1, "year")
		.toDate();

	for (const slot of plantedSlots) {
		slot.plantedAt = pastDate;
		await slot.save();
	}

	return `${plantedSlots.length} plante(s) ont mûri instantanément.`;
};

commandInfo.execute = growPlantsTestCommand;
