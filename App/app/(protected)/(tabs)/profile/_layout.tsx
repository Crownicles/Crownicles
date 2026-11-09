import { ReactNode } from "react";
import { Stack } from "expo-router";

/**
 * A sub-page opened directly (a tapped notification, a link) still has the tab's home under it: back returns
 * there, and the tab does not stay stuck on that sub-page.
 */
// eslint-disable-next-line camelcase -- name imposed by expo-router
export const unstable_settings = { anchor: "index" };

/** A real stack, so the sub-pages get the native back gesture instead of a home-made button. */
export default function ProfileLayout(): ReactNode {
	return <Stack screenOptions={{ headerShown: false }} />;
}
