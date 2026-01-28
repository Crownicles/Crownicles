import { FightController } from "./FightController";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

export class FightsManager {
	private static fights = new Map<string, FightController>();

	public static init(): void {
		setInterval(FightsManager.purgeFights, FightConstants.PURGE_TIMEOUT);
	}

	public static registerFight(fight: FightController): string {
		const uuid = crypto.randomUUID();
		FightsManager.fights.set(uuid, fight);
		return uuid;
	}

	public static unregisterFight(uuid: string): void {
		FightsManager.fights.delete(uuid);
	}

	public static getFight(uuid: string): FightController | null {
		return FightsManager.fights.get(uuid) ?? null;
	}

	private static purgeFights(): void {
		for (const [uuid, fight] of FightsManager.fights.entries()) {
			try {
				if (fight.hadEnded()) {
					FightsManager.unregisterFight(uuid);
				}
			}
			catch (e) {
				CrowniclesLogger.errorWithObj("Error while purging fights", e);
			}
		}
	}
}
