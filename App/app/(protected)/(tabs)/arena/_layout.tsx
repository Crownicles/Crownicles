import {ReactNode} from "react";
import {Stack} from "expo-router";

/** A real stack, so the sub-pages get the native back gesture instead of a home-made button. */
export default function ArenaLayout(): ReactNode {
	return <Stack screenOptions={{headerShown: false}} />;
}
