import { GDPRAnonymizer } from "../GDPRAnonymizer";
import {
	toCSV, GDPRCsvFiles
} from "../CSVUtils";
import { Players } from "../../../../core/database/game/models/Player";
import { PlayerBadges } from "../../../../core/database/game/models/PlayerBadges";
import { InventorySlots } from "../../../../core/database/game/models/InventorySlot";
import { InventoryInfo } from "../../../../core/database/game/models/InventoryInfo";
import { MissionSlot } from "../../../../core/database/game/models/MissionSlot";
import { PlayerMissionsInfo } from "../../../../core/database/game/models/PlayerMissionsInfo";
import { PlayerSmallEvent } from "../../../../core/database/game/models/PlayerSmallEvent";
import PetEntity from "../../../../core/database/game/models/PetEntity";
import PetExpedition from "../../../../core/database/game/models/PetExpedition";
import { GuildPets } from "../../../../core/database/game/models/GuildPet";
import { Guilds } from "../../../../core/database/game/models/Guild";
import { ScheduledDailyBonusNotification } from "../../../../core/database/game/models/ScheduledDailyBonusNotification";
import { ScheduledReportNotification } from "../../../../core/database/game/models/ScheduledReportNotification";
import { ScheduledExpeditionNotification } from "../../../../core/database/game/models/ScheduledExpeditionNotification";
import { DwarfPetsSeen } from "../../../../core/database/game/models/DwarfPetsSeen";
import { PlayerTalismans } from "../../../../core/database/game/models/PlayerTalismans";
import { Material } from "../../../../core/database/game/models/Material";
import { Homes } from "../../../../core/database/game/models/Home";
import { PlayerPlantSlot } from "../../../../core/database/game/models/PlayerPlantSlot";
import { Apartments } from "../../../../core/database/game/models/Apartment";
import { HomeChestSlots } from "../../../../core/database/game/models/HomeChestSlot";
import { HomeGardenSlots } from "../../../../core/database/game/models/HomeGardenSlot";
import { HomePlantStorages } from "../../../../core/database/game/models/HomePlantStorage";
import { PlayerCookingRecipe } from "../../../../core/database/game/models/PlayerCookingRecipe";
import { GlobalBlessing } from "../../../../core/database/game/models/GlobalBlessing";

type Player = Awaited<ReturnType<typeof Players.getByKeycloakId>>;

/**
 * Determines the player's role in a guild
 */
function getGuildRole(guild: {
	chiefId: number; elderId: number | null;
}, playerId: number): string {
	if (guild.chiefId === playerId) {
		return "chief";
	}
	if (guild.elderId === playerId) {
		return "elder";
	}
	return "member";
}

/**
 * Exports player inventory data (files 02-04)
 */
async function exportInventoryData(
	playerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const badges = await PlayerBadges.findAll({ where: { playerId } });
	if (badges.length > 0) {
		csvFiles["02_badges.csv"] = toCSV(badges.map(badge => ({
			badge: badge.badge,
			createdAt: badge.createdAt,
			updatedAt: badge.updatedAt
		})));
	}

	const inventorySlots = await InventorySlots.getOfPlayer(playerId);
	if (inventorySlots.length > 0) {
		csvFiles["03_inventory_slots.csv"] = toCSV(inventorySlots.map(slot => ({
			slotId: slot.slot,
			itemCategory: slot.itemCategory,
			itemId: slot.itemId,
			itemLevel: slot.itemLevel,
			itemEnchantmentId: slot.itemEnchantmentId,
			remainingPotionUsages: slot.remainingPotionUsages,
			createdAt: slot.createdAt,
			updatedAt: slot.updatedAt
		})));
	}

	const inventoryInfo = await InventoryInfo.findOne({ where: { playerId } });
	if (inventoryInfo) {
		csvFiles["04_inventory_info.csv"] = toCSV([
			{
				lastDailyAt: inventoryInfo.lastDailyAt,
				weaponSlots: inventoryInfo.weaponSlots,
				armorSlots: inventoryInfo.armorSlots,
				objectSlots: inventoryInfo.objectSlots,
				potionSlots: inventoryInfo.potionSlots,
				plantSlots: inventoryInfo.plantSlots,
				createdAt: inventoryInfo.createdAt,
				updatedAt: inventoryInfo.updatedAt
			}
		]);
	}
}

/**
 * Exports mission-related data (files 05-06)
 */
async function exportMissionData(
	playerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const missionSlots = await MissionSlot.findAll({ where: { playerId } });
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
			saveBlob: slot.saveBlob?.toString("base64"),
			isCampaign: slot.isCampaign(),
			createdAt: slot.createdAt,
			updatedAt: slot.updatedAt
		})));
	}

	const missionsInfo = await PlayerMissionsInfo.findOne({ where: { playerId } });
	if (missionsInfo) {
		csvFiles["06_missions_info.csv"] = toCSV([
			{
				gems: missionsInfo.gems,
				hasBoughtPointsThisWeek: missionsInfo.hasBoughtPointsThisWeek,
				missionSkipsUsedThisWeek: missionsInfo.missionSkipsUsedThisWeek,
				dailyMissionNumberDone: missionsInfo.dailyMissionNumberDone,
				lastDailyMissionCompleted: missionsInfo.lastDailyMissionCompleted,
				dailyMissionBlob: missionsInfo.dailyMissionBlob?.toString("base64"),
				campaignProgression: missionsInfo.campaignProgression,
				campaignBlob: missionsInfo.campaignBlob,
				createdAt: missionsInfo.createdAt,
				updatedAt: missionsInfo.updatedAt
			}
		]);
	}
}

/**
 * Exports pet-related data (files 07-08)
 */
async function exportPetData(
	player: NonNullable<Player>,
	csvFiles: GDPRCsvFiles
): Promise<void> {
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
					creationDate: pet.creationDate,
					createdAt: pet.createdAt,
					updatedAt: pet.updatedAt
				}
			]);
		}
	}

	const petExpeditions = await PetExpedition.findAll({ where: { playerId: player.id } });
	if (petExpeditions.length > 0) {
		csvFiles["08_pet_expeditions.csv"] = toCSV(petExpeditions.map(exp => ({
			petId: exp.petId,
			startDate: exp.startDate,
			endDate: exp.endDate,
			riskRate: exp.riskRate,
			difficulty: exp.difficulty,
			wealthRate: exp.wealthRate,
			locationType: exp.locationType,
			mapLocationId: exp.mapLocationId,
			status: exp.status,
			foodConsumed: exp.foodConsumed,
			rewardIndex: exp.rewardIndex,
			isDistantExpedition: exp.isDistantExpedition,
			hasBonusTokens: exp.hasBonusTokens,
			hasCloneTalismanBonus: exp.hasCloneTalismanBonus,
			createdAt: exp.createdAt,
			updatedAt: exp.updatedAt
		})));
	}
}

async function exportScheduledNotifications(player: NonNullable<Player>, csvFiles: GDPRCsvFiles): Promise<void> {
	const dailyBonusNotifs = await ScheduledDailyBonusNotification.findAll({ where: { playerId: player.id } });
	const reportNotifs = await ScheduledReportNotification.findAll({ where: { playerId: player.id } });
	const expeditionNotifs = await ScheduledExpeditionNotification.findAll({ where: { keycloakId: player.keycloakId } });

	const notifications = [
		...dailyBonusNotifs.map(n => ({
			type: "dailyBonus",
			mapId: "",
			expeditionId: "",
			petId: "",
			petSex: "",
			petNickname: "",
			scheduledAt: n.scheduledAt,
			createdAt: n.createdAt,
			updatedAt: n.updatedAt
		})),
		...reportNotifs.map(n => ({
			type: "report",
			mapId: n.mapId,
			expeditionId: "",
			petId: "",
			petSex: "",
			petNickname: "",
			scheduledAt: n.scheduledAt,
			createdAt: n.createdAt,
			updatedAt: n.updatedAt
		})),
		...expeditionNotifs.map(n => ({
			type: "expedition",
			mapId: "",
			expeditionId: n.expeditionId,
			petId: n.petId,
			petSex: n.petSex,
			petNickname: n.petNickname ?? "",
			scheduledAt: n.scheduledAt,
			createdAt: n.createdAt,
			updatedAt: n.updatedAt
		}))
	];
	if (notifications.length > 0) {
		csvFiles["12_scheduled_notifications.csv"] = toCSV(notifications);
	}
}

async function exportCurrentBlessing(player: NonNullable<Player>, csvFiles: GDPRCsvFiles): Promise<void> {
	const currentBlessing = await GlobalBlessing.findOne({ where: { lastTriggeredByKeycloakId: player.keycloakId } });
	if (currentBlessing) {
		csvFiles["23_current_blessing.csv"] = toCSV([
			{
				triggeredByExportedPlayer: true,
				activeBlessingType: currentBlessing.activeBlessingType,
				poolAmount: currentBlessing.poolAmount,
				poolThreshold: currentBlessing.poolThreshold,
				poolStartedAt: currentBlessing.poolStartedAt,
				blessingEndAt: currentBlessing.blessingEndAt,
				lastBlessingTriggeredAt: currentBlessing.lastBlessingTriggeredAt,
				createdAt: currentBlessing.createdAt,
				updatedAt: currentBlessing.updatedAt
			}
		]);
	}
}

async function exportPlayerMaterials(playerId: number, csvFiles: GDPRCsvFiles): Promise<void> {
	const materials = await Material.findAll({ where: { playerId } });
	if (materials.length > 0) {
		csvFiles["15_materials.csv"] = toCSV(materials.map(material => ({
			materialId: material.materialId,
			quantity: material.quantity,
			createdAt: material.createdAt,
			updatedAt: material.updatedAt
		})));
	}
}

/**
 * Exports miscellaneous player data (files 09-12)
 */
async function exportMiscData(
	player: NonNullable<Player>,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const smallEvents = await PlayerSmallEvent.findAll({ where: { playerId: player.id } });
	if (smallEvents.length > 0) {
		csvFiles["09_small_events.csv"] = toCSV(smallEvents.map(se => ({
			eventType: se.eventType,
			time: se.time,
			createdAt: se.createdAt,
			updatedAt: se.updatedAt
		})));
	}

	const talismans = await PlayerTalismans.findOne({ where: { playerId: player.id } });
	if (talismans) {
		csvFiles["10_talismans.csv"] = toCSV([
			{
				hasTalisman: talismans.hasTalisman,
				hasCloneTalisman: talismans.hasCloneTalisman,
				hasRemoteHarvestTalisman: talismans.hasRemoteHarvestTalisman,
				createdAt: talismans.createdAt,
				updatedAt: talismans.updatedAt
			}
		]);
	}

	const dwarfPets = await DwarfPetsSeen.findAll({ where: { playerId: player.id } });
	if (dwarfPets.length > 0) {
		csvFiles["11_dwarf_pets_seen.csv"] = toCSV(dwarfPets.map(dp => ({
			petTypeId: dp.petTypeId
		})));
	}

	await exportScheduledNotifications(player, csvFiles);
	await exportCurrentBlessing(player, csvFiles);
	await exportPlayerMaterials(player.id, csvFiles);

	// Player home (and home-scoped data: chest, garden, plant storage)
	const home = await Homes.getOfPlayer(player.id);
	if (home) {
		csvFiles["16_home.csv"] = toCSV([
			{
				cityId: home.cityId,
				level: home.level,
				createdAt: home.createdAt,
				updatedAt: home.updatedAt
			}
		]);
		await exportHomeScopedData(home.id, csvFiles);
	}

	// Player plant slots
	await exportPlayerPlantSlots(player.id, csvFiles);

	// Player apartments (extra remote-access homes purchased in other cities)
	await exportPlayerApartments(player.id, csvFiles);

	// Player cooking recipes discovered
	await exportPlayerCookingRecipes(player.id, csvFiles);
}

async function exportPlayerPlantSlots(playerId: number, csvFiles: GDPRCsvFiles): Promise<void> {
	const plantSlots = await PlayerPlantSlot.findAll({ where: { playerId } });
	if (plantSlots.length > 0) {
		csvFiles["17_plant_slots.csv"] = toCSV(plantSlots.map(slot => ({
			slotType: slot.slotType,
			slot: slot.slot,
			plantId: slot.plantId,
			createdAt: slot.createdAt,
			updatedAt: slot.updatedAt
		})));
	}
}

async function exportHomeScopedData(homeId: number, csvFiles: GDPRCsvFiles): Promise<void> {
	// 18. Home chest slots (items stored in the player's home)
	const chestSlots = await HomeChestSlots.getOfHome(homeId);
	const filledChestSlots = chestSlots.filter(s => s.itemId !== 0);
	if (filledChestSlots.length > 0) {
		csvFiles["18_home_chest_slots.csv"] = toCSV(filledChestSlots.map(slot => ({
			slot: slot.slot,
			itemCategory: slot.itemCategory,
			itemId: slot.itemId,
			itemLevel: slot.itemLevel,
			itemEnchantmentId: slot.itemEnchantmentId,
			remainingPotionUsages: slot.remainingPotionUsages,
			createdAt: slot.createdAt,
			updatedAt: slot.updatedAt
		})));
	}

	// 19. Home garden slots (plants currently growing)
	const gardenSlots = await HomeGardenSlots.getOfHome(homeId);
	const plantedGardenSlots = gardenSlots.filter(s => s.plantId !== 0);
	if (plantedGardenSlots.length > 0) {
		csvFiles["19_home_garden_slots.csv"] = toCSV(plantedGardenSlots.map(slot => ({
			slot: slot.slot,
			plantId: slot.plantId,
			plantedAt: slot.plantedAt,
			createdAt: slot.createdAt,
			updatedAt: slot.updatedAt
		})));
	}

	// 20. Home plant storage (harvested plants stockpiled at home)
	const plantStorage = await HomePlantStorages.getOfHome(homeId);
	if (plantStorage.length > 0) {
		csvFiles["20_home_plant_storage.csv"] = toCSV(plantStorage.map(entry => ({
			plantId: entry.plantId,
			quantity: entry.quantity,
			createdAt: entry.createdAt,
			updatedAt: entry.updatedAt
		})));
	}
}

async function exportPlayerApartments(playerId: number, csvFiles: GDPRCsvFiles): Promise<void> {
	const apartments = await Apartments.getOfPlayer(playerId);
	if (apartments.length > 0) {
		csvFiles["21_apartments.csv"] = toCSV(apartments.map(a => ({
			cityId: a.cityId,
			purchasePrice: a.purchasePrice,
			lastRentClaimedAt: a.lastRentClaimedAt,
			createdAt: a.createdAt,
			updatedAt: a.updatedAt
		})));
	}
}

async function exportPlayerCookingRecipes(playerId: number, csvFiles: GDPRCsvFiles): Promise<void> {
	const recipes = await PlayerCookingRecipe.findAll({ where: { playerId } });
	if (recipes.length > 0) {
		csvFiles["22_cooking_recipes.csv"] = toCSV(recipes.map(r => ({
			recipeId: r.recipeId,
			sourceMapId: r.sourceMapId
		})));
	}
}

/**
 * Exports guild-related data (files 13-14)
 */
async function exportGuildData(
	player: NonNullable<Player>,
	anonymizer: GDPRAnonymizer,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	if (!player.guildId) {
		return;
	}

	const guild = await Guilds.getById(player.guildId);
	if (guild) {
		csvFiles["13_guild_membership.csv"] = toCSV([
			{
				guildId: anonymizer.anonymizeGuildId(player.guildId),
				role: getGuildRole(guild, player.id)
			}
		]);
	}

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

/**
 * Exports player core data from the game database (files 01-23)
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
			banned: player.banned,
			health: player.getHealthValue(),
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
			insideCity: player.insideCity,
			lastActivityAt: player.lastActivityAt,
			lastPetFree: player.lastPetFree,
			nextEvent: player.nextEvent,
			lastMealAt: player.lastMealAt,
			cookingLevel: player.cookingLevel,
			cookingExperience: player.cookingExperience,
			lastBedUsedAt: player.lastBedUsedAt,
			furnacePosition: player.furnacePosition,
			pinnedCookingRecipeId: player.pinnedCookingRecipeId,
			lastGardenWatered: player.lastGardenWatered,
			createdAt: player.createdAt,
			updatedAt: player.updatedAt
		}
	]);

	// 2-4. Inventory data
	await exportInventoryData(player.id, csvFiles);

	// 5-6. Mission data
	await exportMissionData(player.id, csvFiles);

	// 7-8. Pet data
	await exportPetData(player, csvFiles);

	// 9-12. Miscellaneous data
	await exportMiscData(player, csvFiles);

	// 13-14. Guild data
	await exportGuildData(player, anonymizer, csvFiles);
}
