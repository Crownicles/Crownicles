import {ReactNode, useState} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, SMALL_EVENT_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {collectorDescription, eventPromptIcon} from "@/src/collectors/CollectorLabels";
import {EventJournal} from "@/src/collectors/EventOutcomeScreen";
import {MerchantOfferActions} from "@/src/collectors/SmallEventShopCollector";
import {Screen} from "@/src/design/Primitives";
import {BackButton} from "@/src/design/Sections";
import {SwipeBack} from "@/src/design/SwipeBack";
import {plainStory} from "@/src/display/Markdown";
import {i18n} from "@/src/translations/i18n";

/** A recipe seller makes a single offer, told the same way as any other travelling merchant. */
export function RecipeShopCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
}): ReactNode {
	const [answered, setAnswered] = useState(false);
	if (collector.data.type !== SMALL_EVENT_DATA_KINDS.RECIPE_SHOP) {
		return null;
	}
	const {recipe} = collector.data.data;
	const recipeName = plainStory(i18n.t("models:cooking.recipeDisplay", recipe));
	const locked = answered || submitting;
	const choose = (index: number): void => {
		if (locked) {
			return;
		}
		setAnswered(true);
		onChoose(index);
	};
	const leave = (): void => choose(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE));

	return (
		<SwipeBack onClose={leave}>
			<Screen>
				<BackButton label={i18n.t("app:collector.refuse")} onClose={leave} />
				<EventJournal emoji={eventPromptIcon(collector.data)} story={collectorDescription(collector.data) ?? ""} />
				<MerchantOfferActions
					item={recipeName}
					locked={locked}
					onBuy={(): void => choose(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.ACCEPT))}
					onLeave={leave}
				/>
			</Screen>
		</SwipeBack>
	);
}
