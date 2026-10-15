package com.crownicles.keycloak;

import org.keycloak.Config;
import org.keycloak.events.Event;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.EventListenerProviderFactory;
import org.keycloak.events.EventType;
import org.keycloak.events.admin.AdminEvent;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.models.UserModel;

public final class RegistrationConfirmation implements EventListenerProvider, EventListenerProviderFactory {
    private static final String ID = "crownicles-registration-confirmation";
    private static final String PENDING_ATTRIBUTE = "registrationPending";
    private final KeycloakSession session;

    public RegistrationConfirmation() { this.session = null; }
    private RegistrationConfirmation(KeycloakSession session) { this.session = session; }

    public void onEvent(Event event) {
        if (session == null || !confirmsAddress(event)) {
            return;
        }
        var realm = session.realms().getRealm(event.getRealmId());
        if (realm == null) {
            return;
        }
        var user = session.users().getUserById(realm, event.getUserId());
        // Checked first: removing marks the cached user for update, and most sign-ins carry no marker
        if (awaitsConfirmation(user)) {
            user.removeAttribute(PENDING_ATTRIBUTE);
        }
    }

    /** A verified link or a sign-in, made by a user: the events after which the address may have just been confirmed. */
    private static boolean confirmsAddress(Event event) {
        var type = event.getType();
        return event.getUserId() != null && (type == EventType.VERIFY_EMAIL || type == EventType.LOGIN);
    }

    private static boolean awaitsConfirmation(UserModel user) {
        return user != null && user.isEmailVerified() && user.getFirstAttribute(PENDING_ATTRIBUTE) != null;
    }

    public void onEvent(AdminEvent event, boolean includeRepresentation) {}
    public EventListenerProvider create(KeycloakSession session) { return new RegistrationConfirmation(session); }
    public String getId() { return ID; }
    public void init(Config.Scope config) {}
    public void postInit(KeycloakSessionFactory factory) {}
    public void close() {}
}