import { clientUrl } from './helpers.js';

export const renderEmailLayout = ({
  preheader = '',
  title,
  heading,
  subtitle = '',
  bodyHtml,
  footerNote = '',
}) => {
  const url = clientUrl();
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .fluid { max-width: 100% !important; height: auto !important; }
      .stack { display: block !important; width: 100% !important; }
      .mobile-padding { padding-left: 20px !important; padding-right: 20px !important; }
      .mobile-center { text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; direction: rtl;">
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${preheader}</div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 32px 16px;">

        <!-- Header -->
        <table role="presentation" class="email-container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td align="center" style="padding: 24px 0;">
              <a href="${url}" target="_blank" style="text-decoration: none;">
                <span style="font-family: 'Cairo', Tahoma, Arial, sans-serif; font-size: 28px; font-weight: 700; color: #059669;">سوق+</span>
                <span style="font-family: 'Cairo', Tahoma, Arial, sans-serif; font-size: 14px; color: #64748b; display: block; margin-top: 4px;">MarketPlus</span>
              </a>
            </td>
          </tr>
        </table>

        <!-- Card -->
        <table role="presentation" class="email-container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08); overflow: hidden;">
          <!-- Accent bar -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #059669, #10b981, #34d399); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding: 36px 40px 16px; text-align: right;">
              <h1 style="margin: 0 0 8px; font-family: 'Cairo', Tahoma, Arial, sans-serif; font-size: 24px; font-weight: 700; color: #0f172a; line-height: 1.4;">
                ${heading}
              </h1>
              ${subtitle ? `<p style="margin: 0; font-family: 'Cairo', Tahoma, Arial, sans-serif; font-size: 15px; color: #64748b; line-height: 1.6;">${subtitle}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding: 8px 40px 36px; font-family: 'Cairo', Tahoma, Arial, sans-serif; font-size: 15px; line-height: 1.8; color: #334155; text-align: right;">
              ${bodyHtml}
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" class="email-container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td align="center" style="padding: 28px 20px; font-family: 'Cairo', Tahoma, Arial, sans-serif; font-size: 13px; line-height: 1.7; color: #94a3b8; text-align: center;">
              ${footerNote ? `<p style="margin: 0 0 12px;">${footerNote}</p>` : ''}
              <p style="margin: 0 0 8px;">
                <a href="${url}" style="color: #059669; text-decoration: none; font-weight: 600;">زيارة المتجر</a>
                &nbsp;·&nbsp;
                <a href="${url}/orders" style="color: #059669; text-decoration: none;">طلباتي</a>
                &nbsp;·&nbsp;
                <a href="${url}/offers" style="color: #059669; text-decoration: none;">العروض</a>
              </p>
              <p style="margin: 0;">© ${year} سوق+ MarketPlus — جميع الحقوق محفوظة</p>
              <p style="margin: 8px 0 0; font-size: 11px;">هذه رسالة آلية، يرجى عدم الرد عليها مباشرة.</p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
};
