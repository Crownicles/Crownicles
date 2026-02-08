import { Language } from "../../../Lib/src/Language";
import { PetDiet } from "../../../Lib/src/constants/PetConstants";
import i18n from "../translations/i18n";
import { SexTypeShort } from "../../../Lib/src/constants/StringConstants";
import { finishInTimeDisplay } from "../../../Lib/src/utils/TimeUtils";
import { DisplayUtils } from "./DisplayUtils";

export abstract class PetUtils {
	/**
	 * Generate a short pet string containing only the pet emote and the nickname (or type name if the pet has no nickname)
	 * @param lng
	 * @param nickname - can be undefined if the pet has no nickname
	 * @param typeId
	 * @param sex
	 */
	static petToShortString(lng: Language, nickname: string | undefined, typeId: number, sex: SexTypeShort): string {
		return i18n.t("commands:pet.shortPetField", {
			lng,
			emote: DisplayUtils.getPetIcon(typeId, sex),
			name: nickname || DisplayUtils.getPetTypeName(lng, typeId, sex)
		});
	}

	static getDietDisplay(diet: PetDiet | undefined, lng: Language): string {
		return i18n.t("models:diet", {
			lng, context: diet ?? PetDiet.OMNIVOROUS
		});
	}

	static getFeedCooldownDisplay(nextFeed: number, lng: Language): string {
		return nextFeed <= 0
			? i18n.t("commands:shop.shopItems.lovePointsValue.petIsHungry", { lng })
			: finishInTimeDisplay(new Date(new Date().valueOf() + nextFeed));
	}
}
