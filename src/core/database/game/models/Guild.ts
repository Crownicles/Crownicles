import {DataTypes, Model, Op, QueryTypes, Sequelize} from "sequelize";
import {DraftBotEmbed} from "../../../messages/DraftBotEmbed";
import {TextBasedChannel} from "discord.js";
import {Translations} from "../../../Translations";
import {MissionsController} from "../../../missions/MissionsController";
import {Constants} from "../../../Constants";
import {getFoodIndexOf} from "../../../utils/FoodUtils";
import Player, {Players} from "./Player";
import {draftBotInstance} from "../../../bot";
import {NumberChangeReason} from "../../../constants/LogsConstants";
import {PetEntityConstants} from "../../../constants/PetEntityConstants";
import {GuildConstants} from "../../../constants/GuildConstants";
import {GuildPet, GuildPets} from "./GuildPet";
import PetEntity from "./PetEntity";
import moment = require("moment");
import {TopConstants} from "../../../constants/TopConstants";

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
				Constants.XP.BASE_VALUE *
				Math.pow(Constants.XP.COEFFICIENT, this.level + 1)
			) - Constants.XP.MINUS
		);
	}

	/**
	 * Completely destroy a guild from the database
	 */
	public async completelyDestroyAndDeleteFromTheDatabase(): Promise<void> {
		draftBotInstance.logsDatabase.logGuildDestroy(this).then();
		const guildPetsToDestroy: Promise<void>[] = [];
		const petsEntitiesToDestroy: Promise<number>[] = [];
		const pets = await GuildPets.getOfGuild(this.id);
		for (const pet of pets) {
			guildPetsToDestroy.push(pet.destroy());
			petsEntitiesToDestroy.push(PetEntity.destroy({where: {id: pet.petEntityId}}));
		}
		await Promise.all([
			Player.update(
				{guildId: null},
				{
					where: {
						guildId: this.id
					}
				}
			),
			Guild.destroy({
				where: {
					id: this.id
				}
			}),
			guildPetsToDestroy,
			petsEntitiesToDestroy
		]);

	}

	/**
	 * Add experience to the guild
	 * @param experience the experience to add
	 * @param channel the channel where the display will be done
	 * @param language the language to use to display the message
	 * @param reason The reason of the experience change
	 */
	public async addExperience(experience: number, channel: TextBasedChannel, language: string, reason: NumberChangeReason): Promise<void> {
		if (this.isAtMaxLevel()) {
			return;
		}
		// We assume that you cannot go the level 98 to 100 with 1 xp addition
		if (this.level === GuildConstants.MAX_LEVEL - 1) {
			const xpNeededToLevelUp = this.getExperienceNeededToLevelUp();
			if (this.experience + experience > xpNeededToLevelUp) {
				experience = xpNeededToLevelUp - this.experience;
			}
		}
		this.experience += experience;
		this.setExperience(this.experience);
		draftBotInstance.logsDatabase.logGuildExperienceChange(this, reason).then();
		await this.levelUpIfNeeded(channel, language);
	}

	/**
	 * Check if the guild need to level up
	 */
	public needLevelUp(): boolean {
		return this.experience >= this.getExperienceNeededToLevelUp();
	}

	/**
	 * Level up the guild if needed
	 * @param channel the channel where the display will be done
	 * @param language the language to use to display the message
	 */
	public async levelUpIfNeeded(channel: TextBasedChannel, language: string): Promise<void> {
		if (!this.needLevelUp()) {
			return;
		}
		const tr = Translations.getModule("models.guilds", language);
		this.experience -= this.getExperienceNeededToLevelUp();
		this.level++;
		draftBotInstance.logsDatabase.logGuildLevelUp(this).then();
		draftBotInstance.logsDatabase.logGuildExperienceChange(this, NumberChangeReason.LEVEL_UP).then();
		const embed = new DraftBotEmbed()
			.setTitle(
				tr.format("levelUp.title", {
					guildName: this.name
				})
			)
			.setDescription(
				tr.format("levelUp.desc", {
					level: this.level
				})
			);
		await channel.send({embeds: [embed]});
		for (const member of await Players.getByGuild(this.id)) {
			await MissionsController.update(member, channel, language, {
				missionId: "guildLevel",
				count: this.level,
				set: true
			});
		}

		await this.levelUpIfNeeded(channel, language);
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
		return guildPets.length >= PetEntityConstants.SLOTS;
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
		draftBotInstance.logsDatabase.logGuildsFoodChanges(this, getFoodIndexOf(selectedItemType), this.getDataValue(selectedItemType), reason).then();
	}

	/**
	 * Remove food from the guid storage
	 * @param item
	 * @param quantity
	 * @param reason
	 */
	public removeFood(item: string, quantity: number, reason: NumberChangeReason): void {
		this.setDataValue(item, this.getDataValue(item) - quantity);
		draftBotInstance.logsDatabase.logGuildsFoodChanges(this, getFoodIndexOf(item), this.getDataValue(item), reason).then();
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
	 * Add guild points
	 * @param points
	 * @param reason
	 */
	public addScore(points: number, reason: NumberChangeReason): void {
		this.score += points;
		draftBotInstance.logsDatabase.logGuildPointsChange(this, reason).then();
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
		return ((await Guild.sequelize.query(query, {
			replacements: {
				id: this.id
			}
		}))[0][0] as { ranking: number }).ranking;
	}
}

export class Guilds {
	static getById(id: number): Promise<Guild> {
		return Promise.resolve(Guild.findOne({
			where: {
				id
			}
		}));
	}

	static getByName(name: string): Promise<Guild> {
		return Promise.resolve(Guild.findOne({
			where: {
				name
			}
		}));
	}

	static async getGuildLevelMean(): Promise<number> {
		const query = `SELECT AVG(level) as avg
					   FROM guilds`;
		return Math.round(
			(<{ avg: number }[]>(await Guild.sequelize.query(query, {
				type: QueryTypes.SELECT
			})))[0].avg
		);
	}

	static getTotalRanked(): Promise<number> {
		return Guild.count({
			where: {
				[Op.not]: {
					score: 0
				}
			}
		});
	}

	static getRankedGuilds(minRank: number, maxRank: number): Promise<Guild[]> {
		return Guild.findAll({
			where: {
				[Op.not]: {
					score: 0
				}
			},
			order: [
				["score", "DESC"],
				["level", "DESC"]
			],
			limit: maxRank - minRank + 1,
			offset: minRank - 1
		});
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
			defaultValue: moment().format("YYYY-MM-DD HH:mm:ss")
		},
		createdAt: {
			type: DataTypes.DATE,
			defaultValue: moment().format("YYYY-MM-DD HH:mm:ss")
		}
	}, {
		sequelize,
		tableName: "guilds",
		freezeTableName: true
	}).beforeSave(instance => {
		instance.updatedAt = moment().toDate();
	});
}

export default Guild;