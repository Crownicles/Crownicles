import {Dispatch, SetStateAction, useEffect, useState} from "react";
import {AccessibilityInfo} from "react-native";
import {FightStatus} from "ws-packets/src/objects/Fight";
import {FightLogRecord, FightSnapshot, fightStore} from "@/src/store/FightStore";

type PlaybackCursor = {fightId: string | undefined; sequence: number; impactSequence?: number};
export type FightPlayback = {record: FightLogRecord | undefined; status: FightStatus | null; logs: FightLogRecord[]; impact: () => void; complete: () => void; reducedMotion: boolean; impacted: boolean};
type CursorState = [PlaybackCursor, Dispatch<SetStateAction<PlaybackCursor>>];

export function useFightReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		let active = true;
		AccessibilityInfo.isReduceMotionEnabled().then(value => {if (active) setReduced(value);}).catch(() => undefined);
		const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
		return (): void => {active = false; subscription.remove();};
	}, []);
	return reduced;
}

function usePlaybackCursor(fight: FightSnapshot): CursorState {
	const fightId = fight.introduction?.fightId;
	const lastSequence = fight.logs.at(-1)?.sequence ?? 0;
	const [cursor, setCursor] = useState<PlaybackCursor>(() => ({fightId, sequence: fight.playedSequence}));
	if (fightId !== cursor.fightId) setCursor({fightId, sequence: 0});
	if (!fight.visible && cursor.sequence !== lastSequence) setCursor({fightId, sequence: lastSequence});
	return [cursor, setCursor];
}

function playbackStatus(current: FightStatus | null, record: FightLogRecord | undefined, impactSequence: number | undefined): FightStatus | null {
	if (!record) return current;
	if (record.sequence !== impactSequence) return record.before ?? current;
	return record.after ?? record.before ?? current;
}

export function useFightPlayback(fight: FightSnapshot): FightPlayback {
	const reducedMotion = useFightReducedMotion();
	const [cursor, setCursor] = usePlaybackCursor(fight);
	const record = fight.visible ? fight.logs.find(entry => entry.sequence > cursor.sequence) : undefined;
	const impact = (): void => {
		if (record) setCursor(previous => ({...previous, impactSequence: record.sequence}));
	};
	const complete = (): void => {
		if (!record) return;
		setCursor(previous => ({fightId: previous.fightId, sequence: record.sequence}));
		if (fight.introduction) fightStore.markPlayed(fight.introduction.fightId, record.sequence);
	};
	return {record, status: playbackStatus(fight.status, record, cursor.impactSequence), logs: fight.logs.filter(entry => entry.sequence <= (record?.sequence ?? cursor.sequence)), impact, complete, reducedMotion, impacted: record?.sequence === cursor.impactSequence};
}