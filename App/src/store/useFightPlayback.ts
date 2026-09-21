import {Dispatch, SetStateAction, useEffect, useEffectEvent, useState} from "react";
import {FightStatus} from "ws-packets/src/objects/Fight";
import {FightLogRecord, FightSnapshot, fightStore} from "@/src/store/FightStore";
import {useReducedMotion} from "@/src/store/useReducedMotion";
import {FIGHT_SPEEDS, FightSpeed} from "@/src/display/FightMotion";
import {fightNarrative, fightConsequences} from "@/src/display/Fight";

type PlaybackCursor = {fightId: string | undefined; sequence: number; impactSequence?: number; finishedSequence?: number; readSequence?: number};
type PlaybackControls = {speed: FightSpeed; paused: boolean};
export type FightPlayback = {record: FightLogRecord | undefined; status: FightStatus | null; logs: FightLogRecord[]; impact: () => void; complete: () => void; finishMotion: () => void; reducedMotion: boolean};
type CursorState = [PlaybackCursor, Dispatch<SetStateAction<PlaybackCursor>>];
const READING_TIME = {MINIMUM_MS: 2200, MAXIMUM_MS: 6500, MS_PER_CHARACTER: 26, FAST_DIVISOR: 2};

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

function readingDuration(record: FightLogRecord | undefined, speed: FightSpeed): number {
	if (!record) return 0;
	const length = fightNarrative(record.entry).length + fightConsequences(record.entry).map(effect => effect.text).join("").length;
	const duration = Math.max(READING_TIME.MINIMUM_MS, Math.min(READING_TIME.MAXIMUM_MS, length * READING_TIME.MS_PER_CHARACTER));
	return speed === FIGHT_SPEEDS.FAST ? duration / READING_TIME.FAST_DIVISOR : duration;
}

function useReadingTime(record: FightLogRecord | undefined, controls: PlaybackControls, onRead: () => void): void {
	const finish = useEffectEvent((sequence: number | undefined): void => {
		if (sequence === record?.sequence) onRead();
	});
	const duration = readingDuration(record, controls.speed);
	const sequence = record?.sequence;
	useEffect(() => {
		if (sequence === undefined || controls.paused) return undefined;
		const timer = setTimeout(() => finish(sequence), duration);
		return (): void => clearTimeout(timer);
	}, [controls.paused, sequence, duration]);
}

export function useFightPlayback(fight: FightSnapshot, controls: PlaybackControls = {speed: FIGHT_SPEEDS.NORMAL, paused: false}): FightPlayback {
	const reducedMotion = useReducedMotion();
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
	const finishMotion = (): void => {
		if (!record) return;
		if (cursor.readSequence === record.sequence) {
			complete();
			return;
		}
		setCursor(previous => ({...previous, impactSequence: record.sequence, finishedSequence: record.sequence}));
	};
	// The outcome is readable as soon as the action appears, so reading runs alongside the animation
	// instead of after it: whichever of the two ends last moves on to the next action.
	const markRead = (): void => {
		if (!record) return;
		if (cursor.finishedSequence === record.sequence) {
			complete();
			return;
		}
		setCursor(previous => ({...previous, readSequence: record.sequence}));
	};
	useReadingTime(record, controls, markRead);
	return {record, status: playbackStatus(fight.status, record, cursor.impactSequence), logs: fight.logs.filter(entry => entry.sequence <= (record?.sequence ?? cursor.sequence)), impact, complete, finishMotion, reducedMotion};
}