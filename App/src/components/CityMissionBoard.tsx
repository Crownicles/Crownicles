import {ReactNode} from "react";
import {useRouter} from "expo-router";
import {AppIcons} from "@/src/AppIcons";
import {CountBadge, SectionHeader} from "@/src/design/Primitives";
import {EntryRow, ExpandableList} from "@/src/design/Sections";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {ADVENTURE_MISSIONS} from "@/src/navigation/AdventureTools";
import {useMissionsToClaim} from "@/src/store/useClaimables";
import {i18n} from "@/src/translations/i18n";

const BOARD_EMBLEM_SIZE = 26;

/** The city's notice board: the way to the missions, which otherwise live on the journey screen a city replaces. */
export function CityMissionBoard(): ReactNode {
	const router = useRouter();
	const toClaim = useMissionsToClaim();
	return <>
		<SectionHeader first>{i18n.t("app:city.titles.missions")}</SectionHeader>
		<ExpandableList>
			<EntryRow
				emblem={<TwemojiIcon emoji={AppIcons.getIcon("missions.campaign")} size={BOARD_EMBLEM_SIZE} />}
				title={i18n.t("app:city.missionBoard.title")}
				subtitle={toClaim > 0 ? i18n.t("app:missions.rewards.waiting", {count: toClaim}) : i18n.t("app:city.missionBoard.description")}
				end={<CountBadge count={toClaim} />}
				onPress={(): void => router.navigate(ADVENTURE_MISSIONS)}
				testID="city-mission-board"
			/>
		</ExpandableList>
	</>;
}
