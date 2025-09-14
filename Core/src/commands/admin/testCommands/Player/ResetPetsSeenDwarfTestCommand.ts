import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { DwarfPetsSeen } from "../../../../core/database/game/models/DwarfPetsSeen";

export const commandInfo: ITestCommand = {
	name: "resetpetseendwarf",
	aliases: ["rpsd"],
	description: "Remet à zéro la liste des familiers montrés au nain Talvar. (Le nain qui donne une gemme chaque fois qu'il voit un animal dans le small event dédié)."
};

const resetPetSeenDwarfCommand: ExecuteTestCommandLike = async player => {
	const entries = await DwarfPetsSeen.destroy({ where: {
		playerId: player.id
	} });

	return `Vous avez réinitialisé les pets montrés au nain (${entries} entrées).`;
};

commandInfo.execute = resetPetSeenDwarfCommand;
