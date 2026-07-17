import {
	PveBossFightRecord, PveBossPersonalRecord
} from "../../../../../../Lib/src/types/PveBossRecord";

const compareBossRecords = (left: PveBossFightRecord, right: PveBossFightRecord): number =>
	right.monsterLevel - left.monsterLevel
	|| left.turns - right.turns
	|| left.date - right.date;

export function selectPersonalBossRecords(records: PveBossFightRecord[]): PveBossPersonalRecord[] {
	const bestByMonster = new Map<string, PveBossFightRecord>();
	for (const record of records) {
		const currentBest = bestByMonster.get(record.monsterId);
		if (!currentBest || compareBossRecords(record, currentBest) < 0) {
			bestByMonster.set(record.monsterId, record);
		}
	}
	return [...bestByMonster.values()].map(({
		playerKeycloakId: _, ...record
	}) => record);
}
