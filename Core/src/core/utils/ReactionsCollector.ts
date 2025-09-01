import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorEnded,
	ReactionCollectorReaction,
	ReactionCollectorReactPacket
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { BlockingUtils } from "./BlockingUtils";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { PacketUtils } from "./PacketUtils";
import { BlockingReason } from "../../../../Lib/src/constants/BlockingConstants";
import { ReactionCollectorStopPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorStopPacket";
import {
	ReactionCollectorResetTimerPacketReq,
	ReactionCollectorResetTimerPacketRes
} from "../../../../Lib/src/packets/interaction/ReactionCollectorResetTimer";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

export type CollectCallback = (collector: ReactionCollectorInstance, reaction: ReactionCollectorReaction, keycloakId: string, response: CrowniclesPacket[]) => void | Promise<void>;

export type EndCallback = (collector: ReactionCollectorInstance, response: CrowniclesPacket[]) => void | Promise<void>;

type FilterFunction = (collector: ReactionCollectorInstance, keycloakId: string, reactionIndex: number) => boolean | Promise<boolean>;

export type CollectorOptions = {
	time?: number;
	allowedPlayerKeycloakIds?: string[];
	reactionLimit?: number;
	mainPacket?: boolean;
};

type ReactionInfo = {
	keycloakId: string;
	reaction: {
		type: string;
		data: ReactionCollectorReaction;
	};
};

export function createDefaultFilter(allowedPlayerKeycloakIds: string[]): FilterFunction {
	return (collector, keycloakId, reactionIndex) => allowedPlayerKeycloakIds.includes(keycloakId) && collector.isValidReactionIndex(reactionIndex);
}

const collectors: Map<string, ReactionCollectorInstance> = new Map<string, ReactionCollectorInstance>();

export class ReactionCollectorInstance {
	private id: string;

	private model: ReactionCollector;

	private readonly filter: FilterFunction;

	private endTime: number;

	private readonly time: number;

	private readonly collectCallback: CollectCallback;

	private readonly _context: PacketContext;

	private readonly endCallback: EndCallback;

	private readonly reactionLimit: number;

	private reactionsHistory: ReactionInfo[] = [];

	private readonly mainPacket: boolean;

	private endedByTime: boolean;

	private endTimeout: NodeJS.Timeout;

	public constructor(reactionCollector: ReactionCollector, context: PacketContext, collectorOptions: CollectorOptions, endCallback: EndCallback, collectCallback: CollectCallback = null) {
		this.model = reactionCollector;
		this.filter = collectorOptions.allowedPlayerKeycloakIds ? createDefaultFilter(collectorOptions.allowedPlayerKeycloakIds) : (): boolean => true;
		this.time = collectorOptions.time ?? Constants.MESSAGES.COLLECTOR_TIME;
		this.endTime = Date.now() + this.time;
		this.mainPacket = collectorOptions.mainPacket ?? true;
		this.collectCallback = collectCallback;
		this._context = context;
		this.endCallback = endCallback;
		this.reactionLimit = collectorOptions.reactionLimit ?? 1;
	}

	private _hasEnded: boolean;

	get hasEnded(): boolean {
		return this._hasEnded;
	}

	private set hasEnded(value: boolean) {
		this._hasEnded = value;
	}

	get hasEndedByTime(): boolean {
		return this.endedByTime;
	}

	private _creationPacket: ReactionCollectorCreationPacket;

	get creationPacket(): ReactionCollectorCreationPacket {
		return this._creationPacket;
	}

	get context(): PacketContext {
		return this._context;
	}

	public async react(keycloakId: string, index: number, response: CrowniclesPacket[]): Promise<void> {
		if (!this._creationPacket) {
			throw "Reaction collector has not been built yet";
		}

		if (this.hasEnded) {
			CrowniclesLogger.warn("Reaction received after the collector has ended");
			return;
		}

		const reaction = this._creationPacket.reactions[index];
		if (!await this.filter(this, keycloakId, index)) {
			return;
		}
		this.reactionsHistory.push({
			keycloakId,
			reaction
		});
		if (this.collectCallback) {
			await this.collectCallback(this, reaction.data, keycloakId, response);
		}
		if (this.reactionsHistory.length >= this.reactionLimit && this.reactionLimit > 0) {
			await this.end(response);
		}
	}

	private async endByTime(): Promise<void> {
		this.endedByTime = true;
		await this.end();
	}

	public async end(response: CrowniclesPacket[] = null): Promise<void> {
		const isResponseProvided = response !== null;
		if (this.hasEnded) {
			return;
		}
		this.hasEnded = true;
		collectors.delete(this.id);
		if (isResponseProvided) {
			response.push(makePacket(ReactionCollectorStopPacket, {
				id: this.id
			}));
		}
		if (this.endCallback) {
			if (!isResponseProvided) {
				response = [];
			}
			await this.endCallback(this, response);
			if (!isResponseProvided && response.length !== 0) {
				PacketUtils.sendPackets(this._context, response);
			}
		}
	}

	public block(keycloakId: string, reason: BlockingReason): this {
		BlockingUtils.blockPlayerUntil(keycloakId, reason, this.endTime);
		return this;
	}

	public getReactionsHistory(): ReactionInfo[] {
		return this.reactionsHistory;
	}

	public getFirstReaction(): ReactionInfo | null {
		return this.reactionsHistory.length !== 0 ? this.reactionsHistory[0] : null;
	}

	public build(): ReactionCollectorCreationPacket {
		if (this._creationPacket) {
			throw "Reaction collector has already been built";
		}

		// Register
		this.id = RandomUtils.crowniclesRandom.uuid4();
		collectors.set(this.id, this);
		this.endTimeout = setTimeout(this.endByTime.bind(this), this.endTime - Date.now());

		this._creationPacket = makePacket(ReactionCollectorCreationPacket, this.model.creationPacket(this.id, this.endTime, this.mainPacket));
		return this._creationPacket;
	}

	public isValidReactionIndex(index: number): boolean {
		return index >= 0 && index < this._creationPacket.reactions.length;
	}

	public resetTimer(): void {
		this.endTime = Date.now() + this.time;
		clearTimeout(this.endTimeout);
		this.endTimeout = setTimeout(this.endByTime.bind(this), this.endTime - Date.now());
	}
}

export class ReactionCollectorController {
	public static async reactPacket(response: CrowniclesPacket[], packet: ReactionCollectorReactPacket): Promise<void> {
		const collector: ReactionCollectorInstance = collectors.get(packet.id);
		if (!collector || collector.hasEnded) {
			const packet: ReactionCollectorEnded = makePacket(ReactionCollectorEnded, {});
			response.push(packet);
		}
		else {
			await collector.react(packet.keycloakId, packet.reactionIndex, response);
		}
	}

	public static resetTimer(response: CrowniclesPacket[], packet: ReactionCollectorResetTimerPacketReq): void {
		const collector: ReactionCollectorInstance = collectors.get(packet.reactionCollectorId);
		if (collector && !collector.hasEnded) {
			collector.resetTimer();
			response.push(makePacket(ReactionCollectorResetTimerPacketRes, {
				reactionCollectorId: packet.reactionCollectorId,
				endTime: collector.creationPacket.endTime
			}));
		}
	}

	public static getCollectorsOfPlayer(keycloakId: string): ReactionCollectorInstance[] {
		const result: ReactionCollectorInstance[] = [];
		for (const collector of collectors.values()) {
			if (!collector.hasEnded && collector.context.keycloakId === keycloakId) {
				result.push(collector);
			}
		}
		return result;
	}
}
