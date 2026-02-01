import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import Player from "../../../../core/database/game/models/Player";
import { LogsPlayers } from "../../../../core/database/logs/models/LogsPlayers";
import { KeycloakUtils } from "../../../../../../Lib/src/keycloak/KeycloakUtils";
import { KeycloakConfig } from "../../../../../../Lib/src/keycloak/KeycloakConfig";
import { KeycloakUser } from "../../../../../../Lib/src/keycloak/KeycloakUser";
import { parse } from "toml";
import {
	existsSync, readFileSync
} from "node:fs";

export const commandInfo: ITestCommand = {
	name: "claimscore",
	aliases: ["claim"],
	commandFormat: "<score> [discordId]",
	typeWaited: {
		score: TypeKey.INTEGER,
		discordId: TypeKey.INTEGER
	},
	minArgs: 1,
	description: "Associe un joueur (par score) à votre keycloakId, ou au keycloakId de l'utilisateur Discord spécifié."
};

/**
 * Load Keycloak config from config/keycloak.toml
 */
function loadKeycloakConfig(): KeycloakConfig | null {
	const configPath = `${process.cwd()}/config/keycloak.toml`;
	if (!existsSync(configPath)) {
		return null;
	}
	const config = parse(readFileSync(configPath, "utf-8")) as { keycloak: KeycloakConfig };
	return config.keycloak;
}

/**
 * Update keycloakId in logs database if the old keycloakId exists there
 */
export async function updateLogsKeycloakId(oldKeycloakId: string | null, newKeycloakId: string): Promise<boolean> {
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
		throw new Error(`Plusieurs joueurs ont ce score : ${playerList}. Utilisez claimid <id> pour claim par ID joueur.`);
	}

	return playersWithScore[0];
}

/**
 * Link a player to a specific Discord ID by looking up the Keycloak user
 */
export async function linkPlayerToDiscordId(
	targetPlayer: Player,
	targetScore: number,
	discordId: string
): Promise<string> {
	const keycloakConfig = loadKeycloakConfig();
	if (!keycloakConfig) {
		throw new Error("Keycloak config not found (config/keycloak.toml). Cannot link by Discord ID.");
	}

	// Look up the Keycloak user by Discord ID
	const getUser = await KeycloakUtils.getDiscordUser(keycloakConfig, discordId, null);
	if (getUser.isError) {
		throw new Error(`Utilisateur Keycloak non trouvé pour Discord ID ${discordId}. L'utilisateur doit s'être connecté au moins une fois au jeu.`);
	}

	const { user: keycloakUser } = getUser.payload as { user: KeycloakUser };
	const oldKeycloakId = targetPlayer.keycloakId;
	const newKeycloakId = keycloakUser.id;

	const logsUpdated = await updateLogsKeycloakId(oldKeycloakId, newKeycloakId);

	targetPlayer.keycloakId = newKeycloakId;
	await targetPlayer.save();

	return `✅ Joueur #${targetPlayer.id} (score: ${targetScore}) lié au Discord ${discordId} !\n`
		+ `Nouveau keycloakId: ${newKeycloakId}\n`
		+ `Ancien keycloakId: ${oldKeycloakId ?? "null"}\n`
		+ `Logs mis à jour: ${logsUpdated ? "oui" : "non (ancien keycloak non trouvé dans logs)"}\n`
		+ "✅ Lien mis à jour dans Keycloak.";
}

/**
 * Transfer the current player's session to the target player
 */
export async function transferSessionToPlayer(
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
 * Claim a player by score, optionally linking to a specific Discord ID
 */
const claimScoreTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const targetScore = parseInt(args[0], 10);
	const discordId = args.length > 1 ? args[1] : null;

	const targetPlayer = await findUniquePlayerByScore(targetScore);

	if (discordId) {
		return linkPlayerToDiscordId(targetPlayer, targetScore, discordId);
	}

	if (player.id === targetPlayer.id) {
		throw new Error("Vous êtes déjà ce joueur !");
	}

	return transferSessionToPlayer(player, targetPlayer, `score ${targetScore}`);
};

commandInfo.execute = claimScoreTestCommand;
