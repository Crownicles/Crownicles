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
import { PetEntities } from "../database/game/models/PetEntity";
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
	if (otherPlayerRank <= 10) {
		interactionsList.push(InteractOtherPlayerInteraction.TOP10);
		return;
	}
	if (otherPlayerRank <= 50) {
		interactionsList.push(InteractOtherPlayerInteraction.TOP50);
		return;
	}
	if (otherPlayerRank <= 100) {
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
	}
}

/**
 * Check level interactions
 * @param otherPlayer
 * @param interactionsList
 */
function checkLevel(otherPlayer: Player, interactionsList: InteractOtherPlayerInteraction[]): void {
	if (otherPlayer.level < 15) {
		interactionsList.push(InteractOtherPlayerInteraction.BEGINNER);
	}
	else if (otherPlayer.level >= 115) {
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
	if (otherPlayerWeeklyRank <= 5) {
		interactionsList.push(InteractOtherPlayerInteraction.TOP_WEEK);
	}
}

/**
 * Check health interactions
 * @param otherPlayer
 * @param interactionsList
 */
async function checkHealth(otherPlayer: Player, interactionsList: InteractOtherPlayerInteraction[]): Promise<void> {
	const activeObjects = await InventorySlots.getPlayerActiveObjects(otherPlayer.id);
	const healthPercentage = otherPlayer.getHealth(activeObjects) / otherPlayer.getMaxHealth(activeObjects);
	if (healthPercentage < 0.2) {
		interactionsList.push(InteractOtherPlayerInteraction.LOW_HP);
	}
	else if (healthPercentage === 1.0) {
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
	if (otherPlayer.money > 20000) {
		interactionsList.push(InteractOtherPlayerInteraction.RICH);
	}
	else if (player.money > 0 && otherPlayer.money < 200) {
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
 * Get all available interactions, considering both entities
 * @param otherPlayer
 * @param player
 * @param numberOfPlayers
 */
async function getAvailableInteractions(otherPlayer: Player, player: Player, numberOfPlayers: number): Promise<{
	guild: Guild | null;
	inventorySlots: InventorySlot[];
	interactionsList: InteractOtherPlayerInteraction[];
}> {
	let guild = null;
	const interactionsList: InteractOtherPlayerInteraction[] = [];
	const [
		playerRank,
		otherPlayerRank,
		otherPlayerWeeklyRank
	] = await Promise.all([
		Players.getRankById(player.id),
		Players.getRankById(otherPlayer.id),
		Players.getWeeklyRankById(otherPlayer.id)
	]);
	checkTop(otherPlayerRank, interactionsList);
	await checkBadges(otherPlayer, interactionsList);
	checkLevel(otherPlayer, interactionsList);
	checkClass(otherPlayer, player, interactionsList);
	checkGuild(otherPlayer, player, interactionsList);
	checkTopWeek(otherPlayerWeeklyRank, interactionsList);
	await checkHealth(otherPlayer, interactionsList);
	checkRanking(otherPlayerRank, numberOfPlayers, interactionsList, playerRank);
	checkMoney(otherPlayer, interactionsList, player);
	await checkPet(player, otherPlayer, interactionsList);
	guild = await checkGuildResponsibilities(otherPlayer, guild, interactionsList);
	interactionsList.push(InteractOtherPlayerInteraction.CLASS);
	checkEffects(otherPlayer, interactionsList);
	const inventorySlots = await checkInventory(otherPlayer, interactionsList);
	return {
		guild, inventorySlots, interactionsList
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
			where: { score: { [Op.gt]: 100 } }
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
			interactionsList
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
			const otherPet = await PetEntities.getById(otherPlayer.petId);
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
					effectId: otherPlayer.effectId
				}
			}));
		}
	}
};
