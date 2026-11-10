import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import Player from "../../../../core/database/game/models/Player";
import { getPlayerGuardGlory } from "../../../../core/fights/kingGuards/KingGuardMatchmaking";

export const commandInfo: ITestCommand = {
	name: "kingguardglory",
	aliases: ["kgg"],
	commandFormat: "[glory]",
	typeWaited: { glory: TypeKey.INTEGER },
	minArgs: 0,
	description: "Affiche la cote cachée du joueur face aux gardes du roi, ou la remplace par la valeur donnée. "
		+ "Les gardes proposés sont ceux dont la cote est la plus proche de celle-ci."
};

/**
 * Show or set the hidden rating of the player against the king guards
 */
const kingGuardGloryTestCommand: ExecuteTestCommandLike = async (player, args) => {
	if (!args[0]) {
		return `Votre cote face aux gardes du roi est de ${getPlayerGuardGlory(player)}${player.guardGloryPoints === null ? " (celle de votre niveau, vous n'avez encore affronté aucun garde)" : ""}`;
	}
	const glory = parseInt(args[0], 10);
	await Player.withLocked(player.id, async lockedPlayer => {
		lockedPlayer.guardGloryPoints = glory;
		await lockedPlayer.save();
	});
	player.guardGloryPoints = glory;
	player.changed("guardGloryPoints", false);
	return `Votre cote face aux gardes du roi est maintenant de ${glory}`;
};

commandInfo.execute = kingGuardGloryTestCommand;
