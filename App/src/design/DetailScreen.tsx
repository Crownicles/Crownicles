import {ReactNode, useCallback} from "react";
import {BackHandler} from "react-native";
import {useFocusEffect} from "expo-router";
import {Hero, Screen} from "@/src/design/Primitives";
import {BackButton} from "@/src/design/Sections";
import {i18n} from "@/src/translations/i18n";

export function DetailScreen({title, eyebrow, onClose, children}: {title: string; eyebrow: string; onClose: () => void; children: ReactNode}): ReactNode {
	useFocusEffect(useCallback(() => {
		const listener = BackHandler.addEventListener("hardwareBackPress", () => {
			onClose();
			return true;
		});
		return (): void => listener.remove();
	}, [onClose]));
	return <Screen>
		<BackButton label={i18n.t("app:common.back")} onClose={onClose} />
		<Hero eyebrow={eyebrow} title={title} />
		{children}
	</Screen>;
}