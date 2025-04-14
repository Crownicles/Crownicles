import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { Badge } from "../../../../../../Lib/src/types/Badge";

export const commandInfo: ITestCommand = {
	name: "givebadge",
	commandFormat: "<badge>",
	typeWaited: {
		badge: TypeKey.STRING
	},
	description: "Donne un badge à votre joueur"
};

/**
 * Give a badge to your player
 */
const giveBadgeTestCommand: ExecuteTestCommandLike = async (player, args) => {
	if (args[0] !== "*" && Object.values(Badge).indexOf(args[0] as Badge) === -1) {
		throw new Error(`Le badge ${args[0]} n'existe pas !\n\nListe des badges valides :\n${Object.values(Badge).join(", ")}, *\n`);
	}

	const badgesToGive = args[0] === "*" ? Object.values(Badge) : [args[0]];
	for (const badge of badgesToGive) {
		if (!player.hasBadge(badge as Badge)) {
			player.addBadge(badge as Badge);
		}
	}

	await player.save();

	return `Vous avez maintenant le badge ${args[0]} !`;
};

commandInfo.execute = giveBadgeTestCommand;
