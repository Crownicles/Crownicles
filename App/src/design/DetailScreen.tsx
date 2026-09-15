import {ReactNode, useCallback} from "react";
import {BackHandler} from "react-native";
import {useFocusEffect} from "expo-router";
import {Button, ButtonRow, Hero, Screen} from "@/src/design/Primitives";
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
		<ButtonRow><Button onPress={onClose}>{i18n.t("app:common.back")}</Button></ButtonRow>
		<Hero eyebrow={eyebrow} title={title} />
		{children}
	</Screen>;
}