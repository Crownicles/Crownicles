"use strict";

const VERIFY_EMAIL_POLL_MS = 4000;
const SIGN_IN_LINK_POLL_MS = 2500;

/** The sign-in link is opened on any device: this page asks Keycloak until it was, then carries on. */
function watchSignInLink() {
	const status = document.getElementById("crownicles-link-status");
	const expired = document.getElementById("crownicles-link-expired");
	const opened = document.getElementById("crownicles-link-opened");
	const carryOn = document.getElementById("crownicles-link-continue");
	if (!status || !expired || !opened || !carryOn || !status.dataset.polling) {
		return;
	}
	const showExpired = () => {
		status.hidden = true;
		expired.hidden = false;
	};
	const showOpened = () => {
		status.hidden = true;
		opened.hidden = false;
		carryOn.hidden = false;
		// Chrome only lets a tap reopen the app: going on by itself there would end on a prompt that soon vanishes.
		if (!/Android/iu.test(navigator.userAgent)) {
			window.location.replace(carryOn.href);
		}
	};
	const ask = async () => {
		try {
			const response = await fetch(status.dataset.polling, {
				cache: "no-store", credentials: "same-origin"
			});
			if (response.status === 401 || response.status === 404) {
				showExpired();
				return;
			}
			if (response.ok) {
				const { state } = await response.json();
				if (state === "confirmed") {
					showOpened();
					return;
				}
				if (state === "expired") {
					showExpired();
					return;
				}
			}
		}
		catch {
			// Offline for a moment: the next round asks again.
		}
		setTimeout(ask, SIGN_IN_LINK_POLL_MS);
	};
	ask();
}

document.addEventListener("DOMContentLoaded", watchSignInLink);

document.addEventListener("DOMContentLoaded", () => {
	// The link is opened from the mail app: this page notices the confirmation by itself.
	const resume = document.getElementById("crownicles-verify-email-continue");
	const status = document.getElementById("crownicles-verify-email-status");
	const notYet = document.getElementById("crownicles-verify-email-not-yet");
	if (!resume || !status || !notYet) {
		return;
	}
	let checking = false;
	let poll = null;

	/** Whether the flow moved on, which this page then follows. */
	const moveOnIfConfirmed = async () => {
		if (checking) {
			return true;
		}
		checking = true;
		try {
			const response = await fetch(resume.href, { credentials: "same-origin" });
			if (!response.ok) {
				// The link finished the flow in another browser: this one signs in again from the start.
				clearInterval(poll);
				window.location.replace(resume.dataset.restart);
				return true;
			}
			const page = await response.text();
			if (page.includes("id=\"crownicles-verify-email-continue\"")) {
				return false;
			}
			// Showing the fetched page keeps its one-time message, which a second request would lose.
			clearInterval(poll);
			history.replaceState(null, "", response.url);
			document.open();
			document.write(page);
			document.close();
			return true;
		}
		catch {
			// The flow ended with the redirection to the app, which fetch cannot follow.
			window.location.replace(resume.href);
			return true;
		}
		finally {
			checking = false;
		}
	};

	const checkWhenVisible = () => {
		if (document.visibilityState === "visible") {
			moveOnIfConfirmed();
		}
	};
	poll = setInterval(checkWhenVisible, VERIFY_EMAIL_POLL_MS);
	document.addEventListener("visibilitychange", checkWhenVisible);
	resume.addEventListener("click", async event => {
		event.preventDefault();
		notYet.hidden = await moveOnIfConfirmed();
	});
});
