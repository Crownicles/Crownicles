import {ReactNode, useCallback} from "react";
import {BackHandler, Pressable, StyleSheet, View} from "react-native";
import {useFocusEffect} from "expo-router";
import {ChevronDown} from "@/src/design/FightIcons";
import {Hero, Screen} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";

const styles = StyleSheet.create({
	back: {width: 34, height: 34, borderRadius: 17, backgroundColor: Theme.colors.wash, alignItems: "center", justifyContent: "center", marginBottom: Theme.spacing.lg},
	/** The icon set only ships a downward chevron; a quarter turn points it back. */
	chevron: {transform: [{rotate: "90deg"}]},
	pressed: {backgroundColor: Theme.colors.line}
});

export function DetailScreen({title, eyebrow, onClose, children}: {title: string; eyebrow: string; onClose: () => void; children: ReactNode}): ReactNode {
	useFocusEffect(useCallback(() => {
		const listener = BackHandler.addEventListener("hardwareBackPress", () => {
			onClose();
			return true;
		});
		return (): void => listener.remove();
	}, [onClose]));
	return <Screen>
		<Pressable accessibilityRole="button" accessibilityLabel={i18n.t("app:common.back")} onPress={onClose} style={({pressed}) => [styles.back, pressed && styles.pressed]}>
			<View style={styles.chevron}><ChevronDown size={18} color={Theme.colors.ink} /></View>
		</Pressable>
		<Hero eyebrow={eyebrow} title={title} />
		{children}
	</Screen>;
}