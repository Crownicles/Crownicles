import {ReactNode, useCallback, useEffect, useState} from "react";
import {Modal, StyleSheet, View} from "react-native";
import {useRouter} from "expo-router";
import {CompletedMission, MissionType} from "ws-packets/src/objects/Mission";
import {RecipeDisplay} from "ws-packets/src/objects/RecipeDisplay";
import {AppIcons} from "@/src/AppIcons";
import {Note, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, Card, Effect, Effects, EntryRow, Toast} from "@/src/design/Sections";
import {Check, Gift} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Celebration} from "@/src/components/UnlockCelebration";
import {useToastTurn} from "@/src/components/useToastTurn";
import {amountEffect, gainEffect, presentEffects} from "@/src/display/OutcomeEffects";
import {missionDescription, missionRewardTotal, missionRows} from "@/src/display/Missions";
import {MissionRewards, missionRewardsStore, useMissionRewards} from "@/src/store/MissionRewardsStore";
import {i18n} from "@/src/translations/i18n";

const MISSIONS_ROUTE = "/profile/missions";
const MISSION_EMBLEM_SIZE = 26;
const TOAST_EMBLEM_SIZE = 24;

const styles = StyleSheet.create({
	rewards: {alignItems: "center", marginTop: Theme.spacing.lg, marginBottom: Theme.spacing.lg}
});

function missionIcon(type: MissionType): string {
	return AppIcons.getIcon(`missions.${type}`);
}

function recipeLabel(recipe: RecipeDisplay): string {
	return i18n.t("models:cooking.recipeDisplay", {recipeId: recipe.recipeId, recipeType: recipe.recipeType, level: recipe.level});
}

function rewardEffects(rewards: MissionRewards): Effect[] {
	const total = missionRewardTotal(rewards.missions);
	return presentEffects([
		amountEffect(i18n.t("app:adventure.event.fields.experience"), total.experience, {gain: "xp"}),
		amountEffect(i18n.t("app:adventure.event.fields.money"), total.money, {gain: "money"}),
		amountEffect(i18n.t("app:adventure.event.fields.gems"), total.gems, {gain: "gem"}),
		amountEffect(i18n.t("app:adventure.event.fields.points"), total.points, {gain: "score"}),
		amountEffect(i18n.t("app:missions.rewards.pet"), rewards.missions.filter(mission => mission.reward.petRewardTypeId !== undefined).length),
		...rewards.recipes.map(recipe => gainEffect(i18n.t("app:missions.rewards.recipe"), recipeLabel(recipe)))
	]);
}

/** The reward is only told once the player asks for it: Core credited it already, this is the moment it is seen. */
function MissionRewardsReveal({rewards, onClose}: {rewards: MissionRewards; onClose: () => void}): ReactNode {
	const [now] = useState(Date.now);
	const [first] = rewards.missions;
	const count = rewards.missions.length;
	const effects = rewardEffects(rewards);
	return <Modal transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
		<Celebration
			icon={`missions.${first.mission.missionType}`}
			eyebrow={i18n.t("app:missions.rewards.completed", {count})}
			title={count === 1 ? missionDescription(first.mission, now) : i18n.t("app:missions.rewards.title")}
			testID="mission-rewards-reveal"
		>
			<View style={styles.rewards}>
				{effects.length > 0 ? <Effects items={effects} /> : <Note>{i18n.t("app:missions.rewards.none")}</Note>}
			</View>
			{rewards.nextCampaignMission
				? <Note>{i18n.t("app:missions.rewards.nextCampaign", {mission: missionDescription(rewards.nextCampaignMission, now)})}</Note>
				: null}
			<ActionBanner icon={Check} label={i18n.t("app:missions.rewards.continue")} onPress={onClose} testID="mission-rewards-continue" />
		</Celebration>
	</Modal>;
}

function UnclaimedMissionRow({completed, now}: {completed: CompletedMission; now: number}): ReactNode {
	return <EntryRow
		emblem={<TwemojiIcon emoji={missionIcon(completed.mission.missionType)} size={MISSION_EMBLEM_SIZE} />}
		title={missionDescription(completed.mission, now)}
		subtitle={i18n.t(`app:missions.rewards.types.${completed.mission.missionType}`)}
	/>;
}

/** The missions Core completed since the player last looked, waiting for them to collect what they earned. */
export function UnclaimedMissions(): ReactNode {
	const {rewards} = useMissionRewards();
	const [revealed, setRevealed] = useState<MissionRewards | null>(null);
	const [now] = useState(Date.now);
	const count = rewards.missions.length;
	useEffect(() => {
		if (count > 0) missionRewardsStore.announced();
	}, [count]);
	if (count === 0 && !revealed) return null;
	return <>
		{count > 0 ? <>
			<SectionHeader first>{i18n.t("app:missions.rewards.section")}</SectionHeader>
			<Card>
				{missionRows(rewards.missions).map(row => <UnclaimedMissionRow key={row.key} completed={row.completed} now={now} />)}
			</Card>
			<ActionBanner
				icon={Gift}
				emoji={AppIcons.getIcon("missions.total")}
				label={i18n.t("app:missions.rewards.claim", {count})}
				onPress={(): void => setRevealed(rewards)}
				testID="mission-rewards-claim"
			/>
		</> : null}
		{revealed ? <MissionRewardsReveal rewards={revealed} onClose={(): void => {
			missionRewardsStore.claim(revealed);
			setRevealed(null);
		}} /> : null}
	</>;
}

/** On the profile, the way to the rewards waiting in the missions. */
export function MissionRewardsBanner(): ReactNode {
	const router = useRouter();
	const count = useMissionRewards().rewards.missions.length;
	if (count === 0) return null;
	return <ActionBanner
		icon={Gift}
		emoji={AppIcons.getIcon("missions.total")}
		label={i18n.t("app:missions.rewards.waiting", {count})}
		onPress={(): void => router.push(MISSIONS_ROUTE)}
		testID="mission-rewards-banner"
	/>;
}

/** Says a mission was just completed, once the adventure has finished telling its story and no unlock is being announced. */
export function MissionCompletedToast(): ReactNode {
	const router = useRouter();
	const {rewards, unannounced} = useMissionRewards();
	const myTurn = useToastTurn();
	const dismiss = useCallback((): void => missionRewardsStore.announced(), []);
	const latest = rewards.missions.at(-1);
	if (!myTurn) return null;
	if (unannounced === 0 || !latest) return null;
	return <Toast
		emblem={<TwemojiIcon emoji={missionIcon(latest.mission.missionType)} size={TOAST_EMBLEM_SIZE} />}
		title={i18n.t("app:missions.rewards.completed", {count: unannounced})}
		subtitle={i18n.t("app:missions.rewards.toast")}
		onDismiss={dismiss}
		onPress={(): void => {
			dismiss();
			router.navigate(MISSIONS_ROUTE);
		}}
	/>;
}
