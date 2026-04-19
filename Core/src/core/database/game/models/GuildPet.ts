import {
	DataTypes, Model, Sequelize
} from "sequelize";
import PetEntity from "./PetEntity";
import Guild from "./Guild";
import { crowniclesInstance } from "../../../../index";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";

export class GuildPet extends Model {
	declare readonly id: number;

	declare guildId: number;

	declare petEntityId: number;

	declare updatedAt: Date;

	declare createdAt: Date;
}

/**
 * This class is used to information about pets that are in a shelter
 */
export abstract class GuildPets {
	/**
	 * Add pet to a shelter
	 * @param guild
	 * @param petEntity
	 * @param logInDatabase
	 */
	static addPet(guild: Guild, petEntity: PetEntity, logInDatabase: boolean): GuildPet {
		if (logInDatabase) {
			crowniclesInstance?.logsDatabase.logGuildNewPet(guild, petEntity)
				.then();
		}
		return GuildPet.build({
			guildId: guild.id,
			petEntityId: petEntity.id
		});
	}

	/**
	 * Get the list of pets that are in the shelter of a guild
	 * @param guildId
	 */
	static async getOfGuild(guildId: number): Promise<GuildPet[]> {
		return await GuildPet.findAll({
			where: { guildId }
		});
	}
}

export function initModel(sequelize: Sequelize): void {
	GuildPet.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		guildId: { type: DataTypes.INTEGER },
		petEntityId: {
			type: DataTypes.INTEGER
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
		tableName: "guild_pets",
		freezeTableName: true
	});

	GuildPet.beforeSave(instance => {
		instance.updatedAt = moment()
			.toDate();
	});
}

export default GuildPet;
