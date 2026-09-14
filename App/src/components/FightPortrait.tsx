import {ReactNode} from "react";
import {Animated, StyleSheet, View} from "react-native";
import {FightFighter} from "ws-packets/src/objects/Fight";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {AppIcons} from "@/src/AppIcons";
import {Swords} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {petIcon, petName} from "@/src/display/PetDisplay";
import {FightAnimation} from "@/src/store/useFightAnimation";
import {fighterMotionFrames, fighterScaleFrames, fighterTiltFrames, fighterLiftFrames, fighterTimingFrames} from "@/src/display/FightTrajectories";
import {useCompactFight} from "@/src/components/FightControls";

const styles = StyleSheet.create({
	portrait: {width: 72, height: 70, alignSelf: "center", marginTop: 10, marginBottom: 7, alignItems: "center", justifyContent: "center"},
	base: {position: "absolute", bottom: 0, width: 62, height: 10, borderRadius: 5, backgroundColor: Theme.colors.wash},
	pet: {position: "absolute", right: -9, bottom: 2, borderRadius: 10, backgroundColor: Theme.colors.paper, padding: 3, borderWidth: 1, borderColor: Theme.colors.line},
	compact: {height: 40, marginTop: 3, marginBottom: 5}
});

function fighterIcon(fighter: FightFighter): string | null {
	if (fighter.monsterId) return AppIcons.getIconOrNull(`monsters.${fighter.monsterId}`);
	return fighter.classId === undefined ? null : AppIcons.getIconOrNull(`classes.${fighter.classId}`);
}

function PortraitImage({fighter, pet, assistance}: {fighter: FightFighter; pet?: OwnedPet; assistance?: OwnedPet}): ReactNode {
	const compact = useCompactFight();
	const icon = assistance ? petIcon(assistance) : fighterIcon(fighter);
	const companion = assistance ? fighterIcon(fighter) : pet ? petIcon(pet) : null;
	const sizes = compact ? {fighter: 36, pet: 14} : {fighter: 55, pet: 20};
	return <View style={[styles.portrait, compact && styles.compact]} {...assistance ? {testID: "fight-active-pet", accessibilityLabel: petName(assistance)} : {}}><View style={styles.base} />
		{icon ? <TwemojiIcon emoji={icon} size={sizes.fighter} /> : <Swords size={sizes.fighter} color={Theme.colors.muted} />}
		{companion ? <View style={styles.pet}><TwemojiIcon emoji={companion} size={sizes.pet} /></View> : null}
	</View>;
}

export function FightPortrait({fighter, pet, animation}: {fighter: FightFighter; pet?: OwnedPet; animation: FightAnimation}): ReactNode {
	const side = fighter.isSelf ? "self" : "opponent";
	const {cue, progress, reducedMotion} = animation;
	const timing = fighterTimingFrames(cue, side);
	const assistance = cue?.actor === side ? cue.pet : undefined;
	return <Animated.View style={!reducedMotion && {transform: [{translateX: progress.interpolate({inputRange: timing, outputRange: fighterMotionFrames(cue, side)})}, {translateY: progress.interpolate({inputRange: timing, outputRange: fighterLiftFrames(cue, side)})}, {scale: progress.interpolate({inputRange: timing, outputRange: fighterScaleFrames(cue, side)})}, {rotate: progress.interpolate({inputRange: timing, outputRange: fighterTiltFrames(cue, side)})}]}} testID={`fight-portrait-${side}`}>
		<PortraitImage fighter={fighter} pet={pet} {...assistance ? {assistance} : {}} />
	</Animated.View>;
}