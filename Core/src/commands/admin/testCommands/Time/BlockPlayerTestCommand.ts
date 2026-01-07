import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import Player from "../../../../core/database/game/models/Player";
import { BlockingUtils } from "../../../../core/utils/BlockingUtils";
import { BlockingConstants } from "../../../../../../Lib/src/constants/BlockingConstants";
import { minutesToMilliseconds } from "../../../../../../Lib/src/utils/TimeUtils";

export const commandInfo: ITestCommand = {
	name: "blockplayer",
	aliases: ["block"],
	commandFormat: "<time>",
	typeWaited: { time: TypeKey.INTEGER },
	description: "Bloque votre joueur pendant un temps donné (en secondes). Utile pour tester les mécaniques de blocage temporaire et les cooldowns",
	argSuggestions: { time: ["1", "5", "10", "30", "60", "120"] }
};

/**
 * Block your player for a given time
 */
const blockPlayerTestCommand: ExecuteTestCommandLike = (player: Player, args: string[]) => {
	const blockTime = parseInt(args[0], 10);
	if (blockTime <= 0) {
		throw new Error("Erreur block : on ne peut pas vous bloquer pendant un temps négatif ou nul !");
	}
	BlockingUtils.blockPlayer(player.keycloakId, BlockingConstants.REASONS.TEST, minutesToMilliseconds(parseInt(args[0], 10)));
	return `Vous êtes maintenant bloqué pendant ${args[0]} secondes !`;
};

commandInfo.execute = blockPlayerTestCommand;
