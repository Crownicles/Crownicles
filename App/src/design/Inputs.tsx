import {ReactNode} from "react";
import {Text, TextInput, TextInputProps, View} from "react-native";
import {Theme} from "@/src/design/Theme";
import {createStyles} from "@/src/design/ThemeContext";
import {HINT_TONES, Lock, LockHint} from "@/src/design/Sections";
import {useRevealOnFocus} from "@/src/design/KeyboardAvoidance";

type TextFieldProps = Pick<TextInputProps,
	"value" | "onChangeText" | "keyboardType" | "multiline" | "editable" | "onSubmitEditing" | "submitBehavior"
	| "secureTextEntry" | "autoCapitalize" | "autoComplete" | "autoCorrect" | "textContentType" | "returnKeyType"
> & {
	label: string;

	/** Why what is typed cannot be sent yet, shown under the field while it lasts. */
	lock?: Lock | null;

	/** Why the server turned down what was sent, shown under the field until the player edits it. */
	refusal?: string | null;
};
const useStyles = createStyles(colors => ({
	root: {gap: Theme.spacing.sm, marginVertical: Theme.spacing.md},
	label: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.body, color: colors.ink},
	input: {minHeight: 44, minWidth: 0, padding: Theme.spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: Theme.radius, backgroundColor: colors.wash, color: colors.ink, fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.body},
	inputRefused: {borderColor: colors.red},
	paragraph: {minHeight: 96, textAlignVertical: "top"}
}));

export function TextField({label, lock, refusal, ...props}: TextFieldProps): ReactNode {
	const styles = useStyles();
	const {inputRef, rootRef, onFocus} = useRevealOnFocus();
	const shown = lock ?? (refusal ? {reason: refusal} : null);
	// An empty field is not wrong yet: its rule stays a quiet hint until something is typed.
	const refused = shown !== null && Boolean(props.value);
	return <View ref={rootRef} style={styles.root}>
		<Text style={styles.label}>{label}</Text>
		<TextInput {...props} ref={inputRef} onFocus={onFocus} accessibilityLabel={label} style={[styles.input, refused && styles.inputRefused, props.multiline && styles.paragraph]} />
		{shown ? <LockHint lock={shown} tone={refused ? HINT_TONES.REFUSAL : HINT_TONES.HINT} /> : null}
	</View>;
}