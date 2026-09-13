import {useEffect, useEffectEvent, useRef, useState} from "react";
import {Animated, Easing} from "react-native";
import {FightLogRecord} from "@/src/store/FightStore";
import {FightCue, FightMotion, fightCue, isHeavyMotion, FIGHT_SPEEDS, FightSpeed} from "@/src/display/FightMotion";

const ANIMATION_DURATION = 780;
const HEAVY_ANIMATION_DURATION = 920;
const REDUCED_ANIMATION_DURATION = 120;
const IMPACT_PROGRESS = 0.4;
const NORMAL_DURATION_MULTIPLIER = 2;
export type FightAnimation = {progress: Animated.Value; cue?: FightCue; reducedMotion: boolean};
type AnimationCallbacks = {onImpact: () => void; onComplete: () => void};
type AnimationCursor = {sequence?: number; impacted: boolean};
type AnimationSegment = AnimationCallbacks & {duration: number};

function animationDuration(motion: FightMotion | undefined, reducedMotion: boolean, speed: FightSpeed): number {
	if (reducedMotion) return REDUCED_ANIMATION_DURATION;
	const base = isHeavyMotion(motion) ? HEAVY_ANIMATION_DURATION : ANIMATION_DURATION;
	return speed === FIGHT_SPEEDS.FAST ? base : base * NORMAL_DURATION_MULTIPLIER;
}

function playAnimationSegment(progress: Animated.Value, segment: AnimationSegment, cursor: AnimationCursor): () => void {
	let disposed = false;
	let animation: Animated.CompositeAnimation | undefined;
	const listener = progress.addListener(({value}) => {
		if (cursor.impacted || value < IMPACT_PROGRESS) return;
		cursor.impacted = true;
		segment.onImpact();
	});
	progress.stopAnimation(value => {
		if (disposed) return;
		animation = Animated.timing(progress, {toValue: 1, duration: segment.duration * Math.max(0, 1 - value), easing: Easing.linear, useNativeDriver: true});
		animation.start(({finished}) => {if (finished && !disposed) segment.onComplete();});
	});
	return (): void => {disposed = true; progress.removeListener(listener); animation?.stop();};
}

export function useFightAnimation(record: FightLogRecord | undefined, callbacks: AnimationCallbacks, reducedMotion: boolean, speed: FightSpeed = FIGHT_SPEEDS.NORMAL): FightAnimation {
	const [progress] = useState(() => new Animated.Value(0));
	const cursor = useRef<AnimationCursor>({impacted: false});
	const finish = useEffectEvent(callbacks.onComplete);
	const hit = useEffectEvent(callbacks.onImpact);
	const cue = record ? fightCue(record.entry) : undefined;
	const duration = animationDuration(cue?.motion, reducedMotion, speed);
	const sequence = record?.sequence;
	useEffect(() => {
		if (cursor.current.sequence !== sequence) {
			cursor.current = {sequence, impacted: false};
			progress.setValue(0);
		}
		if (sequence === undefined) return;
		return playAnimationSegment(progress, {duration, onImpact: hit, onComplete: finish}, cursor.current);
	}, [sequence, duration, progress]);
	return {progress, ...(cue ? {cue} : {}), reducedMotion};
}