package com.crownicles.keycloak;

import java.util.List;
import org.keycloak.Config;
import org.keycloak.authentication.Authenticator;
import org.keycloak.authentication.AuthenticatorFactory;
import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.AuthenticationFlowError;
import org.keycloak.models.AuthenticationExecutionModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.provider.ProviderConfigProperty;
import jakarta.ws.rs.core.Response;

public final class AccountTarget implements Authenticator, AuthenticatorFactory {
    private static final String ID = "crownicles-account-target";
    private static final String TARGET_NOTE = "client_request_param_crownicles_account";
    private static final String ACTION_NOTE = "kc_action";

    public void authenticate(AuthenticationFlowContext context) {
        String action = context.getAuthenticationSession().getClientNote(ACTION_NOTE);
        if (action == null) {
            context.success();
            return;
        }
        String target = context.getAuthenticationSession().getClientNote(TARGET_NOTE);
        if (target == null || !target.equals(context.getUser().getId())) {
            context.failureChallenge(AuthenticationFlowError.USER_CONFLICT,
                context.form().setError("crowniclesAccountMismatch").createErrorPage(Response.Status.BAD_REQUEST));
            return;
        }
        context.success();
    }
    public void action(AuthenticationFlowContext context) { authenticate(context); }
    public boolean requiresUser() { return true; }
    public boolean configuredFor(KeycloakSession session, RealmModel realm, UserModel user) { return true; }
    public void setRequiredActions(KeycloakSession session, RealmModel realm, UserModel user) {}
    public Authenticator create(KeycloakSession session) { return this; }
    public String getId() { return ID; }
    public String getDisplayType() { return "Crownicles account target"; }
    public String getReferenceCategory() { return ID; }
    public String getHelpText() { return "Checks the intended account before application-initiated actions."; }
    public boolean isConfigurable() { return false; }
    public boolean isUserSetupAllowed() { return false; }
    public AuthenticationExecutionModel.Requirement[] getRequirementChoices() { return new AuthenticationExecutionModel.Requirement[] {AuthenticationExecutionModel.Requirement.REQUIRED, AuthenticationExecutionModel.Requirement.DISABLED}; }
    public List<ProviderConfigProperty> getConfigProperties() { return List.of(); }
    public void init(Config.Scope config) {}
    public void postInit(KeycloakSessionFactory factory) {}
    public void close() {}
}