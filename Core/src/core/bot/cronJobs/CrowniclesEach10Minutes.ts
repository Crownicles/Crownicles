import { set10MinutesCronJob } from "../../utils/CronInterface";
import { TopStorage } from "../../utils/TopUtils";

export class CrowniclesEach10Minutes {
	public static async programCronJob(): Promise<void> {
		await set10MinutesCronJob(CrowniclesEach10Minutes.job, true /* should run immediately to have a top */);
	}

	/**
	 * Execute all regular tasks
	 */
	static job(): void {
		TopStorage.getInstance()
			.updateTops()
			.then();
	}
}
