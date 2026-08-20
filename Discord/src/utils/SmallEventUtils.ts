import { Language } from "../../../Lib/src/Language";
import { StringUtils } from "./StringUtils";

/**
 * Returns a random intro for any small event, using the translations defined in `smallEvents:intro`.
 */
export function getRandomSmallEventIntro(language: Language): string {
	return StringUtils.getRandomTranslation("smallEvents:intro", language);
}
