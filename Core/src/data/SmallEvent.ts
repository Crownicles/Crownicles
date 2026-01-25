import { DataControllerString } from "./DataController";
import { Data } from "./Data";
import { readdirSync } from "fs";
import Player from "../core/database/game/models/Player";
import {
	CrowniclesPacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";

export class SmallEvent extends Data<string> {
	public readonly rarity!: number;

	private readonly properties!: { [key: string]: unknown };

	async execute(context: PacketContext, response: CrowniclesPacket[], player: Player): Promise<void> {
		const smallEventFunction = SmallEventDataController.getSmallEventFunction(this.id);
		await smallEventFunction.executeSmallEvent(response, player, context);
	}

	getProperties<T>(): T {
		return <T> this.properties;
	}
}

export type CanBeExecutedLike = (player: Player) => boolean | Promise<boolean>;
export type ExecuteSmallEventLike = (response: CrowniclesPacket[], player: Player, context: PacketContext, testArgs?: string[]) => void | Promise<void>;

export type SmallEventFuncs = {
	canBeExecuted: CanBeExecutedLike;
	executeSmallEvent: ExecuteSmallEventLike;
};

export class SmallEventDataController extends DataControllerString<SmallEvent> {
	static readonly instance: SmallEventDataController = new SmallEventDataController("smallEvents");

	private static smallEventsFunctionsCache: Map<string, SmallEventFuncs> = null;

	public static getSmallEventFunction(id: string): SmallEventFuncs {
		SmallEventDataController.initCache();

		return SmallEventDataController.smallEventsFunctionsCache.get(id);
	}

	private static initCache(): void {
		if (!SmallEventDataController.smallEventsFunctionsCache) {
			SmallEventDataController.smallEventsFunctionsCache = new Map<string, SmallEventFuncs>();
			SmallEventDataController.loadSmallEventsFromFolder("dist/Core/src/core/smallEvents", "../core/smallEvents");
		}
	}

	private static loadSmallEventsFromFolder(path: string, relativePath: string): void {
		const files = readdirSync(path);
		for (const file of files) {
			if (file.endsWith(".js")) {
				const smallEventFuncs = (<{
					smallEventFuncs: SmallEventFuncs;
				}>require(`${relativePath}/${file.substring(0, file.length - 3)}`)).smallEventFuncs;
				SmallEventDataController.smallEventsFunctionsCache.set(
					file.substring(0, file.length - 3),
					smallEventFuncs
				);
			}
		}
	}

	newInstance(): SmallEvent {
		return new SmallEvent();
	}

	getKeys(): string[] {
		SmallEventDataController.initCache();
		return Array.from(SmallEventDataController.smallEventsFunctionsCache.keys());
	}
}
