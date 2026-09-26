"use strict";

document.addEventListener("DOMContentLoaded", () => {
	// Keycloak lowercases usernames: the displayed name keeps what the player typed.
	const registerForm = document.getElementById("kc-register-form");
	const username = document.getElementById("username");
	const gameUsername = document.getElementById("gameUsername");
	if (registerForm && username && gameUsername) {
		registerForm.addEventListener("submit", () => {
			gameUsername.value = username.value.trim();
		});
	}

	// The link is often opened in the mail app: coming back to this page resumes the sign-up.
	const resume = document.getElementById("crownicles-verify-email-continue");
	if (resume) {
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "visible") {
				window.location.replace(resume.href);
			}
		});
	}
});
