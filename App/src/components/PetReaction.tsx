import {ReactNode, useEffect, useState} from "react";
import {Animated, Easing, View} from "react-native";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {PetFeedResult} from "ws-packets/src/objects/PetFood";
import {DANCE_TIMELINE, DanceFrames, EMPTY_BOWL_FRAMES, caressFrames, feastFrames, feedEncore} from "@/src/display/PetDance";
import {petIcon} from "@/src/display/PetDisplay";
import {useReducedMotion} from "@/src/store/useReducedMotion";
import {Heart, LucideIcon, Sparkles} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {createStyles, useColors} from "@/src/design/ThemeContext";
import {AppIcons} from "@/src/AppIcons";

const DANCE_DURATION = 760;
const REDUCED_DANCE_DURATION = 120;
const CARESS_REPEATS = 1;
const CARESS_HEARTS = 2;
const FEAST_PET_SIZE = 52;
const EMPTY_BOWL_SNIFFS = 2;
const BOWL_SIZE = 34;
const EMPTY_BOWL_OPACITY = 0.55;

/** The motes drift out of the pet in mismatched sizes, so a handful never looks like a row. */
const MOTE_SIZES = [14, 10, 16] as const;
const MOTE_DRIFTS = [-6, 4, 10] as const;

const useStyles = createStyles(() => ({
	feast: {height: 78, alignItems: "center", justifyContent: "center"},
	stage: {alignItems: "center", justifyContent: "center"},
	bowlScene: {flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: Theme.spacing.lg, paddingVertical: Theme.spacing.md},
	motes: {position: "absolute", top: -18, flexDirection: "row", alignItems: "flex-end", gap: Theme.spacing.sm}
}));

/** Runs the dance once per change of `play`, so the same scene can be replayed on demand. */
function useDance(repeats: number, play: number): Animated.Value {
	const reducedMotion = useReducedMotion();
	const [progress] = useState(() => new Animated.Value(0));
	useEffect(() => {
		if (play === 0) return undefined;
		progress.setValue(0);
		const dance = Animated.loop(
			Animated.timing(progress, {toValue: 1, duration: reducedMotion ? REDUCED_DANCE_DURATION : DANCE_DURATION, easing: Easing.inOut(Easing.quad), useNativeDriver: true}),
			{iterations: repeats}
		);
		dance.start();
		return (): void => dance.stop();
	}, [progress, repeats, reducedMotion, play]);
	return progress;
}

function DancingPet({pet, size, frames, progress}: {pet: OwnedPet; size: number; frames: DanceFrames; progress: Animated.Value}): ReactNode {
	const timeline = [...DANCE_TIMELINE];
	return <Animated.View style={{
		transform: [
			{translateY: progress.interpolate({inputRange: timeline, outputRange: [...frames.lift]})},
			{translateX: progress.interpolate({inputRange: timeline, outputRange: [...frames.drift]})},
			{rotate: progress.interpolate({inputRange: timeline, outputRange: frames.tilt.map(angle => `${angle}deg`)})},
			{scale: progress.interpolate({inputRange: timeline, outputRange: [...frames.scale]})}
		]
	}}><TwemojiIcon emoji={petIcon(pet)} size={size} /></Animated.View>;
}

/** What the pet gives off while it dances: sparkles over a good meal, hearts under a hand. */
function DanceMotes({count, icon: Icon, color, progress}: {count: number; icon: LucideIcon; color: string; progress: Animated.Value}): ReactNode {
	const styles = useStyles();
	if (count === 0) return null;
	return <View style={styles.motes} pointerEvents="none" testID="pet-motes">{MOTE_SIZES.slice(0, count).map((size, index) => <Animated.View
		key={size}
		style={{
			opacity: progress.interpolate({inputRange: [0, 0.25 + index * 0.1, 0.6 + index * 0.1, 1], outputRange: [0, 1, 0.5, 0]}),
			transform: [
				{translateY: progress.interpolate({inputRange: [0, 1], outputRange: [8, -10 - index * 3]})},
				{translateX: progress.interpolate({inputRange: [0, 1], outputRange: [0, MOTE_DRIFTS[index]]})},
				{scale: progress.interpolate({inputRange: [0, 0.3, 1], outputRange: [0.6, 1, 0.85]})}
			]
		}}
	><Icon size={size} color={color} /></Animated.View>)}</View>;
}

/** The pet acts out its meal, in the manners of its species and with the appetite the server reported. */
export function PetFeast({pet, result, play}: {pet: OwnedPet; result: PetFeedResult; play: number}): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const {repeats, sparkles} = feedEncore(result);
	const progress = useDance(repeats, play);
	return <View style={styles.feast} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="pet-feast">
		<View style={styles.stage}>
			<DanceMotes count={sparkles} icon={Sparkles} color={colors.gold} progress={progress} />
			<DancingPet pet={pet} size={FEAST_PET_SIZE} frames={feastFrames(pet, result)} progress={progress} />
		</View>
	</View>;
}

/** Nothing is left in the guild's storage: the pet noses its empty bowl, then gives up. */
export function PetEmptyBowl({pet, play}: {pet: OwnedPet | undefined; play: number}): ReactNode {
	const styles = useStyles();
	const progress = useDance(EMPTY_BOWL_SNIFFS, play);
	const bowl = AppIcons.getIconOrNull("petInformation.diet");
	return <View style={styles.bowlScene} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="pet-empty-bowl">
		{bowl ? <TwemojiIcon emoji={bowl} size={BOWL_SIZE} opacity={EMPTY_BOWL_OPACITY} /> : null}
		{pet ? <DancingPet pet={pet} size={FEAST_PET_SIZE} frames={EMPTY_BOWL_FRAMES} progress={progress} /> : null}
	</View>;
}

/** The pet answers a stroke where it stands, once per stroke the server accepted. */
export function PetCaress({pet, size, strokes, hadEnough}: {pet: OwnedPet; size: number; strokes: number; hadEnough: boolean}): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const progress = useDance(CARESS_REPEATS, strokes);
	return <View style={styles.stage} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="pet-caress">
		<DanceMotes count={hadEnough || strokes === 0 ? 0 : CARESS_HEARTS} icon={Heart} color={colors.red} progress={progress} />
		<DancingPet pet={pet} size={size} frames={caressFrames(pet, hadEnough)} progress={progress} />
	</View>;
}
