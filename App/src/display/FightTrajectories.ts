import {FightCue, FightMotion, FightSide, FIGHT_MOTIONS, isHeavyMotion} from "@/src/display/FightMotion";

const ACTOR_FRAMES: Partial<Record<FightMotion, number[]>> = {
	slash: [0, -4, 12, 5, -2, 0], rapid: [0, -1, 10, -1, 8, 0], heavy: [0, -9, 15, 3, -3, 0],
	pierce: [0, -3, 16, 3, 0, 0], bite: [0, -2, 11, 5, -1, 0], claw: [0, -4, 12, 4, 3, 0],
	quake: [0, -3, 0, -3, 2, 0], dodge: [0, -4, -15, -10, -5, 0]
};
const STILL_FRAMES = [0, 0, 0, 0, 0, 0];
const NORMAL_SCALE = [1, 1, 1, 1, 1, 1];
const STILL_TILT = STILL_FRAMES.map(angle => `${angle}deg`);

function actionMotionFrames(cue: FightCue | undefined, side: FightSide): number[] {
	if (!cue) return STILL_FRAMES;
	if (side === cue.target && cue.target !== cue.actor) {
		if (cue.missed) return [0, 0, -10, -10, -3, 0];
		return isHeavyMotion(cue.motion) ? [0, 0, -16, 7, -3, 0] : [0, 0, -10, 6, -3, 0];
	}
	if (cue.periodic || side !== cue.actor) return STILL_FRAMES;
	return ACTOR_FRAMES[cue.motion] ?? STILL_FRAMES;
}

export function fighterMotionFrames(cue: FightCue | undefined, side: FightSide): number[] {
	const direction = side === "self" ? 1 : -1;
	return actionMotionFrames(cue, side).map(value => value * direction);
}

export function fighterScaleFrames(cue: FightCue | undefined, side: FightSide): number[] {
	if (!cue || cue.periodic) return NORMAL_SCALE;
	if (cue.motion === FIGHT_MOTIONS.REST && cue.actor === side) return [1, 1.015, 1.03, 1.02, 1, 1];
	if (cue.target !== side || cue.missed) return NORMAL_SCALE;
	return isHeavyMotion(cue.motion) ? [1, 1, 0.95, 1.03, 0.99, 1] : NORMAL_SCALE;
}

export function fighterTiltFrames(cue: FightCue | undefined, side: FightSide): string[] {
	if (!cue || cue.periodic) return STILL_TILT;
	const direction = side === "self" ? 1 : -1;
	const frames = cue.actor === side && isHeavyMotion(cue.motion) ? [0, -3, 2, 1, 0, 0] : STILL_FRAMES;
	return frames.map(angle => `${angle * direction}deg`);
}