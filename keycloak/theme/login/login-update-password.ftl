<#import "template.ftl" as layout>
<#import "password-commons.ftl" as passwordCommons>
<#-- Keycloak announces this page with a warning banner; here it is the page's own instruction. -->
<#assign isInstruction = message?has_content && message.type == "warning">
<@layout.registrationLayout displayMessage=!isInstruction && !messagesPerField.existsError('password','password-confirm'); section>
    <#if section = "header">
        ${msg("updatePasswordTitle")}
    <#elseif section = "form">
        <#if isInstruction>
            <p class="instruction">${kcSanitize(message.summary)?no_esc}</p>
        </#if>
        <form id="kc-passwd-update-form" class="${properties.kcFormClass!}" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post">
            <#list ["password-new", "password-confirm"] as field>
                <#assign errorKey = (field == "password-new")?then("password", field)>
                <div class="${properties.kcFormGroupClass!}">
                    <div class="${properties.kcLabelWrapperClass!}">
                        <label for="${field}" class="${properties.kcLabelClass!}">${msg((field == "password-new")?then("passwordNew", "passwordConfirm"))}</label>
                    </div>
                    <div class="${properties.kcInputWrapperClass!}">
                        <div class="${properties.kcInputGroup!}" dir="ltr">
                            <input type="password" id="${field}" name="${field}" class="${properties.kcInputClass!}"
                                   <#if field == "password-new">autofocus</#if> autocomplete="new-password"
                                   aria-invalid="<#if messagesPerField.existsError(errorKey)>true</#if>"
                            />
                            <button class="${properties.kcFormPasswordVisibilityButtonClass!}" type="button" aria-label="${msg('showPassword')}"
                                    aria-controls="${field}" data-password-toggle
                                    data-icon-show="${properties.kcFormPasswordVisibilityIconShow!}" data-icon-hide="${properties.kcFormPasswordVisibilityIconHide!}"
                                    data-label-show="${msg('showPassword')}" data-label-hide="${msg('hidePassword')}">
                                <i class="${properties.kcFormPasswordVisibilityIconShow!}" aria-hidden="true"></i>
                            </button>
                        </div>
                        <#if messagesPerField.existsError(errorKey)>
                            <span id="input-error-${errorKey}" class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
                                ${kcSanitize(messagesPerField.get(errorKey))?no_esc}
                            </span>
                        </#if>
                    </div>
                </div>
            </#list>

            <div class="${properties.kcFormGroupClass!}">
                <@passwordCommons.logoutOtherSessions/>

                <div id="kc-form-buttons" class="${properties.kcFormButtonsClass!}">
                    <input name="login" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" type="submit" value="${msg("doSubmit")}" />
                    <#if isAppInitiatedAction??>
                        <button class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" type="submit" name="cancel-aia" value="true">${msg("doCancel")}</button>
                    </#if>
                </div>
            </div>
        </form>
        <script type="module" src="${url.resourcesPath}/js/passwordVisibility.js"></script>
    </#if>
</@layout.registrationLayout>
