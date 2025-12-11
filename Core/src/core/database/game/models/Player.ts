import {
	DataTypes, Model, Op, QueryTypes, Sequelize
} from "sequelize";
import InventorySlot, { InventorySlots } from "./InventorySlot";
import PetEntity from "./PetEntity";
import MissionSlot from "./MissionSlot";
import { InventoryInfos } from "./InventoryInfo";
import { MissionsController } from "../../../missions/MissionsController";
import { PlayerActiveObjects } from "./PlayerActiveObjects";
import {
	daysToMilliseconds,
	getOneDayAgo,
	millisecondsToSeconds,
	minutesToHours
} from "../../../../../../Lib/src/utils/TimeUtils";
import { TravelTime } from "../../../maps/TravelTime";
import { ItemCategory } from "../../../../../../Lib/src/constants/ItemConstants";
import { Maps } from "../../../maps/Maps";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
import { LogsReadRequests } from "../../logs/LogsReadRequests";
import { PlayerSmallEvents } from "./PlayerSmallEvent";
import { Guilds } from "./Guild";
import {
	CrowniclesPacket, makePacket
} from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { PlayerDeathPacket } from "../../../../../../Lib/src/packets/events/PlayerDeathPacket";
import { PlayerLeavePveIslandPacket } from "../../../../../../Lib/src/packets/events/PlayerLeavePveIslandPacket";
import { PlayerLevelUpPacket } from "../../../../../../Lib/src/packets/events/PlayerLevelUpPacket";
import { MapLinkDataController } from "../../../../data/MapLink";
import {
	MapLocation, MapLocationDataController
} from "../../../../data/MapLocation";
import { crowniclesInstance } from "../../../../index";
import { GenericItem } from "../../../../data/GenericItem";
import {
	Class, ClassDataController
} from "../../../../data/Class";
import {
	League, LeagueDataController
} from "../../../../data/League";
import { TopConstants } from "../../../../../../Lib/src/constants/TopConstants";
import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import { InventoryConstants } from "../../../../../../Lib/src/constants/InventoryConstants";
import { Constants } from "../../../../../../Lib/src/constants/Constants";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import { PVEConstants } from "../../../../../../Lib/src/constants/PVEConstants";
import { PlayersConstants } from "../../../../../../Lib/src/constants/PlayersConstants";
import { EntityConstants } from "../../../../../../Lib/src/constants/EntityConstants";
import { ClassInfoConstants } from "../../../../../../Lib/src/constants/ClassInfoConstants";
import { GuildConstants } from "../../../../../../Lib/src/constants/GuildConstants";
import { MapConstants } from "../../../../../../Lib/src/constants/MapConstants";
import { Effect } from "../../../../../../Lib/src/types/Effect";
import { ScheduledReportNotifications } from "./ScheduledReportNotification";
import { PacketUtils } from "../../../utils/PacketUtils";
import { StatValues } from "../../../../../../Lib/src/types/StatValues";
import { ReachDestinationNotificationPacket } from "../../../../../../Lib/src/packets/notifications/ReachDestinationNotificationPacket";
import { CrowniclesLogger } from "../../../../../../Lib/src/logs/CrowniclesLogger";
import { Badge } from "../../../../../../Lib/src/types/Badge";
import { TokensConstants } from "../../../../../../Lib/src/constants/TokensConstants";
import { MathUtils } from "../../../utils/MathUtils";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";
import { ClassConstants } from "../../../../../../Lib/src/constants/ClassConstants";

export type PlayerEditValueParameters = {
	player: Player;
	amount: number;
	response: CrowniclesPacket[];
	reason: NumberChangeReason;
};

export type EditValueParameters = {
	amount: number;
	response: CrowniclesPacket[];
	reason: NumberChangeReason;
};

type MissionHealthParameter = {
	shouldPokeMission: boolean;
	overHealCountsForMission: boolean;
};

type ressourcesLostOnPveFaint = {
	moneyLost: number;
	guildPointsLost: number;
};

export class Player extends Model {
	declare readonly id: number;

	declare keycloakId: string;

	declare health: number;

	declare fightPointsLost: number;

	declare score: number;

	declare weeklyScore: number;

	declare level: number;

	declare experience: number;

	declare money: number;

	declare tokens: number;

	declare class: number;

	declare badges: string;

	declare guildId: number;

	declare nextEvent: number;

	declare petId: number;

	declare lastPetFree: Date;

	declare effectId: string;

	declare effectEndDate: Date;

	declare effectDuration: number;

	declare mapLinkId: number;

	declare startTravelDate: Date;

	declare defenseGloryPoints: number;

	declare attackGloryPoints: number;

	declare gloryPointsLastSeason: number;

	declare fightCountdown: number;

	declare rage: number;

	declare banned: boolean;

	declare hasTalisman: boolean;

	declare hasCloneTalisman: boolean;

	declare updatedAt: Date;

	declare createdAt: Date;

	/**
	 * Add a badge to a player
	 * @param badge
	 */
	public addBadge(badge: Badge): boolean {
		if (this.badges !== null && this.badges !== "") {
			if (!this.hasBadge(badge)) {
				this.badges += `,${badge}`;
			}
			else {
				return false;
			}
		}
		else {
			this.badges = badge;
		}
		return true;
	}

	/**
	 * Check if a player has a specific badge
	 * @param badge
	 */
	public hasBadge(badge: Badge): boolean {
		return this.badges === null
			? false
			: this.badges.split(",")
				.includes(badge);
	}

	public getBadges(): Badge[] {
		if (this.badges === null) {
			return [];
		}

		return this.badges.split(",") as Badge[];
	}

	public setBadges(badges: Badge[]): void {
		this.badges = badges.join(",");
	}

	/**
	 * Get the destination id of a player
	 */
	getDestinationId(): number {
		const link = MapLinkDataController.instance.getById(this.mapLinkId);
		return link ? link.endMap : null;
	}

	/**
	 * Get the mapLocation object of the destination of the player
	 */
	public getDestination(): MapLocation {
		const link = MapLinkDataController.instance.getById(this.mapLinkId);
		return link ? MapLocationDataController.instance.getById(link.endMap) : null;
	}

	/**
	 * Get the origin mapLocation object of the player
	 */
	public getPreviousMap(): MapLocation {
		const link = MapLinkDataController.instance.getById(this.mapLinkId);
		return link ? MapLocationDataController.instance.getById(link.startMap) : null;
	}

	/**
	 * Get the origin id of the player
	 */
	public getPreviousMapId(): number {
		const link = MapLinkDataController.instance.getById(this.mapLinkId);
		return link ? link.startMap : null;
	}

	/**
	 * Get the current trip duration of a player
	 */
	public getCurrentTripDuration(): number {
		const link = MapLinkDataController.instance.getById(this.mapLinkId);
		return link ? minutesToHours(link.tripDuration) : null;
	}

	/**
	 * Get the amount of experience needed to level up
	 */
	public getExperienceNeededToLevelUp(): number {
		return Math.round(
			Constants.XP.BASE_VALUE
			* Math.pow(Constants.XP.COEFFICIENT, this.level + 1)
		) - Constants.XP.MINUS;
	}

	/**
	 * Add or remove points from the score of a player
	 * @param parameters
	 */
	public async addScore(parameters: EditValueParameters): Promise<Player> {
		this.score += parameters.amount;
		if (parameters.amount > 0) {
			const newPlayer = await MissionsController.update(this, parameters.response, {
				missionId: "earnPoints",
				count: parameters.amount
			});
			Object.assign(this, newPlayer);
		}
		await this.setScore(this.score, parameters.response);
		crowniclesInstance.logsDatabase.logScoreChange(this.keycloakId, this.score, parameters.reason)
			.then();
		this.addWeeklyScore(parameters.amount);
		return this;
	}

	/**
	 * Add or remove money to the player
	 * @param parameters
	 */
	public async addMoney(parameters: EditValueParameters): Promise<Player> {
		this.money += parameters.amount;
		if (parameters.amount > 0) {
			const newPlayer = await MissionsController.update(this, parameters.response, {
				missionId: "earnMoney",
				count: parameters.amount
			});

			/*
			 * Clone the mission entity and player to this player model and the entity instance passed in the parameters
			 * As the money and experience may have changed, we update the models of the caller
			 */
			Object.assign(this, newPlayer);
		}
		this.setMoney(this.money);
		crowniclesInstance.logsDatabase.logMoneyChange(this.keycloakId, this.money, parameters.reason)
			.then();
		return this;
	}

	/**
	 * Only use when the player is spending money, this must not be used when the player is losing money
	 * @param parameters
	 */
	public async spendMoney(parameters: EditValueParameters): Promise<Player> {
		await MissionsController.update(this, parameters.response, {
			missionId: "spendMoney",
			count: parameters.amount
		});
		parameters.amount = -parameters.amount;
		return this.addMoney(parameters);
	}

	/**
	 * Add or remove tokens to the player
	 * @param parameters
	 */
	public async addTokens(parameters: EditValueParameters): Promise<Player> {
		const previousTokens = this.tokens;
		const newTokens = MathUtils.clamp(
			this.tokens + parameters.amount,
			0,
			TokensConstants.MAX
		);

		if (newTokens === previousTokens) {
			return this;
		}

		this.setTokens(newTokens);
		await crowniclesInstance.logsDatabase.logTokensChange(this.keycloakId, this.tokens, parameters.reason);

		// Track missions for earning tokens
		const actualChange = newTokens - previousTokens;
		if (actualChange > 0) {
			let newPlayer = await MissionsController.update(this, parameters.response, {
				missionId: "earnTokens",
				count: actualChange
			});

			/*
			 * Clone the mission entity and player to this player model and the entity instance passed in the parameters
			 * As the money and experience may have changed, we update the models of the caller
			 */
			Object.assign(this, newPlayer);

			// Check if max tokens reached
			if (this.tokens === TokensConstants.MAX) {
				newPlayer = await MissionsController.update(this, parameters.response, {
					missionId: "maxTokensReached"
				});
				Object.assign(this, newPlayer);
			}
		}

		return this;
	}

	/**
	 * Use tokens (for missions tracking) - only for spending tokens
	 * @param parameters
	 */
	public async useTokens(parameters: EditValueParameters): Promise<Player> {
		const tokensToUse = Math.abs(parameters.amount);

		// Track missions for using tokens
		let newPlayer = await MissionsController.update(this, parameters.response, {
			missionId: "useTokens",
			count: tokensToUse
		});
		Object.assign(this, newPlayer);

		newPlayer = await MissionsController.update(this, parameters.response, {
			missionId: "spendTokens",
			count: tokensToUse
		});
		Object.assign(this, newPlayer);

		parameters.amount = -tokensToUse;
		return this.addTokens(parameters);
	}

	/**
	 * Return the value of glory that is displayed to the users
	 */
	public getGloryPoints(): number {
		return this.attackGloryPoints + this.defenseGloryPoints;
	}

	/**
	 * Check if a player needs to level up
	 */
	public needLevelUp(): boolean {
		return this.experience >= this.getExperienceNeededToLevelUp();
	}

	/**
	 * Get the class group of a player
	 */
	public getClassGroup(): number {
		const ranges = [
			[ClassConstants.REQUIRED_LEVEL, ClassConstants.GROUP1LEVEL],
			[ClassConstants.GROUP1LEVEL, ClassConstants.GROUP2LEVEL],
			[ClassConstants.GROUP2LEVEL, ClassConstants.GROUP3LEVEL],
			[ClassConstants.GROUP3LEVEL, ClassConstants.GROUP4LEVEL]
		];
		const index = ranges.findIndex(([min, max]) => this.level >= min && this.level < max);
		return index >= 0 ? index : ranges.length;
	}

	/**
	 * Check if a player has to receive a reward for a level up
	 * @param response
	 * @param newLevel
	 */
	public async addLevelUpPacket(response: CrowniclesPacket[], newLevel: number): Promise<void> {
		const healthRestored = newLevel % 10 === 0;

		const packet = makePacket(PlayerLevelUpPacket, {
			keycloakId: this.keycloakId,
			level: newLevel,
			fightUnlocked: newLevel === FightConstants.REQUIRED_LEVEL,
			guildUnlocked: newLevel === GuildConstants.REQUIRED_LEVEL,
			healthRestored,
			classesTier1Unlocked: newLevel === ClassConstants.REQUIRED_LEVEL,
			classesTier2Unlocked: newLevel === ClassConstants.GROUP1LEVEL,
			classesTier3Unlocked: newLevel === ClassConstants.GROUP2LEVEL,
			classesTier4Unlocked: newLevel === ClassConstants.GROUP3LEVEL,
			classesTier5Unlocked: newLevel === ClassConstants.GROUP4LEVEL,
			missionSlotUnlocked: newLevel === Constants.MISSIONS.SLOT_2_LEVEL || newLevel === Constants.MISSIONS.SLOT_3_LEVEL,
			pveUnlocked: newLevel === PVEConstants.MIN_LEVEL,
			tokensUnlocked: newLevel === TokensConstants.LEVEL_TO_UNLOCK,
			statsIncreased: true
		});

		if (healthRestored) {
			await this.addHealth(this.getMaxHealth() - this.health, response, NumberChangeReason.LEVEL_UP, {
				shouldPokeMission: true,
				overHealCountsForMission: false
			});
		}

		response.push(packet);
	}

	/**
	 * Level up a player if he has enough experience
	 * @param response
	 */
	public async levelUpIfNeeded(response: CrowniclesPacket[]): Promise<void> {
		if (!this.needLevelUp()) {
			return;
		}

		const xpNeeded = this.getExperienceNeededToLevelUp();
		this.experience -= xpNeeded;
		crowniclesInstance.logsDatabase.logExperienceChange(this.keycloakId, this.experience, NumberChangeReason.LEVEL_UP)
			.then();
		const newLevel = ++this.level;
		crowniclesInstance.logsDatabase.logLevelChange(this.keycloakId, this.level)
			.then();
		Object.assign(this, await MissionsController.update(this, response, {
			missionId: "reachLevel",
			count: newLevel,
			set: true
		}));

		await this.addLevelUpPacket(response, newLevel);

		await this.levelUpIfNeeded(response);
	}

	/**
	 * This function is called when a player receives an effect after a report
	 * @param timeMalus
	 * @param effect
	 * @param reason
	 */
	public async setLastReportWithEffect(timeMalus: number, effect: Effect, reason: NumberChangeReason): Promise<void> {
		await TravelTime.applyEffect(this, effect, timeMalus, new Date(), reason);
		await this.save();
	}

	/**
	 * Check if we need to kill the player (mouahaha)
	 * @param response
	 * @param reason
	 */
	public async killIfNeeded(response: CrowniclesPacket[], reason: NumberChangeReason): Promise<boolean> {
		if (this.health > 0) {
			return false;
		}
		await TravelTime.applyEffect(this, Effect.DEAD, 0, new Date(), reason);
		const packet = makePacket(PlayerDeathPacket, {});
		response.push(packet);
		return true;
	}

	/**
	 * Check if the player has played recently
	 */
	public isInactive(): boolean {
		return this.startTravelDate.valueOf() + TopConstants.FIFTEEN_DAYS < Date.now();
	}

	/**
	 * Check if the player is not active enough to be joined in the boat
	 */
	public isNotActiveEnoughToBeJoinedInTheBoat(): boolean {
		return this.startTravelDate.valueOf() + PVEConstants.TIME_AFTER_INACTIVITY_ON_BOAT_IS_NOT_ACCEPTED < Date.now();
	}

	/**
	 * Check if the player is in guild
	 */
	public hasAGuild(): boolean {
		return this.guildId !== null;
	}

	/**
	 * Check if the current effect of a player is finished
	 * @param date
	 */
	public currentEffectFinished(date: Date): boolean {
		if (this.effectId === Effect.DEAD.id || this.effectId === Effect.NOT_STARTED.id) {
			return false;
		}
		if (this.effectId === Effect.NO_EFFECT.id) {
			return true;
		}
		if (!this.effectEndDate) {
			return true;
		}
		return this.effectEndDate.valueOf() < date.valueOf();
	}

	/**
	 * Get the amount of time remaining before the effect ends
	 */
	public effectRemainingTime(): number {
		let remainingTime = 0;
		if (Effect.getById(this.effectId)) {
			if (!this.effectEndDate || this.effectEndDate.valueOf() === 0) {
				return 0;
			}
			remainingTime = this.effectEndDate.valueOf() - Date.now();
		}
		if (remainingTime < 0) {
			remainingTime = 0;
		}
		return remainingTime;
	}

	/**
	 * Check if the player is under some effect (except dead or baby)
	 */
	public isUnderEffect(): boolean {
		return [
			Effect.NOT_STARTED.id,
			Effect.NO_EFFECT.id,
			Effect.DEAD.id
		].indexOf(this.effectId) === -1;
	}

	/**
	 * Check if the player is dead and needs to respawn
	 */
	public isDead(): boolean {
		return this.effectId === Effect.DEAD.id;
	}

	/**
	 * Get the travel cost of a player this week
	 */
	public async getTravelCostThisWeek(): Promise<number> {
		const wentCount = await LogsReadRequests.getCountPVEIslandThisWeek(this.keycloakId, this.guildId);
		return PVEConstants.TRAVEL_COST[wentCount >= PVEConstants.TRAVEL_COST.length ? PVEConstants.TRAVEL_COST.length - 1 : wentCount];
	}

	/**
	 * Check if the player has a holy class
	 */
	public hasHolyClass(): boolean {
		return this.class in ClassInfoConstants.HOLY_CLASSES;
	}

	/**
	 * Get the number of player that are on the same map as the player
	 */
	public async getNbPlayersOnYourMap(): Promise<number> {
		const oppositeLink = MapLinkDataController.instance.getInverseLinkOf(this.mapLinkId);

		const query = `SELECT COUNT(*) as count
		               FROM players
		               WHERE (mapLinkId = :link
			               OR mapLinkId = :linkInverse)
			             AND score
			               > ${Constants.MINIMAL_PLAYER_SCORE}`;
		return Math.round(
			(<{
				count: number;
			}[]>(await Player.sequelize.query(query, {
				replacements: {
					link: this.mapLinkId,
					linkInverse: oppositeLink.id
				},
				type: QueryTypes.SELECT
			})))[0].count
		);
	}

	/**
	 * Gives an item to the player
	 * @param item
	 */
	public async giveItem(item: GenericItem): Promise<boolean> {
		const invSlots = await InventorySlots.getOfPlayer(this.id);
		const invInfo = await InventoryInfos.getOfPlayer(this.id);
		const category = item.getCategory();
		const equippedItem = invSlots.filter(slot => slot.itemCategory === category && slot.isEquipped())[0];
		if (equippedItem && equippedItem.itemId === 0) {
			await InventorySlot.update({
				itemId: item.id
			}, {
				where: {
					playerId: this.id,
					itemCategory: category,
					slot: equippedItem.slot
				}
			});
			return true;
		}
		const slotsLimit = invInfo.slotLimitForCategory(category);
		const items = invSlots.filter(slot => slot.itemCategory === category && slot.slot < slotsLimit);
		if (items.length >= slotsLimit) {
			return false;
		}
		for (let i = 0; i < slotsLimit; ++i) {
			if (items.filter(slot => slot.slot === i).length === 0) {
				await InventorySlot.create({
					playerId: this.id,
					itemCategory: category,
					itemId: item.id,
					slot: i
				});
				return true;
			}
		}
		return false;
	}

	/**
	 * Drink a potion
	 */
	public async drinkPotion(itemSlot: number): Promise<void> {
		InventorySlot.findOne({
			where: {
				playerId: this.id,
				slot: itemSlot,
				itemCategory: ItemCategory.POTION
			}
		})
			.then(async item => await crowniclesInstance.logsDatabase.logItemSell(this.keycloakId, item.getItem()));
		if (itemSlot === 0) {
			await InventorySlot.update(
				{
					itemId: InventoryConstants.POTION_DEFAULT_ID
				},
				{
					where: {
						slot: 0,
						itemCategory: ItemCategory.POTION,
						playerId: this.id
					}
				}
			);
			return;
		}

		await InventorySlot.destroy({
			where: {
				playerId: this.id,
				slot: itemSlot,
				itemCategory: ItemCategory.POTION
			}
		});
	}

	public getMaxStatsValue(): StatValues {
		const playerClass = ClassDataController.instance.getById(this.class);
		return {
			attack: playerClass.getAttackValue(this.level),
			defense: playerClass.getDefenseValue(this.level),
			speed: playerClass.getSpeedValue(this.level)
		};
	}

	/**
	 * Check if a player has an empty mission slot
	 */
	public hasEmptyMissionSlot(missionSlots: MissionSlot[]): boolean {
		return missionSlots.filter(slot => !slot.isCampaign()).length < this.getMissionSlotsNumber();
	}

	/**
	 * Give experience to a player
	 * @param parameters
	 */
	public async addExperience(parameters: EditValueParameters): Promise<Player> {
		this.experience += parameters.amount;
		crowniclesInstance.logsDatabase.logExperienceChange(this.keycloakId, this.experience, parameters.reason)
			.then();
		if (parameters.amount > 0) {
			const newPlayer = await MissionsController.update(this, parameters.response, {
				missionId: "earnXP",
				count: parameters.amount
			});

			/*
			 * Clone the mission entity and player to this player model, and the entity instance passed in the parameters
			 * As the money and experience may have changed, we update the models of the caller
			 */
			Object.assign(this, newPlayer);
		}

		await this.levelUpIfNeeded(parameters.response);
		return this;
	}

	/**
	 * Get the number of secondary missions a player can have at maximum
	 */
	public getMissionSlotsNumber(): number {
		return this.level >= Constants.MISSIONS.SLOT_3_LEVEL ? 3 : this.level >= Constants.MISSIONS.SLOT_2_LEVEL ? 2 : 1;
	}

	/**
	 * Set the pet of the player
	 * @param petEntity
	 */
	public setPet(petEntity: PetEntity): void {
		this.petId = petEntity.id;
		crowniclesInstance.logsDatabase.logPlayerNewPet(this.keycloakId, petEntity)
			.then();
	}

	/**
	 * Calculate the cumulative attack of the player
	 * @param playerActiveObjects
	 */
	public getCumulativeAttack(playerActiveObjects: PlayerActiveObjects): number {
		const playerAttack = ClassDataController.instance.getById(this.class)
			.getAttackValue(this.level);
		const attack = playerAttack
			+ (playerActiveObjects.weapon.getAttack() < playerAttack
				? playerActiveObjects.weapon.getAttack()
				: playerAttack)
			+ (playerActiveObjects.armor.getAttack() < playerAttack
				? playerActiveObjects.armor.getAttack()
				: playerAttack)
			+ (playerActiveObjects.object.getAttack() / 2 < playerAttack
				? playerActiveObjects.object.getAttack()
				: playerAttack * 2)
			+ playerActiveObjects.potion.getAttack();
		return attack > 0 ? attack : 0;
	}

	/**
	 * Calculate the cumulative defense of the player
	 * @param playerActiveObjects
	 */
	public getCumulativeDefense(playerActiveObjects: PlayerActiveObjects): number {
		const playerDefense = ClassDataController.instance.getById(this.class)
			.getDefenseValue(this.level);
		const defense = playerDefense
			+ (playerActiveObjects.weapon.getDefense() < playerDefense
				? playerActiveObjects.weapon.getDefense()
				: playerDefense)
			+ (playerActiveObjects.armor.getDefense() < playerDefense
				? playerActiveObjects.armor.getDefense()
				: playerDefense)
			+ (playerActiveObjects.object.getDefense() / 2 < playerDefense
				? playerActiveObjects.object.getDefense()
				: playerDefense * 2)
			+ playerActiveObjects.potion.getDefense();
		return defense > 0 ? defense : 0;
	}

	/**
	 * Calculate the cumulative speed of the player
	 * @param playerActiveObjects
	 */
	public getCumulativeSpeed(playerActiveObjects: PlayerActiveObjects): number {
		const playerSpeed = ClassDataController.instance.getById(this.class)
			.getSpeedValue(this.level);
		const speed = playerSpeed
			+ (playerActiveObjects.weapon.getSpeed() < playerSpeed
				? playerActiveObjects.weapon.getSpeed()
				: playerSpeed)
			+ (playerActiveObjects.armor.getSpeed() < playerSpeed
				? playerActiveObjects.armor.getSpeed()
				: playerSpeed)
			+ (playerActiveObjects.object.getSpeed() / 2 < playerSpeed
				? playerActiveObjects.object.getSpeed()
				: playerSpeed * 2)
			+ playerActiveObjects.potion.getSpeed();
		return speed > 0 ? speed : 0;
	}

	/**
	 * Get the player cumulative energy
	 */
	public getCumulativeEnergy(): number {
		const maxEnergy = this.getMaxCumulativeEnergy();
		return MathUtils.clamp(maxEnergy - this.fightPointsLost, 0, maxEnergy);
	}

	public getRatioCumulativeEnergy(): number {
		return this.getCumulativeEnergy() / this.getMaxCumulativeEnergy();
	}

	/**
	 * Return the player max health
	 */
	public getMaxHealth(): number {
		const playerClass = ClassDataController.instance.getById(this.class);
		return playerClass.getMaxHealthValue(this.level);
	}

	/**
	 * Get the player max cumulative energy
	 */
	public getMaxCumulativeEnergy(): number {
		const playerClass = ClassDataController.instance.getById(this.class);
		return playerClass.getMaxCumulativeEnergyValue(this.level);
	}

	/**
	 * Add health to the player
	 * @param health
	 * @param response
	 * @param reason
	 * @param missionHealthParameter
	 */
	public async addHealth(health: number, response: CrowniclesPacket[], reason: NumberChangeReason, missionHealthParameter: MissionHealthParameter = {
		overHealCountsForMission: true,
		shouldPokeMission: true
	}): Promise<void> {
		await this.setHealth(this.health + health, response, missionHealthParameter);
		crowniclesInstance.logsDatabase.logHealthChange(this.keycloakId, this.health, reason)
			.then();
	}

	/**
	 * Add and logs energy gain
	 * @param energy
	 * @param reason
	 */
	public addEnergy(energy: number, reason: NumberChangeReason): void {
		this.setEnergyLost(Math.max(0, this.fightPointsLost - energy), reason);
	}

	/**
	 * Set the energy lost of the player to a specific value
	 * @param energy
	 * @param reason
	 */
	public setEnergyLost(energy: number, reason: NumberChangeReason): void {
		this.fightPointsLost = Math.min(energy, this.getMaxCumulativeEnergy());
		crowniclesInstance.logsDatabase.logEnergyChange(this.keycloakId, this.fightPointsLost, reason)
			.then();
	}

	/**
	 * Leave the PVE island if no energy left
	 * @param response
	 */
	public async leavePVEIslandIfNoEnergy(response: CrowniclesPacket[]): Promise<boolean> {
		if (!(Maps.isOnPveIsland(this) && this.fightPointsLost >= this.getMaxCumulativeEnergy())) {
			return false;
		}
		const {
			moneyLost,
			guildPointsLost
		} = await this.getAndApplyLostRessourcesOnPveFaint(response);
		const packet = makePacket(PlayerLeavePveIslandPacket, {
			moneyLost,
			guildPointsLost
		});
		response.push(packet);
		await Maps.stopTravel(this);
		await Maps.startTravel(
			this,
			MapLinkDataController.instance.getById(MapConstants.WATER_MAP_LINKS[RandomUtils.randInt(0, MapConstants.WATER_MAP_LINKS.length)]),
			Date.now()
		);
		await TravelTime.applyEffect(this, Effect.CONFOUNDED, 0, new Date(), NumberChangeReason.PVE_ISLAND);
		await PlayerSmallEvents.removeSmallEventsOfPlayer(this.id);
		return true;
	}

	/**
	 * Get the amount of breath a player has at the beginning of a fight
	 */
	public getBaseBreath(): number {
		const playerClass = ClassDataController.instance.getById(this.class);
		return playerClass.baseBreath;
	}

	/**
	 * Get the max amount of breath a player can have
	 */
	public getMaxBreath(): number {
		const playerClass = ClassDataController.instance.getById(this.class);
		return playerClass.maxBreath;
	}

	/**
	 * Get the amount of breath a player will get at the end of each turn
	 */
	public getBreathRegen(): number {
		const playerClass = ClassDataController.instance.getById(this.class);
		return playerClass.breathRegen;
	}

	/**
	 * Get the profile's color of the player
	 */
	public getProfileColor(): string {
		if (this.level < FightConstants.REQUIRED_LEVEL) {
			return null;
		}
		const playerLeague = this.getLeague();
		return playerLeague.color;
	}

	/**
	 * Get the league of the player
	 */
	public getLeague(): League {
		return LeagueDataController.instance.getByGlory(this.getGloryPoints());
	}

	/**
	 * Get the league of the player at the end of the last season
	 */
	public getLeagueLastSeason(): League {
		return LeagueDataController.instance.getByGlory(this.gloryPointsLastSeason);
	}

	/**
	 * Set the glory points of the player
	 * @param gloryPoints
	 * @param isDefense - true if the points to set are the defense Glory points
	 * @param reason
	 * @param response
	 * @param fightId
	 */
	public async setGloryPoints(gloryPoints: number, isDefense: boolean, reason: NumberChangeReason, response: CrowniclesPacket[], fightId: number | null = null): Promise<void> {
		if (isDefense) {
			this.defenseGloryPoints = gloryPoints;
			await crowniclesInstance.logsDatabase.logPlayersDefenseGloryPoints(this.keycloakId, gloryPoints, reason, fightId);
		}
		else {
			this.attackGloryPoints = gloryPoints;
			await crowniclesInstance.logsDatabase.logPlayersAttackGloryPoints(this.keycloakId, gloryPoints, reason, fightId);
		}
		Object.assign(this, await MissionsController.update(this, response, {
			missionId: "reachGlory",
			count: this.getGloryPoints(),
			set: true
		}));
	}

	/**
	 * Get the amount of points to award to the player at the end of the season
	 */
	public async getLastSeasonScoreToAward(): Promise<number> {
		const rank = await Players.getLastSeasonGloryRankById(this.id);
		if (rank > FightConstants.ELO.MAX_RANK_FOR_LEAGUE_POINTS_REWARD) {
			return 0;
		}
		const pointsToAward = Math.round(
			2995 - Math.sqrt(80000 * (rank - 1)) + 5 * rank
		);
		return Math.ceil(pointsToAward / 10) * 10;
	}

	/**
	 * Check in the logs if the player has claimed the league reward for the current season returns true if we find a value in the logs for the last 24 hours
	 */
	async hasClaimedLeagueReward(): Promise<boolean> {
		const dateOfLastLeagueReward = await LogsReadRequests.getDateOfLastLeagueReward(this.keycloakId);

		// Beware, the date of the last league reward is in seconds
		return dateOfLastLeagueReward && !(dateOfLastLeagueReward < millisecondsToSeconds(getOneDayAgo()));
	}

	public async addRage(rage: number, reason: NumberChangeReason, response: CrowniclesPacket[]): Promise<void> {
		await this.setRage(this.rage + rage, reason);
		if (rage > 0) {
			await MissionsController.update(this, response, {
				missionId: "gainRage",
				count: rage
			});
		}
	}

	public async setRage(rage: number, reason: NumberChangeReason): Promise<void> {
		this.rage = rage;
		crowniclesInstance.logsDatabase.logRageChange(this.keycloakId, this.rage, reason)
			.then();
		await this.save();
	}

	/**
	 * Check if the player has enough energy to join the island or fight
	 */
	hasEnoughEnergyToFight(): boolean {
		return this.getCumulativeEnergy() / this.getMaxCumulativeEnergy() >= PVEConstants.MINIMAL_ENERGY_RATIO;
	}

	/**
	 * Calculate and apply maluses on money and guild points when a player faints on PVE island
	 * @param response
	 */
	private async getAndApplyLostRessourcesOnPveFaint(response: CrowniclesPacket[]): Promise<ressourcesLostOnPveFaint> {
		const malusMultiplier = this.hasAGuild() ? PVEConstants.MONEY_MALUS_MULTIPLIER_FOR_GUILD_PLAYERS : PVEConstants.MONEY_MALUS_MULTIPLIER_FOR_SOLO_PLAYERS;
		let moneyLost = Math.round(this.level * PVEConstants.MONEY_LOST_PER_LEVEL_ON_DEATH * malusMultiplier);
		if (moneyLost > this.money) {
			moneyLost = this.money;
		}
		await this.addMoney({
			amount: -moneyLost,
			response,
			reason: NumberChangeReason.PVE_ISLAND
		});
		await this.save();

		let guildPointsLost = PVEConstants.GUILD_POINTS_LOST_ON_DEATH
			+ RandomUtils.crowniclesRandom.integer(-PVEConstants.RANDOM_RANGE_FOR_GUILD_POINTS_LOST_ON_DEATH, PVEConstants.RANDOM_RANGE_FOR_GUILD_POINTS_LOST_ON_DEATH);
		if (this.hasAGuild()) {
			const playerGuild = await Guilds.getById(this.guildId);
			if (guildPointsLost > playerGuild.score) {
				guildPointsLost = playerGuild.score;
			}
			await playerGuild.addScore(-guildPointsLost, response, NumberChangeReason.PVE_ISLAND);
			await playerGuild.save();
		}
		return {
			moneyLost,
			guildPointsLost: this.hasAGuild() ? guildPointsLost : 0
		};
	}

	/**
	 * Allow to set the score of a player to a specific value this is only called from addScore
	 * @param score
	 * @param response
	 */
	private async setScore(score: number, response: CrowniclesPacket[]): Promise<void> {
		await MissionsController.update(this, response, {
			missionId: "reachScore",
			count: score,
			set: true
		});
		if (score > 0) {
			this.score = score;
		}
		else {
			this.score = 0;
		}
	}

	/**
	 * Allow to set the money of a player to a specific value this is only called from addMoney
	 * @param money
	 */
	private setMoney(money: number): void {
		if (money > 0) {
			this.money = money;
		}
		else {
			this.money = 0;
		}
	}

	/**
	 * Set the tokens of a player clamped between 0 and the maximum capacity
	 * @param tokens
	 */
	private setTokens(tokens: number): void {
		this.tokens = MathUtils.clamp(tokens, 0, TokensConstants.MAX);
	}

	/**
	 * Add points to the weekly score of the player
	 * @param weeklyScore
	 */
	private addWeeklyScore(weeklyScore: number): void {
		this.weeklyScore += weeklyScore;
		this.setWeeklyScore(this.weeklyScore);
	}

	/**
	 * Set the weekly score of the player to a specific value this is only called from addWeeklyScore
	 * @param weeklyScore
	 */
	private setWeeklyScore(weeklyScore: number): void {
		if (weeklyScore > 0) {
			this.weeklyScore = weeklyScore;
		}
		else {
			this.weeklyScore = 0;
		}
	}

	/**
	 * Set the player health
	 * @param health
	 * @param response
	 * @param missionHealthParameter
	 */
	private async setHealth(health: number, response: CrowniclesPacket[], missionHealthParameter: MissionHealthParameter = {
		overHealCountsForMission: true,
		shouldPokeMission: true
	}): Promise<void> {
		const difference = (health > this.getMaxHealth() && !missionHealthParameter.overHealCountsForMission ? this.getMaxHealth() : health < 0 ? 0 : health)
			- this.health;
		if (difference > 0 && missionHealthParameter.shouldPokeMission) {
			await MissionsController.update(this, response, {
				missionId: "earnLifePoints",
				count: difference
			});
		}
		if (health < 0) {
			this.health = 0;
		}
		else if (health > this.getMaxHealth()) {
			this.health = this.getMaxHealth();
		}
		else {
			this.health = health;
		}
	}

	/**
	 * Check if the player has started to play by checking its effectId
	 * @returns true if the player has started to play
	 */
	public hasStartedToPlay(): boolean {
		return this.effectId !== Effect.NOT_STARTED.id;
	}
}

/**
 * This class is used to store information about players
 */
export class Players {
	/**
	 * Get or create a player
	 * @param keycloakId
	 */
	static async getOrRegister(keycloakId: string): Promise<Player> {
		return (await Player.findOrCreate(
			{ where: { keycloakId } }
		))[0]; // We don't care about the boolean that findOrCreate returns, so we strip it there
	}

	/**
	 * Get a player by guildId
	 * @param guildId
	 */
	static getByGuild(guildId: number): Promise<Player[]> {
		return Promise.resolve(Player.findAll(
			{
				where: { guildId },
				order: [
					["score", "DESC"],
					["level", "DESC"]
				]
			}
		));
	}

	/**
	 * Get a player by keycloakId
	 * @param keycloakId
	 */
	static getByKeycloakId(keycloakId: string): Promise<Player | null> {
		return Promise.resolve(Player.findOne(
			{ where: { keycloakId } }
		));
	}

	/**
	 * Manage a player parameter to get the interesting player
	 * @param askedPlayer
	 * @param originalPlayer
	 */
	static async getAskedPlayer(askedPlayer: {
		keycloakId?: string;
		rank?: number;
	}, originalPlayer: Player): Promise<Player | null> {
		return askedPlayer.keycloakId
			? askedPlayer.keycloakId === originalPlayer.keycloakId
				? originalPlayer
				: await Players.getByKeycloakId(askedPlayer.keycloakId)
			: await Players.getByRank(askedPlayer.rank);
	}

	/**
	 * Get the rank of a player
	 * @param playerId
	 */
	static async getRankById(playerId: number): Promise<number> {
		return await this.getRank(playerId, Constants.RANK_TYPES.SCORE);
	}

	/**
	 * Get the weekly rank of a player
	 * @param playerId
	 */
	static async getWeeklyRankById(playerId: number): Promise<number> {
		return await this.getRank(playerId, Constants.RANK_TYPES.WEEKLY_SCORE);
	}

	/**
	 * Get the weekly rank of a player
	 * @param playerId
	 */
	static async getLastSeasonGloryRankById(playerId: number): Promise<number> {
		return await this.getRank(playerId, Constants.RANK_TYPES.LAST_SEASON_GLORY);
	}

	/**
	 * Get the glory rank of a player
	 * @param playerId
	 */
	static async getGloryRankById(playerId: number): Promise<number> {
		return await this.getRank(playerId, Constants.RANK_TYPES.GLORY);
	}

	/**
	 * Get the rank of a player related to a specific type of value
	 * @param playerId
	 * @param rankType
	 */
	static async getRank(playerId: number, rankType: string): Promise<number> {
		const condition = rankType === Constants.RANK_TYPES.GLORY ? `WHERE fightCountdown <= ${FightConstants.FIGHT_COUNTDOWN_MAXIMAL_VALUE}` : "";
		const orderBy = rankType === Constants.RANK_TYPES.GLORY ? "(attackGloryPoints + defenseGloryPoints)" : rankType;
		const query = `SELECT ranking
		               FROM (SELECT id, RANK() OVER (ORDER BY ${orderBy} desc, level desc) ranking
		                     FROM players ${condition}) subquery
		               WHERE subquery.id = ${playerId}`;
		return ((await Player.sequelize.query(query))[0][0] as {
			ranking: number;
		}).ranking;
	}

	/**
	 * Get the number of players that are considered playing the game
	 * @param weekOnly Get of the current week only
	 */
	static async getNumberOfPlayingPlayers(weekOnly: boolean): Promise<number> {
		const query = `SELECT COUNT(*) as nbPlayers
		               FROM players
		               WHERE players.${weekOnly ? "weeklyScore" : "score"}
			                     > ${Constants.MINIMAL_PLAYER_SCORE}`;
		const queryResult = await Player.sequelize.query(query);
		return (queryResult[0][0] as {
			nbPlayers: number;
		}).nbPlayers;
	}

	/**
	 * Get the number of players that are considered playing the game
	 */
	static async getNumberOfFightingPlayers(): Promise<number> {
		const query = `SELECT COUNT(*) as nbPlayers
		               FROM players
		               WHERE players.fightCountdown
			                     <= ${FightConstants.FIGHT_COUNTDOWN_MAXIMAL_VALUE}`;
		const queryResult = await Player.sequelize.query(query);
		return (queryResult[0][0] as {
			nbPlayers: number;
		}).nbPlayers;
	}

	/**
	 * Get the players in the list of Ids that will be printed into the top at the given page
	 * @param minRank
	 * @param maxRank
	 * @param weekOnly Get from the current week only
	 */
	static async getPlayersTop(minRank: number, maxRank: number, weekOnly: boolean): Promise<Player[]> {
		const restrictionsTopEntering = weekOnly
			? {
				weeklyScore: {
					[Op.gt]: Constants.MINIMAL_PLAYER_SCORE
				}
			}
			: {
				score: {
					[Op.gt]: Constants.MINIMAL_PLAYER_SCORE
				}
			};
		return await Player.findAll({
			where: {
				...restrictionsTopEntering
			},
			order: [
				[weekOnly ? "weeklyScore" : "score", "DESC"],
				["level", "DESC"]
			],
			limit: maxRank - minRank + 1,
			offset: minRank - 1
		});
	}

	/**
	 * Get the players that will be printed into the glory top at the given page
	 * @param minRank
	 * @param maxRank
	 */
	static async getPlayersGloryTop(minRank: number, maxRank: number): Promise<Player[]> {
		const restrictionsTopEntering = {
			fightCountdown: {
				[Op.lte]: FightConstants.FIGHT_COUNTDOWN_MAXIMAL_VALUE
			}
		};
		return await Player.findAll({
			where: {
				[Op.and]: {
					...restrictionsTopEntering
				}
			},
			order: [
				[Sequelize.literal("(attackGloryPoints + defenseGloryPoints)"), "DESC"],
				["level", "DESC"]
			],
			limit: maxRank - minRank + 1,
			offset: minRank - 1
		});
	}


	/**
	 * Get the player with the given rank
	 * @param rank
	 */
	static async getByRank(rank: number): Promise<Player | null> {
		const query = `SELECT *
		               FROM (SELECT *,
		                            RANK() OVER (ORDER BY score desc, level desc)       rank,
		                            RANK() OVER (ORDER BY weeklyScore desc, level desc) weeklyRank
		                     FROM players) subquery
		               WHERE subquery.rank = :rank`;
		const res = await Player.sequelize.query(query, {
			replacements: { rank },
			type: QueryTypes.SELECT,
			mapToModel: true,
			model: Player
		});
		return res.length === 0 ? null : res[0];
	}

	/**
	 * Get the player with the given id
	 * @param id
	 */
	static async getById(id: number): Promise<Player> {
		const query = `SELECT *
		               FROM (SELECT *,
		                            RANK() OVER (ORDER BY score desc, level desc)       rank,
		                            RANK() OVER (ORDER BY weeklyScore desc, level desc) weeklyRank
		                     FROM players) subquery
		               WHERE subquery.id = :id`;
		const playerToReturn = (await Player.sequelize.query<Player>(query, {
			replacements: { id },
			type: QueryTypes.SELECT
		}))[0] as Player;
		return await Players.getOrRegister(playerToReturn.keycloakId);
	}

	/**
	 * Get the mean of all points of the players
	 */
	static async getNbMeanPoints(): Promise<number> {
		const query = `SELECT AVG(score) as avg
		               FROM players
		               WHERE score > ${Constants.MINIMAL_PLAYER_SCORE}`;
		return Math.round(
			(<{
				avg: number;
			}[]>(await Player.sequelize.query(query, {
				type: QueryTypes.SELECT
			})))[0].avg
		);
	}

	/**
	 * Get the mean of all weekly scores of the players
	 */
	static async getMeanWeeklyScore(): Promise<number> {
		const query = `SELECT AVG(weeklyScore) as avg
		               FROM players
		               WHERE score > ${Constants.MINIMAL_PLAYER_SCORE}`;
		return Math.round(
			(<{
				avg: number;
			}[]>(await Player.sequelize.query(query, {
				type: QueryTypes.SELECT
			})))[0].avg
		);
	}

	/**
	 * Get the number of players who haven't started the adventure
	 */
	static async getNbPlayersHaventStartedTheAdventure(): Promise<number> {
		const query = `SELECT COUNT(*) as count
		               FROM players
		               WHERE effectId = "${Effect.NOT_STARTED.id}"`;
		return (<{
			count: number;
		}[]>(await Player.sequelize.query(query, {
			type: QueryTypes.SELECT
		})))[0].count;
	}

	/**
	 * Get the number of players who have started the adventure
	 */
	static async getNbPlayersHaveStartedTheAdventure(): Promise<number> {
		const query = `SELECT COUNT(*) as count
		               FROM players
		               WHERE score > ${Constants.MINIMAL_PLAYER_SCORE}`;
		return (<{
			count: number;
		}[]>(await Player.sequelize.query(query, {
			type: QueryTypes.SELECT
		})))[0].count;
	}

	/**
	 * Get the mean of all levels of the players
	 */
	static async getLevelMean(): Promise<number> {
		const query = `SELECT AVG(level) as avg
		               FROM players
		               WHERE score > ${Constants.MINIMAL_PLAYER_SCORE}`;
		return Math.round(
			(<{
				avg: number;
			}[]>(await Player.sequelize.query(query, {
				type: QueryTypes.SELECT
			})))[0].avg
		);
	}

	/**
	 * Get the mean out of all money of the players
	 */
	static async getNbMeanMoney(): Promise<number> {
		const query = `SELECT AVG(money) as avg
		               FROM players
		               WHERE score > ${Constants.MINIMAL_PLAYER_SCORE}`;
		return Math.round(
			(<{
				avg: number;
			}[]>(await Player.sequelize.query(query, {
				type: QueryTypes.SELECT
			})))[0].avg
		);
	}

	/**
	 * Get the sum of all money in the game
	 */
	static async getSumAllMoney(): Promise<number> {
		const query = `SELECT SUM(money) as sum
		               FROM players
		               WHERE score > ${Constants.MINIMAL_PLAYER_SCORE}`;
		return (<{
			sum: number;
		}[]>(await Player.sequelize.query(query, {
			type: QueryTypes.SELECT
		})))[0].sum;
	}

	/**
	 * Get the money of the richest player
	 */
	static async getRichestPlayer(): Promise<number> {
		const query = `SELECT MAX(money) as max
		               FROM players`;
		return (<{
			max: number;
		}[]>(await Player.sequelize.query(query, {
			type: QueryTypes.SELECT
		})))[0].max;
	}

	/**
	 * Get the number of players with the given class
	 * @param classEntity
	 */
	static async getNbPlayersWithClass(classEntity: Class): Promise<number> {
		const query = `SELECT COUNT(*) as count
		               FROM players
		               WHERE class = :class
			             AND score
			               > ${Constants.MINIMAL_PLAYER_SCORE}`;
		return Math.round(
			(<{
				count: number;
			}[]>(await Player.sequelize.query(query, {
				replacements: { class: classEntity.id },
				type: QueryTypes.SELECT
			})))[0].count
		);
	}

	/**
	 * Find the X players that are the closest in defense glory to a specific value
	 * @param player - the player that needs an opponent
	 * @param amountOfPlayersToRetrieve - the X amount of players
	 * @param offset - offset in case the found players are not enough and an offset search is necessary
	 */
	static async findPotentialOpponents(player: Player, amountOfPlayersToRetrieve: number, offset: number): Promise<Player[]> {
		return await Player.findAll({
			where: {
				id: { [Op.ne]: player.id },
				defenseGloryPoints: {
					[Op.ne]: null,
					[Op.between]: [
						player.attackGloryPoints - FightConstants.ELO.MAX_ELO_GAP,
						player.attackGloryPoints + FightConstants.ELO.MAX_ELO_GAP
					]
				},
				level: { [Op.gte]: FightConstants.REQUIRED_LEVEL }
			},
			order: [
				// Sort using the difference with the attack elo of the player
				[Sequelize.literal(`ABS(defenseGloryPoints - ${player.attackGloryPoints})`), "ASC"]
			],
			limit: amountOfPlayersToRetrieve,
			offset
		});
	}

	/**
	 * Find the X active players that are the closest in defense glory to a specific value.
	 * Active players are those whose startTravelDate is within the last two weeks.
	 * @param player - the player that needs an opponent
	 * @param amountOfPlayersToRetrieve - the X amount of players
	 * @param offset - offset in case the found players are not enough and an offset search is necessary
	 */
	static async findActivePotentialOpponents(player: Player, amountOfPlayersToRetrieve: number, offset: number): Promise<Player[]> {
		const twoWeeksAgo = new Date(Date.now() - daysToMilliseconds(FightConstants.ACTIVE_PLAYER_TIME_LIMIT_DAYS));
		return await Player.findAll({
			where: {
				id: { [Op.ne]: player.id },
				defenseGloryPoints: {
					[Op.ne]: null,
					[Op.between]: [
						player.attackGloryPoints - FightConstants.ELO.MAX_ELO_GAP,
						player.attackGloryPoints + FightConstants.ELO.MAX_ELO_GAP
					]
				},
				level: { [Op.gte]: FightConstants.REQUIRED_LEVEL },
				startTravelDate: { [Op.gte]: twoWeeksAgo }
			},
			order: [
				// Sort using the difference with the attack elo of the player
				[Sequelize.literal(`ABS(defenseGloryPoints - ${player.attackGloryPoints})`), "ASC"]
			],
			limit: amountOfPlayersToRetrieve,
			offset
		});
	}
}

/**
 * Init the model
 * @param sequelize
 */
export function initModel(sequelize: Sequelize): void {
	Player.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		keycloakId: {
			type: DataTypes.STRING(64) // eslint-disable-line new-cap
		},
		health: {
			type: DataTypes.INTEGER,
			defaultValue: EntityConstants.DEFAULT_VALUES.HEALTH
		},
		fightPointsLost: {
			type: DataTypes.INTEGER,
			defaultValue: EntityConstants.DEFAULT_VALUES.FIGHT_POINTS_LOST
		},
		score: {
			type: DataTypes.INTEGER,
			defaultValue: PlayersConstants.PLAYER_DEFAULT_VALUES.SCORE
		},
		weeklyScore: {
			type: DataTypes.INTEGER,
			defaultValue: PlayersConstants.PLAYER_DEFAULT_VALUES.WEEKLY_SCORE
		},
		level: {
			type: DataTypes.INTEGER,
			defaultValue: PlayersConstants.PLAYER_DEFAULT_VALUES.LEVEL
		},
		experience: {
			type: DataTypes.INTEGER,
			defaultValue: PlayersConstants.PLAYER_DEFAULT_VALUES.EXPERIENCE
		},
		money: {
			type: DataTypes.INTEGER,
			defaultValue: PlayersConstants.PLAYER_DEFAULT_VALUES.MONEY
		},
		tokens: {
			type: DataTypes.INTEGER,
			defaultValue: PlayersConstants.PLAYER_DEFAULT_VALUES.TOKENS
		},
		class: {
			type: DataTypes.INTEGER,
			defaultValue: PlayersConstants.PLAYER_DEFAULT_VALUES.CLASS
		},
		badges: {
			type: DataTypes.TEXT,
			defaultValue: PlayersConstants.PLAYER_DEFAULT_VALUES.BADGES
		},
		guildId: {
			type: DataTypes.INTEGER,
			defaultValue: PlayersConstants.PLAYER_DEFAULT_VALUES.GUILD_ID
		},
		nextEvent: { type: DataTypes.INTEGER },
		petId: { type: DataTypes.INTEGER },
		lastPetFree: {
			type: DataTypes.DATE,
			defaultValue: PlayersConstants.PLAYER_DEFAULT_VALUES.LAST_PET_FREE
		},
		effectId: {
			type: DataTypes.STRING(32), // eslint-disable-line new-cap
			defaultValue: PlayersConstants.PLAYER_DEFAULT_VALUES.EFFECT
		},
		effectEndDate: {
			type: DataTypes.DATE,
			defaultValue: new Date()
		},
		effectDuration: {
			type: DataTypes.INTEGER,
			defaultValue: PlayersConstants.PLAYER_DEFAULT_VALUES.EFFECT_DURATION
		},
		mapLinkId: { type: DataTypes.INTEGER },
		startTravelDate: {
			type: DataTypes.DATE,
			defaultValue: PlayersConstants.PLAYER_DEFAULT_VALUES.START_TRAVEL_DATE
		},
		attackGloryPoints: {
			type: DataTypes.INTEGER,
			defaultValue: FightConstants.ELO.DEFAULT_ELO
		},
		defenseGloryPoints: {
			type: DataTypes.INTEGER,
			defaultValue: FightConstants.ELO.DEFAULT_ELO
		},
		gloryPointsLastSeason: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		fightCountdown: {
			type: DataTypes.INTEGER,
			defaultValue: FightConstants.DEFAULT_FIGHT_COUNTDOWN
		},
		rage: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		banned: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		},
		hasTalisman: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		},
		hasCloneTalisman: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		},
		updatedAt: {
			type: DataTypes.DATE,
			defaultValue: moment()
				.format("YYYY-MM-DD HH:mm:ss")
		},
		createdAt: {
			type: DataTypes.DATE,
			defaultValue: moment()
				.format("YYYY-MM-DD HH:mm:ss")
		}
	}, {
		sequelize,
		tableName: "players",
		freezeTableName: true
	});

	Player.beforeSave(instance => {
		instance.updatedAt = moment()
			.toDate();
	});

	Player.afterSave(instance => {
		if (!instance.mapLinkId) {
			return;
		}

		const handleNotifications = async (): Promise<void> => {
			// Report Notification
			const now = new Date();
			const travelEndDate = new Date(TravelTime.getTravelDataSimplified(instance, now).travelEndTime);
			const destinationId = instance.getDestinationId();
			const pendingReportNotification = await ScheduledReportNotifications.getPendingNotification(instance.id);
			if (pendingReportNotification) {
				await ScheduledReportNotifications.bulkDelete([pendingReportNotification]);
			}

			if (travelEndDate > now) {
				await ScheduledReportNotifications.scheduleNotification(instance.id, instance.keycloakId, destinationId, travelEndDate);
				return;
			}

			if (pendingReportNotification && destinationId === pendingReportNotification.mapId) {
				PacketUtils.sendNotifications([
					makePacket(ReachDestinationNotificationPacket, {
						keycloakId: pendingReportNotification.keycloakId,
						mapType: MapLocationDataController.instance.getById(pendingReportNotification.mapId).type,
						mapId: pendingReportNotification.mapId
					})
				]);
			}
		};

		handleNotifications()
			.then()
			.catch(error => {
				CrowniclesLogger.errorWithObj("Error while handling notifications", error);
			});
	});
}

export default Player;
