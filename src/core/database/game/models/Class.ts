import {DataTypes, Model, Sequelize} from "sequelize";
import {Translations} from "../../../Translations";
import {Data} from "../../../Data";
import {format} from "../../../utils/StringFormatter";
import * as moment from "moment";
import {ClassInfoConstants} from "../../../constants/ClassInfoConstants";
import {Constants} from "../../../Constants";

export class Class extends Model {
	declare readonly id: number;

	declare readonly attack: number;

	declare readonly defense: number;

	declare readonly speed: number;

	declare readonly health: number;

	declare readonly fightPoint: number;

	declare readonly baseBreath: number;

	declare readonly maxBreath: number;

	declare readonly breathRegen: number;

	declare readonly emoji: string;

	declare readonly classGroup: number;

	declare readonly fr: string;

	declare readonly en: string;

	declare updatedAt: Date;

	declare createdAt: Date;

	/**
	 * display the information of the class
	 * @param language
	 * @param level
	 */
	public toString(language: string, level: number): string {
		return format(ClassInfoConstants.FIELDS_VALUE, {
			name: this.getName(language),
			attack: this.getAttackValue(level),
			defense: this.getDefenseValue(level),
			speed: this.getSpeedValue(level),
			health: this.health + level,
			classGroup: this.classGroup,
			fightPoint: this.getMaxCumulativeFightPointValue(level),
			baseBreath: this.baseBreath,
			maxBreath: this.maxBreath,
			breathRegen: this.breathRegen
		});
	}

	public statsToString(language: string, level: number): string {
		return format(ClassInfoConstants.STATS_DISPLAY, {
			attack: this.getAttackValue(level),
			defense: this.getDefenseValue(level),
			speed: this.getSpeedValue(level),
			health: this.health + level,
			fightPoint: this.getMaxCumulativeFightPointValue(level),
			baseBreath: this.baseBreath,
			maxBreath: this.maxBreath,
			breathRegen: this.breathRegen
		});
	}

	/**
	 * get the name of the class in the given language
	 * @param language
	 */
	public getName(language: string): string {
		return language === Constants.LANGUAGE.FRENCH ? this.fr : this.en;
	}

	/**
	 * get the description of the class in the given language
	 * @param language
	 */
	public getDescription(language: string): string {
		return Translations.getModule("commands.class", language).get(`description.${this.id}`);
	}

	/**
	 * get the attack value of the class in the given level
	 * @param level
	 */
	public getAttackValue(level: number): number {
		return Math.round(this.attack + this.attack / 100 * level / 4 * level / 10);
	}

	/**
	 * get the defense value of the class in the given level
	 * @param level
	 */
	public getDefenseValue(level: number): number {
		return Math.round(this.defense + this.defense / 100 * level / 4 * level / 10);
	}

	/**
	 * get the speed value of the class in the given level
	 * @param level
	 */
	public getSpeedValue(level: number): number {
		return Math.round(this.speed + this.speed / 100 * level / 4 * level / 10);
	}

	/**
	 * get the max cumulative fight point value of the class in the given level
	 * @param level
	 */
	public getMaxCumulativeFightPointValue(level: number): number {
		return Math.round(this.fightPoint + 10 * level + level / 4 * level / 8);
	}

	/**
	 * get the max health value of the class in the given level
	 * @param level
	 */
	public getMaxHealthValue(level: number): number {
		return this.health + level;
	}

	/**
	 * get the fight actions of the class
	 */
	public getFightActions(): string[] {
		return Data.getModule(`classes.${this.id}`).getStringArray("fightActionsIds");
	}
}

export class Classes {

	/**
	 * get the class by its id
	 * @param id
	 */
	static getById(id: number): Promise<Class | null> {
		return Promise.resolve(Class.findOne({
			where: {
				id
			}
		}));
	}

	/**
	 * get the class by its group id
	 * @param groupId
	 */
	static getByGroupId(groupId: number): Promise<Class[]> {
		return Promise.resolve(Class.findAll({
			where: {
				classGroup: groupId
			}
		}));
	}

	/**
	 * get the class by its emoji
	 * @param emoji
	 * @param classGroup - class can have the same emoji if they are in different groups
	 */
	static getByEmoji(emoji: string, classGroup: number): Promise<Class | null> {
		return Promise.resolve(Class.findOne({
			where: {
				emoji,
				classGroup
			}
		}));
	}
}

export function initModel(sequelize: Sequelize): void {
	Class.init(
		{
			id: {
				type: DataTypes.INTEGER,
				primaryKey: true
			},
			attack: {
				type: DataTypes.INTEGER
			},
			defense: {
				type: DataTypes.INTEGER
			},
			speed: {
				type: DataTypes.INTEGER
			},
			health: {
				type: DataTypes.INTEGER
			},
			fightPoint: {
				type: DataTypes.INTEGER
			},
			baseBreath: {
				type: DataTypes.INTEGER
			},
			maxBreath: {
				type: DataTypes.INTEGER
			},
			breathRegen: {
				type: DataTypes.INTEGER
			},
			emoji: {
				type: DataTypes.TEXT
			},
			classGroup: {
				type: DataTypes.INTEGER
			},
			fr: {
				type: DataTypes.TEXT
			},
			en: {
				type: DataTypes.TEXT
			},
			updatedAt: {
				type: DataTypes.DATE,
				defaultValue: moment().format("YYYY-MM-DD HH:mm:ss")
			},
			createdAt: {
				type: DataTypes.DATE,
				defaultValue: moment().format("YYYY-MM-DD HH:mm:ss")
			}
		},
		{
			sequelize,
			tableName: "classes",
			freezeTableName: true
		});

	Class.beforeSave(instance => {
		instance.updatedAt = moment().toDate();
	});
}

export default Class;