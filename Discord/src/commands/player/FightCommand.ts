import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import i18n from "../../translations/i18n";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import { DiscordCollectorUtils } from "../../utils/DiscordCollectorUtils";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { PacketUtils } from "../../utils/PacketUtils";
import { CommandFightPacketReq } from "../../../../Lib/src/packets/commands/CommandFightPacket";
import { ReactionCollectorFightPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorFight";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { Language } from "../../../../Lib/src/Language";
import { KeycloakUtils } from "../../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../../bot/CrowniclesShard";
import { CrowniclesFightStatusCachedMessage } from "../../messages/CrowniclesFightStatusCachedMessage";
import { CrowniclesCachedMessages } from "../../messages/CrowniclesCachedMessage";
import { CommandFightIntroduceFightersPacket } from "../../../../Lib/src/packets/fights/FightIntroductionPacket";
import { CommandFightStatusPacket } from "../../../../Lib/src/packets/fights/FightStatusPacket";
import { CommandFightHistoryItemPacket } from "../../../../Lib/src/packets/fights/FightHistoryItemPacket";
import { CrowniclesHistoryCachedMessage } from "../../messages/CrowniclesHistoryCachedMessage";
import { CrowniclesActionChooseCachedMessage } from "../../messages/CrowniclesActionChooseCachedMessage";
import { CommandFightEndOfFightPacket } from "../../../../Lib/src/packets/fights/EndOfFightPacket";
import {
	millisecondsToMinutes, minutesDisplay
} from "../../../../Lib/src/utils/TimeUtils";
import { FightRewardPacket } from "../../../../Lib/src/packets/fights/FightRewardPacket";
import { StringUtils } from "../../utils/StringUtils";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { AIFightActionChoosePacket } from "../../../../Lib/src/packets/fights/AIFightActionChoosePacket";
import { OwnedPet } from "../../../../Lib/src/types/OwnedPet";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { escapeUsername } from "../../../../Lib/src/utils/StringUtils";
import { CommandFightCancelPacketReq } from "../../../../Lib/src/packets/commands/CommandFightCancelPacket";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { DiscordConstants } from "../../DiscordConstants";
import { PetUtils } from "../../utils/PetUtils";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { ReactionCollectorFightChooseActionPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorFightChooseAction";

const buggedFights = new Set<string>();

/**
 * Mark a fight as bugged and request cancellation from the backend
 * @param context - Packet context
 * @param fightId - The identifier of the bugged fight
 */
function fightBugged(context: PacketContext, fightId: string): void {
	buggedFights.add(fightId);
	PacketUtils.sendPacketToBackend(context, makePacket(CommandFightCancelPacketReq, {
		fightId
	}));
	CrowniclesLogger.error("Fight bugged, cancelling fight");
}

/**
 * Create the fight acceptance/refusal collector for initiating a fight
 * @param context - Packet context
 * @param packet - Reaction collector creation packet
 * @returns The collector instance or null if creation failed
 */
export async function createFightCollector(context: PacketContext, packet: ReactionCollectorFightPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	await interaction.deferReply();
	const lng = interaction.userLanguage;
	const data = packet.data.data;
	const subTextKey = RandomUtils.crowniclesRandom.bool(FightConstants.RARE_SUB_TEXT_INTRO) ? "rare" : "common";
	const embed = new CrowniclesEmbed().formatAuthor(i18n.t("commands:fight.title", {
		lng,
		pseudo: escapeUsername(interaction.user.displayName)
	}), interaction.user)
		.setDescription(
			i18n.t("commands:fight.confirmDesc", {
				lng,
				pseudo: escapeUsername(interaction.user.displayName),
				confirmSubText: i18n.t(`commands:fight.confirmSubTexts.${subTextKey}`, { lng }),
				glory: i18n.t("commands:fight:information.glory", {
					lng,
					gloryPoints: data.playerStats.fightRanking.glory
				}),
				className: i18n.t("commands:fight:information.class", {
					lng,
					id: data.playerStats.classId
				}),
				pet: data.playerStats.pet.petTypeId
					? i18n.t(data.playerStats.pet.isOnExpedition ? "commands:fight.petOnExpedition" : "commands:fight.pet", {
						lng,
						petInfo: PetUtils.petToShortString(lng, data.playerStats.pet.petNickname, data.playerStats.pet.petTypeId, data.playerStats.pet.petSex)
					})
					: "",
				stats: i18n.t("commands:fight:information.stats", {
					lng,
					baseBreath: data.playerStats.breath.base,
					breathRegen: data.playerStats.breath.regen,
					cumulativeAttack: data.playerStats.attack,
					cumulativeDefense: data.playerStats.defense,
					cumulativeHealth: data.playerStats.energy.value,
					cumulativeSpeed: data.playerStats.speed,
					cumulativeMaxHealth: data.playerStats.energy.max,
					maxBreath: data.playerStats.breath.max
				})
			})
		);

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context, {
		emojis: {
			accept: CrowniclesIcons.fightCommand.accept,
			refuse: CrowniclesIcons.fightCommand.refuse
		}
	});
}

/**
 * Handle the player refusing to start a fight
 * @param context - Packet context
 */
export async function handleCommandFightRefusePacketRes(context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!originalInteraction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const lng = originalInteraction.userLanguage;
	await buttonInteraction?.editReply({
		embeds: [
			new CrowniclesEmbed().formatAuthor(i18n.t("commands:fight.canceledTitle", {
				lng,
				pseudo: escapeUsername(originalInteraction.user.displayName)
			}), originalInteraction.user)
				.setDescription(
					i18n.t("commands:fight.canceledDesc", {
						lng
					})
				)
				.setErrorColor()
		]
	});
}

/**
 * Add the fight action field to the intro embed of the fight for one fighter
 * @param introEmbed - Embed of the fight intro
 * @param lng
 * @param fighterName - Name of the fighter
 * @param fightActions - Map containing the ids and breath cost of the fighter's fight actions
 * @param opponentFightActionsCount - Number of fight actions of the opponent
 * @param pet - Pet of the fighter
 */
function addFightProfileFor(introEmbed: CrowniclesEmbed, lng: Language, fighterName: string, fightActions: Array<[string, number]>, opponentFightActionsCount: number, pet?: OwnedPet): void {
	let fightActionsDisplay = fightActions.map(([actionId, breathCost]) => i18n.t("commands:fight.fightActionNameDisplay", {
		lng,
		fightActionEmote: CrowniclesIcons.fightActions[actionId],
		fightActionName: i18n.t(`models:fight_actions.${actionId}.name`, {
			lng,
			count: 1
		}),
		breathCost
	}))
		.join("\n");

	// Add a new line to make the display aligned with the opponent
	if (opponentFightActionsCount - fightActions.length > 0) {
		fightActionsDisplay += "\n".repeat(opponentFightActionsCount - fightActions.length);
	}

	const petDisplay = pet
		? `\n\n${i18n.t("commands:fight.petOf", {
			lng,
			pseudo: fighterName
		})}\n${DisplayUtils.getOwnedPetInlineDisplay(pet, lng)}`
		: "";

	introEmbed.addFields({
		name: DiscordConstants.EMPTY_MESSAGE,
		value: `${i18n.t("commands:fight.actionsOf", {
			lng,
			pseudo: fighterName
		})}\n${fightActionsDisplay}${petDisplay}`,
		inline: true
	});
}

/**
 * Send the fight intro message that introduces the fighters
 * @param context
 * @param packet
 */
export async function handleCommandFightIntroduceFightersRes(context: PacketContext, packet: CommandFightIntroduceFightersPacket): Promise<void> {
	if (buggedFights.has(packet.fightId)) {
		return;
	}

	try {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
		const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
		const lng = interaction.userLanguage;
		const getUser = packet.fightOpponentKeycloakId ? await KeycloakUtils.getUserByKeycloakId(keycloakConfig, packet.fightOpponentKeycloakId) : undefined;
		if (getUser?.isError) {
			return;
		}
		const opponentDisplayName = getUser
			? escapeUsername(getUser.payload.user.attributes.gameUsername[0])
			: i18n.t(`models:monsters.${packet.fightOpponentMonsterId}.name`, { lng });
		const embed = new CrowniclesEmbed().formatAuthor(i18n.t("commands:fight.fightIntroTitle", {
			lng,
			fightInitiator: escapeUsername(interaction.user.displayName),
			opponent: escapeUsername(opponentDisplayName)
		}), interaction.user);

		addFightProfileFor(embed, lng, escapeUsername(interaction.user.displayName), packet.fightInitiatorActions, packet.fightOpponentActions.length, packet.fightInitiatorPet);
		addFightProfileFor(embed, lng, escapeUsername(opponentDisplayName), packet.fightOpponentActions, packet.fightInitiatorActions.length, packet.fightOpponentPet);

		await buttonInteraction?.editReply({ embeds: [embed] });
		await CrowniclesCachedMessages.getOrCreate(interaction.id, CrowniclesHistoryCachedMessage)
			.post({ content: DiscordConstants.EMPTY_MESSAGE });
		await CrowniclesCachedMessages.getOrCreate(interaction.id, CrowniclesFightStatusCachedMessage)
			.post({ content: DiscordConstants.EMPTY_MESSAGE });
		await CrowniclesCachedMessages.getOrCreate(interaction.id, CrowniclesActionChooseCachedMessage)
			.post({ content: DiscordConstants.EMPTY_MESSAGE });
	}
	catch (e) {
		CrowniclesLogger.errorWithObj("Fight introduction failed", e);
		fightBugged(context, packet.fightId);
	}
}

/**
 * Update the fight status message with the current statuses of the fighters
 * @param context
 * @param packet
 */
export async function handleCommandFightUpdateStatusRes(context: PacketContext, packet: CommandFightStatusPacket): Promise<void> {
	if (buggedFights.has(packet.fightId) || !context.discord?.interaction) {
		return;
	}

	try {
		await CrowniclesCachedMessages.getOrCreate(context.discord.interaction, CrowniclesFightStatusCachedMessage)
			.update(packet, context);
	}
	catch (e) {
		CrowniclesLogger.errorWithObj("Fight status update failed", e);
		fightBugged(context, packet.fightId);
	}
}

/**
 * Update the fight history with the last action
 * @param context
 * @param packet
 */
export async function handleCommandFightHistoryItemRes(context: PacketContext, packet: CommandFightHistoryItemPacket): Promise<void> {
	if (buggedFights.has(packet.fightId) || !context.discord?.interaction) {
		return;
	}

	try {
		await CrowniclesCachedMessages.getOrCreate(context.discord.interaction, CrowniclesHistoryCachedMessage)
			.update(packet, context);
	}
	catch (e) {
		CrowniclesLogger.errorWithObj("Fight history update failed", e);
		fightBugged(context, packet.fightId);
	}
}


export async function handleCommandFightAIFightActionChoose(context: PacketContext, packet: AIFightActionChoosePacket): Promise<void> {
	if (buggedFights.has(packet.fightId) || !context.discord?.interaction) {
		return;
	}

	try {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
		await CrowniclesCachedMessages.getOrCreate(context.discord.interaction, CrowniclesActionChooseCachedMessage)
			.post({ embeds: [new CrowniclesEmbed().setDescription(i18n.t("commands:fight.actions.aiChoose", { lng: interaction.userLanguage }))] });
		await new Promise(f => setTimeout(f, packet.ms));
	}
	catch (e) {
		CrowniclesLogger.errorWithObj("Fight AI action choose failed", e);
		fightBugged(context, packet.fightId);
	}
}

/**
 * Handle the choice of an action in a fight
 * @param packet
 * @param context
 */
export async function handleCommandFightActionChoose(context: PacketContext, packet: ReactionCollectorFightChooseActionPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const data = packet.data.data;

	if (buggedFights.has(data.fightId) || !context.discord?.interaction) {
		return null;
	}

	try {
		return await CrowniclesCachedMessages.getOrCreate(context.discord.interaction, CrowniclesActionChooseCachedMessage)
			.update(packet, context);
	}
	catch (e) {
		CrowniclesLogger.errorWithObj("Fight action choose failed", e);
		fightBugged(context, data.fightId);
		return null;
	}
}

/**
 * Handle the end of a fight
 * @param context
 * @param packet
 */
export async function handleEndOfFight(context: PacketContext, packet: CommandFightEndOfFightPacket): Promise<void> {
	if (!context.discord?.interaction) {
		return;
	}

	// Erase all cached messages
	CrowniclesCachedMessages.removeAllFromMessageId(context.discord.interaction, cachedMessage => {
		if (!(cachedMessage instanceof CrowniclesHistoryCachedMessage)) {
			cachedMessage.delete()
				.then();
		}
	});

	const interaction = DiscordCache.getInteraction(context.discord.interaction)!;
	const lng = interaction.userLanguage;

	// Get names of fighters
	const getDisplayName = async (keycloakId?: string, monsterId?: string): Promise<string> => {
		if (keycloakId) {
			const getUser = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, keycloakId);
			if (getUser.isError) {
				return i18n.t("error:unknownPlayer", { lng });
			}
			return escapeUsername(getUser.payload.user.attributes.gameUsername[0]);
		}
		return i18n.t(`models:monsters.${monsterId}.name`, { lng });
	};

	const winnerName = await getDisplayName(packet.winner.keycloakId, packet.winner.monsterId);
	const looserName = await getDisplayName(packet.looser.keycloakId, packet.looser.monsterId);

	// Create message description
	let description = i18n.t("commands:fight.end.gameStats", {
		lng,
		turn: packet.turns,
		maxTurn: packet.maxTurns,
		time: minutesDisplay(millisecondsToMinutes(new Date().valueOf() - interaction.createdTimestamp), lng)
	});

	// Add fighter statistics for both fighters
	[
		{
			name: winnerName,
			stats: packet.winner
		},
		{
			name: looserName,
			stats: packet.looser
		}
	].forEach(fighter => {
		description += i18n.t("commands:fight.end.fighterStats", {
			lng,
			pseudo: fighter.name,
			energy: fighter.stats.finalEnergy,
			maxEnergy: fighter.stats.maxEnergy
		});
	});

	// Send embed with handshake reaction
	const embed = new CrowniclesEmbed()
		.setTitle(packet.draw
			? i18n.t("commands:fight.end.draw", {
				lng,
				player1: winnerName,
				player2: looserName
			})
			: i18n.t("commands:fight.end.win", {
				lng,
				winner: winnerName,
				loser: looserName
			}))
		.setDescription(description);

	const message = await interaction.channel?.send({ embeds: [embed] });
	await message?.react(CrowniclesIcons.fightCommand.handshake);
}

/**
 * Generate the fight reward field displaying money and points earned during the fight if needed
 * @param embed
 * @param packet
 * @param lng
 * @param player1Username
 */
function generateFightRewardField(embed: CrowniclesEmbed, packet: FightRewardPacket, lng: Language, player1Username: string): void {
	// Ne pas afficher le field si aucune récompense n'a été gagnée
	if (packet.money <= 0 && packet.points <= 0) {
		return;
	}

	embed.addFields({
		name: i18n.t("commands:fight.fightReward.scoreAndMoneyField", { lng }),
		value: [
			packet.money > 0
				? i18n.t("commands:fight.fightReward.money", {
					lng,
					player: player1Username,
					count: packet.money
				})
				: "",
			packet.points > 0
				? i18n.t("commands:fight.fightReward.points", {
					lng,
					player: player1Username,
					count: packet.points
				})
				: ""
		].filter(Boolean)
			.join("\n"),
		inline: false
	});
}

/**
 * Generate the pet love change field
 * @param embed
 * @param packet
 * @param lng
 * @param player1Username
 */
function generatePetLoveChangeField(embed: CrowniclesEmbed, packet: FightRewardPacket, lng: Language, player1Username: string): void {
	if (packet.petLoveChange && packet.petLoveChange.loveChange > 0) {
		const petDisplay = PetUtils.petToShortString(lng, packet.petLoveChange.petNickname ?? undefined, packet.petLoveChange.petId, packet.petLoveChange.petSex as SexTypeShort);
		embed.addFields({
			name: i18n.t("commands:fight.fightReward.petLoveField", { lng }),
			value: StringUtils.getRandomTranslation(`commands:fight.petReactions.${packet.petLoveChange.reactionType}`, lng, {
				player: player1Username,
				pet: petDisplay
			}),
			inline: false
		});
	}
}

/**
 * Generate the glory changes field displaying glory changes for both players (glory won or lost)
 * @param embed
 * @param packet
 * @param lng
 * @param player1Username
 * @param player2Username
 */
function generateGloryChangesField(embed: CrowniclesEmbed, packet: FightRewardPacket, lng: Language, player1Username: string, player2Username: string): void {
	embed.addFields({
		name: i18n.t("commands:fight.fightReward.gloryField", { lng }),
		value: [
			...[
				{
					player: player1Username,
					change: packet.player1.newGlory - packet.player1.oldGlory
				},
				{
					player: player2Username,
					change: packet.player2.newGlory - packet.player2.oldGlory
				}
			].map(({
				player,
				change
			}) =>
				i18n.t(`commands:fight.fightReward.glory${change >= 0 ? "Positive" : "Negative"}`, {
					lng,
					count: Math.abs(change),
					player
				}))
		].join(""),
		inline: false
	});
}

/**
 * Display league changes if needed
 * @param embed
 * @param packet
 * @param lng
 * @param player1Username
 * @param player2Username
 */
function displayLeagueChangesIfNeeded(embed: CrowniclesEmbed, packet: FightRewardPacket, lng: Language, player1Username: string, player2Username: string): void {
	const leagueChangeValue = [
		...packet.player1.newLeagueId !== packet.player1.oldLeagueId
			? [
				i18n.t(`commands:fight.fightReward.leagueChange${packet.player1.newLeagueId > packet.player1.oldLeagueId ? "Up" : "Down"}`, {
					lng,
					player: player1Username,
					oldLeagueEmoji: CrowniclesIcons.leagues[packet.player1.oldLeagueId],
					newLeagueEmoji: CrowniclesIcons.leagues[packet.player1.newLeagueId],
					oldLeague: i18n.t(`models:leagues.${packet.player1.oldLeagueId}`, { lng }),
					newLeague: i18n.t(`models:leagues.${packet.player1.newLeagueId}`, { lng })
				})
			]
			: [],
		...packet.player2.newLeagueId !== packet.player2.oldLeagueId
			? [
				i18n.t(`commands:fight.fightReward.leagueChange${packet.player2.newLeagueId > packet.player2.oldLeagueId ? "Up" : "Down"}`, {
					lng,
					player: player2Username,
					oldLeagueEmoji: CrowniclesIcons.leagues[packet.player2.oldLeagueId],
					newLeagueEmoji: CrowniclesIcons.leagues[packet.player2.newLeagueId],
					oldLeague: i18n.t(`models:leagues.${packet.player2.oldLeagueId}`, { lng }),
					newLeague: i18n.t(`models:leagues.${packet.player2.newLeagueId}`, { lng })
				})
			]
			: []
	];
	if (leagueChangeValue.length > 0) {
		embed.addFields({
			name: i18n.t("commands:fight.fightReward.leagueField", { lng }),
			value: leagueChangeValue.join("\n"),
			inline: false
		});
	}
}

/**
 * Generate a short sentence about the fight result
 * @param embed
 * @param packet
 * @param lng
 * @param player1Username
 * @param player2Username
 */
function generateFightRecapDescription(embed: CrowniclesEmbed, packet: FightRewardPacket, lng: Language, player1Username: string, player2Username: string): void {
	const gloryDifference = Math.abs(packet.player1.oldGlory - packet.player2.oldGlory);

	if (packet.draw) {
		embed.setDescription(StringUtils.getRandomTranslation("commands:fight.fightReward.draw", lng, {
			player1: player1Username,
			player2: player2Username
		}));
		return;
	}

	// Use the winnerKeycloakId from the packet to determine the winner
	const player1Won = packet.winnerKeycloakId === packet.player1.keycloakId;
	const winnerUsername = player1Won ? player1Username : player2Username;
	const loserUsername = player1Won ? player2Username : player1Username;
	const winnerOldGlory = player1Won ? packet.player1.oldGlory : packet.player2.oldGlory;
	const loserOldGlory = player1Won ? packet.player2.oldGlory : packet.player1.oldGlory;

	if (gloryDifference < FightConstants.ELO.ELO_DIFFERENCE_FOR_SAME_ELO) {
		embed.setDescription(StringUtils.getRandomTranslation("commands:fight.fightReward.sameElo", lng, {
			player1: player1Username,
			player2: player2Username
		}));
	}
	else if (winnerOldGlory > loserOldGlory) {
		embed.setDescription(StringUtils.getRandomTranslation("commands:fight.fightReward.higherEloWins", lng, {
			winner: winnerUsername,
			loser: loserUsername
		}));
	}
	else {
		embed.setDescription(StringUtils.getRandomTranslation("commands:fight.fightReward.lowestEloWins", lng, {
			winner: winnerUsername,
			loser: loserUsername
		}));
	}
}

/**
 * Handle glory and league changes
 * @param context
 * @param packet
 */
export async function handleFightReward(context: PacketContext, packet: FightRewardPacket): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;

	// Get players
	const getPlayer1 = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, packet.player1.keycloakId);
	const getPlayer2 = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, packet.player2.keycloakId);

	// Get usernames for both players
	const player1Username = escapeUsername(getPlayer1.isError ? "Unknown" : getPlayer1.payload.user.attributes.gameUsername[0]);
	const player2Username = escapeUsername(getPlayer2.isError ? "Unknown" : getPlayer2.payload.user.attributes.gameUsername[0]);

	// Create an embed to show glory and league changes
	const embed = new CrowniclesEmbed()
		.setTitle(i18n.t("commands:fight.fightReward.title", {
			lng
		}));

	// Add fight reward description
	generateFightRewardField(embed, packet, lng, player1Username);

	// Add pet love change
	generatePetLoveChangeField(embed, packet, lng, player1Username);

	// Add glory changes
	generateGloryChangesField(embed, packet, lng, player1Username, player2Username);

	// Add league changes
	displayLeagueChangesIfNeeded(embed, packet, lng, player1Username, player2Username);

	// Generate a short sentence about the fight result
	generateFightRecapDescription(embed, packet, lng, player1Username, player2Username);

	await interaction.channel?.send({ embeds: [embed] });
}

/**
 * Prepare the fight command packet for the requested player
 * @param interaction - The Discord interaction
 * @param user - The Keycloak user initiating the fight
 * @returns The fight packet or null if player preparation failed
 */
async function getPacket(interaction: CrowniclesInteraction, user: KeycloakUser): Promise<CommandFightPacketReq | null> {
	const player = await PacketUtils.prepareAskedPlayer(interaction, user);
	if (!player || !player.keycloakId) {
		return null;
	}
	return makePacket(CommandFightPacketReq, { playerKeycloakId: player.keycloakId });
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("fight"),
	getPacket,
	mainGuildCommand: false
};
