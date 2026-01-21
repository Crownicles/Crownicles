import { GDPRAnonymizer } from "../GDPRAnonymizer";
import {
	toCSV, GDPRCsvFiles
} from "../CSVUtils";
import { Players } from "../../../../core/database/game/models/Player";
import { PlayerBadgesManager } from "../../../../core/database/game/models/PlayerBadges";
import { InventorySlots } from "../../../../core/database/game/models/InventorySlot";
import { InventoryInfos } from "../../../../core/database/game/models/InventoryInfo";
import { MissionSlots } from "../../../../core/database/game/models/MissionSlot";
import { PlayerMissionsInfos } from "../../../../core/database/game/models/PlayerMissionsInfo";
import { PlayerSmallEvents } from "../../../../core/database/game/models/PlayerSmallEvent";
import PetEntity from "../../../../core/database/game/models/PetEntity";
import PetExpedition from "../../../../core/database/game/models/PetExpedition";
import { GuildPets } from "../../../../core/database/game/models/GuildPet";
import { Guilds } from "../../../../core/database/game/models/Guild";
import { ScheduledDailyBonusNotification } from "../../../../core/database/game/models/ScheduledDailyBonusNotification";
import { ScheduledReportNotification } from "../../../../core/database/game/models/ScheduledReportNotification";
import { ScheduledExpeditionNotification } from "../../../../core/database/game/models/ScheduledExpeditionNotification";
import { DwarfPetsSeen } from "../../../../core/database/game/models/DwarfPetsSeen";
import { PlayerTalismansManager } from "../../../../core/database/game/models/PlayerTalismans";

type Player = Awaited<ReturnType<typeof Players.getByKeycloakId>>;

/**
 * Exports player core data from the game database (files 01-14)
 */
export async function exportPlayerData(
	player: NonNullable<Player>,
	anonymizer: GDPRAnonymizer,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	// 1. Player core data (REQUIRED under GDPR Art. 15)
	csvFiles["01_player.csv"] = toCSV([
		{
			anonymizedId: anonymizer.getAnonymizedPlayerId(),
			health: player.health,
			score: player.score,
			weeklyScore: player.weeklyScore,
			level: player.level,
			experience: player.experience,
			money: player.money,
			tokens: player.tokens,
			classId: player.class,
			guildId: anonymizer.anonymizeGuildId(player.guildId),
			effectId: player.effectId,
			effectEndDate: player.effectEndDate,
			effectDuration: player.effectDuration,
			defenseGloryPoints: player.defenseGloryPoints,
			attackGloryPoints: player.attackGloryPoints,
			gloryPointsLastSeason: player.gloryPointsLastSeason,
			rage: player.rage,
			fightPointsLost: player.fightPointsLost,
			fightCountdown: player.fightCountdown,
			mapLinkId: player.mapLinkId,
			startTravelDate: player.startTravelDate,
			lastPetFree: player.lastPetFree,
			nextEvent: player.nextEvent,
			createdAt: player.createdAt,
			updatedAt: player.updatedAt
		}
	]);

	// 2. Player badges
	const badges = await PlayerBadgesManager.getOfPlayer(player.id);
	if (badges.length > 0) {
		csvFiles["02_badges.csv"] = toCSV(badges.map(badge => ({ badge })));
	}

	// 3. Inventory slots
	const inventorySlots = await InventorySlots.getOfPlayer(player.id);
	if (inventorySlots.length > 0) {
		csvFiles["03_inventory_slots.csv"] = toCSV(inventorySlots.map(slot => ({
			slotId: slot.slot,
			itemCategory: slot.itemCategory,
			itemId: slot.itemId
		})));
	}

	// 4. Inventory info
	const inventoryInfo = await InventoryInfos.getOfPlayer(player.id);
	if (inventoryInfo) {
		csvFiles["04_inventory_info.csv"] = toCSV([
			{
				lastDailyAt: inventoryInfo.lastDailyAt,
				weaponSlots: inventoryInfo.weaponSlots,
				armorSlots: inventoryInfo.armorSlots,
				objectSlots: inventoryInfo.objectSlots,
				potionSlots: inventoryInfo.potionSlots
			}
		]);
	}

	// 5. Mission slots
	const missionSlots = await MissionSlots.getOfPlayer(player.id);
	if (missionSlots.length > 0) {
		csvFiles["05_mission_slots.csv"] = toCSV(missionSlots.map(slot => ({
			missionId: slot.missionId,
			missionVariant: slot.missionVariant,
			missionObjective: slot.missionObjective,
			expiresAt: slot.expiresAt,
			numberDone: slot.numberDone,
			gemsToWin: slot.gemsToWin,
			xpToWin: slot.xpToWin,
			pointsToWin: slot.pointsToWin,
			moneyToWin: slot.moneyToWin,
			isCampaign: slot.isCampaign()
		})));
	}

	// 6. Missions info
	const missionsInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
	if (missionsInfo) {
		csvFiles["06_missions_info.csv"] = toCSV([
			{
				gems: missionsInfo.gems,
				hasBoughtPointsThisWeek: missionsInfo.hasBoughtPointsThisWeek,
				campaignBlob: missionsInfo.campaignBlob
			}
		]);
	}

	// 7. Pet entity (if player has a pet)
	if (player.petId) {
		const pet = await PetEntity.findByPk(player.petId);
		if (pet) {
			csvFiles["07_pet.csv"] = toCSV([
				{
					typeId: pet.typeId,
					nickname: pet.nickname,
					sex: pet.sex,
					lovePoints: pet.lovePoints,
					hungrySince: pet.hungrySince,
					creationDate: pet.creationDate
				}
			]);
		}
	}

	// 8. Pet expeditions
	const petExpeditions = await PetExpedition.findAll({ where: { playerId: player.id } });
	if (petExpeditions.length > 0) {
		csvFiles["08_pet_expeditions.csv"] = toCSV(petExpeditions.map(exp => ({
			expeditionDate: exp.createdAt
		})));
	}

	// 9. Small events seen
	const smallEvents = await PlayerSmallEvents.getSmallEventsOfPlayer(player.id);
	if (smallEvents && smallEvents.length > 0) {
		csvFiles["09_small_events.csv"] = toCSV(smallEvents.map(se => ({
			eventType: se.eventType,
			time: se.time
		})));
	}

	// 10. Talismans
	const talismans = await PlayerTalismansManager.getOfPlayer(player.id);
	if (talismans) {
		csvFiles["10_talismans.csv"] = toCSV([
			{
				hasTalisman: talismans.hasTalisman,
				hasCloneTalisman: talismans.hasCloneTalisman
			}
		]);
	}

	// 11. Dwarf pets seen
	const dwarfPets = await DwarfPetsSeen.findAll({ where: { playerId: player.id } });
	if (dwarfPets.length > 0) {
		csvFiles["11_dwarf_pets_seen.csv"] = toCSV(dwarfPets.map(dp => ({
			petTypeId: dp.petTypeId
		})));
	}

	// 12. Scheduled notifications
	const dailyBonusNotifs = await ScheduledDailyBonusNotification.findAll({ where: { playerId: player.id } });
	const reportNotifs = await ScheduledReportNotification.findAll({ where: { playerId: player.id } });
	const expeditionNotifs = await ScheduledExpeditionNotification.findAll({ where: { keycloakId: player.keycloakId } });

	const notifications = [
		...dailyBonusNotifs.map(n => ({
			type: "dailyBonus", scheduledAt: n.scheduledAt
		})),
		...reportNotifs.map(n => ({
			type: "report", scheduledAt: n.scheduledAt
		})),
		...expeditionNotifs.map(n => ({
			type: "expedition", scheduledAt: n.scheduledAt
		}))
	];
	if (notifications.length > 0) {
		csvFiles["12_scheduled_notifications.csv"] = toCSV(notifications);
	}

	// 13. Guild membership (anonymized)
	if (player.guildId) {
		const guild = await Guilds.getById(player.guildId);
		if (guild) {
			const isChief = guild.chiefId === player.id;
			const isElder = guild.elderId === player.id;
			csvFiles["13_guild_membership.csv"] = toCSV([
				{
					guildId: anonymizer.anonymizeGuildId(player.guildId),
					role: isChief ? "chief" : isElder ? "elder" : "member"
				}
			]);
		}
	}

	// 14. Guild pets count (anonymized - only count, not individual IDs)
	if (player.guildId) {
		const guildPetsList = await GuildPets.getOfGuild(player.guildId);
		if (guildPetsList.length > 0) {
			csvFiles["14_guild_pets.csv"] = toCSV([
				{
					guildId: anonymizer.anonymizeGuildId(player.guildId),
					petCount: guildPetsList.length
				}
			]);
		}
	}
}
