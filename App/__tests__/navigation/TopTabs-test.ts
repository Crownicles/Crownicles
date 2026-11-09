import { TopTabs } from "expo-router/js-top-tabs";

describe("tab navigator", () => {
	// Expo Router throws while importing its top tabs when react-native-tab-view is missing: nothing in the app imports it directly.
	it("loads with the dependencies the app declares", () => {
		expect(TopTabs.Screen).toBeDefined();
	});
});
