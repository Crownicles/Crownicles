import { DataControllerString } from "./DataController";
import { Data } from "./Data";
import { readdirSync } from "fs";
import Player from "../core/database/game/models/Player";
import {
	CrowniclesPacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import { PlayerActiveObjects } from "../core/database/game/models/PlayerActiveObjects";
import { Model } from "sequelize";
import { LockKey } from "../../../Lib/src/locks/withLockedEntities";

export class SmallEvent extends Data<string> {
	public readonly rarity!: number;

	private readonly properties!: { [key: string]: unknown };

	getProperties<T>(): T {
		return <T> this.properties;
	}
}

export type CanBeExecutedLike = (player: Player, playerActiveObjects: PlayerActiveObjects) => boolean | Promise<boolean>;
export type ExecuteSmallEventLike = (response: CrowniclesPacket[], player: Player, context: PacketContext, playerActiveObjects: PlayerActiveObjects, testArgs?: string[]) => void | Promise<void>;

/**
 * Rows a small event mutates besides the player and their missions (e.g. the player's home)
 */
export type AdditionalLockKeysLike = (player: Player) => Promise<LockKey<Model>[]>;

export type SmallEventFuncs = {
	canBeExecuted: CanBeExecutedLike;
	executeSmallEvent: ExecuteSmallEventLike;

	/**
	 * Locked together with the player and their missions before the small event runs, so that the
	 * whole lock set keeps the canonical order
	 */
	getAdditionalLockKeys?: AdditionalLockKeysLike;
};

export class SmallEventDataController extends DataControllerString<SmallEvent> {
	static readonly instance: SmallEventDataController = new SmallEventDataController("smallEvents");

	private static smallEventsFunctionsCache: Map<string, SmallEventFuncs> | null = null;

	public static getSmallEventFunction(id: string): SmallEventFuncs {
		SmallEventDataController.initCache();

		return SmallEventDataController.smallEventsFunctionsCache!.get(id)!;
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
					smallEventFuncs?: SmallEventFuncs;
				}>require(`${relativePath}/${file.substring(0, file.length - 3)}`)).smallEventFuncs;

				// Skip helper files in the folder that are not actual small events (they don't export smallEventFuncs)
				if (!smallEventFuncs) {
					continue;
				}

				SmallEventDataController.smallEventsFunctionsCache!.set(
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
		return Array.from(SmallEventDataController.smallEventsFunctionsCache!.keys());
	}
}
