import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { Badge } from "../../../../../../Lib/src/types/Badge";
import { PlayerBadgesManager } from "../../../../core/database/game/models/PlayerBadges";

export const commandInfo: ITestCommand = {
	name: "givebadge",
	commandFormat: "<badge>",
	typeWaited: { badge: TypeKey.STRING },
	description: "Attribue un badge spécifique au joueur. Utilisez '*' pour tous les badges. La commande affiche la liste des badges disponibles en cas d'erreur"
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
		await PlayerBadgesManager.addBadge(player.id, badge as Badge);
	}

	return `Vous avez maintenant le badge ${args[0]} !`;
};

commandInfo.execute = giveBadgeTestCommand;
