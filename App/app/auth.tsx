import { useEffect } from "react";
import { useRouter } from "expo-router";
import { maybeCompleteAuthSession } from "expo-web-browser";
import { View } from "react-native";

maybeCompleteAuthSession();

/** Android also hands the sign-in redirect to the router: the screen that started the sign-in lies right below. */
export default function AuthRedirect(): React.ReactElement {
	const router = useRouter();
	useEffect(() => {
		if (router.canGoBack()) {
			router.back();
		}
		else {
			router.replace("/");
		}
	}, [router]);
	return <View />;
}
