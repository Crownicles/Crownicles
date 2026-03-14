import { TopTiming } from "../../../../Lib/src/types/TopTimings";
import {
	TopElementGlory, TopElementGuild, TopElementScore
} from "../../../../Lib/src/types/TopElement";
import { Players } from "../database/game/models/Player";
import { TravelTime } from "../maps/TravelTime";
import { Guilds } from "../database/game/models/Guild";
import { TopDataType } from "../../../../Lib/src/types/TopDataType";
import {
	CrowniclesPacket, makePacket, PacketLike
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandTopGuildsEmptyPacket,
	CommandTopPacketResGlory,
	CommandTopPacketResGuild,
	CommandTopPacketResScore,
	CommandTopPlayersEmptyPacket
} from "../../../../Lib/src/packets/commands/CommandTopPacket";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { TopConstants } from "../../../../Lib/src/constants/TopConstants";

export const NO_GUILD_ID = -1;

type TopObject = {
	totalElements: number;
	timing: TopTiming;
};

type TopElementBaseStorage<Element> = Element & { id: number };

type TopObjectStorage<Element> = TopObject & {
	elements: TopElementBaseStorage<Element>[];
};

type TopObjectResponse<Element> = TopObject & {
	elements: Element[];
	contextRank?: number;
	canBeRanked: boolean;
	elementsPerPage: number;
	needFight?: number;
	initialPage?: number;
};

type AskTopResultBase = {
	result: TopAskingResult;
	kind: TopKind;
};

type AskTopResultOKBase<Element, Kind extends TopKind> = AskTopResultBase & {
	result: TopAskingResult.OK;
	data: TopObjectResponse<Element>;
	now: number;
	kind: Kind;
};

type AskTopResultOK<T extends TopKind> = AskTopResultOKBase<TopElementKind<T>, T>;

type AskTopResultNoElement = AskTopResultBase & {
	result: TopAskingResult.NO_ELEMENT;
	data: { needFight?: number };
};

type AskTopResult<T extends TopKind> = AskTopResultOK<T> | AskTopResultNoElement;

type TopElementKind<Kind extends TopKind> = Kind extends TopKind.SCORE_ALL_TIME | TopKind.SCORE_WEEKLY
	? TopElementScore
	: Kind extends TopKind.GLORY
		? TopElementGlory
		: Kind extends TopKind.GUILDS
			? TopElementGuild
			: never;

enum TopAskingResult {
	OK,
	NO_ELEMENT
}

export enum TopKind {
	SCORE_ALL_TIME = "score_all_time",
	SCORE_WEEKLY = "score_weekly",
	GLORY = "glory",
	GUILDS = "guilds"
}

const ELEMENTS_PER_PAGE: Record<TopKind, number> = {
	[TopKind.SCORE_ALL_TIME]: TopConstants.PLAYERS_PER_PAGE,
	[TopKind.SCORE_WEEKLY]: TopConstants.PLAYERS_PER_PAGE,
	[TopKind.GLORY]: TopConstants.PLAYERS_PER_PAGE,
	[TopKind.GUILDS]: TopConstants.GUILDS_PER_PAGE
};

export function getTopKind(dataType: TopDataType, timing: TopTiming): TopKind {
	if (dataType === TopDataType.SCORE) {
		return timing === TopTiming.ALL_TIME ? TopKind.SCORE_ALL_TIME : TopKind.SCORE_WEEKLY;
	}
	else if (dataType === TopDataType.GLORY) {
		return TopKind.GLORY;
	}

	return TopKind.GUILDS;
}

const TOP_PACKET_MAP: Record<TopKind, [PacketLike<CrowniclesPacket>, PacketLike<CrowniclesPacket>]> = {
	[TopKind.SCORE_ALL_TIME]: [CommandTopPacketResScore, CommandTopPlayersEmptyPacket],
	[TopKind.SCORE_WEEKLY]: [CommandTopPacketResScore, CommandTopPlayersEmptyPacket],
	[TopKind.GLORY]: [CommandTopPacketResGlory, CommandTopPlayersEmptyPacket],
	[TopKind.GUILDS]: [CommandTopPacketResGuild, CommandTopGuildsEmptyPacket]
};

export function getTopPacket<T extends TopKind>(response: CrowniclesPacket[], result: AskTopResult<T>): void {
	const [resPacket, emptyPacket] = TOP_PACKET_MAP[result.kind];
	if (result.result === TopAskingResult.NO_ELEMENT) {
		response.push(makePacket(emptyPacket, result.data));
	}
	else {
		response.push(makePacket(resPacket, result.data));
	}
}

function initialiseTopObjectStorage<Kind extends TopKind>(): TopObjectStorage<TopElementKind<Kind>> {
	// These values won't be used, but we need to return something that matches the type
	return {
		totalElements: 0,
		timing: TopTiming.ALL_TIME,
		elements: []
	};
}

export class TopStorage {
	private static _instance: TopStorage;

	private static _topUpdateFunctions: {
		[key in TopKind]: (now: number) => Promise<void>
	} = {
		[TopKind.SCORE_ALL_TIME]: TopStorage.topUpdateFunctionScore(false),
		[TopKind.SCORE_WEEKLY]: TopStorage.topUpdateFunctionScore(true),
		[TopKind.GLORY]: async () => {
			const totalElements = await Players.getNumberOfFightingPlayers();
			const elements = await Players.getPlayersGloryTop(1, totalElements);
			TopStorage.getInstance()._tops[TopKind.GLORY] = {
				totalElements,
				timing: TopTiming.WEEK,
				elements: elements.map((player, index) => ({
					id: player.id,
					rank: index + 1,
					sameContext: false,
					text: player.keycloakId,
					attributes: {
						1: player.getLeague().id,
						2: player.getGloryPoints(),
						3: player.level
					}
				}))
			};
		},
		[TopKind.GUILDS]: async () => {
			const totalElements = await Guilds.getTotalRanked();
			const elements = await Guilds.getRankedGuilds(1, totalElements);
			TopStorage.getInstance()._tops[TopKind.GUILDS] = {
				totalElements,
				timing: TopTiming.ALL_TIME,
				elements: elements.map((guild, index) => ({
					id: guild.id,
					rank: index + 1,
					sameContext: false,
					text: guild.name,
					attributes: {
						1: guild.score,
						2: guild.level,
						3: undefined
					}
				}))
			};
		}
	};

	private _tops: {
		[key in TopKind]: TopObjectStorage<TopElementKind<key>>
	} = {
		[TopKind.SCORE_ALL_TIME]: initialiseTopObjectStorage<TopKind.SCORE_ALL_TIME>(),
		[TopKind.SCORE_WEEKLY]: initialiseTopObjectStorage<TopKind.SCORE_WEEKLY>(),
		[TopKind.GLORY]: initialiseTopObjectStorage<TopKind.GLORY>(),
		[TopKind.GUILDS]: initialiseTopObjectStorage<TopKind.GUILDS>()
	};

	private _cachedPositions: Map<TopKind, Map<number, number>> = new Map([
		[TopKind.SCORE_ALL_TIME, new Map()],
		[TopKind.SCORE_WEEKLY, new Map()],
		[TopKind.GLORY, new Map()],
		[TopKind.GUILDS, new Map()]
	]);

	private _lastUpdated: Map<TopKind, number> = new Map([
		[TopKind.SCORE_ALL_TIME, 0],
		[TopKind.SCORE_WEEKLY, 0],
		[TopKind.GLORY, 0],
		[TopKind.GUILDS, 0]
	]);

	private static readonly STALE_THRESHOLD_MS = 45000;

	private _now: number = Date.now();

	static topUpdateFunctionScore(weekly: boolean): (now: number) => Promise<void> {
		return async (now: number) => {
			const totalElements = await Players.getNumberOfPlayingPlayers(weekly);
			const elements = await Players.getPlayersTop(1, totalElements, weekly);
			TopStorage.getInstance()._tops[weekly ? TopKind.SCORE_WEEKLY : TopKind.SCORE_ALL_TIME] = {
				totalElements,
				timing: weekly ? TopTiming.WEEK : TopTiming.ALL_TIME,
				elements: elements.map((player, index) => ({
					id: player.id,
					rank: index + 1,
					sameContext: false,
					text: player.keycloakId,
					attributes: {
						1: {
							effectId: player.currentEffectFinished(new Date(now)) ? undefined : player.effectId,
							mapType: TravelTime.getTravelDataSimplified(player, new Date(now)).travelEndTime > now ? undefined : player.getDestination()?.type,
							afk: player.isInactive()
						},
						2: weekly ? player.weeklyScore : player.score,
						3: player.level
					}
				}))
			};
		};
	}

	public static getInstance(): TopStorage {
		if (!this._instance) {
			this._instance = new TopStorage();
		}
		return this._instance;
	}

	public async updateTops(): Promise<void> {
		const now = Date.now();
		for (const kind of Object.values(TopKind)) {
			await this.refreshKind(kind, now);
		}
		CrowniclesLogger.info("Tops updated");
	}

	private async refreshKind(kind: TopKind, now: number): Promise<void> {
		await TopStorage._topUpdateFunctions[kind](now);
		this._cachedPositions.get(kind)!.clear();
		this._lastUpdated.set(kind, now);
		this._now = now;
	}

	private async refreshIfStale(kind: TopKind): Promise<void> {
		const lastUpdated = this._lastUpdated.get(kind)!;
		if (Date.now() - lastUpdated > TopStorage.STALE_THRESHOLD_MS) {
			await this.refreshKind(kind, Date.now());
		}
	}

	public async askTop<T extends TopKind>(kind: T, id: number, needFight?: number, initialPage?: number): Promise<AskTopResult<T>> {
		await this.refreshIfStale(kind);
		const top = this._tops[kind] as TopObjectStorage<TopElementKind<T>>;
		if (!top) {
			throw new Error(`Top of kind ${kind} not found`);
		}
		const {
			totalElements,
			timing,
			elements
		} = top;
		const elementsPerPage = ELEMENTS_PER_PAGE[kind];
		if (totalElements === 0) {
			return {
				result: TopAskingResult.NO_ELEMENT,
				data: kind === TopKind.GLORY ? { needFight } : {},
				kind
			};
		}
		let rank = this._cachedPositions.get(kind)!.get(id);
		if (rank === undefined) {
			rank = kind === TopKind.GLORY && needFight! > 0 ? -1 : elements.find(element => element.id === id)?.rank ?? -1;
			this._cachedPositions.get(kind)!.set(id, rank);
		}
		return {
			result: TopAskingResult.OK,
			now: this._now,
			kind,
			data: {
				totalElements,
				timing,
				contextRank: rank > 0 ? rank : undefined,
				canBeRanked: kind !== TopKind.GUILDS || id !== NO_GUILD_ID,
				needFight,
				elements: elements.map(element => ({
					rank: element.rank,
					sameContext: element.id === id,
					text: element.text,
					attributes: element.attributes
				})),
				elementsPerPage,
				initialPage
			}
		} as AskTopResult<T>;
	}
}
