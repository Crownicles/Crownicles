import {useEffect, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {TestCommandReq, TestListReq} from "ws-packets/src/fromClient/TestReq";
import {TestCommandInfo, TestCommandRes, TestListRes} from "ws-packets/src/fromServer/test/TestRes";
import {GameClient} from "@/src/networking/GameClient";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {RequestState, useGameQuery} from "@/src/store/useGameQuery";

const MAX_SUGGESTIONS = 6;
const MAX_RESULTS = 30;
let resultCount = 0;

export type TestResult = {id: number; commandName: string; result: string; isError: boolean};

export type TestConsole = {
	list: RequestState<TestListRes>;
	results: TestResult[];
	run: (command: string) => void;
	clear: () => void;
};

export function useTestCommandList(): RequestState<TestListRes> {
	return useGameQuery<TestListRes>(GAME_ENTITIES.TEST_COMMANDS, () => GameClient.request(makeFromClientPacket(TestListReq, {}), TestListRes));
}

/**
 * Sends test commands and collects every result they print.
 *
 * A command may answer several times, or not at all when it only acts, so results are listened to
 * as pushed packets rather than awaited as a single answer.
 */
export function useTestConsole(): TestConsole {
	const list = useTestCommandList();
	const queryClient = useQueryClient();
	const [results, setResults] = useState<TestResult[]>([]);
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<TestCommandRes>(TestCommandRes.wireName, packet => {
		const id = ++resultCount;
		setResults(previous => [{id, commandName: packet.commandName, result: packet.result, isError: packet.isError}, ...previous].slice(0, MAX_RESULTS));
		// A test command can change anything about the player, so every screen reads it again.
		queryClient.invalidateQueries().catch(console.error);
	}), [queryClient]);
	return {
		list,
		results,
		run: (command: string): void => {
			WebSocketClient.getInstance().sendPacket(makeFromClientPacket(TestCommandReq, {command}), {});
		},
		clear: (): void => setResults([])
	};
}

/** The commands whose name or alias starts like the first word typed, which is all the server can tell apart. */
export function testCommandSuggestions(commands: TestCommandInfo[], typed: string): TestCommandInfo[] {
	const word = typed.trimStart().split(" ")[0].toLowerCase();
	if (word.length === 0 || typed.trimStart().includes(" ")) return [];
	return commands
		.filter(command => [command.name, ...command.aliases ?? []].some(name => name.toLowerCase().startsWith(word)))
		.slice(0, MAX_SUGGESTIONS);
}
