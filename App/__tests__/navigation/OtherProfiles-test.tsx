import { ReactElement } from "react";
import {
	Button, View
} from "react-native";
import {
	fireEvent, render, screen
} from "@testing-library/react-native";
import {
	useOpenGuild, useOpenPlayer
} from "@/src/navigation/OtherProfiles";

type StackRoute = {
	key: string; name: string; params: Record<string, unknown>;
};

/** The part of an expo-router stack state the profile links read: the routes in order and the focused one. */
type StackState = {
	type: "stack"; index: number; routes: StackRoute[];
};

const RANKING_PARAMS = {
	page: 4, timing: "week", scrollPosition: 235
};

function rankingStack(): StackState {
	return {
		type: "stack",
		index: 0,
		routes: [
			{
				key: "rankings-0", name: "rankings", params: RANKING_PARAMS
			}
		]
	};
}

let mockState = rankingStack();
let mockRouteKeys = 0;
let mockSegments = [
	"(protected)",
	"(tabs)",
	"arena",
	"[page]"
];

type ProfileHref = {
	pathname: string; params: Record<string, string>;
};

/** Like the stack, a push puts a new screen on top, even for a profile already open further down. */
const mockPush = jest.fn((href: ProfileHref): void => {
	const name = "ref" in href.params ? "player/[ref]" : "guilds/[name]";
	mockRouteKeys++;
	const routes = [
		...mockState.routes,
		{
			key: `${name}-${mockRouteKeys}`, name, params: href.params
		}
	];
	mockState = {
		...mockState, index: routes.length - 1, routes
	};
});

/** Like the stack, a dismissal takes the given number of screens off the top. */
const mockDismiss = jest.fn((count: number): void => {
	const routes = mockState.routes.slice(0, -count);
	mockState = {
		...mockState, index: routes.length - 1, routes
	};
});

jest.mock("expo-router", () => ({
	useSegments: (): string[] => mockSegments,
	useNavigation: (): object => ({ getState: (): typeof mockState => mockState }),
	useRouter: (): object => ({
		push: mockPush, dismiss: mockDismiss
	})
}));

function ProfileLinks(): ReactElement {
	const openPlayer = useOpenPlayer();
	const openGuild = useOpenGuild();
	return <View>
		<Button title="Joueur A" onPress={(): void => openPlayer("player-a")} />
		<Button title="Membre A" onPress={(): void => openPlayer("player-a", "Aurore")} />
		<Button title="Membre B" onPress={(): void => openPlayer("player-b", "Aurore")} />
		<Button title="Guilde Aurore" onPress={(): void => openGuild("Aurore")} />
	</View>;
}

const REPEATED_LOOPS = 10;

describe("other profile navigation history", () => {
	beforeEach((): void => {
		jest.clearAllMocks();
		mockState = rankingStack();
		mockSegments = [
			"(protected)",
			"(tabs)",
			"arena",
			"[page]"
		];
	});

	it("reuses the same player's screen without growing the stack or changing its ranking origin", async (): Promise<void> => {
		await render(<ProfileLinks />);
		const ranking = mockState.routes[0];
		await fireEvent.press(screen.getByText("Joueur A"));
		const player = mockState.routes[1];
		for (let loop = 0; loop < REPEATED_LOOPS; loop++) {
			await fireEvent.press(screen.getByText("Guilde Aurore"));
			await fireEvent.press(screen.getByText("Membre A"));
			expect(mockState.routes).toEqual([ranking, player]);
		}
		expect(mockDismiss).toHaveBeenCalledTimes(REPEATED_LOOPS);
		expect(mockState.routes[0]).toBe(ranking);
		expect(mockState.routes[0].params).toEqual(RANKING_PARAMS);
		expect(mockState.routes[1].params).toEqual({ ref: "player-a" });
	});

	it("keeps a different player as a new screen with a normal return to the guild", async (): Promise<void> => {
		await render(<ProfileLinks />);
		await fireEvent.press(screen.getByText("Joueur A"));
		await fireEvent.press(screen.getByText("Guilde Aurore"));
		const guild = mockState.routes[2];
		await fireEvent.press(screen.getByText("Membre B"));
		expect(mockState.routes).toHaveLength(4);
		expect(mockState.routes[3].params).toEqual({
			ref: "player-b", fromGuild: "Aurore"
		});
		expect(mockDismiss).not.toHaveBeenCalled();
		mockDismiss(1);
		expect(mockState.routes.at(-1)).toBe(guild);
	});

	it("removes old duplicate loops by returning to the first copy of the player", async (): Promise<void> => {
		await render(<ProfileLinks />);
		await fireEvent.press(screen.getByText("Joueur A"));
		const origin = [...mockState.routes];
		mockPush({
			pathname: "/arena/guilds/[name]", params: { name: "Aurore" }
		});
		mockPush({
			pathname: "/arena/player/[ref]",
			params: {
				ref: "player-a", fromGuild: "Aurore"
			}
		});
		mockPush({
			pathname: "/arena/guilds/[name]", params: { name: "Aurore" }
		});
		await fireEvent.press(screen.getByText("Membre A"));
		expect(mockState.routes).toEqual(origin);
		expect(mockDismiss).toHaveBeenLastCalledWith(3);
	});

	it("also returns to an existing guild and leaves an already open profile alone", async (): Promise<void> => {
		await render(<ProfileLinks />);
		await fireEvent.press(screen.getByText("Joueur A"));
		await fireEvent.press(screen.getByText("Guilde Aurore"));
		const guild = mockState.routes[2];
		await fireEvent.press(screen.getByText("Membre B"));
		await fireEvent.press(screen.getByText("Guilde Aurore"));
		expect(mockState.routes).toHaveLength(3);
		expect(mockState.routes.at(-1)).toBe(guild);
		const pushCount = mockPush.mock.calls.length;
		const dismissCount = mockDismiss.mock.calls.length;
		await fireEvent.press(screen.getByText("Guilde Aurore"));
		expect(mockPush).toHaveBeenCalledTimes(pushCount);
		expect(mockDismiss).toHaveBeenCalledTimes(dismissCount);
	});

	it.each([
		"profile",
		"arena",
		"guild",
		undefined
	])("opens new profiles in their originating stack (%s)", async (tab): Promise<void> => {
		mockSegments = tab
			? [
				"(protected)",
				"(tabs)",
				tab
			]
			: [
				"(protected)",
				"player",
				"[ref]"
			];
		await render(<ProfileLinks />);
		await fireEvent.press(screen.getByText("Joueur A"));
		expect(mockPush).toHaveBeenLastCalledWith({
			pathname: tab ? `/${tab}/player/[ref]` : "/player/[ref]", params: { ref: "player-a" }
		});
		await fireEvent.press(screen.getByText("Guilde Aurore"));
		expect(mockPush).toHaveBeenLastCalledWith({
			pathname: tab ? `/${tab}/guilds/[name]` : "/guilds/[name]", params: { name: "Aurore" }
		});
	});
});
