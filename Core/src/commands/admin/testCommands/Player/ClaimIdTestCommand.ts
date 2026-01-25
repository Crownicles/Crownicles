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
	description: "Associe un joueur (par ID en base de données) à votre keycloakId."
};

/**
 * Find a player by database ID
 * @throws Error if no player found with that ID
 */
async function findPlayerById(playerId: number): Promise<Player> {
	const player = await Player.findByPk(playerId);

	if (!player) {
		throw new Error(`Aucun joueur trouvé avec l'ID ${playerId} !`);
	}

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

	const targetPlayer = await findPlayerById(playerId);

	if (discordId) {
		return linkPlayerToDiscordId(targetPlayer, targetPlayer.score, discordId);
	}

	if (player.id === targetPlayer.id) {
		throw new Error("Vous êtes déjà ce joueur !");
	}

	return transferSessionToPlayer(player, targetPlayer, `playerId ${playerId}`);
};

commandInfo.execute = claimIdTestCommand;
