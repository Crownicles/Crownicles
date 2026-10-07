import {maybeCompleteAuthSession} from "expo-web-browser";
import {View} from "react-native";

maybeCompleteAuthSession();

export default function AuthRedirect(): React.ReactElement {
	return <View />;
}
