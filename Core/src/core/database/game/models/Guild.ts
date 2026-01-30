import {
	DataTypes, Model, Op, QueryTypes, Sequelize
} from "sequelize";
import { MissionsController } from "../../../missions/MissionsController";
import { getFoodIndexOf } from "../../../utils/FoodUtils";
import Player, { Players } from "./Player";
import { EditValueParameters } from "../EditValueParameters";
import {
	GuildPet, GuildPets
} from "./GuildPet";
import PetEntity, { PetEntities } from "./PetEntity";
import { crowniclesInstance } from "../../../../index";
import {
	CrowniclesPacket, makePacket
} from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { GuildLevelUpPacket } from "../../../../../../Lib/src/packets/events/GuildLevelUpPacket";
import { TopConstants } from "../../../../../../Lib/src/constants/TopConstants";
import { Constants } from "../../../../../../Lib/src/constants/Constants";
import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import { GuildConstants } from "../../../../../../Lib/src/constants/GuildConstants";
import { PetConstants } from "../../../../../../Lib/src/constants/PetConstants";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";

export class Guild extends Model {
	declare readonly id: number;

	declare name: string;

	declare guildDescription: string;

	declare score: number;

	declare level: number;

	declare experience: number;

	declare commonFood: number;

	declare carnivorousFood: number;

	declare herbivorousFood: number;

	declare ultimateFood: number;

	declare lastDailyAt: Date;

	declare chiefId: number;

	declare elderId: number;

	declare creationDate: Date;

	declare updatedAt: Date;

	declare createdAt: Date;


	/**
	 * Update the lastDailyAt date
	 */
	public updateLastDailyAt(): void {
		this.lastDailyAt = new Date();
	}

	/**
	 * Get the experience needed to level up
	 */
	public getExperienceNeededToLevelUp(): number {
		return (
			Math.round(
				Constants.XP.BASE_VALUE
				* Math.pow(Constants.XP.COEFFICIENT, this.level + 1)
			) - Constants.XP.MINUS
		);
	}

	/**
	 * Completely destroy a guild from the database
	 */
	public async completelyDestroyAndDeleteFromTheDatabase(): Promise<void> {
		const pets = await GuildPets.getOfGuild(this.id);
		const guildPetsEntities: PetEntity[] = [];
		for (const guildPet of pets) {
			const petEntity = await PetEntities.getById(guildPet.petEntityId);
			if (petEntity) {
				guildPetsEntities.push(petEntity);
			}
		}

		crowniclesInstance.logsDatabase.logGuildDestroy(this, await Players.getByGuild(this.id), guildPetsEntities)
			.then();
		const guildPetsToDestroy: Promise<void>[] = [];
		const petsEntitiesToDestroy: Promise<number>[] = [];
		for (const pet of pets) {
			guildPetsToDestroy.push(pet.destroy());
			petsEntitiesToDestroy.push(PetEntity.destroy({ where: { id: pet.petEntityId } }));
		}
		await Promise.all([
			Player.update(
				{ guildId: null },
				{ where: { guildId: this.id } }
			),
			Guild.destroy({
				where: { id: this.id }
			}),
			guildPetsToDestroy,
			petsEntitiesToDestroy
		]);
	}

	/**
	 * Add experience to the guild
	 * @param parameters The parameters for adding experience
	 */
	public async addExperience(parameters: EditValueParameters): Promise<void> {
		if (this.isAtMaxLevel()) {
			return;
		}

		let experience = parameters.amount;

		// We assume that you cannot go level max -2 to max with 1 xp addition
		if (this.level === GuildConstants.MAX_LEVEL - 1) {
			const xpNeededToLevelUp = this.getExperienceNeededToLevelUp();
			if (this.experience + experience > xpNeededToLevelUp) {
				experience = xpNeededToLevelUp - this.experience;
			}
		}
		this.experience += experience;
		this.setExperience(this.experience);
		crowniclesInstance.logsDatabase.logGuildExperienceChange(this, parameters.reason)
			.then();
		await this.levelUpIfNeeded(parameters.response);
	}

	/**
	 * Check if the guild need to level up
	 */
	public needLevelUp(): boolean {
		return this.experience >= this.getExperienceNeededToLevelUp();
	}

	/**
	 * Level up the guild if needed
	 * @param response the response packets
	 */
	public async levelUpIfNeeded(response: CrowniclesPacket[]): Promise<void> {
		if (!this.needLevelUp()) {
			return;
		}
		this.experience -= this.getExperienceNeededToLevelUp();
		this.level++;
		crowniclesInstance.logsDatabase.logGuildLevelUp(this)
			.then();
		crowniclesInstance.logsDatabase.logGuildExperienceChange(this, NumberChangeReason.LEVEL_UP)
			.then();
		response.push(makePacket(GuildLevelUpPacket, {
			guildName: this.name,
			level: this.level
		}));
		for (const member of await Players.getByGuild(this.id)) {
			await MissionsController.update(member, response, {
				missionId: "guildLevel",
				count: this.level,
				set: true
			});
		}

		await this.levelUpIfNeeded(response);
	}

	/**
	 * Get the guild's elder id
	 */
	public getElderId(): number {
		return this.elderId;
	}

	/**
	 * Get the guild's chief id
	 */
	public getChiefId(): number {
		return this.chiefId;
	}

	/**
	 * Check if the pet shelter is full
	 */
	public isPetShelterFull(guildPets: GuildPet[]): boolean {
		if (!guildPets) {
			return true;
		}
		return guildPets.length >= PetConstants.SLOTS;
	}

	/**
	 * Check if the guild is at max level
	 */
	public isAtMaxLevel(): boolean {
		return this.level >= GuildConstants.MAX_LEVEL;
	}

	/**
	 * Check the states of the guild storage for a given food type
	 * @param selectedItemType the food type to check
	 * @param quantity the quantity that need to be available
	 */
	public isStorageFullFor(selectedItemType: string, quantity: number): boolean {
		return this.getDataValue(selectedItemType) + quantity > GuildConstants.MAX_PET_FOOD[getFoodIndexOf(selectedItemType)];
	}

	/**
	 * Add food to the guild storage
	 * @param selectedItemType the food type to add
	 * @param quantity the quantity to add
	 * @param reason change reason
	 */
	public addFood(selectedItemType: string, quantity: number, reason: NumberChangeReason): void {
		this.setDataValue(selectedItemType, this.getDataValue(selectedItemType) + quantity);
		if (this.isStorageFullFor(selectedItemType, 0)) {
			this.setDataValue(selectedItemType, GuildConstants.MAX_PET_FOOD[getFoodIndexOf(selectedItemType)]);
		}
		crowniclesInstance.logsDatabase.logGuildsFoodChanges(this, getFoodIndexOf(selectedItemType), this.getDataValue(selectedItemType), reason)
			.then();
	}

	/**
	 * Remove food from the guid storage
	 * @param item
	 * @param quantity
	 * @param reason
	 */
	public removeFood(item: string, quantity: number, reason: NumberChangeReason): void {
		this.setDataValue(item, this.getDataValue(item) - quantity);
		crowniclesInstance.logsDatabase.logGuildsFoodChanges(this, getFoodIndexOf(item), this.getDataValue(item), reason)
			.then();
	}

	/**
	 * Add guild points
	 * @param parameters The parameters for adding score
	 */
	public async addScore(parameters: EditValueParameters): Promise<void> {
		this.score += parameters.amount;
		if (parameters.amount > 0) {
			for (const member of await Players.getByGuild(this.id)) {
				await MissionsController.update(member, parameters.response, {
					missionId: "guildHasPoints",
					count: this.score,
					set: true
				});
			}
		}
		crowniclesInstance.logsDatabase.logGuildPointsChange(this, parameters.reason)
			.then();
	}

	/**
	 * Get guild ranking
	 */
	public async getRanking(): Promise<number> {
		if (this.score === 0) {
			return TopConstants.TOP_GUILD_NOT_RANKED_REASON.ZERO_POINTS;
		}

		const query = `SELECT ranking
                       FROM (SELECT id, RANK() OVER (ORDER BY score desc, level desc) ranking
                             FROM guilds) subquery
                       WHERE subquery.id = :id`;
		return ((await Guild.sequelize!.query(query, {
			replacements: { id: this.id },
			type: QueryTypes.SELECT
		}))[0] as {
			ranking: number;
		}).ranking;
	}

	/**
	 * Set the guild's experience
	 * @param experience
	 */
	private setExperience(experience: number): void {
		if (experience > 0) {
			this.experience = experience;
		}
		else {
			this.experience = 0;
		}
	}

	/**
	 * Check if the player is the elder or the chief of the guild
	 * @param player
	 */
	public isChiefOrElder(player: Player): boolean {
		return player.id === this.elderId || player.id === this.chiefId;
	}
}

export abstract class Guilds {
	static getById(id: number): Promise<Guild | null> {
		return Promise.resolve(Guild.findOne({
			where: { id }
		}));
	}

	static getByName(name: string): Promise<Guild | null> {
		return Promise.resolve(Guild.findOne({
			where: { name }
		}));
	}

	static async getGuildLevelMean(): Promise<number> {
		const query = `SELECT AVG(level) as avg
                       FROM guilds`;
		return Math.round(
			(<{
				avg: number;
			}[]>(await Guild.sequelize!.query(query, {
				type: QueryTypes.SELECT
			})))[0].avg
		);
	}

	static getTotalRanked(): Promise<number> {
		return Guild.count({
			where: { [Op.not]: { score: 0 } }
		});
	}

	static getRankedGuilds(minRank: number, maxRank: number): Promise<Guild[]> {
		return Guild.findAll({
			where: { [Op.not]: { score: 0 } },
			order: [
				["score", "DESC"],
				["level", "DESC"]
			],
			limit: maxRank - minRank + 1,
			offset: minRank - 1
		});
	}

	static async ofPlayer(player: Player): Promise<Guild | null> {
		try {
			return await Guilds.getById(player.guildId);
		}
		catch {
			return null;
		}
	}
}

export function initModel(sequelize: Sequelize): void {
	Guild.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		name: DataTypes.STRING(32), // eslint-disable-line new-cap
		guildDescription: DataTypes.STRING(300), // eslint-disable-line new-cap
		score: {
			type: DataTypes.INTEGER,
			defaultValue: GuildConstants.DEFAULT_VALUES.SCORE
		},
		level: {
			type: DataTypes.INTEGER,
			defaultValue: GuildConstants.DEFAULT_VALUES.LEVEL
		},
		experience: {
			type: DataTypes.INTEGER,
			defaultValue: GuildConstants.DEFAULT_VALUES.EXPERIENCE
		},
		commonFood: {
			type: DataTypes.INTEGER,
			defaultValue: GuildConstants.DEFAULT_VALUES.COMMON_FOOD
		},
		carnivorousFood: {
			type: DataTypes.INTEGER,
			defaultValue: GuildConstants.DEFAULT_VALUES.CARNIVOROUS_FOOD
		},
		herbivorousFood: {
			type: DataTypes.INTEGER,
			defaultValue: GuildConstants.DEFAULT_VALUES.HERBIVOROUS_FOOD
		},
		ultimateFood: {
			type: DataTypes.INTEGER,
			defaultValue: GuildConstants.DEFAULT_VALUES.ULTIMATE_FOOD
		},
		lastDailyAt: {
			type: DataTypes.DATE,
			defaultValue: null
		},
		chiefId: DataTypes.INTEGER,
		elderId: DataTypes.INTEGER,
		creationDate: {
			type: DataTypes.DATE,
			defaultValue: DataTypes.NOW
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
		tableName: "guilds",
		freezeTableName: true
	})
		.beforeSave(instance => {
			instance.updatedAt = moment()
				.toDate();
		});
}

export default Guild;
