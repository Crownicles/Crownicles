import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { BlockingUtils } from "../../../../core/utils/BlockingUtils";

export const commandInfo: ITestCommand = {
	name: "unblock",
	description: "Retire tous les blocages actifs de votre joueur. Utilisé quand une commande de test ou un bug vous a bloqué. Note : cette commande est prévue pour les tests"
};

/**
 * Unblock the player
 */
const unblockTestCommand: ExecuteTestCommandLike = player => {
	const reasons = BlockingUtils.getPlayerBlockingReason(player.keycloakId).map(r => {
		BlockingUtils.unblockPlayer(player.keycloakId, r);
		return r;
	});
	return `Vous vous êtes débloqué des raisons suivantes : ${reasons.join(", ")}`;
};

commandInfo.execute = unblockTestCommand;
