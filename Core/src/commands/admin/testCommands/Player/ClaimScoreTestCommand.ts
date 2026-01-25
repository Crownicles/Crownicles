import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import Player from "../../../../core/database/game/models/Player";
import { LogsPlayers } from "../../../../core/database/logs/models/LogsPlayers";

export const commandInfo: ITestCommand = {
	name: "claimscore",
	aliases: ["claim"],
	commandFormat: "<score|playerid=id> [discordId]",
	typeWaited: { scoreOrPlayerId: TypeKey.STRING },
	description: "Associe un joueur (par score ou playerid=<id>) à votre keycloakId, ou crée un keycloakId basé sur le discordId fourni. Si playerid est utilisé, le score est mis à 0."
};

/**
 * Update keycloakId in logs database if the old keycloakId exists there
 */
async function updateLogsKeycloakId(oldKeycloakId: string | null, newKeycloakId: string): Promise<boolean> {
	if (!oldKeycloakId) {
		return false;
	}
	const logsPlayer = await LogsPlayers.findOne({ where: { keycloakId: oldKeycloakId } });
	if (!logsPlayer) {
		return false;
	}
	await LogsPlayers.update({ keycloakId: newKeycloakId }, { where: { keycloakId: oldKeycloakId } });
	return true;
}

/**
 * Find and validate a unique player with the given score
 * @throws Error if no player found or multiple players have the same score
 */
async function findUniquePlayerByScore(targetScore: number): Promise<Player> {
	const playersWithScore = await Player.findAll({
		where: { score: targetScore },
		limit: 5
	});

	if (playersWithScore.length === 0) {
		throw new Error(`Aucun joueur trouvé avec le score ${targetScore} !`);
	}

	if (playersWithScore.length > 1) {
		const playerList = playersWithScore
			.map(p => `#${p.id} (lvl ${p.level})`)
			.join(", ");
		throw new Error(`Plusieurs joueurs ont ce score : ${playerList}. Essayez un score plus précis ou utilisez playerid=<id>.`);
	}

	return playersWithScore[0];
}

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

	return player;
}

/**
 * Link a player to a specific Discord ID
 */
async function linkPlayerToDiscordId(
	targetPlayer: Player,
	targetScore: number,
	discordId: string
): Promise<string> {
	const oldKeycloakId = targetPlayer.keycloakId;
	const fakeKeycloakId = `discord-${discordId}`;

	const logsUpdated = await updateLogsKeycloakId(oldKeycloakId, fakeKeycloakId);

	targetPlayer.keycloakId = fakeKeycloakId;
	await targetPlayer.save();

	return `✅ Joueur #${targetPlayer.id} (score: ${targetScore}) lié au Discord ${discordId} !\n`
		+ `Nouveau keycloakId: ${fakeKeycloakId}\n`
		+ `Ancien keycloakId: ${oldKeycloakId ?? "null"}\n`
		+ `Logs mis à jour: ${logsUpdated ? "oui" : "non (ancien keycloak non trouvé dans logs)"}\n`
		+ "⚠️ Ce lien est local uniquement (pas dans Keycloak).";
}

/**
 * Transfer the current player's session to the target player
 */
async function transferSessionToPlayer(
	player: Player,
	targetPlayer: Player,
	identifier: string
): Promise<string> {
	const oldKeycloakId = targetPlayer.keycloakId;
	const myKeycloakId = player.keycloakId;

	const logsUpdated = await updateLogsKeycloakId(oldKeycloakId, myKeycloakId);

	// Remove keycloakId from current player (to avoid duplicates)
	player.keycloakId = `old-${player.id}-${Date.now()}`;
	await player.save();

	// Assign my keycloakId to target player
	targetPlayer.keycloakId = myKeycloakId;
	await targetPlayer.save();

	return `✅ Vous contrôlez maintenant le joueur #${targetPlayer.id} (${identifier}) !\n`
		+ `Ancien keycloakId de la cible: ${oldKeycloakId ?? "null"}\n`
		+ `Logs mis à jour: ${logsUpdated ? "oui" : "non (ancien keycloak non trouvé dans logs)"}\n`
		+ `Votre ancien joueur (#${player.id}) a été dissocié.\n`
		+ "⚠️ Relancez une commande pour charger votre nouveau profil.";
}

/**
 * Parse playerid from argument if present
 * @returns Player ID or null if not a playerid argument
 */
function parsePlayerIdArg(arg: string): number | null {
	const match = arg.match(/^playerid=(\d+)$/i);
	return match ? parseInt(match[1], 10) : null;
}

/**
 * Claim a player by score or player ID, optionally linking to a specific Discord ID
 */
const claimScoreTestCommand: ExecuteTestCommandLike = async (player, args) => {
	// Check if first arg is playerid=<id>
	const playerId = parsePlayerIdArg(args[0]);

	let targetPlayer: Player;
	let identifier: string;

	if (playerId !== null) {
		targetPlayer = await findPlayerByIdAndResetScore(playerId);
		identifier = `playerId ${playerId} (score reset to 0)`;

		// If playerid is used, discordId would be in args[1]
		const discordId = args.length > 1 ? args[1] : null;

		if (discordId) {
			return linkPlayerToDiscordId(targetPlayer, 0, discordId);
		}
	}
	else {
		// Validate that it's a valid integer score
		const targetScore = parseInt(args[0], 10);
		if (isNaN(targetScore)) {
			throw new Error(`Argument invalide: "${args[0]}". Utilisez un score (nombre) ou playerid=<id>.`);
		}

		targetPlayer = await findUniquePlayerByScore(targetScore);
		identifier = `score ${targetScore}`;
		const discordId = args.length > 1 ? args[1] : null;

		if (discordId) {
			return linkPlayerToDiscordId(targetPlayer, targetScore, discordId);
		}
	}

	if (player.id === targetPlayer.id) {
		throw new Error("Vous êtes déjà ce joueur !");
	}

	return transferSessionToPlayer(player, targetPlayer, identifier);
};

commandInfo.execute = claimScoreTestCommand;
