import i18n from "../translations/i18n";
import { Language } from "../../../Lib/src/Language";

/**
 * Names of the guards of the library: each one has a unique first name, so that the players can tell them apart
 */
export abstract class KingGuardUtils {
	/**
	 * First name of a guard of the library
	 * @param guardId
	 * @param lng
	 */
	static getFirstName(guardId: number, lng: Language): string {
		return i18n.t(`kingGuards:names.${guardId}`, { lng });
	}

	/**
	 * Name of a guard as shown during the fights and in the fight history: its first name with its title
	 * @param guardId
	 * @param lng
	 */
	static getDisplayName(guardId: number, lng: Language): string {
		return i18n.t("commands:fight.kingGuard.name", {
			lng,
			name: KingGuardUtils.getFirstName(guardId, lng)
		});
	}
}
