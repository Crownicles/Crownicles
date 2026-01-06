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
import { PetUtils } from "../../../utils/PetUtils";
import { crowniclesInstance } from "../../../../index";
import {
	CrowniclesPacket, makePacket
} from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { PlayerReceivePetPacket } from "../../../../../../Lib/src/packets/events/PlayerReceivePetPacket";
import {
	SexTypeShort, StringConstants
} from "../../../../../../Lib/src/constants/StringConstants";
import { OwnedPet } from "../../../../../../Lib/src/types/OwnedPet";
import { PetBasicInfo } from "../../../../../../Lib/src/types/PetBasicInfo";
import { CrowniclesLogger } from "../../../../../../Lib/src/logs/CrowniclesLogger";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";

export class PetEntity extends Model {
	declare readonly id: number;

	declare typeId: number;

	declare sex: SexTypeShort;

	declare nickname: string;

	declare lovePoints: number;

	declare hungrySince: Date;

	declare lastExpeditionEndDate: Date;

	declare creationDate: Date;

	declare updatedAt: Date;

	declare createdAt: Date;


	/**
	 * Get the amount of time before the pet can be fed again
	 * @param petModel
	 */
	public getFeedCooldown(petModel: Pet): number {
		if (!this.hungrySince) {
			return 0;
		}
		const feedDelayMultiplier = petModel.feedDelay ?? 1;
		const cooldownDuration = PetConstants.BREED_COOLDOWN * feedDelayMultiplier;
		return cooldownDuration - (Date.now() - this.hungrySince.valueOf());
	}

	/**
	 * Get the love level of the pet
	 */
	public getLoveLevelNumber(): number {
		return this.lovePoints >= PetConstants.TRAINED_LOVE_THRESHOLD
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
			petSex: this.sex
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

	/**
	 * Get the pet as an OwnedPet object
	 */
	public asOwnedPet(): OwnedPet {
		const petModel = PetDataController.instance.getById(this.typeId);
		return {
			typeId: this.typeId,
			nickname: this.nickname,
			rarity: petModel.rarity,
			sex: this.sex,
			loveLevel: this.getLoveLevelNumber(),
			force: petModel.force,
			feedDelay: petModel.feedDelay
		};
	}

	/**
	 * Get basic pet information for packets and displays
	 */
	public getBasicInfo(): PetBasicInfo {
		return {
			petTypeId: this.typeId,
			petSex: this.sex,
			petNickname: this.nickname
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

	/**
	 * Generate a random pet entity
	 * @param minRarity
	 * @param maxRarity
	 */
	static generateRandomPetEntity(
		minRarity = PetConstants.PET_RARITY_RANGE.MIN,
		maxRarity = PetConstants.PET_RARITY_RANGE.MAX
	): PetEntity {
		const sex = RandomUtils.crowniclesRandom.bool() ? "m" : "f";
		const rarity = PetUtils.generateRandomPetRarity(minRarity, maxRarity);
		let pet = PetDataController.instance.getRandom(rarity);
		if (!pet) {
			CrowniclesLogger.warn(`No pet found for rarity ${rarity}, defaulting to any rarity.`);
			pet = PetDataController.instance.getRandom();
		}
		return PetEntity.build({
			typeId: pet.id,
			sex,
			nickname: null,
			lovePoints: PetConstants.BASE_LOVE
		});
	}

	/**
	 * Generate a random pet entity for a player without guild
	 * @param minRarity
	 * @param maxRarity
	 */
	static generateRandomPetEntityNotGuild(
		minRarity = PetConstants.PET_RARITY_RANGE.MIN,
		maxRarity = PetConstants.PET_RARITY_RANGE.MAX
	): PetEntity {
		return PetEntities.generateRandomPetEntity(minRarity, maxRarity);
	}

	/**
	 * Get the number of trained pets
	 */
	static async getNbTrainedPets(): Promise<number> {
		const query = `SELECT COUNT(*) as count
                       FROM pet_entities
                       WHERE lovePoints >= ${PetConstants.TRAINED_LOVE_THRESHOLD}`;
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
		lastExpeditionEndDate: {
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
