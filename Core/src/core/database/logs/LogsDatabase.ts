import { Database } from "../../../../../Lib/src/database/Database";
import { LogsPlayersMoney } from "./models/LogsPlayersMoney";
import { LogsPlayers } from "./models/LogsPlayers";
import { LogsPlayersHealth } from "./models/LogsPlayersHealth";
import { LogsPlayersExperience } from "./models/LogsPlayersExperience";
import {
	CreateOptions, Model, ModelStatic
} from "sequelize";
import { LogsPlayersLevel } from "./models/LogsPlayersLevel";
import { LogsPlayersScore } from "./models/LogsPlayersScore";
import { LogsPlayersGems } from "./models/LogsPlayersGems";
import { LogsCommands } from "./models/LogsCommands";
import { LogsPlayersCommands } from "./models/LogsPlayersCommands";
import { LogsSmallEvents } from "./models/LogsSmallEvents";
import { LogsPlayersSmallEvents } from "./models/LogsPlayersSmallEvents";
import { LogsPossibilities } from "./models/LogsPossibilities";
import { LogsPlayersPossibilities } from "./models/LogsPlayersPossibilities";
import { LogsAlterations } from "./models/LogsAlterations";
import { LogsPlayersStandardAlterations } from "./models/LogsPlayersStandardAlterations";
import { LogsPlayersOccupiedAlterations } from "./models/LogsPlayersOccupiedAlterations";
import { LogsUnlocks } from "./models/LogsUnlocks";
import { LogsPlayersClassChanges } from "./models/LogsPlayersClassChanges";
import { LogsPlayersTravels } from "./models/LogsPlayersTravels";
import { LogsMapLinks } from "./models/LogsMapLinks";
import { LogsMissionsFailed } from "./models/LogsMissionsFailed";
import { LogsMissionsFinished } from "./models/LogsMissionsFinished";
import { LogsMissionsFound } from "./models/LogsMissionsFound";
import { LogsMissionsDailyFinished } from "./models/LogsMissionsDailyFinished";
import { LogsMissionsDaily } from "./models/LogsMissionsDaily";
import { LogsMissionsCampaignProgresses } from "./models/LogsMissionsCampaignProgresses";
import { LogsMissions } from "./models/LogsMissions";
import { LogsPlayers15BestTopweek } from "./models/LogsPlayers15BestTopweek";
import { LogsItemGainsArmor } from "./models/LogsItemsGainsArmor";
import { LogsItemGainsObject } from "./models/LogsItemsGainsObject";
import { LogsItemGainsPotion } from "./models/LogsItemsGainsPotion";
import { LogsItemGainsWeapon } from "./models/LogsItemsGainsWeapon";
import { LogsItemSellsArmor } from "./models/LogsItemsSellsArmor";
import { LogsItemSellsObject } from "./models/LogsItemsSellsObject";
import { LogsItemSellsPotion } from "./models/LogsItemsSellsPotion";
import { LogsItemSellsWeapon } from "./models/LogsItemsSellsWeapon";
import { LogsPlayersTimewarps } from "./models/LogsPlayersTimewarps";
import PetEntity from "../game/models/PetEntity";
import { LogsPetsNicknames } from "./models/LogsPetsNicknames";
import { LogsPetEntities } from "./models/LogsPetEntities";
import { Guild } from "../game/models/Guild";
import { LogsGuilds } from "./models/LogsGuilds";
import {
	Player, Players
} from "../game/models/Player";
import { LogsGuildsKicks } from "./models/LogsGuildsKicks";
import { LogsDailyPotions } from "./models/LogsDailyPotions";
import { LogsClassicalShopBuyouts } from "./models/LogsClassicalShopBuyouts";
import { LogsGuildShopBuyouts } from "./models/LogsGuildShopBuyouts";
import { LogsMissionShopBuyouts } from "./models/LogsMissionShopBuyouts";
import { LogsDailyTimeouts } from "./models/LogsDailyTimeouts";
import { LogsTopWeekEnd } from "./models/LogsTopWeekEnd";
import { GuildDailyConstants } from "../../../../../Lib/src/constants/GuildDailyConstants";
import { LogsGuildsDailies } from "./models/LogsGuildsDailies";
import { LogsPetsTransfers } from "./models/LogsPetsTransfers";
import { LogsGuildsLeaves } from "./models/LogsGuildsLeaves";
import { LogsGuildsDestroys } from "./models/LogsGuildsDestroys";
import { LogsGuildsEldersRemoves } from "./models/LogsGuildsEldersRemoves";
import { LogsGuildsChiefsChanges } from "./models/LogsGuildsChiefsChanges";
import { LogsPetsFrees } from "./models/LogsPetsFrees";
import { LogsFightsResults } from "./models/LogsFightsResults";
import { LogsFightsActionsUsed } from "./models/LogsFightsActionsUsed";
import { LogsFightsActions } from "./models/LogsFightsActions";
import { LogsGuildsCreations } from "./models/LogsGuildCreations";
import { LogsGuildsJoins } from "./models/LogsGuildJoins";
import { LogsGuildsExperiences } from "./models/LogsGuildsExperiences";
import { LogsGuildsLevels } from "./models/LogsGuildsLevels";
import { LogsGuildsDescriptionChanges } from "./models/LogsGuildsDescriptionChanges";
import { LogsGuildsEldersAdds } from "./models/LogsGuildsEldersAdds";
import { LogsPetsSells } from "./models/LogsPetsSells";
import { LogsPetsLovesChanges } from "./models/LogsPetsLovesChanges";
import { LogsGuildsFoodsChanges } from "./models/LogsGuildsFoodsChanges";
import { LogsGuildsNewPets } from "./models/LogsGuildsNewPets";
import { LogsPlayersNewPets } from "./models/LogsPlayersNewPets";
import { LogsPlayersDailies } from "./models/LogsPlayersDailies";
import {
	NumberChangeReason, ShopItemType
} from "../../../../../Lib/src/constants/LogsConstants";
import { getDateLogs } from "../../../../../Lib/src/utils/TimeUtils";
import { LogsPlayersGloryPoints } from "./models/LogsPlayersGloryPoints";
import { LogsPlayers15BestSeason } from "./models/LogsPlayers15BestSeason";
import { LogsSeasonEnd } from "./models/LogsSeasonEnd";
import { LogsPlayerLeagueReward } from "./models/LogsPlayerLeagueReward";
import { LogsPlayersEnergy } from "./models/LogsPlayersEnergy";
import { LogsGuildsPoints } from "./models/LogsGuildsPoints";
import { LogsPveFightsResults } from "./models/LogsPveFightsResults";
import { LogsPveFightsActionsUsed } from "./models/LogsPveFightsActionsUsed";
import { LogsPlayersRage } from "./models/LogsPlayersRage";
import { GenericItem } from "../../../data/GenericItem";
import { MapLink } from "../../../data/MapLink";
import { FightController } from "../../fights/FightController";
import { PlayerFighter } from "../../fights/fighter/PlayerFighter";
import { MonsterFighter } from "../../fights/fighter/MonsterFighter";
import { Effect } from "../../../../../Lib/src/types/Effect";
import { getDatabaseConfiguration } from "../../bot/CrowniclesConfig";
import { botConfig } from "../../../index";
import { GuildLikeType } from "../../types/GuildLikeType";
import { LogsCommandOrigins } from "./models/LogsCommandOrigins";
import { LogsCommandSubOrigins } from "./models/LogsCommandSubOrigins";
import { ReactionCollectorReactPacket } from "../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { LogsPlayersTeleportations } from "./models/LogsPlayersTeleportations";
import { AiPlayerFighter } from "../../fights/fighter/AiPlayerFighter";

/**
 * This class is used to log all the changes in the game database
 */
export class LogsDatabase extends Database {
	constructor() {
		super(getDatabaseConfiguration(botConfig, "logs"), `${__dirname}/models`, `${__dirname}/migrations`);
	}

	/**
	 * Log when a pet is freed
	 * @param freedPet
	 */
	public static async logPetFree(freedPet: PetEntity): Promise<void> {
		const logPetEntity = await LogsDatabase.findOrCreatePetEntity(freedPet);
		await LogsPetsFrees.create({
			petId: logPetEntity.id,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a pet is sold
	 * @param soldPet
	 * @param sellerId
	 * @param buyerId
	 * @param price
	 */
	public static async logPetSell(soldPet: PetEntity, sellerId: string, buyerId: string, price: number): Promise<void> {
		const logPetEntity = await LogsDatabase.findOrCreatePetEntity(soldPet);
		const seller = await LogsDatabase.findOrCreatePlayer(sellerId);
		const buyer = await LogsDatabase.findOrCreatePlayer(buyerId);
		await LogsPetsSells.create({
			petId: logPetEntity.id,
			sellerId: seller.id,
			buyerId: buyer.id,
			price,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a player leaves a guild
	 * @param guild
	 * @param leftKeycloakId
	 */
	public static async logGuildLeave(guild: Guild | GuildLikeType, leftKeycloakId: string): Promise<void> {
		const logGuild = await LogsDatabase.findOrCreateGuild(guild);
		const leftPlayer = await LogsDatabase.findOrCreatePlayer(leftKeycloakId);
		await LogsGuildsLeaves.create({
			guildId: logGuild.id,
			leftPlayer: leftPlayer.id,
			date: getDateLogs()
		});
	}

	/**
	 * Find or create a player in the log database
	 * @param keycloakId
	 */
	static async findOrCreatePlayer(keycloakId: string): Promise<LogsPlayers> {
		return (await LogsPlayers.findOrCreate({
			where: {
				keycloakId
			}
		}))[0];
	}

	/**
	 * Log when a guild is created
	 * @param creatorKeycloakId
	 * @param guild
	 */
	public static async logGuildCreation(creatorKeycloakId: string, guild: Guild): Promise<void> {
		const creator = await LogsDatabase.findOrCreatePlayer(creatorKeycloakId);
		const guildInstance = await LogsDatabase.findOrCreateGuild(guild);
		await LogsGuildsCreations.create({
			guildId: guildInstance.id,
			creatorId: creator.id,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a player joins a guild
	 * @param guild
	 * @param joinedKeycloakId
	 * @param inviterKeycloakId
	 */
	public static async logGuildJoin(guild: Guild, joinedKeycloakId: string, inviterKeycloakId: string): Promise<void> {
		const logGuild = await LogsDatabase.findOrCreateGuild(guild);
		const joiningPlayer = await LogsDatabase.findOrCreatePlayer(joinedKeycloakId);
		const invitingPlayer = await LogsDatabase.findOrCreatePlayer(inviterKeycloakId);
		await LogsGuildsJoins.create({
			guildId: logGuild.id,
			adderId: invitingPlayer.id,
			addedId: joiningPlayer.id,
			date: getDateLogs()
		});
	}

	/**
	 * Find or create a pet entity in the log database
	 * @param petEntity
	 */
	private static async findOrCreatePetEntity(petEntity: PetEntity): Promise<LogsPetEntities> {
		return (await LogsPetEntities.findOrCreate({
			where: {
				gameId: petEntity.id,
				creationTimestamp: Math.floor(petEntity.creationDate.valueOf() / 1000.0)
			}
		}))[0];
	}

	/**
	 * Find or create a guild in the log database
	 * @param guild
	 */
	private static async findOrCreateGuild(guild: Guild | GuildLikeType): Promise<LogsGuilds> {
		return (await LogsGuilds.findOrCreate({
			where: {
				gameId: guild.id,
				creationTimestamp: Math.floor(guild.creationDate.valueOf() / 1000.0)
			},
			defaults: {
				name: guild.name
			}
		}))[0];
	}

	/**
	 * Allow to log a number that comes from a player but only for small numbers like his class, his level or campaign level
	 * @param keycloakId
	 * @param valueFieldName
	 * @param value
	 * @param model
	 */
	private static async logPlayerAndNumber(keycloakId: string, valueFieldName: string, value: number, model: ModelStatic<Model<unknown, unknown>>): Promise<void> {
		const player = await LogsDatabase.findOrCreatePlayer(keycloakId);
		const values: { [key: string]: string | number } = {
			playerId: player.id,
			date: getDateLogs()
		};
		values[valueFieldName] = value;
		await model.create(values);
	}

	/**
	 * Allow to log a thing that only is about a player and a date like his daily
	 * @param keycloakId
	 * @param model
	 */
	private static async logSimplePlayerDate(keycloakId: string, model: ModelStatic<Model<unknown, unknown>>): Promise<void> {
		const player = await LogsDatabase.findOrCreatePlayer(keycloakId);
		await model.create({
			playerId: player.id,
			date: getDateLogs()
		});
	}

	/**
	 * Allow to log a mission change about a player
	 * @param keycloakId
	 * @param missionId
	 * @param variant
	 * @param objective
	 * @param model
	 */
	private static async logMissionChange(keycloakId: string, missionId: string, variant: number, objective: number, model: ModelStatic<Model<unknown, unknown>>): Promise<void> {
		const player = await LogsDatabase.findOrCreatePlayer(keycloakId);
		const [mission] = await LogsMissions.findOrCreate({
			where: {
				name: missionId,
				variant,
				objective
			}
		});
		await model.create({
			playerId: player.id,
			missionId: mission.id,
			date: getDateLogs()
		});
	}

	/**
	 * Allow to log a number change for example the xp or the money
	 * @param keycloakId
	 * @param value
	 * @param reason
	 * @param model
	 */
	private static async logNumberChange(keycloakId: string, value: number, reason: NumberChangeReason, model: ModelStatic<Model<unknown, unknown>>): Promise<void> {
		const player = await LogsDatabase.findOrCreatePlayer(keycloakId);
		await model.create({
			playerId: player.id,
			value,
			reason,
			date: getDateLogs()
		});
	}

	/**
	 * Allow to log information about an item in the log database
	 * @param keycloakId
	 * @param item
	 * @param model
	 */
	private static async logItem(
		keycloakId: string,
		item: GenericItem,
		model: { create: (values?: unknown, options?: CreateOptions<unknown>) => Promise<Model<unknown, unknown>> }
	): Promise<void> {
		const [player] = await LogsPlayers.findOrCreate({
			where: {
				keycloakId
			}
		});
		await model.create({
			playerId: player.id,
			itemId: item.id,
			date: getDateLogs()
		});
	}

	/**
	 * Log a player's money change
	 * @param keycloakId
	 * @param value
	 * @param reason
	 */
	public logMoneyChange(keycloakId: string, value: number, reason: NumberChangeReason): Promise<void> {
		return LogsDatabase.logNumberChange(keycloakId, value, reason, LogsPlayersMoney);
	}

	/**
	 * Log a player's health change
	 * @param keycloakId
	 * @param value
	 * @param reason
	 */
	public logHealthChange(keycloakId: string, value: number, reason: NumberChangeReason): Promise<void> {
		return LogsDatabase.logNumberChange(keycloakId, value, reason, LogsPlayersHealth);
	}

	/**
	 * Log a player's energy change (except natural regeneration)
	 * @param keycloakId
	 * @param value
	 * @param reason
	 */
	public logEnergyChange(keycloakId: string, value: number, reason: NumberChangeReason): Promise<void> {
		return LogsDatabase.logNumberChange(keycloakId, value, reason, LogsPlayersEnergy);
	}

	/**
	 * Log a player's xp change
	 * @param keycloakId
	 * @param value
	 * @param reason
	 */
	public logExperienceChange(keycloakId: string, value: number, reason: NumberChangeReason): Promise<void> {
		return LogsDatabase.logNumberChange(keycloakId, value, reason, LogsPlayersExperience);
	}

	/**
	 * Log a player's score change
	 * @param keycloakId
	 * @param value
	 * @param reason
	 */
	public logScoreChange(keycloakId: string, value: number, reason: NumberChangeReason): Promise<void> {
		return LogsDatabase.logNumberChange(keycloakId, value, reason, LogsPlayersScore);
	}

	/**
	 * Log a player's rage change
	 * @param keycloakId
	 * @param value
	 * @param reason
	 */
	public logRageChange(keycloakId: string, value: number, reason: NumberChangeReason): Promise<void> {
		return LogsDatabase.logNumberChange(keycloakId, value, reason, LogsPlayersRage);
	}

	/**
	 * Log a player's gems change
	 * @param keycloakId
	 * @param value
	 * @param reason
	 */
	public logGemsChange(keycloakId: string, value: number, reason: NumberChangeReason): Promise<void> {
		return LogsDatabase.logNumberChange(keycloakId, value, reason, LogsPlayersGems);
	}

	/**
	 * Log a player's level change
	 * @param keycloakId
	 * @param level
	 */
	public logLevelChange(keycloakId: string, level: number): Promise<void> {
		return LogsDatabase.logPlayerAndNumber(keycloakId, "level", level, LogsPlayersLevel);
	}

	/**
	 * Record the usage of a command in the log database
	 * @param keycloakId
	 * @param origin
	 * @param subOrigin
	 * @param commandName
	 */
	public async logCommandUsage(keycloakId: string, origin: string, subOrigin: string, commandName: string): Promise<void> {
		if (commandName === ReactionCollectorReactPacket.name) { // Do not log reaction packets, there is no useful information and there are too many of them
			return;
		}

		const player = await LogsDatabase.findOrCreatePlayer(keycloakId);
		const [commandOrigin] = await LogsCommandOrigins.findOrCreate({
			where: {
				name: origin
			}
		});
		const [commandSubOrigin] = await LogsCommandSubOrigins.findOrCreate({
			where: {
				name: subOrigin
			}
		});
		const [command] = await LogsCommands.findOrCreate({
			where: {
				commandName
			}
		});
		await LogsPlayersCommands.create({
			playerId: player.id,
			originId: commandOrigin.id,
			subOriginId: commandSubOrigin.id,
			commandId: command.id,
			date: getDateLogs()
		});
	}

	/**
	 * Log the appearance of a small event
	 * @param keycloakId
	 * @param name
	 */
	public async logSmallEvent(keycloakId: string, name: string): Promise<void> {
		const player = await LogsDatabase.findOrCreatePlayer(keycloakId);
		const [smallEvent] = await LogsSmallEvents.findOrCreate({
			where: {
				name
			}
		});
		await LogsPlayersSmallEvents.create({
			playerId: player.id,
			smallEventId: smallEvent.id,
			date: getDateLogs()
		});
	}

	/**
	 * Log the appearance of a big event
	 * @param keycloakId
	 * @param eventId
	 * @param possibilityName
	 * @param outcome
	 */
	public async logBigEvent(keycloakId: string, eventId: number, possibilityName: string, outcome: string): Promise<void> {
		const player = await LogsDatabase.findOrCreatePlayer(keycloakId);
		const [possibility] = await LogsPossibilities.findOrCreate({
			where: {
				bigEventId: eventId,
				possibilityName: possibilityName === "end" ? null : possibilityName,
				issueIndex: parseInt(outcome, 10)
			}
		});
		await LogsPlayersPossibilities.create({
			playerId: player.id,
			bigEventId: eventId,
			possibilityId: possibility.id,
			date: getDateLogs()
		});
	}

	/**
	 * Log a new alteration of a player
	 * @param keycloakId
	 * @param alterationId
	 * @param reason
	 * @param duration
	 */
	public async logAlteration(keycloakId: string, alterationId: string, reason: NumberChangeReason, duration: number): Promise<void> {
		const player = await LogsDatabase.findOrCreatePlayer(keycloakId);
		switch (alterationId) {
			case Effect.OCCUPIED.id:
				await LogsPlayersOccupiedAlterations.create({
					playerId: player.id,
					duration,
					reason,
					date: getDateLogs()
				});
				break;
			default:
				await LogsPlayersStandardAlterations.create({
					playerId: player.id,
					alterationId: (await LogsAlterations.findOrCreate({
						where: {
							alteration: alterationId
						}
					}))[0].id,
					reason,
					date: getDateLogs()
				});
		}
	}

	/**
	 * Log when a player has been unlocked from jail
	 * @param buyerKeycloakId
	 * @param releasedKeycloakId
	 */
	public async logUnlock(buyerKeycloakId: string, releasedKeycloakId: string): Promise<void> {
		const [buyer] = await LogsPlayers.findOrCreate({
			where: {
				keycloakId: buyerKeycloakId
			}
		});
		const [released] = await LogsPlayers.findOrCreate({
			where: {
				keycloakId: releasedKeycloakId
			}
		});
		await LogsUnlocks.create({
			buyerId: buyer.id,
			releasedId: released.id,
			date: getDateLogs()
		});
	}

	/**
	 * Log a player's class change
	 * @param keycloakId
	 * @param classId
	 */
	public logPlayerClassChange(keycloakId: string, classId: number): Promise<void> {
		return LogsDatabase.logPlayerAndNumber(keycloakId, "classId", classId, LogsPlayersClassChanges);
	}

	/**
	 * Log when a player does not succeed a mission
	 * @param keycloakId
	 * @param missionId
	 * @param variant
	 * @param objective
	 */
	public logMissionFailed(keycloakId: string, missionId: string, variant: number, objective: number): Promise<void> {
		return LogsDatabase.logMissionChange(keycloakId, missionId, variant, objective, LogsMissionsFailed);
	}

	/**
	 * Log when a player succeeds a mission except for the daily mission
	 * @param keycloakId
	 * @param missionId
	 * @param variant
	 * @param objective
	 */
	public logMissionFinished(keycloakId: string, missionId: string, variant: number, objective: number): Promise<void> {
		return LogsDatabase.logMissionChange(keycloakId, missionId, variant, objective, LogsMissionsFinished);
	}

	/**
	 * Log when a player starts a mission
	 * @param keycloakId
	 * @param missionId
	 * @param variant
	 * @param objective
	 */
	public logMissionFound(keycloakId: string, missionId: string, variant: number, objective: number): Promise<void> {
		return LogsDatabase.logMissionChange(keycloakId, missionId, variant, objective, LogsMissionsFound);
	}

	/**
	 * Log when a player finish a daily mission
	 * @param keycloakId
	 */
	public logMissionDailyFinished(keycloakId: string): Promise<void> {
		return LogsDatabase.logSimplePlayerDate(keycloakId, LogsMissionsDailyFinished);
	}

	/**
	 * Log when a player progress in the campaign
	 * @param keycloakId
	 * @param campaignIndex
	 */
	public logMissionCampaignProgress(keycloakId: string, campaignIndex: number): Promise<void> {
		return LogsDatabase.logPlayerAndNumber(keycloakId, "number", campaignIndex, LogsMissionsCampaignProgresses);
	}

	/**
	 * Log when a daily mission is refreshed
	 * @param missionId
	 * @param variant
	 * @param objective
	 */
	public async logMissionDailyRefreshed(missionId: string, variant: number, objective: number): Promise<void> {
		const [mission] = await LogsMissions.findOrCreate({
			where: {
				name: missionId,
				variant,
				objective
			}
		});
		await LogsMissionsDaily.create({
			missionId: mission.id,
			date: getDateLogs()
		});
	}

	/**
	 * Log when new travel is started
	 * @param keycloakId
	 * @param mapLink
	 */
	public async logNewTravel(keycloakId: string, mapLink: MapLink): Promise<void> {
		const player = await LogsDatabase.findOrCreatePlayer(keycloakId);
		const [maplinkLog] = await LogsMapLinks.findOrCreate({
			where: {
				start: mapLink.startMap,
				end: mapLink.endMap
			}
		});
		await LogsPlayersTravels.create({
			playerId: player.id,
			mapLinkId: maplinkLog.id,
			date: getDateLogs()
		});
	}

	/**
	 * Save the top players from the top week. To avoid having too much data, we only save the top 15 players
	 */
	public async log15BestTopWeek(): Promise<void> {
		const players = await Players.getPlayersTop(1, 15, true);
		const now = getDateLogs();
		for (let i = 0; i < players.length; i++) {
			const player = await LogsDatabase.findOrCreatePlayer(players[i].keycloakId);
			await LogsPlayers15BestTopweek.create({
				playerId: player.id,
				position: i + 1,
				topWeekScore: players[i].weeklyScore,
				date: now
			});
		}
	}

	/**
	 * Log when a player gains a new item
	 * @param keycloakId
	 * @param item
	 */
	public logItemGain(keycloakId: string, item: GenericItem): Promise<unknown> {
		let itemCategoryDatabase: {
			create: (values?: unknown, options?: CreateOptions<unknown>) => Promise<Model<unknown, unknown>>;
		};
		switch (item.categoryName) {
			case "weapons":
				itemCategoryDatabase = LogsItemGainsWeapon;
				break;
			case "armors":
				itemCategoryDatabase = LogsItemGainsArmor;
				break;
			case "objects":
				itemCategoryDatabase = LogsItemGainsObject;
				break;
			case "potions":
				itemCategoryDatabase = LogsItemGainsPotion;
				break;
			default:
				break;
		}
		return LogsDatabase.logItem(keycloakId, item, itemCategoryDatabase);
	}

	/**
	 * Log when a player receives a time boost
	 * @param keycloakId
	 * @param time - Time in minutes
	 * @param reason
	 */
	public async logTimeWarp(keycloakId: string, time: number, reason: NumberChangeReason): Promise<void> {
		if (reason === NumberChangeReason.IGNORE) {
			return;
		}
		const player = await LogsDatabase.findOrCreatePlayer(keycloakId);
		await LogsPlayersTimewarps.create({
			playerId: player.id,
			time,
			reason,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a player sells an item
	 * @param keycloakId
	 * @param item
	 */
	public logItemSell(keycloakId: string, item: GenericItem): Promise<unknown> {
		let itemCategoryDatabase: {
			create: (values?: unknown, options?: CreateOptions<unknown>) => Promise<Model<unknown, unknown>>;
		};
		switch (item.categoryName) {
			case "weapons":
				itemCategoryDatabase = LogsItemSellsWeapon;
				break;
			case "armors":
				itemCategoryDatabase = LogsItemSellsArmor;
				break;
			case "objects":
				itemCategoryDatabase = LogsItemSellsObject;
				break;
			case "potions":
				itemCategoryDatabase = LogsItemSellsPotion;
				break;
			default:
				break;
		}
		return LogsDatabase.logItem(keycloakId, item, itemCategoryDatabase);
	}

	/**
	 * Log when a player renames its pet
	 * @param petRenamed
	 */
	public async logPetNickname(petRenamed: PetEntity): Promise<void> {
		const pet = await LogsDatabase.findOrCreatePetEntity(petRenamed);
		await LogsPetsNicknames.create({
			petId: pet.id,
			name: petRenamed.nickname,
			date: getDateLogs()
		});
	}

	/**
	 * Log when the shop refreshes the daily potion
	 * @param potionId
	 */
	public async logDailyPotion(potionId: number): Promise<void> {
		await LogsDailyPotions.create({
			potionId,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a player is kicked from a guild
	 * @param kickedKeycloakId
	 * @param guild
	 */
	public async logGuildKick(kickedKeycloakId: string, guild: Guild): Promise<void> {
		const logGuild = await LogsDatabase.findOrCreateGuild(guild);
		const kickedPlayer = await LogsDatabase.findOrCreatePlayer(kickedKeycloakId);
		await LogsGuildsKicks.create({
			guildId: logGuild.id,
			kickedPlayer: kickedPlayer.id,
			date: getDateLogs()
		});
	}

	/**
	 * Log when anything is bought from the shop
	 * @param keycloakId
	 * @param shopItem
	 */
	public async logClassicalShopBuyout(keycloakId: string, shopItem: ShopItemType): Promise<void> {
		const logPlayer = await LogsDatabase.findOrCreatePlayer(keycloakId);
		await LogsClassicalShopBuyouts.create({
			playerId: logPlayer.id,
			shopItem,
			date: getDateLogs()
		});
	}

	/**
	 * Log when anything is bought from the guild shop
	 * @param keycloakId
	 * @param shopItem
	 * @param amount
	 */
	public async logGuildShopBuyout(keycloakId: string, shopItem: ShopItemType, amount: number): Promise<void> {
		const logPlayer = await LogsDatabase.findOrCreatePlayer(keycloakId);
		await LogsGuildShopBuyouts.create({
			playerId: logPlayer.id,
			shopItem,
			amount,
			date: getDateLogs()
		});
	}


	/**
	 * Log when a daily ti
	 * @param petLoveChange
	 */
	public async logDailyTimeout(petLoveChange: boolean): Promise<void> {
		await LogsDailyTimeouts.create({
			petLoveChange,
			date: getDateLogs()
		});
	}

	/**
	 * Log when the weekly top end
	 */
	public async logTopWeekEnd(): Promise<void> {
		await LogsTopWeekEnd.create({
			date: getDateLogs()
		});
	}

	/**
	 * Log when the weekly top end
	 */
	public async logSeasonEnd(): Promise<void> {
		await LogsSeasonEnd.create({
			date: getDateLogs()
		});
	}

	/**
	 * Log when anything is bought from the mission shop
	 * @param keycloakId
	 * @param shopItem
	 */
	public async logMissionShopBuyout(keycloakId: string, shopItem: ShopItemType): Promise<void> {
		const logPlayer = await LogsDatabase.findOrCreatePlayer(keycloakId);
		await LogsMissionShopBuyouts.create({
			playerId: logPlayer.id,
			shopItem,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a guild ask for its daily reward
	 * @param guild
	 * @param rewardResult
	 */
	public async logGuildDaily(guild: Guild, rewardResult: string): Promise<void> {
		const logGuild = await LogsDatabase.findOrCreateGuild(guild);
		const reward = Object.values(GuildDailyConstants.REWARD_TYPES)
			.indexOf(rewardResult);
		await LogsGuildsDailies.create({
			guildId: logGuild.id,
			reward,
			date: getDateLogs()
		});
	}

	/**
	 * Log a pet transfer
	 * @param guildPet
	 * @param playerPet
	 */
	public async logPetTransfer(guildPet: PetEntity, playerPet: PetEntity): Promise<void> {
		const logGuildPet = guildPet ? await LogsDatabase.findOrCreatePetEntity(guildPet) : null;
		const logPlayerPet = playerPet ? await LogsDatabase.findOrCreatePetEntity(playerPet) : null;
		await LogsPetsTransfers.create({
			playerPetId: logPlayerPet ? logPlayerPet.id : null,
			guildPetId: logGuildPet ? logGuildPet.id : null,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a guild is destroyed
	 * @param guild
	 * @param members
	 * @param guildPetsEntities
	 */
	public async logGuildDestroy(guild: Guild, members: Player[], guildPetsEntities: PetEntity[]): Promise<void> {
		const guildInfo: GuildLikeType = {
			id: guild.id,
			name: guild.name,
			creationDate: guild.creationDate,
			chiefId: guild.chiefId
		};
		const logGuild = await LogsDatabase.findOrCreateGuild(guildInfo);
		for (const member of members) {
			if (member.id !== guildInfo.chiefId) {
				await LogsDatabase.logGuildLeave(guild, member.keycloakId);
			}
		}
		for (const guildPetEntity of guildPetsEntities) {
			await LogsDatabase.logPetFree(guildPetEntity);
		}
		await LogsGuildsDestroys.create({
			guildId: logGuild.id,
			date: getDateLogs()
		});
	}

	/**
	 * Log when an elder is demoted
	 * @param guild
	 * @param removedPlayerId
	 */
	public async logGuildElderRemove(guild: Guild, removedPlayerId: number): Promise<void> {
		const logGuild = await LogsDatabase.findOrCreateGuild(guild);
		await LogsGuildsEldersRemoves.create({
			guildId: logGuild.id,
			removedElder: (await LogsDatabase.findOrCreatePlayer((await Players.getById(removedPlayerId)).keycloakId)).id,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a guild's chief is changed
	 * @param guild
	 * @param newChiefId
	 */
	public async logGuildChiefChange(guild: Guild, newChiefId: number): Promise<void> {
		const logGuild = await LogsDatabase.findOrCreateGuild(guild);
		const logNewChiefId = (await LogsDatabase.findOrCreatePlayer((await Players.getById(newChiefId)).keycloakId)).id;
		await LogsGuildsChiefsChanges.create({
			guildId: logGuild.id,
			newChief: logNewChiefId,
			date: getDateLogs()
		});
	}

	/**
	 * Log all the information about a fight, this is called at the end of a fight
	 * @param fight
	 */
	public async logFight(fight: FightController): Promise<number | null> {
		const fightInitiator = fight.fightInitiator;
		const nonFightInitiator = fight.getNonFightInitiatorFighter();

		if (!(nonFightInitiator instanceof PlayerFighter) && !(nonFightInitiator instanceof AiPlayerFighter)) {
			return null;
		}

		const fightInitiatorId = (await LogsDatabase.findOrCreatePlayer(fightInitiator.player.keycloakId)).id;
		const nonFightInitiatorId = (await LogsDatabase.findOrCreatePlayer(nonFightInitiator.player.keycloakId)).id;

		const winner = fight.getWinnerFighter() === fightInitiator ? 1 : 2;

		// Get pet type IDs if pets exist
		const fightInitiatorPetTypeId = fightInitiator.pet ? fightInitiator.pet.typeId : null;
		const nonFightInitiatorPetTypeId = nonFightInitiator.pet ? nonFightInitiator.pet.typeId : null;

		const fightResult = await LogsFightsResults.create({
			fightInitiatorId,
			fightInitiatorPoints: fightInitiator.player.score,
			player2Id: nonFightInitiatorId,
			player2Points: nonFightInitiator.player.score,
			turn: fight.turn,
			winner: fight.isADraw() ? 0 : winner,
			friendly: false,
			fightInitiatorInitialDefenseGlory: fightInitiator.player.defenseGloryPoints,
			fightInitiatorInitialAttackGlory: fightInitiator.player.attackGloryPoints,
			fightInitiatorClassId: fightInitiator.player.class,
			player2InitialDefenseGlory: nonFightInitiator.player.defenseGloryPoints,
			player2InitialAttackGlory: nonFightInitiator.player.attackGloryPoints,
			player2ClassId: nonFightInitiator.player.class,
			fightInitiatorPetTypeId,
			player2PetTypeId: nonFightInitiatorPetTypeId,
			date: getDateLogs()
		});
		for (const player of [fightInitiator, nonFightInitiator]) {
			const fightActionsUsed: { [action: string]: number } = {};
			for (const fightAction of player.fightActionsHistory) {
				if (fightActionsUsed[fightAction.id]) {
					fightActionsUsed[fightAction.id]++;
				}
				else {
					fightActionsUsed[fightAction.id] = 1;
				}
			}
			for (const [action, count] of Object.entries(fightActionsUsed)) {
				const [fightAction] = await LogsFightsActions.findOrCreate({
					where: {
						name: action,
						classId: player.player.class
					}
				});
				await LogsFightsActionsUsed.create({
					fightId: fightResult.id,
					player: player === fightInitiator ? 1 : 2,
					actionId: fightAction.id,
					count
				});
			}
		}
		return fightResult.id;
	}

	/**
	 * Log all the information about a pve fight, this is called at the end of a fight
	 * @param fight
	 */
	public async logPveFight(fight: FightController): Promise<void> {
		const player = fight.fightInitiator as PlayerFighter | null;
		const monster = fight.getNonFightInitiatorFighter() as MonsterFighter | null;

		if (player && monster) {
			const playerId = (await LogsDatabase.findOrCreatePlayer(player.player.keycloakId)).id;
			const monsterStats = monster.getBaseStats();
			const winner = fight.getWinnerFighter();
			const fightResult = await LogsPveFightsResults.create({
				playerId,
				monsterId: monster.monster.id,
				monsterLevel: monster.level,
				monsterFightPoints: monsterStats.maxEnergy,
				monsterAttack: monsterStats.attack,
				monsterDefense: monsterStats.defense,
				monsterSpeed: monsterStats.speed,
				turn: fight.turn,
				winner: !winner ? 0 : winner === player ? 1 : 2,
				date: getDateLogs()
			});
			const fightActionsUsed: { [action: string]: number } = {};
			for (const fightAction of player.fightActionsHistory) {
				if (fightActionsUsed[fightAction.id]) {
					fightActionsUsed[fightAction.id]++;
				}
				else {
					fightActionsUsed[fightAction.id] = 1;
				}
			}
			for (const [action, count] of Object.entries(fightActionsUsed)) {
				const [fightAction] = await LogsFightsActions.findOrCreate({
					where: {
						name: action,
						classId: player.player.class
					}
				});
				await LogsPveFightsActionsUsed.create({
					pveFightId: fightResult.id,
					actionId: fightAction.id,
					count
				});
			}
		}
	}

	/**
	 * Log when a guild experience changes
	 * @param guild
	 * @param reason
	 */
	public async logGuildExperienceChange(guild: Guild, reason: NumberChangeReason): Promise<void> {
		const guildInstance = await LogsDatabase.findOrCreateGuild(guild);
		await LogsGuildsExperiences.create({
			guildId: guildInstance.id,
			experience: guild.experience,
			reason,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a guild points changes
	 * @param guild
	 * @param reason
	 */
	public async logGuildPointsChange(guild: Guild, reason: NumberChangeReason): Promise<void> {
		const guildInstance = await LogsDatabase.findOrCreateGuild(guild);
		await LogsGuildsPoints.create({
			guildId: guildInstance.id,
			points: guild.score,
			reason,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a guild description changes
	 * @param keycloakId
	 * @param guild
	 */
	public async logGuildDescriptionChange(keycloakId: string, guild: Guild): Promise<void> {
		const player = await LogsDatabase.findOrCreatePlayer(keycloakId);
		const guildInstance = await LogsDatabase.findOrCreateGuild(guild);
		await LogsGuildsDescriptionChanges.create({
			guildId: guildInstance.id,
			playerId: player.id,
			description: guild.guildDescription,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a pet has its love changed
	 * @param petEntity
	 * @param reason
	 */
	public async logPetLoveChange(petEntity: PetEntity, reason: NumberChangeReason): Promise<void> {
		const logPet = await LogsDatabase.findOrCreatePetEntity(petEntity);
		await LogsPetsLovesChanges.create({
			petId: logPet.id,
			lovePoints: petEntity.lovePoints,
			reason,
			date: getDateLogs()
		});
	}

	/**
	 * Log when guild food changes
	 * @param guild
	 * @param food
	 * @param total
	 * @param reason
	 */
	public async logGuildsFoodChanges(guild: Guild, food: number, total: number, reason: NumberChangeReason): Promise<void> {
		const guildInstance = await LogsDatabase.findOrCreateGuild(guild);
		await LogsGuildsFoodsChanges.create({
			guildId: guildInstance.id,
			food,
			total,
			reason,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a guild gets a new pet
	 * @param guild
	 * @param petEntity
	 */
	public async logGuildNewPet(guild: Guild, petEntity: PetEntity): Promise<void> {
		const petEntityInstance = await LogsDatabase.findOrCreatePetEntity(petEntity);
		const guildInstance = await LogsDatabase.findOrCreateGuild(guild);
		await LogsGuildsNewPets.create({
			guildId: guildInstance.id,
			petId: petEntityInstance.id,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a player gets a new pet
	 * @param keycloakId
	 * @param petEntity
	 */
	public async logPlayerNewPet(keycloakId: string, petEntity: PetEntity): Promise<void> {
		const petEntityInstance = await LogsDatabase.findOrCreatePetEntity(petEntity);
		const playerInstance = await LogsDatabase.findOrCreatePlayer(keycloakId);
		await LogsPlayersNewPets.create({
			playerId: playerInstance.id,
			petId: petEntityInstance.id,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a member of a guild gets promoted to elder
	 * @param guild
	 * @param addedPlayerId
	 */
	public async logGuildElderAdd(guild: Guild, addedPlayerId: string): Promise<void> {
		const logGuild = await LogsDatabase.findOrCreateGuild(guild);
		const player = await LogsDatabase.findOrCreatePlayer(addedPlayerId);
		await LogsGuildsEldersAdds.create({
			guildId: logGuild.id,
			addedElder: player.id,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a guild levels up
	 * @param guild
	 */
	public async logGuildLevelUp(guild: Guild): Promise<void> {
		const guildInstance = await LogsDatabase.findOrCreateGuild(guild);
		await LogsGuildsLevels.create({
			guildId: guildInstance.id,
			level: guild.level,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a player ask for his daily reward
	 * @param keycloakId
	 * @param item
	 */
	public async logPlayerDaily(keycloakId: string, item: GenericItem): Promise<void> {
		await LogsDatabase.logItem(keycloakId, item, LogsPlayersDailies);
	}

	/**
	 * Log when a player's elo changes because of an attack
	 * @param keycloakId
	 * @param gloryPoints
	 * @param reason
	 * @param fightId
	 */
	public async logPlayersAttackGloryPoints(keycloakId: string, gloryPoints: number, reason: NumberChangeReason, fightId: number = null): Promise<void> {
		const player = await LogsDatabase.findOrCreatePlayer(keycloakId);
		await LogsPlayersGloryPoints.create({
			playerId: player.id,
			value: gloryPoints,
			reason,
			fightId,
			date: getDateLogs(),
			isDefense: false
		});
	}

	/**
	 * Log when a player's elo changes because of a defense
	 * @param keycloakId
	 * @param gloryPoints
	 * @param reason
	 * @param fightId
	 */
	public async logPlayersDefenseGloryPoints(keycloakId: string, gloryPoints: number, reason: NumberChangeReason, fightId: number = null): Promise<void> {
		const player = await LogsDatabase.findOrCreatePlayer(keycloakId);
		await LogsPlayersGloryPoints.create({
			playerId: player.id,
			value: gloryPoints,
			reason,
			fightId,
			date: getDateLogs(),
			isDefense: true
		});
	}

	/**
	 * Save the top players from the season ranking. To avoid having too much data, we only save the top 15 players
	 */
	public async log15BestSeason(): Promise<void> {
		const players = await Players.getPlayersGloryTop(1, 15);
		const now = getDateLogs();
		for (let i = 0; i < players.length; i++) {
			const player = await LogsDatabase.findOrCreatePlayer(players[i].keycloakId);
			await LogsPlayers15BestSeason.create({
				playerId: player.id,
				position: i + 1,
				seasonGlory: players[i].getGloryPoints(),
				date: now
			});
		}
	}

	/**
	 * Save when a player ask for his league reward
	 * @param keycloakId
	 * @param leagueLastSeason
	 */
	public async logPlayerLeagueReward(keycloakId: string, leagueLastSeason: number): Promise<void> {
		const player = await LogsDatabase.findOrCreatePlayer(keycloakId);
		await LogsPlayerLeagueReward.create({
			playerId: player.id,
			leagueLastSeason,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a player is teleported
	 * @param keycloakId
	 * @param originMapLinkId
	 * @param newMapLinkId
	 */
	public async logTeleportation(keycloakId: string, originMapLinkId: number, newMapLinkId: number): Promise<void> {
		const player = await LogsDatabase.findOrCreatePlayer(keycloakId);
		await LogsPlayersTeleportations.create({
			playerId: player.id,
			originMapLinkId,
			newMapLinkId,
			date: getDateLogs()
		});
	}
}
