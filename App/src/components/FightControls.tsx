import {ReactNode, useState} from "react";
import {Pressable, StyleSheet, Text, View, useWindowDimensions} from "react-native";
import {LucideIcon} from "lucide-react-native";
import {Theme} from "@/src/design/Theme";

const styles = StyleSheet.create({
	root: {position: "relative"},
	button: {width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12},
	pressed: {backgroundColor: Theme.colors.wash},
	tooltip: {position: "absolute", right: 0, top: 44, minWidth: 112, maxWidth: 210, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 6, backgroundColor: Theme.colors.ink, zIndex: 20},
	label: {fontFamily: Theme.fonts.medium, fontSize: 11, lineHeight: 15, color: Theme.colors.paper}
});

export function useCompactFight(): boolean {
	return useWindowDimensions().height < 740;
}

export function FightIconButton({icon: Icon, label, onPress, disabled = false}: {icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean}): ReactNode {
	const [hovered, setHovered] = useState(false);
	return <View style={styles.root}>
		<Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={(): void => {setHovered(false); onPress();}} onHoverIn={(): void => setHovered(true)} onHoverOut={(): void => setHovered(false)} style={({pressed}) => [styles.button, pressed && styles.pressed]}><Icon size={19} color={disabled ? Theme.colors.faint : Theme.colors.muted} strokeWidth={1.8} /></Pressable>
		{hovered ? <View pointerEvents="none" style={styles.tooltip}><Text style={styles.label}>{label}</Text></View> : null}
	</View>;
}