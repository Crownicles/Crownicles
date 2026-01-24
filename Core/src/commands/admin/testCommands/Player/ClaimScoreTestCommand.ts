import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import Player from "../../../../core/database/game/models/Player";

export const commandInfo: ITestCommand = {
	name: "claimscore",
	aliases: ["claim"],
	commandFormat: "<score> [discordId]",
	typeWaited: { score: TypeKey.INTEGER },
	description: "Associe un joueur (par score) à votre keycloakId, ou crée un keycloakId basé sur le discordId fourni."
};

/**
 * Claim a player by score, optionally linking to a specific Discord ID
 */
const claimScoreTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const targetScore = parseInt(args[0], 10);
	const discordId = args.length > 1 ? args[1] : null;

	// Find player(s) with this exact score
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
		throw new Error(`Plusieurs joueurs ont ce score : ${playerList}. Essayez un score plus précis.`);
	}

	const targetPlayer = playersWithScore[0];
	const oldKeycloakId = targetPlayer.keycloakId;

	if (discordId) {
		/*
		 * Create a keycloakId that simulates what Keycloak would generate for this Discord user.
		 * Format matches KeycloakUtils.registerUser: username is `discord-{discordId}`
		 * The keycloakId itself should be a UUID, but we use a deterministic fake one.
		 */
		const fakeKeycloakId = `discord-${discordId}`;
		targetPlayer.keycloakId = fakeKeycloakId;
		await targetPlayer.save();

		return `✅ Joueur #${targetPlayer.id} (score: ${targetScore}) lié au Discord ${discordId} !\n`
			+ `Nouveau keycloakId: ${fakeKeycloakId}\n`
			+ `Ancien keycloakId: ${oldKeycloakId ?? "null"}\n`
			+ `⚠️ Ce lien est local uniquement (pas dans Keycloak).`;
	}

	// No discord ID provided - transfer current session to this player
	if (player.id === targetPlayer.id) {
		throw new Error("Vous êtes déjà ce joueur !");
	}

	const myKeycloakId = player.keycloakId;

	// Remove keycloakId from current player (to avoid duplicates)
	player.keycloakId = `old-${player.id}-${Date.now()}`;
	await player.save();

	// Assign my keycloakId to target player
	targetPlayer.keycloakId = myKeycloakId;
	await targetPlayer.save();

	return `✅ Vous contrôlez maintenant le joueur #${targetPlayer.id} (score: ${targetScore}) !\n`
		+ `Ancien keycloakId de la cible: ${oldKeycloakId ?? "null"}\n`
		+ `Votre ancien joueur (#${player.id}) a été dissocié.\n`
		+ `⚠️ Relancez une commande pour charger votre nouveau profil.`;
};

commandInfo.execute = claimScoreTestCommand;
