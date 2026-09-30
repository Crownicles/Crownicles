import {ReactNode} from "react";
import {Screen} from "@/src/design/Primitives";
import {BackButton, Standing} from "@/src/design/Sections";
import {SwipeBack} from "@/src/design/SwipeBack";
import {i18n} from "@/src/translations/i18n";

/**
 * The one page of the app, pushed over the screen it opens from: the back button, a heading of the
 * page's choosing (a title, or the journal entry a merchant greets with), then what the page holds.
 */
export function Page({onClose, backLabel, heading, overlay, children}: {
	onClose: () => void;
	backLabel?: string;
	heading?: ReactNode;
	overlay?: boolean;
	children: ReactNode;
}): ReactNode {
	return <SwipeBack onClose={onClose} {...overlay ? {overlay} : {}}>
		<Screen>
			<BackButton label={backLabel ?? i18n.t("app:common.back")} onClose={onClose} />
			{heading}
			{children}
		</Screen>
	</SwipeBack>;
}

export function DetailScreen({title, eyebrow, onClose, overlay, children}: {title: string; eyebrow: string; onClose: () => void; overlay?: boolean; children: ReactNode}): ReactNode {
	return <Page onClose={onClose} heading={<Standing caption={eyebrow} title={title} />} {...overlay ? {overlay} : {}}>{children}</Page>;
}
