import {ReactNode, useState} from "react";
import {useRouter} from "expo-router";
import {MISSION_TYPES} from "ws-packets/src/objects/Mission";
import {AppIcons} from "@/src/AppIcons";
import {SectionHeader} from "@/src/design/Primitives";
import {Card, EntryRow} from "@/src/design/Sections";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {useMissions} from "@/src/components/Missions";
import {missionDescription} from "@/src/display/Missions";
import {JOURNEY_TABS} from "@/src/journey/Journey";
import {useJourney} from "@/src/journey/useJourney";
import {i18n} from "@/src/translations/i18n";

const GUIDE_EMBLEM = 26;

/**
 * Walks the newcomer through their first hours one step at a time: only the campaign mission to do
 * now, never what comes after. It leaves once every part of the game is open.
 */
export function JourneyGuide(): ReactNode {
	const router = useRouter();
	const journey = useJourney();
	const missions = useMissions();
	const [now] = useState(Date.now);
	const campaign = journey.nextStep && missions.status === "ready" && missions.data.campaignProgression !== 0
		? missions.data.missions.find(mission => mission.missionType === MISSION_TYPES.CAMPAIGN)
		: undefined;
	if (!campaign) return null;
	const canOpenMissions = journey.tabs.includes(JOURNEY_TABS.PROFILE);
	return <>
		<SectionHeader>{i18n.t("app:journey.title")}</SectionHeader>
		<Card>
			<EntryRow
				emblem={<TwemojiIcon emoji={AppIcons.getIcon(`missions.${campaign.missionType}`)} size={GUIDE_EMBLEM} />}
				title={missionDescription(campaign, now)}
				subtitle={i18n.t("app:journey.nextStep", {value: campaign.numberDone, max: campaign.missionObjective})}
				{...canOpenMissions ? {onPress: (): void => router.push("/profile/missions")} : {}}
				testID="journey-campaign"
			/>
		</Card>
	</>;
}
