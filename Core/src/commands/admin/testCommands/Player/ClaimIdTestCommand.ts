import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import Player from "../../../../core/database/game/models/Player";
import {
	linkPlayerToDiscordId,
	transferSessionToPlayer,
	updateLogsKeycloakId
} from "./ClaimScoreTestCommand";

export const commandInfo: ITestCommand = {
	name: "claimid",
	commandFormat: "<playerId> [discordId]",
	typeWaited: {
		playerId: TypeKey.INTEGER,
		discordId: TypeKey.INTEGER
	},
	minArgs: 1,
	description: "Associe un joueur (par ID en base de données) à votre keycloakId. Le score du joueur sera mis à 0 pour éviter les conflits."
};

/**
 * Find a player by database ID and reset their score to 0
 * @throws Error if no player found with that ID
 */
async function findPlayerByIdAndResetScore(playerId: number): Promise<Player> {
	const player = await Player.findByPk(playerId);

	if (!player) {
		throw new Error(`Aucun joueur trouvé avec l'ID ${playerId} !`);
	}

	// Reset score to 0 to avoid conflicts
	player.score = 0;
	await player.save();

	// Update logs if player has keycloakId
	if (player.keycloakId) {
		await updateLogsKeycloakId(player.keycloakId, player.keycloakId);
	}

	return player;
}

/**
 * Claim a player by database ID, optionally linking to a specific Discord ID
 */
const claimIdTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const playerId = parseInt(args[0], 10);
	const discordId = args.length > 1 ? args[1] : null;

	const targetPlayer = await findPlayerByIdAndResetScore(playerId);

	if (discordId) {
		return linkPlayerToDiscordId(targetPlayer, 0, discordId);
	}

	if (player.id === targetPlayer.id) {
		throw new Error("Vous êtes déjà ce joueur !");
	}

	return transferSessionToPlayer(player, targetPlayer, `playerId ${playerId} (score reset to 0)`);
};

commandInfo.execute = claimIdTestCommand;
