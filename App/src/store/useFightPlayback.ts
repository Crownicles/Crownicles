import {useEffect, useState} from "react";
import {AccessibilityInfo} from "react-native";
import {FightStatus} from "ws-packets/src/objects/Fight";
import {FightLogRecord, FightSnapshot} from "@/src/store/FightStore";

type PlaybackCursor = {fightId: string | undefined; sequence: number; impactSequence?: number};
type FightPlayback = {record: FightLogRecord | undefined; status: FightStatus | null; logs: FightLogRecord[]; impact: () => void; complete: () => void; reducedMotion: boolean};

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

export function useFightPlayback(fight: FightSnapshot): FightPlayback {
	const fightId = fight.introduction?.fightId;
	const reducedMotion = useFightReducedMotion();
	const lastSequence = fight.logs.at(-1)?.sequence ?? 0;
	const [cursor, setCursor] = useState<PlaybackCursor>(() => ({fightId, sequence: lastSequence}));
	if (fightId !== cursor.fightId) setCursor({fightId, sequence: 0});
	if (!fight.visible && cursor.sequence !== lastSequence) setCursor({fightId, sequence: lastSequence});
	const record = fight.visible ? fight.logs.find(entry => entry.sequence > cursor.sequence) : undefined;
	const impact = (): void => {
		if (record) setCursor(previous => ({...previous, impactSequence: record.sequence}));
	};
	const complete = (): void => {
		if (!record) return;
		setCursor({fightId, sequence: record.sequence});
	};
	const status = record?.sequence === cursor.impactSequence ? record?.after ?? record?.before : record?.before;
	return {record, status: status ?? fight.status, logs: fight.logs.filter(entry => entry.sequence <= (record?.sequence ?? cursor.sequence)), impact, complete, reducedMotion};
}