<#import "template.ftl" as layout>
<#import "password-commons.ftl" as passwordCommons>
<#import "user-profile-commons.ftl" as userProfileCommons>
<@layout.registrationLayout displayMessage=messagesPerField.exists('global') displayRequiredFields=false; section>
    <#if section = "header">
        ${msg("updateEmailTitle")}
    <#elseif section = "form">
        <p class="instruction">${msg("crowniclesUpdateEmailInstruction")}</p>
        <form id="kc-update-email-form" class="${properties.kcFormClass!}" action="${url.loginAction}" method="post">
            <@userProfileCommons.userProfileFormFields/>

            <div class="${properties.kcFormGroupClass!}">
                <@passwordCommons.logoutOtherSessions/>

                <div id="kc-form-buttons" class="${properties.kcFormButtonsClass!}">
                    <input class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" type="submit" value="${msg("crowniclesUpdateEmailSubmit")}" />
                    <#if isAppInitiatedAction??>
                        <button class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" type="submit" name="cancel-aia" value="true" formnovalidate>${msg("doCancel")}</button>
                    </#if>
                </div>
            </div>
        </form>
    </#if>
</@layout.registrationLayout>
