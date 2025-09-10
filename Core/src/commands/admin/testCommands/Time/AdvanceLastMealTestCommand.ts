import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "advancelastmeal",
	aliases: ["alm"],
	commandFormat: "<time>",
	typeWaited: {
		time: TypeKey.INTEGER
	},
	description: "Avance l'heure du dernier repas de votre joueur d'une durée en minutes donnée"
};

const advanceLastMealTestCommand: ExecuteTestCommandLike = async (player, args) => {
	player.lastMealAt = new Date(player.lastPetFree.valueOf() - parseInt(args[0], 10) * 60000);
	await player.save();
	return `Vous avez avancé votre dernier repas de ${args[0]} minutes !`;
};

commandInfo.execute = advanceLastMealTestCommand;
