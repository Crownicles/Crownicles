<#--
  Mail layout for Crownicles.

  Styles are inline on purpose: mail clients strip <style> blocks, so a stylesheet would leave the
  message unstyled exactly where it matters.
-->
<#macro emailLayout>
<html lang="${locale.language}" dir="${(ltr)?then('ltr','rtl')}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${realmName!"Crownicles"}</title>
</head>
<body style="margin:0; padding:0; background-color:#F4F4F5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F4F5;">
        <tr>
            <td align="center" style="padding:32px 16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px; background-color:#FFFFFF; border:1px solid #E6E6E8; border-radius:14px;">
                    <tr>
                        <td style="padding:28px 26px 8px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:25px; font-weight:800; letter-spacing:-0.6px; color:#0B0B0C;">
                            ${realmName!"Crownicles"}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 26px 28px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:14.5px; line-height:22px; color:#0B0B0C;">
                            <#nested>
                        </td>
                    </tr>
                </table>
                <div style="max-width:480px; padding:16px 10px 0; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; line-height:18px; color:#8A8A90; text-align:center;">
                    ${msg("crowniclesFooter")}
                </div>
            </td>
        </tr>
    </table>
</body>
</html>
</#macro>
