import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { InventorySlots } from "../../../../core/database/game/models/InventorySlot";

export const commandInfo: ITestCommand = {
	name: "experience",
	aliases: ["xp"],
	commandFormat: "<experience>",
	typeWaited: {
		experience: TypeKey.INTEGER
	},
	description: "Définit l'expérience du joueur testeur."
};

/**
 * Set the experience of the player
 */
const experienceTestCommand: ExecuteTestCommandLike = async (player, args, response) => {
	const maxXp = player.getExperienceNeededToLevelUp() * 2;
	const xp = parseInt(args[0], 10);
	if (xp < 0 || xp > maxXp) {
		throw new Error(`Erreur experience : expérience donnée doit être comprise entre 0 et ${maxXp} !`);
	}
	await player.addExperience({
		amount: xp - player.experience,
		response,
		reason: NumberChangeReason.TEST
	}, await InventorySlots.getPlayerActiveObjects(player.id));
	await player.save();

	return `Vous avez maintenant ${player.experience} :star: !`;
};

commandInfo.execute = experienceTestCommand;
