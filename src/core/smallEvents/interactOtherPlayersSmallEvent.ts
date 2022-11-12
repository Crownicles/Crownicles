import {SmallEvent} from "./SmallEvent";
import {CommandInteraction, TextBasedChannel} from "discord.js";
import {DraftBotEmbed} from "../messages/DraftBotEmbed";
import {format} from "../utils/StringFormatter";
import {Constants} from "../Constants";
import {Guild, Guilds} from "../database/game/models/Guild";
import Player, {Players} from "../database/game/models/Player";
import {MapLocations} from "../database/game/models/MapLocation";
import {MissionsController} from "../missions/MissionsController";
import {Classes} from "../database/game/models/Class";
import {BlockingUtils} from "../utils/BlockingUtils";
import {TranslationModule, Translations} from "../Translations";
import {draftBotClient} from "../bot";
import {DraftBotReactionMessageBuilder} from "../messages/DraftBotReactionMessage";
import {DraftBotReaction} from "../messages/DraftBotReaction";
import {RandomUtils} from "../utils/RandomUtils";
import {BlockingConstants} from "../constants/BlockingConstants";
import {GenericItemModel} from "../database/game/models/GenericItemModel";
import {NumberChangeReason} from "../constants/LogsConstants";
import {InventorySlots} from "../database/game/models/InventorySlot";
import {PetEntities} from "../database/game/models/PetEntity";
import {Pets} from "../database/game/models/Pet";
import {Op} from "sequelize";
import {SmallEventConstants} from "../constants/SmallEventConstants";

type TextInformation = { interaction: CommandInteraction, tr: TranslationModule };

/**
 * Check top interactions
 * @param otherPlayerRank
 * @param cList
 */
function checkTop(otherPlayerRank: number, cList: string[]): void {
	if (otherPlayerRank === 1) {
		cList.push("top1");
	}
	else if (otherPlayerRank <= 10) {
		cList.push("top10");
	}
	else if (otherPlayerRank <= 50) {
		cList.push("top50");
	}
	else if (otherPlayerRank <= 100) {
		cList.push("top100");
	}
}

/**
 * Check badge interactions
 * @param otherPlayer
 * @param cList
 */
function checkBadges(otherPlayer: Player, cList: string[]): void {
	if (otherPlayer.badges) {
		if (otherPlayer.badges.includes(Constants.BADGES.POWERFUL_GUILD)) {
			cList.push("powerfulGuild");
		}
		if (otherPlayer.badges.includes(Constants.BADGES.STAFF_MEMBER)) {
			cList.push("staffMember");
		}
	}
}

/**
 * Check level interactions
 * @param otherPlayer
 * @param cList
 */
function checkLevel(otherPlayer: Player, cList: string[]): void {
	if (otherPlayer.level < 10) {
		cList.push("beginner");
	}
	else if (otherPlayer.level >= 50) {
		cList.push("advanced");
	}
}

/**
 * Check class interactions
 * @param otherPlayer
 * @param player
 * @param cList
 */
function checkClass(otherPlayer: Player, player: Player, cList: string[]): void {
	if (otherPlayer.class && otherPlayer.class === player.class) {
		cList.push("sameClass");
	}
}

/**
 * Check guild interactions
 * @param otherPlayer
 * @param player
 * @param cList
 */
function checkGuild(otherPlayer: Player, player: Player, cList: string[]): void {
	if (otherPlayer.guildId && otherPlayer.guildId === player.guildId) {
		cList.push("sameGuild");
	}
}

/**
 * Check topWeek interactions
 * @param otherPlayerWeeklyRank
 * @param cList
 */
function checkTopWeek(otherPlayerWeeklyRank: number, cList: string[]): void {
	if (otherPlayerWeeklyRank <= 5) {
		cList.push("topWeek");
	}
}

/**
 * Check health interactions
 * @param otherPlayer
 * @param cList
 */
async function checkHealth(otherPlayer: Player, cList: string[]): Promise<void> {
	const healthPercentage = otherPlayer.health / await otherPlayer.getMaxHealth();
	if (healthPercentage < 0.2) {
		cList.push("lowHP");
	}
	else if (healthPercentage === 1.0) {
		cList.push("fullHP");
	}
}

/**
 * Check ranking interactions
 * @param otherPlayerRank
 * @param numberOfPlayers
 * @param cList
 * @param playerRank
 */
function checkRanking(otherPlayerRank: number, numberOfPlayers: number, cList: string[], playerRank: number): void {
	if (otherPlayerRank > numberOfPlayers) {
		cList.push("unranked");
	}
	else if (otherPlayerRank < playerRank) {
		cList.push("lowerRankThanHim");
	}
	else if (otherPlayerRank > playerRank) {
		cList.push("betterRankThanHim");
	}
}

/**
 * Check money interactions
 * @param otherPlayer
 * @param cList
 * @param player
 */
function checkMoney(otherPlayer: Player, cList: string[], player: Player): void {
	if (otherPlayer.money > 20000) {
		cList.push("rich");
	}
	else if (player.money > 0 && otherPlayer.money < 200) {
		cList.push("poor");
	}
}

/**
 * Check pet interactions
 * @param otherPlayer
 * @param cList
 */
function checkPet(otherPlayer: Player, cList: string[]): void {
	if (otherPlayer.petId) {
		cList.push("pet");
	}
}

/**
 * Check guild responsibilities interactions
 * @param otherPlayer
 * @param guild
 * @param cList
 */
async function checkGuildResponsibilities(otherPlayer: Player, guild: Guild, cList: string[]): Promise<Guild> {
	if (otherPlayer.guildId) {
		guild = await Guilds.getById(otherPlayer.guildId);
		if (guild.chiefId === otherPlayer.id) {
			cList.push("guildChief");
		}
		else if (guild.elderId === otherPlayer.id) {
			cList.push("guildElder");
		}
	}
	return guild;
}

/**
 * Check effect interactions
 * @param otherPlayer
 * @param tr
 * @param cList
 */
function checkEffects(otherPlayer: Player, tr: TranslationModule, cList: string[]): void {
	if (!otherPlayer.checkEffect() && tr.get(otherPlayer.effect)) {
		cList.push(otherPlayer.effect);
	}
}

/**
 * Check inventory interactions
 * @param otherPlayer
 * @param cList
 */
async function checkInventory(otherPlayer: Player, cList: string[]): Promise<void> {
	const invSlots = await InventorySlots.getOfPlayer(otherPlayer.id);
	if (invSlots.find((slot) => slot.isWeapon() && slot.isEquipped()).itemId !== 0) {
		cList.push("weapon");
	}
	if (invSlots.find((slot) => slot.isArmor() && slot.isEquipped()).itemId !== 0) {
		cList.push("armor");
	}
	if (invSlots.find((slot) => slot.isPotion() && slot.isEquipped()).itemId !== 0) {
		cList.push("potion");
	}
	if (invSlots.find((slot) => slot.isObject() && slot.isEquipped()).itemId !== 0) {
		cList.push("object");
	}
}

/**
 * Select a random player on the same path
 * @param playersOnMap
 * @returns {Player}
 */
function selectAPlayer(playersOnMap: { discordUserId: string }[]): string {
	// We don't query other shards, it's not optimized
	let selectedPlayer: string = null;
	for (let i = 0; i < playersOnMap.length; ++i) {
		if (draftBotClient.users.cache.has(playersOnMap[i].discordUserId)) {
			selectedPlayer = playersOnMap[i].discordUserId;
			break;
		}
	}
	return selectedPlayer;
}

/**
 * Get the display of an Player
 * @param tr
 * @param otherPlayer
 * @param numberOfPlayers
 */
async function getPlayerDisplay(tr: TranslationModule, otherPlayer: Player, numberOfPlayers: number): Promise<string> {
	return format(tr.get("playerDisplay"), {
		pseudo: otherPlayer.getPseudo(tr.language),
		rank: await Players.getRankById(otherPlayer.id) > numberOfPlayers ?
			Translations.getModule("commands.profile", tr.language).get("ranking.unranked") :
			await Players.getRankById(otherPlayer.id)
	});
}

/**
 * Get the display of the otherPlayer's pet
 * @param otherPlayer
 * @param language
 */
async function getPetName(otherPlayer: Player, language: string): Promise<string> {
	const petEntity = await PetEntities.getById(otherPlayer.petId);
	const petModel = petEntity ? await Pets.getById(petEntity.petId) : null;
	return petEntity
		? `${petEntity.getPetEmote(petModel)} ${petEntity.nickname ? petEntity.nickname : petEntity.getPetTypeName(petModel, language)}`
		: "";
}

/**
 * Send a coin from the current player to the interacted one
 * @param otherPlayer
 * @param channel
 * @param language
 * @param player
 */
async function sendACoin(otherPlayer: Player, channel: TextBasedChannel, language: string, player: Player): Promise<void> {
	await otherPlayer.addMoney({
		amount: 1,
		channel,
		language,
		reason: NumberChangeReason.RECEIVE_COIN
	});
	await otherPlayer.save();
	await player.addMoney({
		amount: -1,
		channel,
		language,
		reason: NumberChangeReason.SMALL_EVENT
	});
	await player.save();
}

/**
 * Get the needed item if the selected interaction needs one
 * @param characteristic
 * @param otherPlayer
 */
async function getItemIfNeeded(characteristic: string, otherPlayer: Player): Promise<GenericItemModel> {
	switch (characteristic) {
	case "weapon":
		return await (await InventorySlots.getMainWeaponSlot(otherPlayer.id)).getItem();
	case "armor":
		return await (await InventorySlots.getMainArmorSlot(otherPlayer.id)).getItem();
	case "potion":
		return await (await InventorySlots.getMainPotionSlot(otherPlayer.id)).getItem();
	case "object":
		return await (await InventorySlots.getMainObjectSlot(otherPlayer.id)).getItem();
	default:
		return null;
	}
}

/**
 * Get the prefix(es) for the item's display if needed
 * @param item
 */
function getPrefixes(item: GenericItemModel): { [key: string]: string } {
	let prefixItem, prefixItem2 = "";
	if (item) {
		if (item.frenchPlural) {
			prefixItem = "ses";
		}
		else if (item.frenchMasculine) {
			prefixItem = "son";
		}
		else if (/^[AEIOUYÉÈH].*$/u.test(item.fr)) {
			prefixItem = "son";
			prefixItem2 = "sa";
		}
		else {
			prefixItem = "sa";
		}
	}
	return {prefixItem, prefixItem2};
}

/**
 * Send and manage the poor interaction
 * @param textInformation
 * @param otherPlayer
 * @param player
 * @param seEmbed
 */
async function sendAndManagePoorInteraction(
	textInformation: TextInformation,
	otherPlayer: Player,
	player: Player,
	seEmbed: DraftBotEmbed
): Promise<void> {
	await new DraftBotReactionMessageBuilder()
		.allowUser(textInformation.interaction.user)
		.addReaction(new DraftBotReaction(SmallEventConstants.INTERACT_OTHER_PLAYERS.COIN_EMOTE))
		.addReaction(new DraftBotReaction(Constants.MENU_REACTION.DENY))
		.endCallback(async (reactMsg) => {
			const reaction = reactMsg.getFirstReaction();
			const poorEmbed = new DraftBotEmbed()
				.formatAuthor(Translations.getModule("commands.report", textInformation.tr.language).get("journal"), textInformation.interaction.user);
			if (reaction && reaction.emoji.name === SmallEventConstants.INTERACT_OTHER_PLAYERS.COIN_EMOTE) {
				await sendACoin(otherPlayer, textInformation.interaction.channel, textInformation.tr.language, player);
				poorEmbed.setDescription(format(textInformation.tr.getRandom("poorGiveMoney"), {
					pseudo: otherPlayer.getPseudo(textInformation.tr.language)
				}));
			}
			else {
				poorEmbed.setDescription(format(textInformation.tr.getRandom("poorDontGiveMoney"), {
					pseudo: otherPlayer.getPseudo(textInformation.tr.language)
				}));
			}
			BlockingUtils.unblockPlayer(player.discordUserId, BlockingConstants.REASONS.REPORT);
			await textInformation.interaction.channel.send({embeds: [poorEmbed]});
		})
		.build()
		.setDescription(seEmbed.data.description)
		.setAuthor({
			name: seEmbed.data.author.name,
			iconURL: textInformation.interaction.user.displayAvatarURL()
		})
		.editReply(textInformation.interaction, collector => BlockingUtils.blockPlayerWithCollector(player.discordUserId, BlockingConstants.REASONS.REPORT, collector));
}

/**
 * Get all available interactions, considering both entities
 * @param otherPlayer
 * @param player
 * @param numberOfPlayers
 * @param tr
 */
async function getAvailableInteractions(otherPlayer: Player, player: Player, numberOfPlayers: number, tr: TranslationModule): Promise<{ guild: Guild, cList: string[] }> {
	let guild = null;
	const cList: string[] = [];
	const [playerRank, otherPlayerRank, otherPlayerWeeklyRank] = await Promise.all([
		Players.getRankById(player.id),
		Players.getRankById(otherPlayer.id),
		Players.getWeeklyRankById(otherPlayer.id)
	]);
	checkTop(otherPlayerRank, cList);
	checkBadges(otherPlayer, cList);
	checkLevel(otherPlayer, cList);
	checkClass(otherPlayer, player, cList);
	checkGuild(otherPlayer, player, cList);
	checkTopWeek(otherPlayerWeeklyRank, cList);
	await checkHealth(otherPlayer, cList);
	checkRanking(otherPlayerRank, numberOfPlayers, cList, playerRank);
	checkMoney(otherPlayer, cList, player);
	checkPet(otherPlayer, cList);
	guild = await checkGuildResponsibilities(otherPlayer, guild, cList);
	cList.push("class");
	checkEffects(otherPlayer, tr, cList);
	await checkInventory(otherPlayer, cList);
	return {guild, cList};
}

export const smallEvent: SmallEvent = {
	/**
	 * No restrictions on who can do it
	 */
	canBeExecuted(): Promise<boolean> {
		return Promise.resolve(true);
	},

	/**
	 * Interact with another player on the road
	 * @param interaction
	 * @param language
	 * @param player
	 * @param seEmbed
	 */
	async executeSmallEvent(interaction: CommandInteraction, language: string, player: Player, seEmbed: DraftBotEmbed): Promise<void> {
		const numberOfPlayers = await Player.count({
			where: {
				score: {
					[Op.gt]: 100
				}
			}
		});
		const playersOnMap = await MapLocations.getPlayersOnMap(await player.getDestinationId(), await player.getPreviousMapId(), player.id);
		const tr = Translations.getModule("smallEvents.interactOtherPlayers", language);
		const selectedPlayerId = selectAPlayer(playersOnMap);
		if (!selectedPlayerId) {
			// if no player is found on the map.
			// (because we only check for player that are in the cache, this can happen pretty often)
			seEmbed.setDescription(seEmbed.data.description + tr.getRandom("no_one"));
			await interaction.editReply({embeds: [seEmbed]});
			return;
		}
		const [otherPlayer] = await Players.getOrRegister(selectedPlayerId);
		await MissionsController.update(player, interaction.channel, language, {
			missionId: "meetDifferentPlayers",
			params: {metPlayerDiscordId: otherPlayer.discordUserId}
		});
		const {guild, cList} = await getAvailableInteractions(otherPlayer, player, numberOfPlayers, tr);
		const characteristic = RandomUtils.draftbotRandom.pick(cList);
		const item = await getItemIfNeeded(characteristic, otherPlayer);
		const {prefixItem, prefixItem2} = getPrefixes(item);

		seEmbed.setDescription(seEmbed.data.description + format(tr.getRandom(characteristic), {
			playerDisplay: await getPlayerDisplay(tr, otherPlayer, numberOfPlayers),
			level: otherPlayer.level,
			class: (await Classes.getById(otherPlayer.class)).getName(language),
			advice: Translations.getModule("advices", language).getRandom("advices"),
			petName: await getPetName(otherPlayer, language),
			guildName: guild ? guild.name : "",
			item: item ? item.getName(language) : "",
			pluralItem: item ? item.frenchPlural ? "s" : "" : "",
			prefixItem: prefixItem,
			prefixItem2: prefixItem2 !== "" ? prefixItem2 : prefixItem
		}));

		if (characteristic === "poor") {
			await sendAndManagePoorInteraction({interaction, tr}, otherPlayer, player, seEmbed);
		}
		else {
			await interaction.editReply({embeds: [seEmbed]});
		}
	}
};