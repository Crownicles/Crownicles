import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { DwarfPetsSeen } from "../../../../core/database/game/models/DwarfPetsSeen";
import { PetDataController } from "../../../../data/Pet";

export const commandInfo: ITestCommand = {
	name: "markallpetsseendwarf",
	aliases: ["mapsd"],
	description: "Marque tous les familiers comme ayant été montrés au nain Talvar (le nain du mini event qui donne 1 gemme / animal)."
};

const markAllPetsSeenDwarfCommand: ExecuteTestCommandLike = async player => {
	for (let i = 1; i < PetDataController.instance.getPetsCount(); i++) {
		try {
			await DwarfPetsSeen.create({
				playerId: player.id,
				petTypeId: i
			});
		}
		catch {
			// Empty because it's not necessary
		}
	}

	return "Vous avez mis au complet les pets montrés au nain.";
};

commandInfo.execute = markAllPetsSeenDwarfCommand;
