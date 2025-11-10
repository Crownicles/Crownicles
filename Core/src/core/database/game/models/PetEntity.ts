import {
	DataTypes, Model, QueryTypes, Sequelize
} from "sequelize";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
import { MissionsController } from "../../../missions/MissionsController";
import {
	PET_ENTITY_GIVE_RETURN, PetConstants
} from "../../../../../../Lib/src/constants/PetConstants";
import {
	Player, PlayerEditValueParameters
} from "./Player";
import {
	Guild, Guilds
} from "./Guild";
import { GuildPets } from "./GuildPet";
import {
	Pet, PetDataController
} from "../../../../data/Pet";
import { crowniclesInstance } from "../../../../index";
import {
	CrowniclesPacket, makePacket
} from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { PlayerReceivePetPacket } from "../../../../../../Lib/src/packets/events/PlayerReceivePetPacket";
import {
	SexTypeShort, StringConstants
} from "../../../../../../Lib/src/constants/StringConstants";
import { OwnedPet } from "../../../../../../Lib/src/types/OwnedPet";
import { CrowniclesLogger } from "../../../../../../Lib/src/logs/CrowniclesLogger";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";

export class PetEntity extends Model {
	declare readonly id: number;

	declare typeId: number;

	declare sex: string;

	declare nickname: string;

	declare lovePoints: number;

	declare hungrySince: Date;

	declare creationDate: Date;

	declare updatedAt: Date;

	declare createdAt: Date;


	public getFeedCooldown(petModel: Pet): number {
		if (!this.hungrySince) {
			return 0;
		}
		return PetConstants.BREED_COOLDOWN * petModel.rarity
			- (new Date().valueOf() - this.hungrySince.valueOf());
	}

	public getLoveLevelNumber(): number {
		return this.lovePoints === PetConstants.MAX_LOVE_POINTS
			? PetConstants.LOVE_LEVEL.TRAINED
			: this.lovePoints >= PetConstants.LOVE_LEVELS[2]
				? PetConstants.LOVE_LEVEL.TAMED
				: this.lovePoints >= PetConstants.LOVE_LEVELS[1]
					? PetConstants.LOVE_LEVEL.FEARFUL
					: this.lovePoints >= PetConstants.LOVE_LEVELS[0]
						? PetConstants.LOVE_LEVEL.WILD
						: PetConstants.LOVE_LEVEL.FEISTY;
	}

	public async changeLovePoints(parameters: PlayerEditValueParameters): Promise<void> {
		this.lovePoints += parameters.amount;
		if (this.lovePoints >= PetConstants.MAX_LOVE_POINTS) {
			this.lovePoints = PetConstants.MAX_LOVE_POINTS;
		}
		else if (this.lovePoints < 0) {
			this.lovePoints = 0;
		}
		crowniclesInstance.logsDatabase.logPetLoveChange(this, parameters.reason)
			.then();
		await MissionsController.update(parameters.player, parameters.response, {
			missionId: "tamedPet",
			params: { loveLevel: this.getLoveLevelNumber() }
		});
		await MissionsController.update(parameters.player, parameters.response, {
			missionId: "trainedPet",
			params: { loveLevel: this.getLoveLevelNumber() }
		});
	}

	public isFeisty(): boolean {
		return this.getLoveLevelNumber() === PetConstants.LOVE_LEVEL.FEISTY;
	}

	/**
	 * Give the pet entity to a player, if no space then in their guild and if no space, don't give it.
	 * Send an embed only if send a generic message is true
	 * @param player The player
	 * @param response
	 */
	public async giveToPlayer(player: Player, response: CrowniclesPacket[]): Promise<PET_ENTITY_GIVE_RETURN> {
		let guild: Guild;
		let returnValue: PET_ENTITY_GIVE_RETURN;
		const packet = makePacket(PlayerReceivePetPacket, {
			giveInGuild: false,
			giveInPlayerInv: false,
			noRoomInGuild: false,
			petTypeId: this.typeId,
			petSex: this.sex as SexTypeShort
		});

		// Search for a user's guild
		try {
			guild = await Guilds.getById(player.guildId);
		}
		catch {
			guild = null;
		}

		const noRoomInGuild = guild?.isPetShelterFull(await GuildPets.getOfGuild(guild?.id)) ?? true;

		if (noRoomInGuild && player.petId !== null) {
			packet.noRoomInGuild = true;
			returnValue = PET_ENTITY_GIVE_RETURN.NO_SLOT;
		}
		else if (!noRoomInGuild && player.petId !== null) {
			await this.save();
			await GuildPets.addPet(guild, this, true)
				.save();
			packet.giveInGuild = true;
			returnValue = PET_ENTITY_GIVE_RETURN.GUILD;
		}
		else {
			await this.save();
			player.setPet(this);
			await player.save();
			await MissionsController.update(player, response, { missionId: "havePet" });
			packet.giveInPlayerInv = true;
			returnValue = PET_ENTITY_GIVE_RETURN.PLAYER;
		}

		response.push(packet);

		return returnValue;
	}

	public isFemale(): boolean {
		return this.sex === StringConstants.SEX.FEMALE.short;
	}

	public asOwnedPet(): OwnedPet {
		return {
			typeId: this.typeId,
			nickname: this.nickname,
			rarity: PetDataController.instance.getById(this.typeId).rarity,
			sex: this.sex as SexTypeShort,
			loveLevel: this.getLoveLevelNumber()
		};
	}
}

export class PetEntities {
	static async getById(id: number): Promise<PetEntity> {
		return await PetEntity.findOne({
			where: { id }
		});
	}

	static createPet(typeId: number, sex: string, nickname: string): PetEntity {
		return PetEntity.build({
			typeId,
			sex,
			nickname,
			lovePoints: PetConstants.BASE_LOVE
		});
	}

	static generateRandomPetEntity(level: number, minRarity = 1, maxRarity = 5): PetEntity {
		const sex = RandomUtils.crowniclesRandom.bool() ? "m" : "f";
		let levelTier = Math.floor(level / 10);
		if (levelTier > PetConstants.PROBABILITIES.length - 1) {
			levelTier = PetConstants.PROBABILITIES.length - 1;
		}

		let rarity;
		let totalProbabilities = 0;

		// Calculate max probability value
		for (rarity = minRarity; rarity <= maxRarity; ++rarity) {
			totalProbabilities += PetConstants.PROBABILITIES[levelTier][rarity - 1];
		}

		let randomTier = RandomUtils.crowniclesRandom.real(0, totalProbabilities, true);

		// Remove the rarity probabilities and stop when going under 0 to pick a rarity
		for (rarity = minRarity; rarity <= maxRarity; ++rarity) {
			randomTier -= PetConstants.PROBABILITIES[levelTier][rarity - 1];
			if (randomTier <= 0) {
				break;
			}
		}
		if (rarity === maxRarity + 1) {
			// Case that should never be reached if the probabilities are 1
			rarity = 1;
			CrowniclesLogger.warn(`Warning ! Pet probabilities are not equal to 1 for level tier ${levelTier}`);
		}
		const pet = PetDataController.instance.getRandom(rarity);
		return PetEntity.build({
			typeId: pet.id,
			sex,
			nickname: null,
			lovePoints: PetConstants.BASE_LOVE
		});
	}

	static generateRandomPetEntityNotGuild(minRarity = 1, maxRarity = 5): PetEntity {
		return PetEntities.generateRandomPetEntity(PetConstants.GUILD_LEVEL_USED_FOR_NO_GUILD_LOOT, minRarity, maxRarity);
	}

	static async getNbTrainedPets(): Promise<number> {
		const query = `SELECT COUNT(*) as count
                       FROM pet_entities
                       WHERE lovePoints = ${PetConstants.MAX_LOVE_POINTS}`;
		return (<{
			count: number;
		}[]>(await PetEntity.sequelize.query(query, {
			type: QueryTypes.SELECT
		})))[0].count;
	}

	static async getNbFeistyPets(): Promise<number> {
		const query = `SELECT COUNT(*) as count
                       FROM pet_entities
                       WHERE lovePoints <= ${PetConstants.LOVE_LEVELS[0]}`;
		return (<{
			count: number;
		}[]>(await PetEntity.sequelize.query(query, {
			type: QueryTypes.SELECT
		})))[0].count;
	}

	static async getNbPetsGivenSex(sex: string): Promise<number> {
		const query = `SELECT COUNT(*) as count
                       FROM pet_entities
                       WHERE sex = :sex`;
		return (<{
			count: number;
		}[]>(await PetEntity.sequelize.query(query, {
			type: QueryTypes.SELECT,
			replacements: { sex }
		})))[0].count;
	}

	static async getNbPets(): Promise<number> {
		const query = `SELECT COUNT(*) as count
                       FROM pet_entities`;
		return (<{
			count: number;
		}[]>(await PetEntity.sequelize.query(query, {
			type: QueryTypes.SELECT
		})))[0].count;
	}
}

export function initModel(sequelize: Sequelize): void {
	PetEntity.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		typeId: { type: DataTypes.INTEGER },
		sex: { type: DataTypes.CHAR },
		nickname: { type: DataTypes.TEXT },
		lovePoints: { type: DataTypes.INTEGER },
		hungrySince: {
			type: DataTypes.DATE,
			defaultValue: null
		},
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
		tableName: "pet_entities",
		freezeTableName: true
	});

	PetEntity.beforeSave(instance => {
		instance.updatedAt = moment()
			.toDate();
	});
}

export default PetEntity;
