import {ReactElement} from "react";
import {fireEvent, render, screen, waitFor, act} from "@testing-library/react-native";
import {AppState, Text, type AppStateStatus} from "react-native";
import {CollectorPrompt} from "@/src/collectors/CollectorPrompt";
import {CollectorsProvider, useCollectors} from "@/src/collectors/CollectorsContext";
import {collectorsStore} from "@/src/collectors/CollectorsStore";
import {GameQueryProvider} from "@/src/store/GameQueryProvider";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";

jest.mock("@/src/collectors/CollectorLabels", () => ({
	collectorDescription: (): undefined => undefined,
	collectorTitle: (): string => "collector title",
	isChoosable: (): boolean => true,
	reactionLabel: (): string => "collector choice"
}));

jest.mock("@/src/translations/i18n", () => ({
	i18n: {
		t: (key: string): string => key
	}
}));

function collector(endTime: number): ReactionCollectorCreation {
	return {
		id: "collector-1",
		endTime,
		data: {
			type: "unknown",
			data: {serverType: "test"}
		},
		reactions: []
	};
}

function CollectorCount(): ReactElement {
	const {open} = useCollectors();
	return <Text>{open.length}</Text>;
}

describe("collector expiration", () => {
	afterEach((): void => {
		jest.useRealTimers();
	});

	it("disables choices when the local countdown reaches zero", async () => {
		jest.useFakeTimers();
		const onChoose = jest.fn();
		const endTime = Date.now() + 1_000;

		await render(
			<CollectorPrompt
				collector={{...collector(endTime), reactions: [{type: "unknown", data: {serverType: "choice"}}]}}
				onChoose={onChoose}
			/>
		);

		await act(async () => {
			await jest.advanceTimersByTimeAsync(1_000);
		});
		await waitFor(() => expect(screen.getByText("app:collector.expired")).toBeTruthy());

		fireEvent.press(screen.getByText("collector choice"));
		expect(onChoose).not.toHaveBeenCalled();
	});

	it("removes a collector that expired while the app was in the background", async () => {
		jest.useFakeTimers();
		const endTime = Date.now() + 1_000;
		const appStateListeners: ((state: AppStateStatus) => void)[] = [];
		const addEventListener = jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
			appStateListeners.push(listener);
			return {remove: jest.fn()};
		});

		try {
			await render(
				<GameQueryProvider>
					<CollectorsProvider>
						<CollectorCount />
					</CollectorsProvider>
				</GameQueryProvider>
			);
			await act(async () => {
				collectorsStore.track(collector(endTime));
			});
			await waitFor(() => expect(screen.getByText("1")).toBeTruthy());

			jest.setSystemTime(endTime + 1);
			await act(async () => {
				for (const listener of appStateListeners) {
					listener("background");
					listener("active");
				}
			});

			await waitFor(() => expect(screen.getByText("0")).toBeTruthy());
		}
		finally {
			addEventListener.mockRestore();
			collectorsStore.removeExpired(Number.MAX_SAFE_INTEGER);
		}
	});
});