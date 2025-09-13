import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "fightcountdown",
	aliases: ["fcd"],
	commandFormat: "<countdown>",
	typeWaited: {
		countdown: TypeKey.INTEGER
	},
	description: "Définit le cooldown avant de pouvoir relancer un combat. Utile pour tester les restrictions de timing entre combats consécutifs"
};

/**
 * Set fightcountdown of the player
 */
const fightCountdownTestCommand: ExecuteTestCommandLike = async (player, args) => {
	player.fightCountdown = parseInt(args[0], 10);
	await player.save();
	return `Vous avez maintenant ${args[0]} de fightcountdown !`;
};

commandInfo.execute = fightCountdownTestCommand;
