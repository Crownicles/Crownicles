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
