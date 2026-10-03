import {ReactNode} from "react";
import {act, renderHook} from "@testing-library/react-native";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {GuildCommandRes} from "ws-packets/src/fromServer/guild/GuildRes";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {useGuildOutcome} from "@/src/store/useGuildOutcome";

const NAME_TAKEN = Object.assign(new GuildCommandRes(), {outcome: {type: "creationStatus", status: {foundGuild: false, guildNameIsAvailable: false}}});
const CREATED = Object.assign(new GuildCommandRes(), {outcome: {type: "created", guildName: "Aurore"}});

async function renderOutcome(): Promise<{result: {current: ReturnType<typeof useGuildOutcome>}; receive: (packet: GuildCommandRes, answersRequest: boolean) => Promise<void>}> {
	const registration = jest.spyOn(WebSocketClient.getInstance(), "registerPushedPacketHandler");
	const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
	const wrapper = ({children}: {children: ReactNode}): ReactNode => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
	const {result} = await renderHook(() => useGuildOutcome(), {wrapper});
	const handler = registration.mock.calls.find(([name]) => name === GuildCommandRes.wireName)![1];
	registration.mockRestore();
	return {result, receive: async (packet, answersRequest): Promise<void> => {
		await act(async () => handler(packet, {answersRequest}));
	}};
}

describe("guild outcome sheet", () => {
	it("leaves a refusal to the screen whose request it answers", async () => {
		const {result, receive} = await renderOutcome();
		await receive(NAME_TAKEN, true);
		expect(result.current.outcome).toBeNull();
	});

	it("shows a refusal that arrives on its own, after a confirmation", async () => {
		const {result, receive} = await renderOutcome();
		await receive(NAME_TAKEN, false);
		expect(result.current.outcome).toEqual(NAME_TAKEN.outcome);
	});

	it("still shows a result that answers a request", async () => {
		const {result, receive} = await renderOutcome();
		await receive(CREATED, true);
		expect(result.current.outcome).toEqual(CREATED.outcome);
	});
});
