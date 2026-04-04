import { setDailyCronJob } from "../../utils/CronInterface";
import { Settings } from "../../database/game/models/Setting";
import { crowniclesInstance } from "../../../index";
import { CrowniclesLogger } from "../../../../../Lib/src/logs/CrowniclesLogger";
import { PotionDataController } from "../../../data/Potion";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import PetEntity from "../../database/game/models/PetEntity";
import {
	literal, Op
} from "sequelize";
import { PetConstants } from "../../../../../Lib/src/constants/PetConstants";
import { ItemEnchantment } from "../../../../../Lib/src/types/ItemEnchantment";
import { CityDataController } from "../../../data/City";
import Player from "../../database/game/models/Player";
import { TokensConstants } from "../../../../../Lib/src/constants/TokensConstants";
import Guild from "../../database/game/models/Guild";
import { GuildDomainConstants } from "../../../../../Lib/src/constants/GuildDomainConstants";
import { GuildPets } from "../../database/game/models/GuildPet";
import { NumberChangeReason } from "../../../../../Lib/src/constants/LogsConstants";
import { PetDataController } from "../../../data/Pet";

export class CrowniclesDaily {
	public static async programCronJob(): Promise<void> {
		await setDailyCronJob(CrowniclesDaily.job, await Settings.NEXT_DAILY_RESET.getValue() < Date.now());
	}

	/**
	 * Execute all the daily tasks
	 */
	static async job(): Promise<void> {
		/*
		 * First program the daily immediately at +1 day
		 * Then wait a bit before setting the next date, so we are sure to be past the date
		 *
		 * The first one is set immediately so if the bot crashes before programming the next one, it will be set anyway to approximately a valid date (at 1s max of difference)
		 */
		let nextDaily = await Settings.NEXT_DAILY_RESET.getValue() + 24 * 60 * 60 * 1000;
		while (nextDaily < Date.now()) {
			nextDaily += 24 * 60 * 60 * 1000;
		}
		await Settings.NEXT_DAILY_RESET.setValue(nextDaily);

		await Player.update(
			{
				tokens: literal(`LEAST(${TokensConstants.MAX}, tokens + ${TokensConstants.DAILY.FREE_PER_DAY})`)
			},
			{ where: {} }
		);

		CrowniclesDaily.randomPotion()
			.finally(() => null);
		CrowniclesDaily.randomLovePointsLoose()
			.then(petLoveChange => crowniclesInstance?.logsDatabase.logDailyTimeout(petLoveChange)
				.then());
		CrowniclesDaily.reloadEnchanter().then();
		CrowniclesDaily.trainingGroundLoveBonus().then();
		CrowniclesDaily.pantryAutoFeed().then();
		crowniclesInstance?.logsDatabase.log15BestTopWeek()
			.then();
	}


	/**
	 * Update the random potion sold in the shop
	 */
	static async randomPotion(): Promise<void> {
		CrowniclesLogger.info("Daily timeout");
		const previousPotionId = await Settings.SHOP_POTION.getValue();
		const newPotionId = PotionDataController.instance.randomShopPotion(previousPotionId).id;
		await Settings.SHOP_POTION.setValue(newPotionId);
		CrowniclesLogger.info("New potion in shop", { newPotionId });
		crowniclesInstance?.logsDatabase.logDailyPotion(newPotionId)
			.then();
	}

	/**
	 * Make some pet lose some love points
	 */
	static async randomLovePointsLoose(): Promise<boolean> {
		if (RandomUtils.crowniclesRandom.bool()) {
			CrowniclesLogger.info("All pets lost 4 loves point");
			await PetEntity.update(
				{
					lovePoints: literal(
						"CASE WHEN lovePoints - 4 < 0 THEN 0 ELSE lovePoints - 4 END"
					)
				},
				{
					where: {
						lovePoints: {
							[Op.notIn]: [PetConstants.MAX_LOVE_POINTS, 0]
						}
					}
				}
			);
			return true;
		}
		return false;
	}

	/**
	 * Reload the enchanter's enchantment and location
	 */
	static async reloadEnchanter(): Promise<void> {
		try {
			const enchantmentId = ItemEnchantment.getRandomEnchantment().id;
			await Settings.ENCHANTER_ENCHANTMENT_ID.setValue(enchantmentId);

			const cityId = CityDataController.instance.getRandomCity().id;
			await Settings.ENCHANTER_CITY.setValue(cityId);

			CrowniclesLogger.info("Enchanter reloaded", {
				enchantmentId,
				cityId
			});
		}
		catch (error) {
			CrowniclesLogger.error(`Something went wrong when reloading the enchanter: ${error}`);
		}
	}

	/**
	 * Add love points to all pets in guild shelters based on training ground level
	 */
	static async trainingGroundLoveBonus(): Promise<void> {
		try {
			await Guild.sequelize!.query(
				`UPDATE pet_entities pe
				JOIN guild_pets gp ON gp.petEntityId = pe.id
				JOIN guilds g ON gp.guildId = g.id
				SET pe.lovePoints = LEAST(pe.lovePoints + g.trainingGroundLevel, ${PetConstants.MAX_LOVE_POINTS})
				WHERE g.trainingGroundLevel > 0`
			);
			CrowniclesLogger.info("Training ground love bonus applied");
		}
		catch (error) {
			CrowniclesLogger.error(`Training ground love bonus failed: ${error}`);
		}
	}

	/**
	 * Auto-feed all shelter pets in guilds with pantry level >= AUTO_FEED_PANTRY_LEVEL using common food
	 */
	static async pantryAutoFeed(): Promise<void> {
		try {
			const guilds = await Guild.findAll({
				where: {
					pantryLevel: { [Op.gte]: GuildDomainConstants.AUTO_FEED_PANTRY_LEVEL },
					commonFood: { [Op.gt]: 0 }
				}
			});

			for (const guild of guilds) {
				const guildPets = await GuildPets.getOfGuild(guild.id);
				let fedCount = 0;

				for (const guildPet of guildPets) {
					if (guild.commonFood <= 0) {
						break;
					}

					const petEntity = await PetEntity.findByPk(guildPet.petEntityId);
					if (!petEntity) {
						continue;
					}

					const petModel = PetDataController.instance.getById(petEntity.typeId);
					if (!petModel || !petEntity.canBeFed(petModel, PetConstants.PET_FOOD.COMMON_FOOD)) {
						continue;
					}

					guild.removeFood(PetConstants.PET_FOOD.COMMON_FOOD, 1, NumberChangeReason.GUILD_DAILY);
					petEntity.hungrySince = new Date();
					petEntity.lovePoints = Math.min(
						petEntity.lovePoints + PetConstants.PET_FOOD_LOVE_POINTS_AMOUNT[0],
						PetConstants.MAX_LOVE_POINTS
					);
					await petEntity.save();
					fedCount++;
				}

				if (fedCount > 0) {
					await guild.save();
				}
			}

			CrowniclesLogger.info("Pantry auto-feed completed");
		}
		catch (error) {
			CrowniclesLogger.error(`Pantry auto-feed failed: ${error}`);
		}
	}
}
