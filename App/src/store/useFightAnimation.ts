import {useEffect, useEffectEvent, useState} from "react";
import {Animated, Easing} from "react-native";
import {FightLogRecord} from "@/src/store/FightStore";
import {FightCue, fightCue, isHeavyMotion} from "@/src/display/FightMotion";

const ANIMATION_DURATION = 780;
const HEAVY_ANIMATION_DURATION = 920;
const REDUCED_ANIMATION_DURATION = 120;
const IMPACT_PROGRESS = 0.4;
export type FightAnimation = {progress: Animated.Value; cue?: FightCue; reducedMotion: boolean};
type AnimationCallbacks = {onImpact: () => void; onComplete: () => void};

export function useFightAnimation(record: FightLogRecord | undefined, callbacks: AnimationCallbacks, reducedMotion: boolean): FightAnimation {
	const [progress] = useState(() => new Animated.Value(0));
	const finish = useEffectEvent(callbacks.onComplete);
	const hit = useEffectEvent(callbacks.onImpact);
	const cue = record ? fightCue(record.entry) : undefined;
	const duration = reducedMotion ? REDUCED_ANIMATION_DURATION : isHeavyMotion(cue?.motion) ? HEAVY_ANIMATION_DURATION : ANIMATION_DURATION;
	const sequence = record?.sequence;
	useEffect(() => {
		progress.setValue(0);
		if (sequence === undefined) return;
		let impacted = false;
		const listener = progress.addListener(({value}) => {
			if (impacted || value < IMPACT_PROGRESS) return;
			impacted = true;
			hit();
		});
		const animation = Animated.timing(progress, {toValue: 1, duration, easing: Easing.linear, useNativeDriver: true});
		animation.start(({finished}) => {if (finished) finish();});
		return (): void => {progress.removeListener(listener); animation.stop();};
	}, [sequence, duration, progress]);
	return {progress, ...(cue ? {cue} : {}), reducedMotion};
}