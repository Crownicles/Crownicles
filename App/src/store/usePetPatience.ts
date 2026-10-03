import {useEffect, useRef, useState} from "react";

/** How many strokes in a row a pet tolerates before walking off for a moment. */
export const PET_PATIENCE = {STROKES: 5, WITHIN_MS: 6_000, SULK_MS: 5_000};

export type PetPatience = {strokes: number; hadEnough: boolean; stroke: () => void};

/**
 * Counts the strokes a pet has just received.
 *
 * A caress changes nothing in the game, so running out of patience is only a matter of manners and
 * belongs here rather than on the server.
 */
export function usePetPatience(): PetPatience {
	const [strokes, setStrokes] = useState(0);
	const [hadEnough, setHadEnough] = useState(false);
	const recent = useRef<number[]>([]);
	useEffect(() => {
		if (!hadEnough) return undefined;
		const forgiveness = setTimeout(() => {
			recent.current = [];
			setHadEnough(false);
		}, PET_PATIENCE.SULK_MS);
		return (): void => clearTimeout(forgiveness);
	}, [hadEnough]);
	const stroke = (): void => {
		const now = Date.now();
		recent.current = [...recent.current.filter(at => now - at < PET_PATIENCE.WITHIN_MS), now];
		setStrokes(count => count + 1);
		if (recent.current.length >= PET_PATIENCE.STROKES) setHadEnough(true);
	};
	return {strokes, hadEnough, stroke};
}
