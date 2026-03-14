import {TopTiming} from "../../../../Lib/src/types/TopTimings";
import {TopElementGlory, TopElementGuild, TopElementScore} from "../../../../Lib/src/types/TopElement";
import {Players} from "../database/game/models/Player";
import {TravelTime} from "../maps/TravelTime";
import {Guilds} from "../database/game/models/Guild";
import {TopDataType} from "../../../../Lib/src/types/TopDataType";
import {CrowniclesPacket, makePacket} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandTopGuildsEmptyPacket,
	CommandTopInvalidPagePacket,
	CommandTopPacketResGlory,
	CommandTopPacketResGuild,
	CommandTopPacketResScore,
	CommandTopPlayersEmptyPacket
} from "../../../../Lib/src/packets/commands/CommandTopPacket";
import {CrowniclesLogger} from "../../../../Lib/src/logs/CrowniclesLogger";

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
	minRank: number;
	maxRank: number;
	elementsPerPage: number;
	needFight?: number;
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

type AskTopResultInvalidPage = AskTopResultBase & {
	result: TopAskingResult.INVALID_PAGE;
	data: {
		minPage: number; maxPage: number;
	};
};

type AskTopResult<T extends TopKind> = AskTopResultOK<T> | AskTopResultNoElement | AskTopResultInvalidPage;

type TopElementKind<Kind extends TopKind> = Kind extends TopKind.SCORE_ALL_TIME | TopKind.SCORE_WEEKLY
	? TopElementScore
	: Kind extends TopKind.GLORY
		? TopElementGlory
		: Kind extends TopKind.GUILDS
			? TopElementGuild
			: never;

enum TopAskingResult {
	OK,
	NO_ELEMENT,
	INVALID_PAGE
}

export enum TopKind {
	SCORE_ALL_TIME = "score_all_time",
	SCORE_WEEKLY = "score_weekly",
	GLORY = "glory",
	GUILDS = "guilds"
}

const ELEMENTS_PER_PAGE: Record<TopKind, number> = {
	[TopKind.SCORE_ALL_TIME]: 15,
	[TopKind.SCORE_WEEKLY]: 15,
	[TopKind.GLORY]: 15,
	[TopKind.GUILDS]: 15
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

export function getTopPacket<T extends TopKind>(response: CrowniclesPacket[], result: AskTopResult<T>): void {
	const packetKind = result.kind === TopKind.SCORE_ALL_TIME || result.kind === TopKind.SCORE_WEEKLY
		? [CommandTopPacketResScore, CommandTopPlayersEmptyPacket]
		: result.kind === TopKind.GLORY
			? [CommandTopPacketResGlory, CommandTopPlayersEmptyPacket]
			: [CommandTopPacketResGuild, CommandTopGuildsEmptyPacket];
	if (result.result === TopAskingResult.INVALID_PAGE) {
		response.push(makePacket(CommandTopInvalidPagePacket, result.data));
	}
	else if (result.result === TopAskingResult.NO_ELEMENT) {
		response.push(makePacket(packetKind[1], result.data));
	}
	else {
		response.push(makePacket(packetKind[0], result.data));
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

	private _cachedPages: {
		[key in TopKind]: Map<number, TopElementBaseStorage<TopElementKind<key>>[]>
	} = {
		[TopKind.SCORE_ALL_TIME]: new Map(),
		[TopKind.SCORE_WEEKLY]: new Map(),
		[TopKind.GLORY]: new Map(),
		[TopKind.GUILDS]: new Map()
	};

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
			await TopStorage._topUpdateFunctions[kind](now);
			console.log(`Top ${kind} updated, ${TopStorage.getInstance()._tops[kind].totalElements}`);
		}
		this._cachedPositions.forEach(cachedPosition => {
			cachedPosition.clear();
		});
		for (const cachedPage of Object.values(this._cachedPages)) {
			cachedPage.clear();
		}
		this._now = now;
		CrowniclesLogger.info("Tops updated");
	}

	public askTop<T extends TopKind>(kind: T, id: number, page: number, needFight?: number): AskTopResult<T> {
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
		const maxPage = Math.ceil(totalElements / elementsPerPage);
		if (page < 1 || page > maxPage) {
			return {
				result: TopAskingResult.INVALID_PAGE,
				data: {
					minPage: 1,
					maxPage
				},
				kind
			};
		}
		const minRank = (page - 1) * elementsPerPage + 1;
		const maxRank = Math.min(page * elementsPerPage, totalElements);
		let rank = this._cachedPositions.get(kind)!.get(id);
		if (rank === undefined) {
			rank = needFight && needFight > 0 ? -1 : elements.find(element => element.id === id)?.rank ?? -1;
			this._cachedPositions.get(kind)!.set(id, rank);
		}
		const tmpElementPortion = this._cachedPages[kind].get(page);
		let elementPortion: TopElementBaseStorage<TopElementKind<T>>[];
		if (!tmpElementPortion) {
			elementPortion = elements.filter(element => element.rank >= minRank && element.rank <= maxRank);
			this._cachedPages[kind].set(page, elementPortion);
		}
		else {
			elementPortion = tmpElementPortion;
		}
		return {
			result: TopAskingResult.OK,
			now: this._now,
			kind,
			data: {
				totalElements,
				timing,
				minRank,
				maxRank,
				contextRank: rank > 0 ? rank : undefined,
				canBeRanked: kind !== TopKind.GUILDS || id !== -1,
				needFight,
				elements: elementPortion.map(element => ({
					rank: element.rank,
					sameContext: element.id === id,
					text: element.text,
					attributes: element.attributes
				})),
				elementsPerPage
			}
		} as AskTopResult<T>;
	}
}
