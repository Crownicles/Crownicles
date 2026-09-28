import {ReactNode} from "react";
import {PlayerLevelUpRes} from "ws-packets/src/fromServer/character/PlayerLevelUpRes";
import {AppIcons} from "@/src/AppIcons";
import {useAnnouncementTurn} from "@/src/components/useToastTurn";
import {Toast} from "@/src/design/Sections";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {levelUpStore, useLevelUp} from "@/src/store/LevelUpStore";
import {i18n} from "@/src/translations/i18n";
import {joinFacts} from "@/src/display/Facts";

const TOAST_EMBLEM_SIZE = 24;

/** What the new level brings; the parts of the game it opens are announced by the journey instead. */
function levelUpGains(levelUp: PlayerLevelUpRes): string {
	const gains = joinFacts([
		levelUp.healthRestored && i18n.t("app:levelUp.healthRestored"),
		levelUp.statsIncreased && i18n.t("app:levelUp.statsIncreased"),
		levelUp.missionSlotUnlocked && i18n.t("app:levelUp.missionSlot")
	]);
	return gains || i18n.t("app:levelUp.stronger");
}

/** Says the character levelled up, like a drunk potion or a sold item, once the mission toast has had its turn. */
export function LevelUpToast(): ReactNode {
	const levelUp = useLevelUp();
	const myTurn = useAnnouncementTurn();
	if (!levelUp || !myTurn) return null;
	return <Toast
		emblem={<TwemojiIcon emoji={AppIcons.getIcon("unitValues.xp")} size={TOAST_EMBLEM_SIZE} />}
		title={i18n.t("app:levelUp.title", {level: levelUp.level})}
		subtitle={levelUpGains(levelUp)}
		onDismiss={levelUpStore.announced}
	/>;
}
