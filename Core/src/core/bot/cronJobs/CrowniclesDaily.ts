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
}
