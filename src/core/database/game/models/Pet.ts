import {DataTypes, Model, Sequelize} from "sequelize";
import {readdir} from "fs";
import * as moment from "moment";
import {PetEntityConstants} from "../../../constants/PetEntityConstants";
import {Translations} from "../../../Translations";
import {RandomUtils} from "../../../utils/RandomUtils";

export class Pet extends Model {
	public readonly id!: number;

	public readonly rarity!: number;

	public readonly maleNameFr!: string;

	public readonly maleNameEn!: string;

	public readonly femaleNameFr!: string;

	public readonly femaleNameEn!: string;

	public readonly emoteMale!: string;

	public readonly emoteFemale!: string;

	public readonly diet: string;

	public updatedAt!: Date;

	public createdAt!: Date;

	public getRarityDisplay(): string {
		return PetEntityConstants.EMOTE.RARITY.repeat(this.rarity);
	}

	public getDietDisplay(language: string): string {
		return Translations.getModule("models.pets", language).get(`diet.diet_${this.diet}`);
	}

	/**
	 * Get the name of the pet type in the specified language
	 * @param language
	 * @param isFemale
	 */
	public toString(language: string, isFemale: boolean): string {
		const field = `${isFemale ? "female" : "male"}Name${language.toUpperCase().slice(0, 1)}${language.slice(1)}`;
		return this[field as keyof Pet];
	}

	/**
	 * Returns true if the pet can eat meat
	 */
	public canEatMeat(): boolean {
		return this.diet === PetEntityConstants.RESTRICTIVES_DIETS.CARNIVOROUS || !this.diet;
	}

	/**
	 * Returns true if the pet can eat vegetables
	 */
	public canEatVegetables(): boolean {
		return this.diet === PetEntityConstants.RESTRICTIVES_DIETS.HERBIVOROUS || !this.diet;
	}
}

export class Pets {

	/**
	 * Get a pet from its id
	 * @param id
	 */
	static getById(id: number): Promise<Pet> {
		return Pet.findOne({
			where: {
				id
			}
		});
	}

	/**
	 * Get a random pet
	 */
	static async getRandom(): Promise<Pet> {
		const randomId = RandomUtils.draftbotRandom.integer(1, await this.getMaxId());
		return this.getById(randomId);
	}

	/**
	 * Get the maximum id of the pets (used for test commands and random pet generation)
	 */
	static getMaxId(): Promise<number> {
		return new Promise((resolve, reject) => {
			readdir("resources/text/pets/",
				(err, files) => {
					err ? reject(err) : resolve(files.length - 1);
				}
			);
		});
	}
}

export function initModel(sequelize: Sequelize): void {
	Pet.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		rarity: {
			type: DataTypes.INTEGER
		},
		maleNameFr: {
			type: DataTypes.TEXT
		},
		maleNameEn: {
			type: DataTypes.TEXT
		},
		femaleNameFr: {
			type: DataTypes.TEXT
		},
		femaleNameEn: {
			type: DataTypes.TEXT
		},
		emoteMale: {
			type: DataTypes.TEXT
		},
		emoteFemale: {
			type: DataTypes.TEXT
		},
		diet: {
			type: DataTypes.TEXT,
			defaultValue: null
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
		tableName: "pets",
		freezeTableName: true
	});

	Pet.beforeSave(instance => {
		instance.updatedAt = moment().toDate();
	});
}

export default Pet;