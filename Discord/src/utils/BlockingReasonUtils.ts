import { Language } from "../../../Lib/src/Language";
import i18n from "../translations/i18n";

export function formatBlockedReasons(reasons: readonly string[], lng: Language): string {
	return [...new Set(reasons)]
		.map(reason => i18n.t(`error:blockedContext.${reason}`, { lng }))
		.join(", ");
}
