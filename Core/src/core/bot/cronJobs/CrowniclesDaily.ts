import { setDailyCronJob } from "../../utils/CronInterface";
import { Settings } from "../../database/game/models/Setting";
import { crowniclesInstance } from "../../../app";
import { CrowniclesLogger } from "../../../../../Lib/src/logs/CrowniclesLogger";
import { PotionDataController } from "../../../data/Potion";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import PetEntity from "../../database/game/models/PetEntity";
import {
	literal, Op, QueryTypes
} from "sequelize";
import { PetConstants } from "../../../../../Lib/src/constants/PetConstants";
import { ItemEnchantment } from "../../../../../Lib/src/types/ItemEnchantment";
import { CityDataController } from "../../../data/City";
import Player from "../../database/game/models/Player";
import { TokensConstants } from "../../../../../Lib/src/constants/TokensConstants";
import Guild from "../../database/game/models/Guild";
import { MissionSlot } from "../../database/game/models/MissionSlot";
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
				name: "maxTokensReachedMissions",
				run: CrowniclesDaily.maxTokensReachedMissions
			},
			{
				name: "randomPotion",
				run: CrowniclesDaily.randomPotion
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
				run: CrowniclesDaily.reloadEnchanter
			},
			{
				name: "trainingGroundLoveBonus",
				run: CrowniclesDaily.trainingGroundLoveBonus
			},
			{
				name: "pantryAutoFill",
				run: CrowniclesDaily.pantryAutoFill
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
	 * Mark the `maxTokensReached` mission as done for every player sitting at the token cap.
	 *
	 * The daily grant above is a bulk SQL update, so it bypasses `Player.addTokens` and never
	 * notifies the mission system: a player pushed to the cap by that grant would otherwise
	 * stay stuck at 0/1. The reward itself is handed out by the regular completion check, on
	 * the player's next mission update.
	 */
	static async maxTokensReachedMissions(): Promise<void> {
		/*
		 * Deliberately split in two: a single `UPDATE ... JOIN players` would lock rows in both
		 * tables in an order the optimizer chooses, which can invert the game's own order
		 * (player locked first, mission slots written after) and deadlock a live command.
		 * The read below is non-locking, and the write only ever touches mission_slots.
		 *
		 * `numberDone < 1` is not a correctness guard — the final state is the same without it —
		 * but mission completion is lazy: the slot is only advanced or dropped on the player's
		 * next `MissionsController.update`, so for a capped yet inactive player the row stays
		 * here indefinitely. Without the guard this nightly job would rewrite an ever-growing
		 * set of already-done rows, and `advancedSlots` below would count no-ops.
		 */
		const [rows] = await MissionSlot.sequelize!.query(
			`SELECT ms.id
			FROM mission_slots ms
			JOIN players p ON p.id = ms.playerId
			WHERE ms.missionId = 'maxTokensReached'
				AND ms.numberDone < 1
				AND (ms.expiresAt IS NULL OR ms.expiresAt > NOW())
				AND p.tokens >= ${TokensConstants.MAX}`
		);
		const slotIds = (rows as { id: number }[]).map(row => row.id);
		if (slotIds.length === 0) {
			return;
		}
		await MissionSlot.update({ numberDone: 1 }, { where: { id: { [Op.in]: slotIds } } });
		CrowniclesLogger.info("Max tokens missions advanced", { advancedSlots: slotIds.length });
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
		if (!RandomUtils.crowniclesRandom.bool()) {
			return false;
		}

		const [affectedPets] = await PetEntity.update(
			{
				lovePoints: literal(
					`GREATEST(0, lovePoints - ${PetConstants.DAILY_LOVE_LOSS})`
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
		CrowniclesLogger.info("Daily love loss applied to pets", {
			lostLovePoints: PetConstants.DAILY_LOVE_LOSS,
			affectedPets
		});
		return true;
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
		// The building level is not the love amount: map each level to its balancing value
		const rewardingLevels = GuildDomainConstants.TRAINING_LOVE_PER_DAY
			.map((lovePerDay, level) => ({
				level, lovePerDay
			}))
			.filter(({ lovePerDay }) => lovePerDay > 0);

		if (rewardingLevels.length === 0) {
			CrowniclesLogger.info("Training ground love bonus skipped: no rewarding level");
			return;
		}

		const loveGainCases = rewardingLevels
			.map(({
				level, lovePerDay
			}) => `WHEN ${level} THEN ${lovePerDay}`)
			.join(" ");
		const eligibleLevels = rewardingLevels
			.map(({ level }) => level)
			.join(", ");

		const [, affectedPets] = await Guild.sequelize!.query(
			`UPDATE pet_entities pe
			JOIN guild_pets gp ON gp.petEntityId = pe.id
			JOIN guilds g ON gp.guildId = g.id
			SET pe.lovePoints = LEAST(pe.lovePoints + CASE g.trainingGroundLevel ${loveGainCases} ELSE 0 END, ${PetConstants.MAX_LOVE_POINTS})
			WHERE g.trainingGroundLevel IN (${eligibleLevels})`,
			{ type: QueryTypes.UPDATE }
		);
		CrowniclesLogger.info("Training ground love bonus applied", { affectedPets });
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
