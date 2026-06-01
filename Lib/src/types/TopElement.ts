export type TopElementScoreFirstType = {
	effectId?: string; mapType?: string; afk: boolean;
};

export type TopElementScore = TopElement<TopElementScoreFirstType, number, number>;
export type TopElementGlory = TopElement<number, number, number>;
export type TopElementGuild = TopElement<number, number, undefined>;

export interface TopElement<T, U, V> {
	rank: number;

	sameContext: boolean;

	text: string;

	attributes: {
		1: T;
		2: U;
		3: V;
	};
}
