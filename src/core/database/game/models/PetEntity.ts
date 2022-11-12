import {DataTypes, Model, QueryTypes, Sequelize} from "sequelize";
import Pet from "./Pet";
import {Constants} from "../../../Constants";
import {RandomUtils} from "../../../utils/RandomUtils";
import {format} from "../../../utils/StringFormatter";
import {Translations} from "../../../Translations";
import {MissionsController} from "../../../missions/MissionsController";
import {finishInTimeDisplay} from "../../../utils/TimeUtils";
import {botConfig, draftBotInstance} from "../../../bot";
import {PetEntityConstants} from "../../../constants/PetEntityConstants";
import {PlayerEditValueParameters} from "./Player";
import moment = require("moment");
import {PetConstants} from "../../../constants/PetConstants";

export class PetEntity extends Model {
	public readonly id!: number;

	public petId!: number;

	public sex!: string;

	public nickname: string;

	public lovePoints!: number;

	public hungrySince!: Date;

	public creationDate!: Date;

	public updatedAt!: Date;

	public createdAt!: Date;


	public getPetTypeName(petModel: Pet, language: string): string {
		const field = `${this.sex === "m" ? "male" : "female"}Name${language.toUpperCase().slice(0, 1)}${language.slice(1)}`;
		return petModel[field as keyof Pet];
	}

	public getFeedCooldownDisplay(petModel: Pet, language: string): string {
		if (!this.hungrySince || this.getFeedCooldown(petModel) <= 0) {
			return Translations.getModule("models.pets", language).get("hungry");
		}
		return finishInTimeDisplay(new Date(new Date().valueOf() + this.getFeedCooldown(petModel)));
	}

	public getFeedCooldown(petModel: Pet): number {
		if (!this.hungrySince) {
			return 0;
		}
		return PetConstants.BREED_COOLDOWN * petModel.rarity -
			(new Date().valueOf() - this.hungrySince.valueOf());
	}

	public getPetEmote(petModel: Pet): string {
		return petModel[`emote${this.sex === "m" ? "Male" : "Female"}` as keyof Pet];
	}

	public displayName(petModel: Pet, language: string): string {
		const displayedName = this.nickname ? this.nickname : this.getPetTypeName(petModel, language);
		return `${this.getPetEmote(petModel)} ${displayedName}`;
	}

	public getPetDisplay(petModel: Pet, language: string): string {
		return Translations.getModule("commands.guildShelter", language).format("petField", {
			emote: this.getPetEmote(petModel),
			type: this.getPetTypeName(petModel, language),
			rarity: petModel.getRarityDisplay(),
			sex: this.getSexDisplay(language),
			nickname: this.getNickname(language),
			loveLevel: this.getLoveLevel(language)
		});
	}

	public getPetTitle(language: string, petNumber: number): string {
		return Translations.getModule("commands.guildShelter", language).format("petFieldName", {
			number: petNumber
		});
	}

	public getLoveLevel(language: string): string {
		const translations = Translations.getModule("models.pets", language);
		const loveLevel = this.getLoveLevelNumber();
		let loveLevelText;
		if (loveLevel === PetConstants.LOVE_LEVEL.FEISTY) {
			loveLevelText = language === Constants.LANGUAGE.FRENCH ? format(translations.get("loveLevels.0"), {
				typeSuffix: this.sex === PetConstants.SEX.FEMALE ? "se" : "x"
			}) : translations.get("loveLevels.0");
		}
		else if (loveLevel === PetConstants.LOVE_LEVEL.WILD) {
			loveLevelText = translations.get("loveLevels.1");
		}
		else if (loveLevel === PetConstants.LOVE_LEVEL.FEARFUL) {
			loveLevelText = language === Constants.LANGUAGE.FRENCH ? format(translations.get("loveLevels.2"), {
				typeSuffix: this.sex === PetConstants.SEX.FEMALE ? "ve" : "f"
			}) : translations.get("loveLevels.2");
		}
		else if (loveLevel === PetConstants.LOVE_LEVEL.TAMED) {
			loveLevelText = language === Constants.LANGUAGE.FRENCH ? format(translations.get("loveLevels.3"), {
				typeSuffix: this.sex === PetConstants.SEX.FEMALE ? "ée" : "é"
			}) : translations.get("loveLevels.3");
		}
		else if (loveLevel === PetConstants.LOVE_LEVEL.TRAINED) {
			loveLevelText = language === Constants.LANGUAGE.FRENCH ? format(translations.get("loveLevels.4"), {
				typeSuffix: this.sex === PetConstants.SEX.FEMALE ? "ée" : "é"
			}) : translations.get("loveLevels.4");
		}
		return loveLevelText;
	}

	public getLoveLevelNumber(): number {
		return this.lovePoints === PetConstants.MAX_LOVE_POINTS
			? PetConstants.LOVE_LEVEL.TRAINED : this.lovePoints >= PetConstants.LOVE_LEVELS[2]
				? PetConstants.LOVE_LEVEL.TAMED : this.lovePoints >= PetConstants.LOVE_LEVELS[1]
					? PetConstants.LOVE_LEVEL.FEARFUL : this.lovePoints >= PetConstants.LOVE_LEVELS[0]
						? PetConstants.LOVE_LEVEL.WILD : PetConstants.LOVE_LEVEL.FEISTY;
	}

	public async changeLovePoints(parameters: PlayerEditValueParameters): Promise<void> {
		this.lovePoints += parameters.amount;
		if (this.lovePoints >= PetConstants.MAX_LOVE_POINTS) {
			this.lovePoints = PetConstants.MAX_LOVE_POINTS;
		}
		else if (this.lovePoints < 0) {
			this.lovePoints = 0;
		}
		draftBotInstance.logsDatabase.logPetLoveChange(this, parameters.reason).then();
		await MissionsController.update(parameters.player, parameters.channel, parameters.language, {
			missionId: "tamedPet",
			params: {loveLevel: this.getLoveLevelNumber()}
		});
		await MissionsController.update(parameters.player, parameters.channel, parameters.language, {
			missionId: "trainedPet",
			params: {loveLevel: this.getLoveLevelNumber()}
		});
	}

	public isFeisty(): boolean {
		return this.getLoveLevelNumber() === PetConstants.LOVE_LEVEL.FEISTY;
	}

	private getNickname(language: string): string {
		return this.nickname ? this.nickname : Translations.getModule("models.pets", language).get("noNickname");
	}

	private getSexDisplay(language: string): string {
		return `${
			Translations.getModule("models.pets", language).get(this.sex === "m" ? "male" : "female")
		} ${
			this.sex === "m" ? PetEntityConstants.EMOTE.MALE : PetEntityConstants.EMOTE.FEMALE
		}`;
	}
}

export class PetEntities {
	static async getById(id: number): Promise<PetEntity> {
		return await PetEntity.findOne({
			where: {
				id
			}
		});
	}

	static createPet(petId: number, sex: string, nickname: string): PetEntity {
		return PetEntity.build({
			petId: petId,
			sex: sex,
			nickname: nickname,
			lovePoints: PetConstants.BASE_LOVE
		});
	}

	static async generateRandomPetEntity(level: number): Promise<PetEntity> {
		const sex = RandomUtils.draftbotRandom.bool() ? "m" : "f";
		let randomTier = RandomUtils.draftbotRandom.realZeroToOneInclusive();
		const levelTier = Math.floor(level / 10);
		let rarity;
		for (rarity = 1; rarity < 6; ++rarity) {
			randomTier -= PetEntityConstants.PROBABILITIES[levelTier][rarity - 1];
			if (randomTier <= 0) {
				break;
			}
		}
		if (rarity === 6) {
			// Case that should never be reached if the probabilities are 1
			rarity = 1;
			console.log(`Warning ! Pet probabilities are not equal to 1 for level tier ${levelTier}`);
		}
		const pet = await Pet.findOne({
			where: {
				rarity: rarity
			},
			order: [draftBotInstance.gameDatabase.sequelize.random()]
		});
		return PetEntity.build({
			petId: pet.id,
			sex: sex,
			nickname: null,
			lovePoints: PetConstants.BASE_LOVE
		});
	}

	static async generateRandomPetEntityNotGuild(): Promise<PetEntity> {
		return await PetEntities.generateRandomPetEntity(PetConstants.GUILD_LEVEL_USED_FOR_NO_GUILD_LOOT);
	}

	static async getNbTrainedPets(): Promise<number> {
		const query = `SELECT COUNT(*) as count
					   FROM ${botConfig.MARIADB_PREFIX}_game.pet_entities
					   WHERE lovePoints = ${PetConstants.MAX_LOVE_POINTS}`;
		return (<{ count: number }[]>(await PetEntity.sequelize.query(query, {
			type: QueryTypes.SELECT
		})))[0]["count"];
	}

	static async getNbFeistyPets(): Promise<number> {
		const query = `SELECT COUNT(*) as count
					   FROM ${botConfig.MARIADB_PREFIX}_game.pet_entities
					   WHERE lovePoints <= ${PetConstants.LOVE_LEVELS[0]}`;
		return (<{ count: number }[]>(await PetEntity.sequelize.query(query, {
			type: QueryTypes.SELECT
		})))[0]["count"];
	}

	static async getNbPetsGivenSex(sex: string): Promise<number> {
		const query = `SELECT COUNT(*) as count
					   FROM ${botConfig.MARIADB_PREFIX}_game.pet_entities
					   WHERE sex = :sex`;
		return (<{ count: number }[]>(await PetEntity.sequelize.query(query, {
			type: QueryTypes.SELECT,
			replacements: {
				sex: sex
			}
		})))[0]["count"];
	}

	static async getNbPets(): Promise<number> {
		const query = `SELECT COUNT(*) as count
					   FROM ${botConfig.MARIADB_PREFIX}_game.pet_entities`;
		return (<{ count: number }[]>(await PetEntity.sequelize.query(query, {
			type: QueryTypes.SELECT
		})))[0]["count"];
	}
}

export function initModel(sequelize: Sequelize): void {
	PetEntity.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		petId: {
			type: DataTypes.INTEGER
		},
		sex: {
			type: DataTypes.CHAR
		},
		nickname: {
			type: DataTypes.TEXT
		},
		lovePoints: {
			type: DataTypes.INTEGER
		},
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
			defaultValue: moment().format("YYYY-MM-DD HH:mm:ss")
		},
		createdAt: {
			type: DataTypes.DATE,
			defaultValue: moment().format("YYYY-MM-DD HH:mm:ss")
		}
	}, {
		sequelize,
		tableName: "pet_entities",
		freezeTableName: true
	});

	PetEntity.beforeSave(instance => {
		instance.updatedAt = moment().toDate();
	});
}

export default PetEntity;