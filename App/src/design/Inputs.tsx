import {ReactNode} from "react";
import {Text, TextInput, TextInputProps, View} from "react-native";
import {Theme} from "@/src/design/Theme";
import {createStyles} from "@/src/design/ThemeContext";

type TextFieldProps = Pick<TextInputProps,
	"value" | "onChangeText" | "keyboardType" | "multiline" | "editable" | "onSubmitEditing"
	| "secureTextEntry" | "autoCapitalize" | "autoComplete" | "textContentType" | "returnKeyType"
> & {label: string};
const useStyles = createStyles(colors => ({
	root: {gap: Theme.spacing.sm, marginVertical: Theme.spacing.md},
	label: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.body, color: colors.ink},
	input: {minHeight: 44, minWidth: 0, padding: Theme.spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: Theme.radius, backgroundColor: colors.wash, color: colors.ink, fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.body},
	paragraph: {minHeight: 96, textAlignVertical: "top"}
}));

export function TextField({label, ...props}: TextFieldProps): ReactNode {
	const styles = useStyles();
	return <View style={styles.root}>
		<Text style={styles.label}>{label}</Text>
		<TextInput {...props} accessibilityLabel={label} style={[styles.input, props.multiline && styles.paragraph]} />
	</View>;
}