import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {TopReq} from "ws-packets/src/fromClient/RankingsReq";
import {TopEmptyRes, TopRes} from "ws-packets/src/fromServer/fight/RankingsRes";
import {TopDataType, TopTiming} from "ws-packets/src/objects/Rankings";
import {GameClient} from "@/src/networking/GameClient";

type RankingRecorder = (ranking: TopRes) => Promise<void>;

export class TopweekRecordTracker {
	private active = false;
	private generation = 0;
	private inFlight = false;
	private dirty = false;

	public constructor(private readonly record: RankingRecorder) {}

	public start(): void {
		if (this.active) return;
		this.active = true;
		this.generation++;
		this.refresh();
	}

	public stop(): void {
		this.active = false;
		this.generation++;
		this.inFlight = false;
		this.dirty = false;
	}

	public refresh(): void {
		if (!this.active) return;
		if (this.inFlight) {
			this.dirty = true;
			return;
		}
		const generation = this.generation;
		this.inFlight = true;
		GameClient.request(makeFromClientPacket(TopReq, {dataType: TopDataType.SCORE, timing: TopTiming.WEEK}), TopRes, [TopEmptyRes]).then(async answer => {
			if (!this.active || generation !== this.generation || answer.kind !== "answer") return;
			await this.record(answer.packet);
		}).catch((error: unknown): void => {
			console.warn("Unable to read the topweek record:", error);
		}).finally((): void => {
			if (generation !== this.generation) return;
			this.inFlight = false;
			if (!this.dirty) return;
			this.dirty = false;
			this.refresh();
		});
	}
}