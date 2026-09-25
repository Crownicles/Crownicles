import {ReactNode} from "react";
import {AppIcons} from "@/src/AppIcons";
import {useToastTurn} from "@/src/components/useToastTurn";
import {Toast} from "@/src/design/Sections";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {blessingAnnouncementStore, useBlessingAnnouncement} from "@/src/store/BlessingAnnouncementStore";
import {useMissionRewards} from "@/src/store/MissionRewardsStore";
import {i18n} from "@/src/translations/i18n";

const TOAST_EMBLEM_SIZE = 24;

/** Says a blessing was just invoked for everyone, waiting like the mission toast for the screen to be free and taking its turn after it. */
export function BlessingActivatedToast(): ReactNode {
	const blessing = useBlessingAnnouncement();
	const myTurn = useToastTurn();
	const {unannounced: missionsToAnnounce} = useMissionRewards();
	if (!myTurn || missionsToAnnounce > 0) return null;
	if (!blessing) return null;
	return <Toast
		emblem={<TwemojiIcon emoji={AppIcons.getIcon("announcements.blessing")} size={TOAST_EMBLEM_SIZE} />}
		title={i18n.t("app:reference.blessing.activated", {name: i18n.t(`bot:blessingNames.${blessing.blessingType}`)})}
		subtitle={i18n.t(`bot:blessingEffects.${blessing.blessingType}`)}
		onDismiss={blessingAnnouncementStore.announced}
	/>;
}
