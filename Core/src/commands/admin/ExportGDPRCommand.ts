import { adminCommand } from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Players } from "../../core/database/game/models/Player";
import {
	CommandExportGDPRReq,
	CommandExportGDPRRes
} from "../../../../Lib/src/packets/commands/CommandExportGDPRPacket";
import { RightGroup } from "../../../../Lib/src/types/RightGroup";
import { PlayerBadgesManager } from "../../core/database/game/models/PlayerBadges";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";
import { InventoryInfos } from "../../core/database/game/models/InventoryInfo";
import { MissionSlots } from "../../core/database/game/models/MissionSlot";
import { PlayerMissionsInfos } from "../../core/database/game/models/PlayerMissionsInfo";
import { PlayerSmallEvents } from "../../core/database/game/models/PlayerSmallEvent";
import PetEntity from "../../core/database/game/models/PetEntity";
import PetExpedition from "../../core/database/game/models/PetExpedition";
import { createHash } from "crypto";
import { GuildPets } from "../../core/database/game/models/GuildPet";
import { Guilds } from "../../core/database/game/models/Guild";
import { ScheduledDailyBonusNotification } from "../../core/database/game/models/ScheduledDailyBonusNotification";
import { ScheduledReportNotification } from "../../core/database/game/models/ScheduledReportNotification";
import { ScheduledExpeditionNotification } from "../../core/database/game/models/ScheduledExpeditionNotification";
import { DwarfPetsSeen } from "../../core/database/game/models/DwarfPetsSeen";
import { PlayerTalismansManager } from "../../core/database/game/models/PlayerTalismans";

// Logs database imports
import { LogsPlayers } from "../../core/database/logs/models/LogsPlayers";
import { LogsPlayersScore } from "../../core/database/logs/models/LogsPlayersScore";
import { LogsPlayersLevel } from "../../core/database/logs/models/LogsPlayersLevel";
import { LogsPlayersExperience } from "../../core/database/logs/models/LogsPlayersExperience";
import { LogsPlayersMoney } from "../../core/database/logs/models/LogsPlayersMoney";
import { LogsPlayersHealth } from "../../core/database/logs/models/LogsPlayersHealth";
import { LogsPlayersEnergy } from "../../core/database/logs/models/LogsPlayersEnergy";
import { LogsPlayersGems } from "../../core/database/logs/models/LogsPlayersGems";
import { LogsPlayersRage } from "../../core/database/logs/models/LogsPlayersRage";
import { LogsPlayersTokens } from "../../core/database/logs/models/LogsPlayersTokens";
import { LogsPlayersGloryPoints } from "../../core/database/logs/models/LogsPlayersGloryPoints";
import { LogsPlayersClassChanges } from "../../core/database/logs/models/LogsPlayersClassChanges";
import { LogsPlayersTravels } from "../../core/database/logs/models/LogsPlayersTravels";
import { LogsPlayersTeleportations } from "../../core/database/logs/models/LogsPlayersTeleportations";
import { LogsPlayersTimewarps } from "../../core/database/logs/models/LogsPlayersTimewarps";
import { LogsPlayersPossibilities } from "../../core/database/logs/models/LogsPlayersPossibilities";
import { LogsPlayersSmallEvents } from "../../core/database/logs/models/LogsPlayersSmallEvents";
import { LogsPlayersStandardAlterations } from "../../core/database/logs/models/LogsPlayersStandardAlterations";
import { LogsPlayersOccupiedAlterations } from "../../core/database/logs/models/LogsPlayersOccupiedAlterations";
import { LogsPlayersVotes } from "../../core/database/logs/models/LogsPlayersVotes";
import { LogsPlayersDailies } from "../../core/database/logs/models/LogsPlayersDailies";
import { LogsPlayersNewPets } from "../../core/database/logs/models/LogsPlayersNewPets";
import { LogsPlayersCommands } from "../../core/database/logs/models/LogsPlayersCommands";
import { LogsPlayers15BestSeason } from "../../core/database/logs/models/LogsPlayers15BestSeason";
import { LogsPlayers15BestTopweek } from "../../core/database/logs/models/LogsPlayers15BestTopweek";
import { LogsPlayerLeagueReward } from "../../core/database/logs/models/LogsPlayerLeagueReward";
import { LogsMissionsFound } from "../../core/database/logs/models/LogsMissionsFound";
import { LogsMissionsFinished } from "../../core/database/logs/models/LogsMissionsFinished";
import { LogsMissionsFailed } from "../../core/database/logs/models/LogsMissionsFailed";
import { LogsMissionsDailyFinished } from "../../core/database/logs/models/LogsMissionsDailyFinished";
import { LogsMissionsCampaignProgresses } from "../../core/database/logs/models/LogsMissionsCampaignProgresses";
import { LogsFightsResults } from "../../core/database/logs/models/LogsFightsResults";
import { LogsFightsActionsUsed } from "../../core/database/logs/models/LogsFightsActionsUsed";
import { LogsPveFightsResults } from "../../core/database/logs/models/LogsPveFightsResults";
import { LogsPveFightsActionsUsed } from "../../core/database/logs/models/LogsPveFightsActionsUsed";
import { LogsClassicalShopBuyouts } from "../../core/database/logs/models/LogsClassicalShopBuyouts";
import { LogsGuildShopBuyouts } from "../../core/database/logs/models/LogsGuildShopBuyouts";
import { LogsMissionShopBuyouts } from "../../core/database/logs/models/LogsMissionShopBuyouts";
import { LogsItemGainsArmor } from "../../core/database/logs/models/LogsItemsGainsArmor";
import { LogsItemGainsWeapon } from "../../core/database/logs/models/LogsItemsGainsWeapon";
import { LogsItemGainsObject } from "../../core/database/logs/models/LogsItemsGainsObject";
import { LogsItemGainsPotion } from "../../core/database/logs/models/LogsItemsGainsPotion";
import { LogsItemSellsArmor } from "../../core/database/logs/models/LogsItemsSellsArmor";
import { LogsItemSellsWeapon } from "../../core/database/logs/models/LogsItemsSellsWeapon";
import { LogsItemSellsObject } from "../../core/database/logs/models/LogsItemsSellsObject";
import { LogsItemSellsPotion } from "../../core/database/logs/models/LogsItemsSellsPotion";
import { LogsGuildsCreations } from "../../core/database/logs/models/LogsGuildCreations";
import { LogsGuildsJoins } from "../../core/database/logs/models/LogsGuildJoins";
import { LogsGuildsKicks } from "../../core/database/logs/models/LogsGuildsKicks";
import { LogsGuildsLeaves } from "../../core/database/logs/models/LogsGuildsLeaves";
import { LogsGuildsChiefsChanges } from "../../core/database/logs/models/LogsGuildsChiefsChanges";
import { LogsGuildsEldersAdds } from "../../core/database/logs/models/LogsGuildsEldersAdds";
import { LogsGuildsEldersRemoves } from "../../core/database/logs/models/LogsGuildsEldersRemoves";
import { LogsGuildsDescriptionChanges } from "../../core/database/logs/models/LogsGuildsDescriptionChanges";
import { LogsPetsSells } from "../../core/database/logs/models/LogsPetsSells";
import { LogsExpeditions } from "../../core/database/logs/models/LogsExpeditions";
import { LogsUnlocks } from "../../core/database/logs/models/LogsUnlocks";
import { LogsPetsNicknames } from "../../core/database/logs/models/LogsPetsNicknames";
import { LogsGuilds } from "../../core/database/logs/models/LogsGuilds";
import { Op } from "sequelize";

/**
 * Anonymization utilities for GDPR export
 */
class GDPRAnonymizer {
	private readonly playerIdHash: string;

	private readonly keycloakIdHash: string;

	private readonly otherPlayersHashes: Map<number, string> = new Map();

	private otherPlayerCounter = 0;

	constructor(playerId: number, keycloakId: string) {
		// Create consistent hash for the player being exported
		this.playerIdHash = createHash("sha256").update(`player-${playerId}`)
			.digest("hex")
			.substring(0, 16);
		this.keycloakIdHash = createHash("sha256").update(`keycloak-${keycloakId}`)
			.digest("hex")
			.substring(0, 16);
	}

	/**
	 * Get the anonymized ID for the exported player
	 */
	getAnonymizedPlayerId(): string {
		return this.playerIdHash;
	}

	/**
	 * Anonymize a player ID - own ID gets consistent hash, other players get "OTHER_PLAYER_X"
	 */
	anonymizePlayerId(playerId: number | null, isOwnPlayer: boolean): string | null {
		if (playerId === null) {
			return null;
		}
		if (isOwnPlayer) {
			return this.playerIdHash;
		}
		if (!this.otherPlayersHashes.has(playerId)) {
			this.otherPlayerCounter++;
			this.otherPlayersHashes.set(playerId, `OTHER_PLAYER_${this.otherPlayerCounter}`);
		}
		return this.otherPlayersHashes.get(playerId)!;
	}

	/**
	 * Anonymize a keycloak ID
	 */
	anonymizeKeycloakId(keycloakId: string | null, isOwnPlayer: boolean): string | null {
		if (keycloakId === null) {
			return null;
		}
		if (isOwnPlayer) {
			return this.keycloakIdHash;
		}
		return "REDACTED";
	}

	/**
	 * Anonymize a guild ID
	 */
	anonymizeGuildId(guildId: number | null): string | null {
		if (guildId === null || guildId === 0) {
			return null;
		}
		return createHash("sha256").update(`guild-${guildId}`)
			.digest("hex")
			.substring(0, 12);
	}
}

/**
 * Convert an array of objects to CSV format
 */
function toCSV(data: Record<string, unknown>[], columns?: string[]): string {
	if (data.length === 0) {
		return "";
	}

	const headers = columns ?? Object.keys(data[0]);
	const csvRows: string[] = [];

	// Header row
	csvRows.push(headers.join(","));

	// Data rows
	for (const row of data) {
		const values = headers.map(header => {
			const value = row[header];
			if (value === null || value === undefined) {
				return "";
			}
			if (value instanceof Date) {
				return value.toISOString();
			}
			if (typeof value === "string") {
				// Escape quotes and wrap in quotes if needed
				if (value.includes(",") || value.includes('"') || value.includes("\n")) {
					return `"${value.replace(/"/g, '""')}"`;
				}
				return value;
			}
			return String(value);
		});
		csvRows.push(values.join(","));
	}

	return csvRows.join("\n");
}

/**
 * A command that exports all GDPR-relevant player data
 * Data is anonymized: own player gets consistent hash, other players are redacted
 */
export default class ExportGDPRCommand {
	static verifyRights(context: PacketContext): boolean {
		return context.rightGroups?.includes(RightGroup.ADMIN) ?? false;
	}

	@adminCommand(CommandExportGDPRReq, ExportGDPRCommand.verifyRights)
	async execute(response: CrowniclesPacket[], packet: CommandExportGDPRReq): Promise<void> {
		const player = await Players.getByKeycloakId(packet.keycloakId);

		if (!player) {
			response.push(makePacket(CommandExportGDPRRes, {
				exists: false,
				csvFiles: {},
				anonymizedPlayerId: ""
			}));
			return;
		}

		const anonymizer = new GDPRAnonymizer(player.id, player.keycloakId);
		const csvFiles: Record<string, string> = {};

		try {
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
				csvFiles["02_badges.csv"] = toCSV(badges.map(badge => ({
					badge
				})));
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

			/*
			 * ======= LOGS DATABASE EXPORTS (GDPR Art. 15 - Right of access) =======
			 * Find the player in the logs database
			 */
			const logsPlayer = await LogsPlayers.findOne({ where: { keycloakId: player.keycloakId } });

			if (logsPlayer) {
				const logsPlayerId = logsPlayer.id;

				// 15. Score history
				const scoreHistory = await LogsPlayersScore.findAll({ where: { playerId: logsPlayerId } });
				if (scoreHistory.length > 0) {
					csvFiles["logs/15_score_history.csv"] = toCSV(scoreHistory.map(s => ({
						value: s.value, reason: s.reason, date: s.date
					})));
				}

				// 16. Level history
				const levelHistory = await LogsPlayersLevel.findAll({ where: { playerId: logsPlayerId } });
				if (levelHistory.length > 0) {
					csvFiles["logs/16_level_history.csv"] = toCSV(levelHistory.map(l => ({
						level: l.level, date: l.date
					})));
				}

				// 17. Experience history
				const expHistory = await LogsPlayersExperience.findAll({ where: { playerId: logsPlayerId } });
				if (expHistory.length > 0) {
					csvFiles["logs/17_experience_history.csv"] = toCSV(expHistory.map(e => ({
						value: e.value, reason: e.reason, date: e.date
					})));
				}

				// 18. Money history
				const moneyHistory = await LogsPlayersMoney.findAll({ where: { playerId: logsPlayerId } });
				if (moneyHistory.length > 0) {
					csvFiles["logs/18_money_history.csv"] = toCSV(moneyHistory.map(m => ({
						value: m.value, reason: m.reason, date: m.date
					})));
				}

				// 19. Health history
				const healthHistory = await LogsPlayersHealth.findAll({ where: { playerId: logsPlayerId } });
				if (healthHistory.length > 0) {
					csvFiles["logs/19_health_history.csv"] = toCSV(healthHistory.map(h => ({
						value: h.value, reason: h.reason, date: h.date
					})));
				}

				// 20. Energy history
				const energyHistory = await LogsPlayersEnergy.findAll({ where: { playerId: logsPlayerId } });
				if (energyHistory.length > 0) {
					csvFiles["logs/20_energy_history.csv"] = toCSV(energyHistory.map(e => ({
						value: e.value, reason: e.reason, date: e.date
					})));
				}

				// 21. Gems history
				const gemsHistory = await LogsPlayersGems.findAll({ where: { playerId: logsPlayerId } });
				if (gemsHistory.length > 0) {
					csvFiles["logs/21_gems_history.csv"] = toCSV(gemsHistory.map(g => ({
						value: g.value, reason: g.reason, date: g.date
					})));
				}

				// 22. Rage history
				const rageHistory = await LogsPlayersRage.findAll({ where: { playerId: logsPlayerId } });
				if (rageHistory.length > 0) {
					csvFiles["logs/22_rage_history.csv"] = toCSV(rageHistory.map(r => ({
						value: r.value, reason: r.reason, date: r.date
					})));
				}

				// 23. Tokens history
				const tokensHistory = await LogsPlayersTokens.findAll({ where: { playerId: logsPlayerId } });
				if (tokensHistory.length > 0) {
					csvFiles["logs/23_tokens_history.csv"] = toCSV(tokensHistory.map(t => ({
						value: t.value, reason: t.reason, date: t.date
					})));
				}

				// 24. Glory points history
				const gloryHistory = await LogsPlayersGloryPoints.findAll({ where: { playerId: logsPlayerId } });
				if (gloryHistory.length > 0) {
					csvFiles["logs/24_glory_points_history.csv"] = toCSV(gloryHistory.map(g => ({
						value: g.value, reason: g.reason, date: g.date
					})));
				}

				// 25. Class changes
				const classChanges = await LogsPlayersClassChanges.findAll({ where: { playerId: logsPlayerId } });
				if (classChanges.length > 0) {
					csvFiles["logs/25_class_changes.csv"] = toCSV(classChanges.map(c => ({
						classId: c.classId, date: c.date
					})));
				}

				// 26. Travels
				const travels = await LogsPlayersTravels.findAll({ where: { playerId: logsPlayerId } });
				if (travels.length > 0) {
					csvFiles["logs/26_travels.csv"] = toCSV(travels.map(t => ({
						mapLinkId: t.mapLinkId, date: t.date
					})));
				}

				// 27. Teleportations
				const teleportations = await LogsPlayersTeleportations.findAll({ where: { playerId: logsPlayerId } });
				if (teleportations.length > 0) {
					csvFiles["logs/27_teleportations.csv"] = toCSV(teleportations.map(t => ({
						originMapLinkId: t.originMapLinkId, newMapLinkId: t.newMapLinkId, date: t.date
					})));
				}

				// 28. Timewarps
				const timewarps = await LogsPlayersTimewarps.findAll({ where: { playerId: logsPlayerId } });
				if (timewarps.length > 0) {
					csvFiles["logs/28_timewarps.csv"] = toCSV(timewarps.map(t => ({
						time: t.time, reason: t.reason, date: t.date
					})));
				}

				// 29. Possibilities (event choices)
				const possibilities = await LogsPlayersPossibilities.findAll({ where: { playerId: logsPlayerId } });
				if (possibilities.length > 0) {
					csvFiles["logs/29_event_possibilities.csv"] = toCSV(possibilities.map(p => ({
						possibilityId: p.possibilityId, date: p.date
					})));
				}

				// 30. Small events seen
				const logsSmallEvents = await LogsPlayersSmallEvents.findAll({ where: { playerId: logsPlayerId } });
				if (logsSmallEvents.length > 0) {
					csvFiles["logs/30_small_events.csv"] = toCSV(logsSmallEvents.map(s => ({
						smallEventId: s.smallEventId, date: s.date
					})));
				}

				// 31. Standard alterations
				const standardAlterations = await LogsPlayersStandardAlterations.findAll({ where: { playerId: logsPlayerId } });
				if (standardAlterations.length > 0) {
					csvFiles["logs/31_standard_alterations.csv"] = toCSV(standardAlterations.map(a => ({
						alterationId: a.alterationId, reason: a.reason, date: a.date
					})));
				}

				// 32. Occupied alterations
				const occupiedAlterations = await LogsPlayersOccupiedAlterations.findAll({ where: { playerId: logsPlayerId } });
				if (occupiedAlterations.length > 0) {
					csvFiles["logs/32_occupied_alterations.csv"] = toCSV(occupiedAlterations.map(a => ({
						duration: a.duration, reason: a.reason, date: a.date
					})));
				}

				// 33. Votes
				const votes = await LogsPlayersVotes.findAll({ where: { playerId: logsPlayerId } });
				if (votes.length > 0) {
					csvFiles["logs/33_votes.csv"] = toCSV(votes.map(v => ({
						date: v.date
					})));
				}

				// 34. Dailies
				const dailies = await LogsPlayersDailies.findAll({ where: { playerId: logsPlayerId } });
				if (dailies.length > 0) {
					csvFiles["logs/34_dailies.csv"] = toCSV(dailies.map(d => ({
						itemId: d.itemId, date: d.getDataValue("date" as keyof typeof d)
					})));
				}

				// 35. New pets obtained
				const newPets = await LogsPlayersNewPets.findAll({ where: { playerId: logsPlayerId } });
				if (newPets.length > 0) {
					csvFiles["logs/35_pets_obtained.csv"] = toCSV(newPets.map(p => ({
						petId: p.petId, date: p.date
					})));
				}

				// 36. Commands used (anonymized - only command name, not content)
				const commands = await LogsPlayersCommands.findAll({ where: { playerId: logsPlayerId } });
				if (commands.length > 0) {
					csvFiles["logs/36_commands_used.csv"] = toCSV(commands.map(c => ({
						commandId: c.commandId, date: c.date
					})));
				}

				// 37. Top 15 best season appearances
				const best15Season = await LogsPlayers15BestSeason.findAll({ where: { playerId: logsPlayerId } });
				if (best15Season.length > 0) {
					csvFiles["logs/37_top15_season.csv"] = toCSV(best15Season.map(b => ({
						position: b.position, seasonGlory: b.seasonGlory, date: b.date
					})));
				}

				// 38. Top 15 best topweek appearances
				const best15Topweek = await LogsPlayers15BestTopweek.findAll({ where: { playerId: logsPlayerId } });
				if (best15Topweek.length > 0) {
					csvFiles["logs/38_top15_topweek.csv"] = toCSV(best15Topweek.map(b => ({
						position: b.position, topWeekScore: b.topWeekScore, date: b.date
					})));
				}

				// 39. League rewards
				const leagueRewards = await LogsPlayerLeagueReward.findAll({ where: { playerId: logsPlayerId } });
				if (leagueRewards.length > 0) {
					csvFiles["logs/39_league_rewards.csv"] = toCSV(leagueRewards.map(l => ({
						leagueLastSeason: l.leagueLastSeason, date: l.date
					})));
				}

				// 40. Missions found
				const missionsFound = await LogsMissionsFound.findAll({ where: { playerId: logsPlayerId } });
				if (missionsFound.length > 0) {
					csvFiles["logs/40_missions_found.csv"] = toCSV(missionsFound.map(m => ({
						missionId: m.missionId, date: m.date
					})));
				}

				// 41. Missions finished
				const missionsFinished = await LogsMissionsFinished.findAll({ where: { playerId: logsPlayerId } });
				if (missionsFinished.length > 0) {
					csvFiles["logs/41_missions_finished.csv"] = toCSV(missionsFinished.map(m => ({
						missionId: m.missionId, date: m.date
					})));
				}

				// 42. Missions failed
				const missionsFailed = await LogsMissionsFailed.findAll({ where: { playerId: logsPlayerId } });
				if (missionsFailed.length > 0) {
					csvFiles["logs/42_missions_failed.csv"] = toCSV(missionsFailed.map(m => ({
						missionId: m.missionId, date: m.date
					})));
				}

				// 43. Daily missions finished
				const missionsDailyFinished = await LogsMissionsDailyFinished.findAll({ where: { playerId: logsPlayerId } });
				if (missionsDailyFinished.length > 0) {
					csvFiles["logs/43_daily_missions_finished.csv"] = toCSV(missionsDailyFinished.map(m => ({
						date: m.date
					})));
				}

				// 44. Campaign progresses
				const campaignProgresses = await LogsMissionsCampaignProgresses.findAll({ where: { playerId: logsPlayerId } });
				if (campaignProgresses.length > 0) {
					csvFiles["logs/44_campaign_progresses.csv"] = toCSV(campaignProgresses.map(c => ({
						number: c.number, date: c.date
					})));
				}

				// 45. PvP Fights (where player was initiator OR opponent)
				const fightsAsInitiator = await LogsFightsResults.findAll({ where: { fightInitiatorId: logsPlayerId } });
				const fightsAsOpponent = await LogsFightsResults.findAll({ where: { player2Id: logsPlayerId } });
				const allFights = [
					...fightsAsInitiator.map(f => ({
						fightId: f.id,
						role: "initiator",
						opponentId: anonymizer.anonymizePlayerId(f.player2Id, false),
						myPoints: f.fightInitiatorPoints,
						opponentPoints: f.player2Points,
						turns: f.turn,
						winner: f.winner === 1 ? "me" : f.winner === 2 ? "opponent" : "draw",
						friendly: f.friendly,
						date: f.date
					})),
					...fightsAsOpponent.map(f => ({
						fightId: f.id,
						role: "opponent",
						opponentId: anonymizer.anonymizePlayerId(f.fightInitiatorId, false),
						myPoints: f.player2Points,
						opponentPoints: f.fightInitiatorPoints,
						turns: f.turn,
						winner: f.winner === 2 ? "me" : f.winner === 1 ? "opponent" : "draw",
						friendly: f.friendly,
						date: f.date
					}))
				];
				if (allFights.length > 0) {
					csvFiles["logs/45_pvp_fights.csv"] = toCSV(allFights);
				}

				// 46. Fight actions used (for player's fights)
				const fightIds = [...new Set([...fightsAsInitiator.map(f => f.id), ...fightsAsOpponent.map(f => f.id)])];
				if (fightIds.length > 0) {
					const fightActions = await LogsFightsActionsUsed.findAll({ where: { fightId: { [Op.in]: fightIds } } });
					if (fightActions.length > 0) {
						csvFiles["logs/46_pvp_fight_actions.csv"] = toCSV(fightActions.map(a => ({
							fightId: a.fightId, actionId: a.actionId, player: a.player, count: a.count
						})));
					}
				}

				// 47. PvE Fights
				const pveFights = await LogsPveFightsResults.findAll({ where: { playerId: logsPlayerId } });
				if (pveFights.length > 0) {
					csvFiles["logs/47_pve_fights.csv"] = toCSV(pveFights.map(f => ({
						monsterId: f.monsterId, turns: f.turn, winner: f.winner, date: f.date
					})));
				}

				// 48. PvE fight actions
				const pveFightIds = pveFights.map(f => f.id);
				if (pveFightIds.length > 0) {
					const pveActions = await LogsPveFightsActionsUsed.findAll({ where: { pveFightId: { [Op.in]: pveFightIds } } });
					if (pveActions.length > 0) {
						csvFiles["logs/48_pve_fight_actions.csv"] = toCSV(pveActions.map(a => ({
							pveFightId: a.pveFightId, actionId: a.actionId, count: a.count
						})));
					}
				}

				// 49. Classical shop buyouts
				const classicalBuyouts = await LogsClassicalShopBuyouts.findAll({ where: { playerId: logsPlayerId } });
				if (classicalBuyouts.length > 0) {
					csvFiles["logs/49_classical_shop_buyouts.csv"] = toCSV(classicalBuyouts.map(b => ({
						shopItem: b.shopItem, amount: b.amount, date: b.date
					})));
				}

				// 50. Guild shop buyouts
				const guildBuyouts = await LogsGuildShopBuyouts.findAll({ where: { playerId: logsPlayerId } });
				if (guildBuyouts.length > 0) {
					csvFiles["logs/50_guild_shop_buyouts.csv"] = toCSV(guildBuyouts.map(b => ({
						shopItem: b.shopItem, amount: b.amount, date: b.date
					})));
				}

				// 51. Mission shop buyouts
				const missionBuyouts = await LogsMissionShopBuyouts.findAll({ where: { playerId: logsPlayerId } });
				if (missionBuyouts.length > 0) {
					csvFiles["logs/51_mission_shop_buyouts.csv"] = toCSV(missionBuyouts.map(b => ({
						shopItem: b.shopItem, date: b.date
					})));
				}

				// 52-55. Item gains (armor, weapon, object, potion)
				const armorGains = await LogsItemGainsArmor.findAll({ where: { playerId: logsPlayerId } });
				if (armorGains.length > 0) {
					csvFiles["logs/52_item_gains_armor.csv"] = toCSV(armorGains.map(i => ({
						itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
					})));
				}
				const weaponGains = await LogsItemGainsWeapon.findAll({ where: { playerId: logsPlayerId } });
				if (weaponGains.length > 0) {
					csvFiles["logs/53_item_gains_weapon.csv"] = toCSV(weaponGains.map(i => ({
						itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
					})));
				}
				const objectGains = await LogsItemGainsObject.findAll({ where: { playerId: logsPlayerId } });
				if (objectGains.length > 0) {
					csvFiles["logs/54_item_gains_object.csv"] = toCSV(objectGains.map(i => ({
						itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
					})));
				}
				const potionGains = await LogsItemGainsPotion.findAll({ where: { playerId: logsPlayerId } });
				if (potionGains.length > 0) {
					csvFiles["logs/55_item_gains_potion.csv"] = toCSV(potionGains.map(i => ({
						itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
					})));
				}

				// 56-59. Item sells
				const armorSells = await LogsItemSellsArmor.findAll({ where: { playerId: logsPlayerId } });
				if (armorSells.length > 0) {
					csvFiles["logs/56_item_sells_armor.csv"] = toCSV(armorSells.map(i => ({
						itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
					})));
				}
				const weaponSells = await LogsItemSellsWeapon.findAll({ where: { playerId: logsPlayerId } });
				if (weaponSells.length > 0) {
					csvFiles["logs/57_item_sells_weapon.csv"] = toCSV(weaponSells.map(i => ({
						itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
					})));
				}
				const objectSells = await LogsItemSellsObject.findAll({ where: { playerId: logsPlayerId } });
				if (objectSells.length > 0) {
					csvFiles["logs/58_item_sells_object.csv"] = toCSV(objectSells.map(i => ({
						itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
					})));
				}
				const potionSells = await LogsItemSellsPotion.findAll({ where: { playerId: logsPlayerId } });
				if (potionSells.length > 0) {
					csvFiles["logs/59_item_sells_potion.csv"] = toCSV(potionSells.map(i => ({
						itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
					})));
				}

				// 60. Guilds created
				const guildsCreated = await LogsGuildsCreations.findAll({ where: { creatorId: logsPlayerId } });
				if (guildsCreated.length > 0) {
					csvFiles["logs/60_guilds_created.csv"] = toCSV(guildsCreated.map(g => ({
						guildId: anonymizer.anonymizeGuildId(g.guildId), date: g.date
					})));
				}

				// 61. Guilds joined (as the one being added)
				const guildsJoined = await LogsGuildsJoins.findAll({ where: { addedId: logsPlayerId } });
				if (guildsJoined.length > 0) {
					csvFiles["logs/61_guilds_joined.csv"] = toCSV(guildsJoined.map(g => ({
						guildId: anonymizer.anonymizeGuildId(g.guildId),
						addedBy: anonymizer.anonymizePlayerId(g.adderId, false),
						date: g.date
					})));
				}

				// 62. Guilds kicked from
				const guildsKicked = await LogsGuildsKicks.findAll({ where: { kickedPlayer: logsPlayerId } });
				if (guildsKicked.length > 0) {
					csvFiles["logs/62_guilds_kicked.csv"] = toCSV(guildsKicked.map(g => ({
						guildId: anonymizer.anonymizeGuildId(g.guildId), date: g.date
					})));
				}

				// 63. Guilds left
				const guildsLeft = await LogsGuildsLeaves.findAll({ where: { leftPlayer: logsPlayerId } });
				if (guildsLeft.length > 0) {
					csvFiles["logs/63_guilds_left.csv"] = toCSV(guildsLeft.map(g => ({
						guildId: anonymizer.anonymizeGuildId(g.guildId), date: g.date
					})));
				}

				// 64. Became guild chief
				const becameChief = await LogsGuildsChiefsChanges.findAll({ where: { newChief: logsPlayerId } });
				if (becameChief.length > 0) {
					csvFiles["logs/64_became_guild_chief.csv"] = toCSV(becameChief.map(g => ({
						guildId: anonymizer.anonymizeGuildId(g.guildId), date: g.date
					})));
				}

				// 65. Became guild elder
				const becameElder = await LogsGuildsEldersAdds.findAll({ where: { addedElder: logsPlayerId } });
				if (becameElder.length > 0) {
					csvFiles["logs/65_became_guild_elder.csv"] = toCSV(becameElder.map(g => ({
						guildId: anonymizer.anonymizeGuildId(g.guildId), date: g.date
					})));
				}

				// 66. Removed from guild elder
				const removedElder = await LogsGuildsEldersRemoves.findAll({ where: { removedElder: logsPlayerId } });
				if (removedElder.length > 0) {
					csvFiles["logs/66_removed_guild_elder.csv"] = toCSV(removedElder.map(g => ({
						guildId: anonymizer.anonymizeGuildId(g.guildId), date: g.date
					})));
				}

				// 67. Guild descriptions written by this player
				const descriptionsWritten = await LogsGuildsDescriptionChanges.findAll({ where: { playerId: logsPlayerId } });
				if (descriptionsWritten.length > 0) {
					csvFiles["logs/67_guild_descriptions_written.csv"] = toCSV(descriptionsWritten.map(d => ({
						guildId: anonymizer.anonymizeGuildId(d.guildId),
						description: d.description,
						date: d.date
					})));
				}

				// 68. Pets sold
				const petsSold = await LogsPetsSells.findAll({ where: { sellerId: logsPlayerId } });
				if (petsSold.length > 0) {
					csvFiles["logs/68_pets_sold.csv"] = toCSV(petsSold.map(p => ({
						petId: p.petId,
						buyerId: anonymizer.anonymizePlayerId(p.buyerId, false),
						price: p.price,
						date: p.date
					})));
				}

				// 69. Pets bought
				const petsBought = await LogsPetsSells.findAll({ where: { buyerId: logsPlayerId } });
				if (petsBought.length > 0) {
					csvFiles["logs/69_pets_bought.csv"] = toCSV(petsBought.map(p => ({
						petId: p.petId,
						sellerId: anonymizer.anonymizePlayerId(p.sellerId, false),
						price: p.price,
						date: p.date
					})));
				}

				// 70. Expeditions
				const expeditions = await LogsExpeditions.findAll({ where: { playerId: logsPlayerId } });
				if (expeditions.length > 0) {
					csvFiles["logs/70_expeditions.csv"] = toCSV(expeditions.map(e => ({
						petId: e.petId,
						mapLocationId: e.mapLocationId,
						locationType: e.locationType,
						action: e.action,
						durationMinutes: e.durationMinutes,
						foodConsumed: e.foodConsumed,
						success: e.success,
						money: e.money,
						experience: e.experience,
						points: e.points,
						tokens: e.tokens,
						loveChange: e.loveChange,
						date: e.date
					})));
				}

				// 71. Unlocks (bought freedom)
				const unlocksBuyer = await LogsUnlocks.findAll({ where: { buyerId: logsPlayerId } });
				if (unlocksBuyer.length > 0) {
					csvFiles["logs/71_unlocks_bought.csv"] = toCSV(unlocksBuyer.map(u => ({
						freedPlayerId: anonymizer.anonymizePlayerId(u.releasedId, false),
						date: u.date
					})));
				}

				// 72. Unlocks (was freed by someone)
				const unlocksFreed = await LogsUnlocks.findAll({ where: { releasedId: logsPlayerId } });
				if (unlocksFreed.length > 0) {
					csvFiles["logs/72_unlocks_received.csv"] = toCSV(unlocksFreed.map(u => ({
						buyerId: anonymizer.anonymizePlayerId(u.buyerId, false),
						date: u.date
					})));
				}

				/*
				 * 73. Pet nicknames (need to find pet entities owned by player first)
				 * Get all pets ever owned by this player from logs
				 */
				const playerPetIds = newPets.map(p => p.petId);
				if (playerPetIds.length > 0) {
					const petNicknames = await LogsPetsNicknames.findAll({ where: { petId: { [Op.in]: playerPetIds } } });
					if (petNicknames.length > 0) {
						csvFiles["logs/73_pet_nicknames.csv"] = toCSV(petNicknames.map(n => ({
							petId: n.petId, name: n.name, date: n.date
						})));
					}
				}

				// 74. Guild names (for guilds created by this player)
				const createdGuildIds = guildsCreated.map(g => g.guildId);
				if (createdGuildIds.length > 0) {
					const guildNames = await LogsGuilds.findAll({ where: { id: { [Op.in]: createdGuildIds } } });
					if (guildNames.length > 0) {
						csvFiles["logs/74_guild_names_created.csv"] = toCSV(guildNames.map(g => ({
							guildId: anonymizer.anonymizeGuildId(g.id),
							name: g.name,
							creationTimestamp: g.creationTimestamp
						})));
					}
				}
			}

			// Add metadata file
			csvFiles["00_metadata.csv"] = toCSV([
				{
					exportDate: new Date().toISOString(),
					anonymizedPlayerId: anonymizer.getAnonymizedPlayerId(),
					gdprArticle: "Art. 15 GDPR - Right of access",
					dataRetentionNote: "This export contains all personal data processed about you. IDs referencing other players have been anonymized.",
					fileCount: Object.keys(csvFiles).length + 1 // +1 for metadata itself
				}
			]);

			response.push(makePacket(CommandExportGDPRRes, {
				exists: true,
				csvFiles,
				anonymizedPlayerId: anonymizer.getAnonymizedPlayerId()
			}));
		}
		catch (error) {
			response.push(makePacket(CommandExportGDPRRes, {
				exists: true,
				error: error instanceof Error ? error.message : "Unknown error during export",
				csvFiles: {},
				anonymizedPlayerId: anonymizer.getAnonymizedPlayerId()
			}));
		}
	}
}
