import {useCallback, useEffect, useRef, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {GuildJoinReq, GuildRecruitmentListReq, GuildRecruitmentReq} from "ws-packets/src/fromClient/GuildRecruitmentReq";
import {
	GuildJoinErrorRes, GuildJoinRes, GuildRecruitmentErrorRes, GuildRecruitmentListRes, GuildRecruitmentRes
} from "ws-packets/src/fromServer/guild/GuildRecruitmentRes";
import {GUILD_RECRUITMENT_ERRORS, GuildRecruitmentSettings} from "ws-packets/src/objects/GuildRecruitment";
import {GameAnswer, GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {commandRejectionMessage} from "@/src/display/CommandRejection";
import {i18n} from "@/src/translations/i18n";

export type RecruitmentState =
	| {status: "loading"}
	| {status: "noOffice"}
	| {status: "failed"}
	| {status: "ready"; settings: GuildRecruitmentSettings};

type RecruitmentChange = Partial<GuildRecruitmentSettings>;

function answerMessage<Answer extends GuildRecruitmentRes | GuildRecruitmentListRes | GuildJoinRes>(answer: GameAnswer<Answer>): string | null {
	if (answer.kind === "rejected") return commandRejectionMessage(answer.packet.rejection);
	if (answer.kind === "timeout") return i18n.t("app:common.connectionError");
	if (answer.kind === "alternative" && answer.packet instanceof GuildJoinErrorRes) {
		return i18n.t(`commands:guildJoin.errors.${answer.packet.error}`, {minScore: answer.packet.minScore});
	}
	return null;
}

function recruitmentState(answer: GameAnswer<GuildRecruitmentRes>): RecruitmentState {
	if (answer.kind === "answer") return {status: "ready", settings: answer.packet.settings};
	if (answer.kind === "alternative" && answer.packet instanceof GuildRecruitmentErrorRes && answer.packet.error === GUILD_RECRUITMENT_ERRORS.NO_OFFICE) {
		return {status: "noOffice"};
	}
	return {status: "failed"};
}

function requestRecruitment(change: RecruitmentChange): Promise<GameAnswer<GuildRecruitmentRes>> {
	return GameClient.request(makeFromClientPacket<GuildRecruitmentReq>(GuildRecruitmentReq, change), GuildRecruitmentRes, [GuildRecruitmentErrorRes]);
}

/** The guild's recruitment, read once, then changed one setting at a time. */
export function useRecruitmentSettings(): {state: RecruitmentState; pending: boolean; change: (change: RecruitmentChange) => void} {
	const [state, setState] = useState<RecruitmentState>({status: "loading"});
	const [pending, setPending] = useState(false);
	const active = useRef(true);

	useEffect(() => {
		active.current = true;
		requestRecruitment({}).then(answer => {
			if (active.current) setState(recruitmentState(answer));
		}).catch(console.error);
		return (): void => {
			active.current = false;
		};
	}, []);

	const change = (update: RecruitmentChange): void => {
		if (pending) return;
		setPending(true);
		requestRecruitment(update).then(answer => {
			if (active.current) setState(recruitmentState(answer));
		}).catch(console.error).finally(() => {
			if (active.current) setPending(false);
		});
	};
	return {state, pending, change};
}

export type GuildSearch = {
	result: GuildRecruitmentListRes | null;
	pending: boolean;
	message: string | null;
	search: (text: string) => void;
};

/** Suggestions for an empty search, otherwise the recruiting guilds whose name contains it. */
export function useGuildSearch(): GuildSearch {
	const [result, setResult] = useState<GuildRecruitmentListRes | null>(null);
	const [pending, setPending] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const search = useCallback((text: string): void => {
		const trimmed = text.trim();
		setPending(true);
		GameClient.request(makeFromClientPacket(GuildRecruitmentListReq, trimmed ? {search: trimmed} : {}), GuildRecruitmentListRes)
			.then(answer => {
				setMessage(answerMessage(answer));
				if (answer.kind === "answer") setResult(answer.packet);
			})
			.catch(console.error)
			.finally(() => setPending(false));
	}, []);
	return {result, pending, message, search};
}

/** Joins a guild, then refreshes what the player's new membership changes. */
export function useGuildJoin(onJoined: () => void): {pending: boolean; message: string | null; join: (guildId: number) => void} {
	const queryClient = useQueryClient();
	const [pending, setPending] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const join = (guildId: number): void => {
		if (pending) return;
		setPending(true);
		GameClient.request(makeFromClientPacket(GuildJoinReq, {guildId}), GuildJoinRes, [GuildJoinErrorRes])
			.then(async answer => {
				setMessage(answerMessage(answer));
				if (answer.kind !== "answer") return;
				await Promise.all([GAME_ENTITIES.GUILD, GAME_ENTITIES.PROFILE].map(entity => queryClient.invalidateQueries({queryKey: gameKey(entity)})));
				onJoined();
			})
			.catch(console.error)
			.finally(() => setPending(false));
	};
	return {pending, message, join};
}
