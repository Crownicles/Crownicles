import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import Player, { Players } from "../database/game/models/Player";
import { Op } from "sequelize";
import { MapLocationDataController } from "../../data/MapLocation";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	InteractOtherPlayerInteraction,
	SmallEventInteractOtherPlayersAcceptToGivePoorPacket,
	SmallEventInteractOtherPlayersPacket,
	SmallEventInteractOtherPlayersRefuseToGivePoorPacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventInteractOtherPlayers";
import { MissionsController } from "../missions/MissionsController";
import {
	PetEntity, PetEntities
} from "../database/game/models/PetEntity";
import {
	InventorySlot, InventorySlots
} from "../database/game/models/InventorySlot";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { BlockingUtils } from "../utils/BlockingUtils";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { ReactionCollectorInteractOtherPlayersPoor } from "../../../../Lib/src/packets/interaction/ReactionCollectorInteractOtherPlayers";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import Guild, { Guilds } from "../database/game/models/Guild";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { Badge } from "../../../../Lib/src/types/Badge";
import { PetUtils } from "../utils/PetUtils";
import { PlayerBadgesManager } from "../database/game/models/PlayerBadges";
import { PlayerMissionsInfos } from "../database/game/models/PlayerMissionsInfo";
import { PlayerTalismansManager } from "../database/game/models/PlayerTalismans";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { LogsDatabase } from "../database/logs/LogsDatabase";
import { LogsPveFightsResults } from "../database/logs/models/LogsPveFightsResults";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";

/**
 * Check top interactions
 * @param otherPlayerRank
 * @param interactionsList
 */
function checkTop(otherPlayerRank: number, interactionsList: InteractOtherPlayerInteraction[]): void {
	if (otherPlayerRank === 1) {
		interactionsList.push(InteractOtherPlayerInteraction.TOP1);
		return;
	}
	if (otherPlayerRank <= SmallEventConstants.INTERACT_OTHER_PLAYERS.TOP_RANKS.TOP10) {
		interactionsList.push(InteractOtherPlayerInteraction.TOP10);
		return;
	}
	if (otherPlayerRank <= SmallEventConstants.INTERACT_OTHER_PLAYERS.TOP_RANKS.TOP50) {
		interactionsList.push(InteractOtherPlayerInteraction.TOP50);
		return;
	}
	if (otherPlayerRank <= SmallEventConstants.INTERACT_OTHER_PLAYERS.TOP_RANKS.TOP100) {
		interactionsList.push(InteractOtherPlayerInteraction.TOP100);
	}
}

/**
 * Check badge interactions
 * @param otherPlayer
 * @param interactionsList
 */
async function checkBadges(otherPlayer: Player, interactionsList: InteractOtherPlayerInteraction[]): Promise<void> {
	const badges = await PlayerBadgesManager.getOfPlayer(otherPlayer.id);
	if (badges.length > 0) {
		if (badges.includes(Badge.POWERFUL_GUILD) || badges.includes(Badge.VERY_POWERFUL_GUILD)) {
			interactionsList.push(InteractOtherPlayerInteraction.POWERFUL_GUILD);
		}
		if (badges.includes(Badge.TECHNICAL_TEAM)) {
			interactionsList.push(InteractOtherPlayerInteraction.STAFF_MEMBER);
		}
		if (badges.includes(Badge.ORACLE_PATRON)) {
			interactionsList.push(InteractOtherPlayerInteraction.ORACLE_PATRON);
		}
		if (badges.includes(Badge.EXPERT_EXPEDITEUR)) {
			interactionsList.push(InteractOtherPlayerInteraction.EXPERT_EXPEDITEUR);
		}
		if (badges.includes(Badge.ANIMAL_LOVER)) {
			interactionsList.push(InteractOtherPlayerInteraction.ANIMAL_LOVER);
		}
		if (badges.includes(Badge.MISSION_COMPLETER)) {
			interactionsList.push(InteractOtherPlayerInteraction.MISSION_COMPLETER);
		}
	}
}

/**
 * Check level interactions
 * @param otherPlayer
 * @param interactionsList
 */
function checkLevel(otherPlayer: Player, interactionsList: InteractOtherPlayerInteraction[]): void {
	if (otherPlayer.level < SmallEventConstants.INTERACT_OTHER_PLAYERS.LEVEL.BEGINNER_MAX) {
		interactionsList.push(InteractOtherPlayerInteraction.BEGINNER);
	}
	else if (otherPlayer.level >= SmallEventConstants.INTERACT_OTHER_PLAYERS.LEVEL.ADVANCED_MIN) {
		interactionsList.push(InteractOtherPlayerInteraction.ADVANCED);
	}
}

/**
 * Check class interactions
 * @param otherPlayer
 * @param player
 * @param interactionsList
 */
function checkClass(otherPlayer: Player, player: Player, interactionsList: InteractOtherPlayerInteraction[]): void {
	if (otherPlayer.class && otherPlayer.class === player.class) {
		interactionsList.push(InteractOtherPlayerInteraction.SAME_CLASS);
	}
}

/**
 * Check guild interactions
 * @param otherPlayer
 * @param player
 * @param interactionsList
 */
function checkGuild(otherPlayer: Player, player: Player, interactionsList: InteractOtherPlayerInteraction[]): void {
	if (otherPlayer.guildId && otherPlayer.guildId === player.guildId) {
		interactionsList.push(InteractOtherPlayerInteraction.SAME_GUILD);
	}
}

/**
 * Check topWeek interactions
 * @param otherPlayerWeeklyRank
 * @param interactionsList
 */
function checkTopWeek(otherPlayerWeeklyRank: number, interactionsList: InteractOtherPlayerInteraction[]): void {
	if (otherPlayerWeeklyRank <= SmallEventConstants.INTERACT_OTHER_PLAYERS.TOP_WEEK_MAX_RANK) {
		interactionsList.push(InteractOtherPlayerInteraction.TOP_WEEK);
	}
}

/**
 * Check health interactions
 * @param otherPlayer
 * @param interactionsList
 */
function checkHealth(otherPlayer: Player, interactionsList: InteractOtherPlayerInteraction[]): void {
	const healthPercentage = otherPlayer.health / otherPlayer.getMaxHealth();
	if (healthPercentage < SmallEventConstants.INTERACT_OTHER_PLAYERS.HEALTH.LOW_HP_THRESHOLD) {
		interactionsList.push(InteractOtherPlayerInteraction.LOW_HP);
	}
	else if (healthPercentage === SmallEventConstants.INTERACT_OTHER_PLAYERS.HEALTH.FULL_HP) {
		interactionsList.push(InteractOtherPlayerInteraction.FULL_HP);
	}
}

/**
 * Check ranking interactions
 * @param otherPlayerRank
 * @param numberOfPlayers
 * @param interactionsList
 * @param playerRank
 */
function checkRanking(otherPlayerRank: number, numberOfPlayers: number, interactionsList: InteractOtherPlayerInteraction[], playerRank: number): void {
	if (otherPlayerRank > numberOfPlayers) {
		interactionsList.push(InteractOtherPlayerInteraction.UNRANKED);
	}
	else if (otherPlayerRank < playerRank) {
		interactionsList.push(InteractOtherPlayerInteraction.LOWER_RANK_THAN_THEM);
	}
	else if (otherPlayerRank > playerRank) {
		interactionsList.push(InteractOtherPlayerInteraction.BETTER_RANK_THAN_THEM);
	}
}

/**
 * Check money interactions
 * @param otherPlayer
 * @param interactionsList
 * @param player
 */
function checkMoney(otherPlayer: Player, interactionsList: InteractOtherPlayerInteraction[], player: Player): void {
	if (otherPlayer.money > SmallEventConstants.INTERACT_OTHER_PLAYERS.MONEY.RICH_MIN) {
		interactionsList.push(InteractOtherPlayerInteraction.RICH);
	}
	else if (player.money > 0 && otherPlayer.money < SmallEventConstants.INTERACT_OTHER_PLAYERS.MONEY.POOR_MAX) {
		interactionsList.push(InteractOtherPlayerInteraction.POOR);
	}
}

/**
 * Check pet interactions
 * @param player
 * @param otherPlayer
 * @param interactionsList
 */
async function checkPet(player: Player, otherPlayer: Player, interactionsList: InteractOtherPlayerInteraction[]): Promise<void> {
	// Check if the other player has a different pet than the current player
	if (!otherPlayer.petId || otherPlayer.petId === player.petId) {
		return;
	}

	// Check if pet is a clone (on expedition with clone talisman)
	if (await PetUtils.isPetClone(otherPlayer)) {
		interactionsList.push(InteractOtherPlayerInteraction.PET_CLONE);
		return;
	}

	// Check if pet is on expedition (without clone talisman)
	if (await PetUtils.isPetOnExpedition(otherPlayer.id)) {
		interactionsList.push(InteractOtherPlayerInteraction.PET_ON_EXPEDITION);
		return;
	}

	// Pet is not on expedition, normal pet interaction
	interactionsList.push(InteractOtherPlayerInteraction.PET);
}

/**
 * Check guild responsibilities interactions
 * @param otherPlayer
 * @param guild
 * @param interactionsList
 */
async function checkGuildResponsibilities(otherPlayer: Player, guild: Guild | null, interactionsList: InteractOtherPlayerInteraction[]): Promise<Guild | null> {
	if (otherPlayer.guildId) {
		guild = await Guilds.getById(otherPlayer.guildId);
		if (guild) {
			if (guild.chiefId === otherPlayer.id) {
				interactionsList.push(InteractOtherPlayerInteraction.GUILD_CHIEF);
			}
			else if (guild.elderId === otherPlayer.id) {
				interactionsList.push(InteractOtherPlayerInteraction.GUILD_ELDER);
			}
		}
	}
	return guild;
}

/**
 * Check effect interactions
 * @param otherPlayer
 * @param interactionsList
 */
function checkEffects(otherPlayer: Player, interactionsList: InteractOtherPlayerInteraction[]): void {
	if (otherPlayer.isUnderEffect()) {
		interactionsList.push(InteractOtherPlayerInteraction.EFFECT);
	}
}

/**
 * Check inventory interactions
 * @param otherPlayer
 * @param interactionsList
 */
async function checkInventory(otherPlayer: Player, interactionsList: InteractOtherPlayerInteraction[]): Promise<InventorySlot[]> {
	const invSlots = await InventorySlots.getOfPlayer(otherPlayer.id);
	if (invSlots.find(slot => slot.isWeapon() && slot.isEquipped())?.itemId !== 0) {
		interactionsList.push(InteractOtherPlayerInteraction.WEAPON);
	}
	if (invSlots.find(slot => slot.isArmor() && slot.isEquipped())?.itemId !== 0) {
		interactionsList.push(InteractOtherPlayerInteraction.ARMOR);
	}
	if (invSlots.find(slot => slot.isPotion() && slot.isEquipped())?.itemId !== 0) {
		interactionsList.push(InteractOtherPlayerInteraction.POTION);
	}
	if (invSlots.find(slot => slot.isObject() && slot.isEquipped())?.itemId !== 0) {
		interactionsList.push(InteractOtherPlayerInteraction.OBJECT);
	}

	return invSlots;
}

/**
 * Check league interactions
 * @param otherPlayer
 * @param player
 * @param interactionsList
 */
function checkLeague(otherPlayer: Player, player: Player, interactionsList: InteractOtherPlayerInteraction[]): void {
	const otherLeague = otherPlayer.getLeague();
	const playerLeague = player.getLeague();
	if (otherLeague.id >= SmallEventConstants.INTERACT_OTHER_PLAYERS.HIGH_LEAGUE_MIN_ID) {
		interactionsList.push(InteractOtherPlayerInteraction.HIGH_LEAGUE);
	}
	if (otherLeague.id === playerLeague.id) {
		interactionsList.push(InteractOtherPlayerInteraction.SAME_LEAGUE);
	}
}

/**
 * Check glory ranking interactions
 * @param otherPlayerGloryRank
 * @param interactionsList
 */
function checkGlory(otherPlayerGloryRank: number, interactionsList: InteractOtherPlayerInteraction[]): void {
	if (otherPlayerGloryRank > 0 && otherPlayerGloryRank <= SmallEventConstants.INTERACT_OTHER_PLAYERS.TOP_GLORY_MAX_RANK) {
		interactionsList.push(InteractOtherPlayerInteraction.TOP_GLORY);
	}
}

/**
 * Check gems interactions
 * @param gems
 * @param interactionsList
 */
function checkGems(gems: number, interactionsList: InteractOtherPlayerInteraction[]): void {
	if (gems >= SmallEventConstants.INTERACT_OTHER_PLAYERS.MANY_GEMS_MIN) {
		interactionsList.push(InteractOtherPlayerInteraction.MANY_GEMS);
	}
}

/**
 * Check token interactions
 * @param otherPlayer
 * @param interactionsList
 */
function checkTokens(otherPlayer: Player, interactionsList: InteractOtherPlayerInteraction[]): void {
	if (otherPlayer.tokens >= SmallEventConstants.INTERACT_OTHER_PLAYERS.MANY_TOKENS_MIN) {
		interactionsList.push(InteractOtherPlayerInteraction.MANY_TOKENS);
	}
}

/**
 * Check talisman interactions
 * @param hasTalisman
 * @param hasCloneTalisman
 * @param interactionsList
 */
function checkTalismans(hasTalisman: boolean, hasCloneTalisman: boolean, interactionsList: InteractOtherPlayerInteraction[]): void {
	if (hasCloneTalisman) {
		interactionsList.push(InteractOtherPlayerInteraction.HAS_CLONE_TALISMAN);
	}
	else if (hasTalisman) {
		interactionsList.push(InteractOtherPlayerInteraction.HAS_TALISMAN);
	}
}

/**
 * Check pet type interactions (same pet, flying, aquatic)
 * @param playerPet
 * @param otherPet
 * @param interactionsList
 */
function checkPetType(playerPet: PetEntity | null, otherPet: PetEntity | null, interactionsList: InteractOtherPlayerInteraction[]): void {
	if (!otherPet) {
		return;
	}
	if (playerPet && playerPet.typeId === otherPet.typeId) {
		interactionsList.push(InteractOtherPlayerInteraction.SAME_PET);

		// Remove the generic PET interaction since SAME_PET is more specific
		const petIndex = interactionsList.indexOf(InteractOtherPlayerInteraction.PET);
		if (petIndex !== -1) {
			interactionsList.splice(petIndex, 1);
		}
	}
	if (PetConstants.FLYING_PETS.includes(otherPet.typeId)) {
		interactionsList.push(InteractOtherPlayerInteraction.FLYING_PET);
	}
	if (PetConstants.AQUATIC_PETS.includes(otherPet.typeId)) {
		interactionsList.push(InteractOtherPlayerInteraction.AQUATIC_PET);
	}
}

const FINAL_BOSS_IDS = [
	"magmaTitan",
	"maleIceDragon",
	"femaleIceDragon"
] as const;

const BOSS_INTERACTION_MAP: Record<string, InteractOtherPlayerInteraction> = {
	magmaTitan: InteractOtherPlayerInteraction.BEATEN_MAGMA_TITAN,
	maleIceDragon: InteractOtherPlayerInteraction.BEATEN_MALE_ICE_DRAGON,
	femaleIceDragon: InteractOtherPlayerInteraction.BEATEN_FEMALE_ICE_DRAGON
};

/**
 * Check boss kill interactions
 * @param otherPlayer
 * @param interactionsList
 */
async function checkBossKills(otherPlayer: Player, interactionsList: InteractOtherPlayerInteraction[]): Promise<Map<string, number>> {
	const bestBossKills = new Map<string, number>();

	const logPlayer = await LogsDatabase.findOrCreatePlayer(otherPlayer.keycloakId);
	if (!logPlayer) {
		return bestBossKills;
	}

	const bossKills = await LogsPveFightsResults.findAll({
		where: {
			playerId: logPlayer.id,
			monsterId: { [Op.in]: [...FINAL_BOSS_IDS] },
			winner: 1
		}
	});

	for (const kill of bossKills) {
		const current = bestBossKills.get(kill.monsterId);
		if (current === undefined || kill.monsterLevel > current) {
			bestBossKills.set(kill.monsterId, kill.monsterLevel);
		}
	}

	for (const [monsterId] of bestBossKills) {
		const interaction = BOSS_INTERACTION_MAP[monsterId];
		if (interaction !== undefined) {
			interactionsList.push(interaction);
		}
	}

	return bestBossKills;
}

/**
 * Get all available interactions, considering both entities
 * @param otherPlayer
 * @param player
 * @param numberOfPlayers
 */
async function getAvailableInteractions(otherPlayer: Player, player: Player, numberOfPlayers: number): Promise<{
	guild: Guild | null;
	inventorySlots: InventorySlot[];
	interactionsList: InteractOtherPlayerInteraction[];
	otherPet: PetEntity | null;
	gloryRank: number;
	gems: number;
	bestBossKills: Map<string, number>;
}> {
	let guild = null;
	const interactionsList: InteractOtherPlayerInteraction[] = [];
	const [
		playerRank,
		otherPlayerRank,
		otherPlayerWeeklyRank,
		otherPlayerGloryRank,
		otherPet,
		playerPet,
		otherPlayerMissionsInfo,
		otherPlayerTalismans
	] = await Promise.all([
		Players.getRankById(player.id),
		Players.getRankById(otherPlayer.id),
		Players.getWeeklyRankById(otherPlayer.id),
		Players.getGloryRankById(otherPlayer.id).catch(() => -1),
		PetEntities.getById(otherPlayer.petId),
		PetEntities.getById(player.petId),
		PlayerMissionsInfos.getOfPlayer(otherPlayer.id),
		PlayerTalismansManager.getOfPlayer(otherPlayer.id)
	]);
	checkTop(otherPlayerRank, interactionsList);
	await checkBadges(otherPlayer, interactionsList);
	checkLevel(otherPlayer, interactionsList);
	checkClass(otherPlayer, player, interactionsList);
	checkGuild(otherPlayer, player, interactionsList);
	checkTopWeek(otherPlayerWeeklyRank, interactionsList);
	checkHealth(otherPlayer, interactionsList);
	checkRanking(otherPlayerRank, numberOfPlayers, interactionsList, playerRank);
	checkMoney(otherPlayer, interactionsList, player);
	await checkPet(player, otherPlayer, interactionsList);
	guild = await checkGuildResponsibilities(otherPlayer, guild, interactionsList);
	interactionsList.push(InteractOtherPlayerInteraction.CLASS);
	checkEffects(otherPlayer, interactionsList);
	const inventorySlots = await checkInventory(otherPlayer, interactionsList);
	checkLeague(otherPlayer, player, interactionsList);
	checkGlory(otherPlayerGloryRank, interactionsList);
	checkGems(otherPlayerMissionsInfo.gems, interactionsList);
	checkTokens(otherPlayer, interactionsList);
	checkTalismans(otherPlayerTalismans.hasTalisman, otherPlayerTalismans.hasCloneTalisman, interactionsList);
	checkPetType(playerPet, otherPet, interactionsList);
	const bestBossKills = await checkBossKills(otherPlayer, interactionsList);
	return {
		guild,
		inventorySlots,
		interactionsList,
		otherPet,
		gloryRank: otherPlayerGloryRank,
		gems: otherPlayerMissionsInfo.gems,
		bestBossKills
	};
}

/**
 * Send a coin from the current player to the interacted one
 * @param otherPlayer
 * @param player
 * @param response
 */
async function sendACoin(otherPlayer: Player, player: Player, response: CrowniclesPacket[]): Promise<void> {
	await Promise.all([
		otherPlayer.addMoney({
			amount: 1,
			response,
			reason: NumberChangeReason.RECEIVE_COIN
		}),
		player.spendMoney({
			amount: 1,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		})
	]);
	await Promise.all([
		otherPlayer.save(),
		player.save()
	]);
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnContinent,

	async executeSmallEvent(response, player, context): Promise<void> {
		const numberOfPlayers = await Player.count({
			where: { score: { [Op.gt]: SmallEventConstants.INTERACT_OTHER_PLAYERS.MIN_SCORE_FOR_COUNTING } }
		});

		const destinationId = player.getDestinationId();
		if (destinationId === null) {
			response.push(makePacket(SmallEventInteractOtherPlayersPacket, {}));
			return;
		}
		const playersOnMap = await MapLocationDataController.instance.getPlayersOnMap(destinationId, player.getPreviousMapId() ?? destinationId, player.id);
		if (playersOnMap.length === 0) {
			response.push(makePacket(SmallEventInteractOtherPlayersPacket, {}));
			return;
		}

		const selectedPlayerKeycloakId = RandomUtils.crowniclesRandom.pick(playersOnMap).keycloakId;
		const otherPlayer = await Players.getOrRegister(selectedPlayerKeycloakId);
		await MissionsController.update(player, response, {
			missionId: "meetDifferentPlayers",
			params: { metPlayerKeycloakId: otherPlayer.keycloakId }
		});
		const {
			guild,
			inventorySlots,
			interactionsList,
			otherPet,
			gloryRank,
			gems,
			bestBossKills
		} = await getAvailableInteractions(otherPlayer, player, numberOfPlayers);
		const interaction = RandomUtils.crowniclesRandom.pick(interactionsList);
		const fetchedRank = await Players.getRankById(otherPlayer.id);
		const otherPlayerRank = fetchedRank === null || fetchedRank > numberOfPlayers ? undefined : fetchedRank;

		if (interaction === InteractOtherPlayerInteraction.POOR) {
			const collector = new ReactionCollectorInteractOtherPlayersPoor(
				otherPlayer.keycloakId,
				otherPlayerRank ?? 0
			);

			const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
				const reaction = collector.getFirstReaction();

				if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
					await sendACoin(otherPlayer, player, response);
					response.push(makePacket(SmallEventInteractOtherPlayersAcceptToGivePoorPacket, {}));
				}
				else {
					response.push(makePacket(SmallEventInteractOtherPlayersRefuseToGivePoorPacket, {}));
				}

				BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
			};

			const packet = new ReactionCollectorInstance(
				collector,
				context,
				{
					allowedPlayerKeycloakIds: [player.keycloakId],
					reactionLimit: 1
				},
				endCallback
			)
				.block(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND)
				.build();

			response.push(packet);
		}
		else {
			const bossId = FINAL_BOSS_IDS.find(id => BOSS_INTERACTION_MAP[id] === interaction);
			response.push(makePacket(SmallEventInteractOtherPlayersPacket, {
				keycloakId: otherPlayer.keycloakId,
				playerInteraction: interaction,
				data: {
					rank: otherPlayerRank,
					level: otherPlayer.level,
					classId: otherPlayer.class,
					petName: otherPlayer.petId && otherPet ? otherPet.nickname : undefined,
					petId: otherPlayer.petId && otherPet ? otherPet.typeId : undefined,
					petSex: (otherPlayer.petId && otherPet ? otherPet.sex : undefined) as SexTypeShort,
					guildName: guild ? guild.name : undefined,
					weaponId: inventorySlots.find(slot => slot.isWeapon() && slot.isEquipped())?.itemId ?? 0,
					armorId: inventorySlots.find(slot => slot.isArmor() && slot.isEquipped())?.itemId ?? 0,
					potionId: inventorySlots.find(slot => slot.isPotion() && slot.isEquipped())?.itemId ?? 0,
					objectId: inventorySlots.find(slot => slot.isObject() && slot.isEquipped())?.itemId ?? 0,
					effectId: otherPlayer.effectId,
					leagueId: otherPlayer.getLeague().id,
					gloryRank,
					gems,
					tokens: otherPlayer.tokens,
					bossId,
					bossLevel: bossId ? bestBossKills.get(bossId) : undefined
				}
			}));
		}
	}
};
