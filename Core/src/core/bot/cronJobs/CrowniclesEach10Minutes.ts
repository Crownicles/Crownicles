import {setDailyCronJob} from "../../utils/CronInterface";
import {Settings} from "../../database/game/models/Setting";
import {TopStorage} from "../../utils/TopUtils";

export class CrowniclesEach10Minutes {
	public static async programCronJob(): Promise<void> {
		await setDailyCronJob(CrowniclesEach10Minutes.job, await Settings.NEXT_10_MINUTES_TIMEOUT.getValue() < Date.now());
	}

	/**
	 * Execute all the daily tasks
	 */
	static async job(): Promise<void> {
		let next10Min = await Settings.NEXT_10_MINUTES_TIMEOUT.getValue() + 10 * 60 * 1000;
		while (next10Min < Date.now()) {
			next10Min += 24 * 60 * 60 * 1000;
		}
		await Settings.NEXT_10_MINUTES_TIMEOUT.setValue(next10Min);
		TopStorage.getInstance().updateTops()
			.then();
	}
}
