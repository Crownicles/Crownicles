import { setDailyCronJob } from "../../utils/CronInterface";
import { Settings } from "../../database/game/models/Setting";
import { crowniclesInstance } from "../../../app";
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
import { NumberChangeReason } from "../../../../../Lib/src/constants/LogsConstants";
import { CrowniclesCoreMetrics } from "../CrowniclesCoreMetrics";
import {
	msDiff, nowMs
} from "../../../../../Lib/src/types/TimeTypes";

type DailyTask = {
	name: string;
	run: () => Promise<void>;
};

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

		/*
		 * Run the daily tasks sequentially and isolated from each other: a burst of
		 * concurrent DB accesses at reset time used to exhaust the connection pool and
		 * silently fail some tasks (see enchanter not moving). Sequencing avoids the
		 * contention, and isolation ensures a failing task never skips the others.
		 */
		await CrowniclesDaily.runDailyTasks([
			{
				name: "randomPotion",
				run: (): Promise<void> => CrowniclesDaily.randomPotion()
			},
			{
				name: "randomLovePointsLoose",
				run: async (): Promise<void> => {
					const petLoveChange = await CrowniclesDaily.randomLovePointsLoose();
					await crowniclesInstance?.logsDatabase.logDailyTimeout(petLoveChange);
				}
			},
			{
				name: "reloadEnchanter",
				run: (): Promise<void> => CrowniclesDaily.reloadEnchanter()
			},
			{
				name: "trainingGroundLoveBonus",
				run: (): Promise<void> => CrowniclesDaily.trainingGroundLoveBonus()
			},
			{
				name: "pantryAutoFill",
				run: (): Promise<void> => CrowniclesDaily.pantryAutoFill()
			},
			{
				name: "log15BestTopWeek",
				run: async (): Promise<void> => {
					await crowniclesInstance?.logsDatabase.log15BestTopWeek();
				}
			}
		]);
	}

	/**
	 * Run the given daily tasks one after another, isolating failures so that one
	 * failing task neither blocks the others nor stays invisible.
	 * @param tasks - The ordered list of daily tasks to run
	 */
	private static async runDailyTasks(tasks: DailyTask[]): Promise<void> {
		for (const task of tasks) {
			const startTime = nowMs();
			try {
				await task.run();
				CrowniclesLogger.info("Daily task completed", {
					task: task.name,
					durationMs: msDiff(nowMs(), startTime)
				});
			}
			catch (error) {
				CrowniclesCoreMetrics.incrementDailyTaskFailure(task.name);
				CrowniclesLogger.errorWithObj(`Daily task failed: ${task.name}`, error);
			}
		}
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
		const enchantmentId = ItemEnchantment.getRandomEnchantment().id;
		await Settings.ENCHANTER_ENCHANTMENT_ID.setValue(enchantmentId);

		const cityId = CityDataController.instance.getRandomCity().id;
		await Settings.ENCHANTER_CITY.setValue(cityId);

		CrowniclesLogger.info("Enchanter reloaded", {
			enchantmentId,
			cityId
		});
	}

	/**
	 * Add love points to all pets in guild shelters based on training ground level
	 */
	static async trainingGroundLoveBonus(): Promise<void> {
		await Guild.sequelize!.query(
			`UPDATE pet_entities pe
			JOIN guild_pets gp ON gp.petEntityId = pe.id
			JOIN guilds g ON gp.guildId = g.id
			SET pe.lovePoints = LEAST(pe.lovePoints + g.trainingGroundLevel, ${PetConstants.MAX_LOVE_POINTS})
			WHERE g.trainingGroundLevel > 0`
		);
		CrowniclesLogger.info("Training ground love bonus applied");
	}

	/**
	 * Auto-fill pantry food for guilds with a pantry building, based on pantry level
	 */
	static async pantryAutoFill(): Promise<void> {
		const guilds = await Guild.findAll({
			where: {
				pantryLevel: { [Op.gte]: 1 },
				domainCityId: { [Op.not]: null }
			}
		});

		const foodFields = PetConstants.PET_FOOD_BY_ID;

		for (const guild of guilds) {
			const rates = GuildDomainConstants.getAutoFillRates(guild.pantryLevel);
			let changed = false;

			for (let i = 0; i < foodFields.length; i++) {
				if (rates[i] <= 0) {
					continue;
				}
				const foodType = foodFields[i];

				/*
				 * Skip when the storage is already at cap — adding 0 effective
				 * food would still trigger a log entry and force a guild save.
				 */
				if (guild.getFoodAmount(foodType) >= guild.getFoodCapacityFor(foodType)) {
					continue;
				}
				guild.addFood(foodType, rates[i], NumberChangeReason.GUILD_DAILY);
				changed = true;
			}

			if (changed) {
				await guild.save();
			}
		}

		CrowniclesLogger.info("Pantry auto-fill completed");
	}
}
