import {ReactNode, useEffect, useState} from "react";
import {Animated, Easing, View} from "react-native";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {PetExpedition} from "ws-packets/src/fromServer/pet/PetRes";
import {useSecondsLeft} from "@/src/collectors/CollectorPrompt";
import {AppIcons} from "@/src/AppIcons";
import {Figure, Figures, Standing} from "@/src/design/Sections";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {createStyles} from "@/src/design/ThemeContext";
import {expeditionLocationIcon, expeditionLocationTitle} from "@/src/display/PetExpedition";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {formatNumber} from "@/src/display/Amounts";
import {missionDate} from "@/src/display/Missions";
import {petIcon, petName} from "@/src/display/PetDisplay";
import {useReducedMotion} from "@/src/store/useReducedMotion";
import {i18n} from "@/src/translations/i18n";

const MILLISECONDS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const PERCENTAGE_SCALE = 100;
/** The pet trots along the trail, a small hop per step, as the traveller of the adventure page does. */
const TROT = {stepMs: 380, hop: -4, lean: "6deg"} as const;

const useStyles = createStyles(colors => ({
	trail: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.md, paddingTop: Theme.spacing.xl + Theme.spacing.sm, paddingBottom: Theme.spacing.lg, paddingHorizontal: Theme.spacing.lg},
	node: {width: Theme.dimensions.headerIcon, height: Theme.dimensions.headerIcon, alignItems: "center", justifyContent: "center"},
	track: {flex: 1, height: 6, borderRadius: Theme.pillRadius, backgroundColor: colors.line},
	fill: {height: "100%", borderRadius: Theme.pillRadius, backgroundColor: colors.ink},
	walker: {position: "absolute", top: -Theme.dimensions.headerIcon + Theme.spacing.xs, marginLeft: -Theme.dimensions.quickActionIcon / 2}
}));

function useTrot(moving: boolean): Animated.Value {
	const reducedMotion = useReducedMotion();
	const [step] = useState(() => new Animated.Value(0));
	useEffect(() => {
		if (!moving || reducedMotion) return undefined;
		const trot = Animated.loop(Animated.sequence([
			Animated.timing(step, {toValue: 1, duration: TROT.stepMs, easing: Easing.out(Easing.quad), useNativeDriver: true}),
			Animated.timing(step, {toValue: 0, duration: TROT.stepMs, easing: Easing.in(Easing.quad), useNativeDriver: true})
		]));
		trot.start();
		return (): void => trot.stop();
	}, [moving, reducedMotion, step]);
	return step;
}

/** From home to the destination, the pet's emoji advancing along the track as its time out runs. Twemoji animals face left, so it is mirrored. */
function ExpeditionTrail({pet, expedition, progress}: {pet: OwnedPet; expedition: PetExpedition; progress: number}): ReactNode {
	const styles = useStyles();
	const step = useTrot(progress < 1);
	const position = `${progress * PERCENTAGE_SCALE}%` as const;
	return <View accessible accessibilityLabel={`${i18n.t("app:expedition.remaining")}: ${Math.round(progress * PERCENTAGE_SCALE)}%`} style={styles.trail}>
		<View style={styles.node}><TwemojiIcon emoji={AppIcons.getIcon("expedition.recall")} size={Theme.dimensions.headerIcon} /></View>
		<View style={styles.track}>
			<View style={[styles.fill, {width: position}]} />
			<Animated.View style={[styles.walker, {left: position}, {transform: [
				{translateY: step.interpolate({inputRange: [0, 1], outputRange: [0, TROT.hop]})},
				{rotate: step.interpolate({inputRange: [0, 1], outputRange: ["0deg", TROT.lean]})},
				{scaleX: -1}
			]}]}>
				<TwemojiIcon emoji={petIcon(pet)} size={Theme.dimensions.quickActionIcon} />
			</Animated.View>
		</View>
		<View style={styles.node}><TwemojiIcon emoji={expeditionLocationIcon(expedition)} size={Theme.dimensions.headerIcon} /></View>
	</View>;
}

function expeditionFigures(expedition: PetExpedition, secondsLeft: number): Figure[] {
	return [
		...secondsLeft > 0 ? [{caption: i18n.t("app:expedition.remaining"), value: formatDurationMinutes(secondsLeft / SECONDS_PER_MINUTE)}] : [],
		{caption: i18n.t("app:expedition.risk"), value: i18n.t(`commands:petExpedition.riskCategories.${expedition.riskCategory}`)},
		...expedition.foodConsumed > 0 ? [{caption: i18n.t("app:expedition.foodConsumed"), value: formatNumber(expedition.foodConsumed)}] : []
	];
}

/** A pet away is followed like the adventure itself: where it is headed, how far along it is, what the trip costs. */
export function PetExpeditionJourney({pet, expedition}: {pet: OwnedPet; expedition: PetExpedition}): ReactNode {
	const secondsLeft = useSecondsLeft(expedition.endTime);
	const duration = expedition.endTime - expedition.startTime;
	const progress = duration > 0 ? Math.min(1, Math.max(0, 1 - secondsLeft * MILLISECONDS_PER_SECOND / duration)) : 1;
	const back = secondsLeft === 0;
	return <>
		<Standing
			testID="pet-expedition-journey"
			emblem={<TwemojiIcon emoji={expeditionLocationIcon(expedition)} size={Theme.dimensions.headerIcon} />}
			caption={i18n.t(back ? "app:expedition.titles.expeditionFinished" : "app:expedition.titles.expeditionProgress")}
			title={expeditionLocationTitle(expedition)}
			subtitle={back
				? i18n.t("app:expedition.away.back", {pet: petName(pet)})
				: i18n.t("app:expedition.away.exploring", {pet: petName(pet), date: missionDate(expedition.endTime)})}
		>
			<ExpeditionTrail pet={pet} expedition={expedition} progress={progress} />
		</Standing>
		<Figures items={expeditionFigures(expedition, secondsLeft)} />
	</>;
}
