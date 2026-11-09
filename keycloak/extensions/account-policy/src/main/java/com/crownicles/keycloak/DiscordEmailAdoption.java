package com.crownicles.keycloak;

import java.util.List;
import org.keycloak.Config;
import org.keycloak.authentication.Authenticator;
import org.keycloak.authentication.AuthenticatorFactory;
import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.models.AuthenticationExecutionModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.provider.ProviderConfigProperty;

public final class DiscordEmailAdoption implements Authenticator, AuthenticatorFactory {
    private static final String ID = "crownicles-discord-email";
    private static final String EMAIL_ATTRIBUTE = "discordEmail";
    private static final String VERIFIED_ATTRIBUTE = "discordEmailVerified";

    public void authenticate(AuthenticationFlowContext context) {
        UserModel user = context.getUser();
        String email = user.getFirstAttribute(EMAIL_ATTRIBUTE);
        // A taken address stays a collision for the player to settle; writing it would fail the sign-in instead
        boolean adoptable = (user.getEmail() == null || user.getEmail().isBlank())
            && email != null && !email.isBlank()
            && "true".equals(user.getFirstAttribute(VERIFIED_ATTRIBUTE))
            && context.getSession().users().getUserByEmail(context.getRealm(), email) == null;
        if (adoptable) {
            user.setEmail(email);
            user.setEmailVerified(true);
        }
        context.success();
    }
    public void action(AuthenticationFlowContext context) { authenticate(context); }
    public boolean requiresUser() { return true; }
    public boolean configuredFor(KeycloakSession session, RealmModel realm, UserModel user) { return true; }
    public void setRequiredActions(KeycloakSession session, RealmModel realm, UserModel user) {}
    public Authenticator create(KeycloakSession session) { return this; }
    public String getId() { return ID; }
    public String getDisplayType() { return "Crownicles Discord address"; }
    public String getReferenceCategory() { return ID; }
    public String getHelpText() { return "Gives an account without an address the one Discord verified, when no other account holds it."; }
    public boolean isConfigurable() { return false; }
    public boolean isUserSetupAllowed() { return false; }
    public AuthenticationExecutionModel.Requirement[] getRequirementChoices() { return new AuthenticationExecutionModel.Requirement[] {AuthenticationExecutionModel.Requirement.REQUIRED, AuthenticationExecutionModel.Requirement.DISABLED}; }
    public List<ProviderConfigProperty> getConfigProperties() { return List.of(); }
    public void init(Config.Scope config) {}
    public void postInit(KeycloakSessionFactory factory) {}
    public void close() {}
}
