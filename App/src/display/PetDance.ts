import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {PET_FEED_RESULTS, PetFeedResult} from "ws-packets/src/objects/PetFood";

/**
 * How a pet reacts to attention.
 *
 * A species always celebrates a meal and answers a stroke the same way, so its manners become
 * familiar, and it says no with the same move whatever it is refusing.
 */
export const PET_DANCES = {
	HOP: "hop", WIGGLE: "wiggle", SPIN: "spin", BOUNCE: "bounce", SWAY: "sway", POUNCE: "pounce",
	NUZZLE: "nuzzle", PURR: "purr", WAG: "wag", STRETCH: "stretch", MELT: "melt", LEAN: "lean",
	HUFF: "huff"
} as const;
export type PetDance = typeof PET_DANCES[keyof typeof PET_DANCES];

export type DanceFrames = {lift: readonly number[]; drift: readonly number[]; tilt: readonly number[]; scale: readonly number[]};

/** Every dance is written on the same six keyframes, and starts and ends on the resting pose so it can repeat. */
export const DANCE_TIMELINE = [0, 0.2, 0.4, 0.6, 0.8, 1] as const;
const STILL = [0, 0, 0, 0, 0, 0] as const;
const STEADY = [1, 1, 1, 1, 1, 1] as const;

const DANCE_FRAMES = {
	hop: {lift: [0, -22, 0, -14, 0, 0], drift: STILL, tilt: STILL, scale: [1, 1, 0.9, 1, 0.94, 1]},
	wiggle: {lift: STILL, drift: [0, -7, 7, -6, 3, 0], tilt: [0, -14, 14, -10, 5, 0], scale: STEADY},
	spin: {lift: [0, -8, -12, -8, 0, 0], drift: STILL, tilt: [0, 110, 230, 320, 360, 360], scale: STEADY},
	bounce: {lift: [0, -14, 0, -7, 0, 0], drift: STILL, tilt: STILL, scale: [1, 1.12, 0.82, 1.08, 0.93, 1]},
	sway: {lift: STILL, drift: [0, -16, 16, -11, 5, 0], tilt: [0, -7, 7, -5, 2, 0], scale: STEADY},
	pounce: {lift: [0, -9, -20, 0, -5, 0], drift: [0, 12, 24, 7, -4, 0], tilt: [0, -9, -16, 5, 0, 0], scale: [1, 1.06, 1.14, 0.9, 1.03, 1]},
	nuzzle: {lift: STILL, drift: [0, 6, -4, 5, -2, 0], tilt: [0, 9, -6, 7, -2, 0], scale: [1, 1.05, 1.02, 1.05, 1.01, 1]},
	purr: {lift: [0, -2, 2, -2, 1, 0], drift: [0, -2, 2, -2, 1, 0], tilt: STILL, scale: [1, 1.04, 0.99, 1.04, 1.01, 1]},
	wag: {lift: STILL, drift: [0, -5, 5, -4, 2, 0], tilt: [0, -12, 12, -9, 4, 0], scale: STEADY},
	stretch: {lift: [0, -4, -7, -3, 0, 0], drift: [0, -4, -7, -2, 0, 0], tilt: [0, -7, -12, -4, 0, 0], scale: [1, 1.07, 1.11, 1.03, 1, 1]},
	melt: {lift: [0, 3, 6, 4, 1, 0], drift: STILL, tilt: [0, 5, 10, 6, 2, 0], scale: [1, 0.97, 0.94, 0.97, 1, 1]},
	lean: {lift: [0, -3, -2, -3, 0, 0], drift: [0, 8, 11, 6, 2, 0], tilt: [0, 7, 11, 6, 2, 0], scale: STEADY},
	huff: {lift: [0, -3, -1, -2, 0, 0], drift: [0, -12, -17, -12, -5, 0], tilt: [0, -16, -22, -14, -5, 0], scale: [1, 0.97, 0.94, 0.96, 0.99, 1]}
} as const satisfies Record<PetDance, DanceFrames>;

/** A meal is celebrated; a stroke is answered in a quieter register, where the pet leans into the hand. */
const SPECIES_FEASTS = [PET_DANCES.HOP, PET_DANCES.WIGGLE, PET_DANCES.SPIN, PET_DANCES.BOUNCE, PET_DANCES.SWAY, PET_DANCES.POUNCE] as const;
const SPECIES_CARESSES = [PET_DANCES.NUZZLE, PET_DANCES.PURR, PET_DANCES.WAG, PET_DANCES.STRETCH, PET_DANCES.MELT, PET_DANCES.LEAN] as const;

function speciesIndex(pet: OwnedPet, catalogueSize: number): number {
	return Math.abs(pet.typeId) % catalogueSize;
}

/** A meal the pet did not enjoy is turned away from, exactly as one stroke too many is. */
export function feastDance(pet: OwnedPet, result: PetFeedResult): PetDance {
	return result === PET_FEED_RESULTS.DISLIKE ? PET_DANCES.HUFF : SPECIES_FEASTS[speciesIndex(pet, SPECIES_FEASTS.length)];
}

export function caressDance(pet: OwnedPet, hadEnough = false): PetDance {
	return hadEnough ? PET_DANCES.HUFF : SPECIES_CARESSES[speciesIndex(pet, SPECIES_CARESSES.length)];
}

export function feastFrames(pet: OwnedPet, result: PetFeedResult): DanceFrames {
	return DANCE_FRAMES[feastDance(pet, result)];
}

export function caressFrames(pet: OwnedPet, hadEnough = false): DanceFrames {
	return DANCE_FRAMES[caressDance(pet, hadEnough)];
}

/** How much the meal pleased the pet decides how long it keeps dancing, and how much it sparkles. */
const FEED_ENCORES = {
	[PET_FEED_RESULTS.DISLIKE]: {repeats: 1, sparkles: 0},
	[PET_FEED_RESULTS.HAPPY]: {repeats: 1, sparkles: 1},
	[PET_FEED_RESULTS.VERY_HAPPY]: {repeats: 2, sparkles: 2},
	[PET_FEED_RESULTS.VERY_VERY_HAPPY]: {repeats: 3, sparkles: 3}
} as const satisfies Record<PetFeedResult, {repeats: number; sparkles: number}>;

export function feedEncore(result: PetFeedResult): {repeats: number; sparkles: number} {
	return FEED_ENCORES[result];
}
