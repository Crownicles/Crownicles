import {FightCue, FightMotion, FightSide, FIGHT_MOTIONS, isHeavyMotion} from "@/src/display/FightMotion";

const CONTACT_MOTIONS = new Set<FightMotion>([FIGHT_MOTIONS.SLASH, FIGHT_MOTIONS.RAPID, FIGHT_MOTIONS.HEAVY, FIGHT_MOTIONS.BITE, FIGHT_MOTIONS.CLAW, FIGHT_MOTIONS.PIERCE, FIGHT_MOTIONS.QUAKE]);
const STILL_FRAMES = [0, 0, 0, 0, 0, 0];

function actionMotionFrames(cue: FightCue | undefined, side: FightSide): number[] {
	if (!cue) return STILL_FRAMES;
	if (side === cue.target && cue.target !== cue.actor) {
		return cue.missed ? [0, 0, -10, -10, -3, 0] : [0, 0, -10, 6, -3, 0];
	}
	if (cue.periodic || side !== cue.actor) return STILL_FRAMES;
	return CONTACT_MOTIONS.has(cue.motion) ? [0, -4, 12, 5, -2, 0] : STILL_FRAMES;
}

export function fighterMotionFrames(cue: FightCue | undefined, side: FightSide): number[] {
	const direction = side === "self" ? 1 : -1;
	return actionMotionFrames(cue, side).map(value => value * direction);
}

export function fighterScaleFrames(cue: FightCue | undefined, side: FightSide): number[] {
	if (!isHeavyMotion(cue?.motion)) return [1, 1, 1, 1, 1, 1];
	return cue?.target === side ? [1, 1, 0.95, 1.03, 0.99, 1] : [1, 1, 1, 1, 1, 1];
}