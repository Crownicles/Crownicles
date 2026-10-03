import {render, screen} from "@testing-library/react-native";
import {ConnectionStatus} from "@/src/components/ConnectionStatus";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";

describe("ConnectionStatus", () => {
	it("renders nothing while connected and shows the alert only until recovery", async () => {
		const {rerender, toJSON} = await render(<ConnectionStatus state={AuthStateEnum.LOGGED_IN} topInset={59} />);
		expect(toJSON()).toBeNull();
		for (const state of [AuthStateEnum.RECONNECTING_NO_PACKET_QUEUE, AuthStateEnum.RECONNECTING_PACKET_QUEUE]) {
			await rerender(<ConnectionStatus state={state} topInset={59} />);
			expect(screen.getByText("Hors ligne · reconnexion en cours")).toBeTruthy();
			expect(screen.getByText("Hors ligne · reconnexion en cours").props.accessibilityLiveRegion).toBe("polite");
		}
		await rerender(<ConnectionStatus state={AuthStateEnum.LOGGED_IN} topInset={0} />);
		expect(toJSON()).toBeNull();
		expect(screen.queryByText("Hors ligne · reconnexion en cours")).toBeNull();
	});
});