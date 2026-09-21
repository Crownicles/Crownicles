import {ReactNode} from "react";
import {StyleSheet, Text, TextInput, TextInputProps, View} from "react-native";
import {Theme} from "@/src/design/Theme";

type TextFieldProps = Pick<TextInputProps, "value" | "onChangeText" | "keyboardType" | "multiline" | "editable" | "onSubmitEditing"> & {label: string};
const styles = StyleSheet.create({
	root: {gap: Theme.spacing.sm, marginVertical: Theme.spacing.md},
	label: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.body, color: Theme.colors.ink},
	input: {minHeight: 44, minWidth: 0, padding: Theme.spacing.md, borderWidth: 1, borderColor: Theme.colors.line, borderRadius: Theme.radius, backgroundColor: Theme.colors.wash, color: Theme.colors.ink, fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.body},
	paragraph: {minHeight: 96, textAlignVertical: "top"}
});

export function TextField({label, ...props}: TextFieldProps): ReactNode {
	return <View style={styles.root}>
		<Text style={styles.label}>{label}</Text>
		<TextInput {...props} accessibilityLabel={label} style={[styles.input, props.multiline && styles.paragraph]} />
	</View>;
}