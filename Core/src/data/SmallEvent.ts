import { DataControllerString } from "./DataController";
import { Data } from "./Data";
import Player from "../core/database/game/models/Player";
import {
	CrowniclesPacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import { PlayerActiveObjects } from "../core/database/game/models/PlayerActiveObjects";
import { Model } from "sequelize";
import {
	Locked, LockKey
} from "../../../Lib/src/locks/withLockedEntities";
import { importCompiledFolderExports } from "../core/utils/DynamicImportUtils";

export class SmallEvent extends Data<string> {
	public readonly rarity!: number;

	private readonly properties!: { [key: string]: unknown };

	getProperties<T>(): T {
		return <T> this.properties;
	}
}

/**
 * The report a small event is executed in: the packets answered to the player, the context of their command and their
 * active objects, read once for the eligibility of every small event and the execution of the chosen one
 */
export type SmallEventExecutionContext = {
	response: CrowniclesPacket[];
	context: PacketContext;
	playerActiveObjects: PlayerActiveObjects;

	/**
	 * Outcome forced by the test command executing the small event
	 */
	testArgs?: string[];
};

export type CanBeExecutedLike = (player: Player, playerActiveObjects: PlayerActiveObjects) => boolean | Promise<boolean>;

/**
 * The report executes the small event with the player locked together with their missions
 */
export type ExecuteSmallEventLike = (player: Locked<Player>, execution: SmallEventExecutionContext) => void | Promise<void>;

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

type SmallEventModule = {
	smallEventFuncs?: SmallEventFuncs;
};

export class SmallEventDataController extends DataControllerString<SmallEvent> {
	static readonly instance: SmallEventDataController = new SmallEventDataController("smallEvents");

	private static smallEventsFunctionsCache: Map<string, SmallEventFuncs>;

	public static async loadSmallEventsFunctions(): Promise<void> {
		// The helper files of the folder are not small events: they don't export smallEventFuncs
		SmallEventDataController.smallEventsFunctionsCache = await importCompiledFolderExports(
			"core/smallEvents",
			(smallEventModule: SmallEventModule) => smallEventModule.smallEventFuncs
		);
	}

	public static getSmallEventFunction(id: string): SmallEventFuncs | undefined {
		return SmallEventDataController.smallEventsFunctionsCache.get(id);
	}

	newInstance(): SmallEvent {
		return new SmallEvent();
	}

	getKeys(): string[] {
		return Array.from(SmallEventDataController.smallEventsFunctionsCache.keys());
	}
}
