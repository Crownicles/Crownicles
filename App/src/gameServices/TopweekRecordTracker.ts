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

	private isCurrent(generation: number): boolean {
		return this.active && generation === this.generation;
	}

	private async recordRanking(generation: number): Promise<void> {
		const answer = await GameClient.request(makeFromClientPacket(TopReq, {dataType: TopDataType.SCORE, timing: TopTiming.WEEK}), TopRes, [TopEmptyRes]);
		if (this.isCurrent(generation) && answer.kind === "answer") await this.record(answer.packet);
	}

	/** A refresh asked while the previous one ran is replayed once it ends */
	private settle(generation: number): void {
		if (generation !== this.generation) return;
		this.inFlight = false;
		if (!this.dirty) return;
		this.dirty = false;
		this.refresh();
	}

	public refresh(): void {
		if (!this.active) return;
		if (this.inFlight) {
			this.dirty = true;
			return;
		}
		const generation = this.generation;
		this.inFlight = true;
		this.recordRanking(generation).catch((error: unknown): void => {
			console.warn("Unable to read the topweek record:", error);
		}).finally((): void => this.settle(generation));
	}
}