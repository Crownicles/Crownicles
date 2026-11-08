import { ReactNode } from "react";
import { useRouter } from "expo-router";
import { AppIcons } from "@/src/AppIcons";
import { useAnnouncementTurn } from "@/src/components/useToastTurn";
import { Toast } from "@/src/design/Sections";
import { TwemojiIcon } from "@/src/design/TwemojiIcon";
import { tierReachedRewards } from "@/src/display/KingChallenge";
import { ADVENTURE_KING_CHALLENGE } from "@/src/navigation/AdventureTools";
import { gameRules } from "@/src/rules/GameRules";
import { useCityStayScore } from "@/src/store/CityStayScoreStore";
import {
	kingChallengeTierStore, useKingChallengeTierReached
} from "@/src/store/KingChallengeStore";
import { useLevelUp } from "@/src/store/LevelUpStore";
import { i18n } from "@/src/translations/i18n";

const TOAST_EMBLEM_SIZE = 24;

/**
 * Says the king rewarded a crossed tier, once the gain that crossed it has been told: the mission, the city stay
 * or the level that came with it. A tap opens the challenge in the missions.
 */
export function KingChallengeToast(): ReactNode {
	const router = useRouter();
	const reached = useKingChallengeTierReached();
	const myTurn = useAnnouncementTurn();
	const levelUp = useLevelUp();
	const cityStay = useCityStayScore();
	if (!reached || !myTurn || levelUp || cityStay) {
		return null;
	}
	const rules = gameRules().kingChallenge;
	return <Toast
		emblem={<TwemojiIcon emoji={AppIcons.getIcon("kingChallenge.icon")} size={TOAST_EMBLEM_SIZE} />}
		title={i18n.t("app:kingChallenge.toast.title", {
			count: reached.crossedTiers, tier: reached.tier, tierCount: rules.tierRewards.length
		})}
		subtitle={tierReachedRewards(reached, rules)}
		onDismiss={kingChallengeTierStore.announced}
		onPress={(): void => {
			kingChallengeTierStore.announced();
			router.navigate(ADVENTURE_KING_CHALLENGE);
		}}
	/>;
}
