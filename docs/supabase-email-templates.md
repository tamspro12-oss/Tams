# TAMS Pro — Supabase Auth Email Templates

Paste these templates into **Supabase Dashboard → Authentication → Email Templates** so every confirmation and password-reset email shows **TAMS Pro** branding and lands cleanly on `https://tamspro.online`.

---

## 1. Confirm signup

- **Dashboard Location:** `Authentication` → `Email Templates` → **Confirm signup**
- **Subject heading:**
  ```text
  Confirm your TAMS Pro agency account
  ```
- **Message body (HTML):**
  ```html
  <!doctype html>
  <html>
    <body style="margin:0;padding:24px;background-color:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:#0F5E63;padding:24px 28px;color:#ffffff;">
            <div style="font-size:20px;font-weight:700;letter-spacing:0.02em;">TAMS Pro</div>
            <div style="font-size:12px;opacity:0.85;margin-top:4px;">Travel Agency Management System</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <h2 style="margin:0 0 12px 0;font-size:20px;color:#0f172a;">Confirm your email address</h2>
            <p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#475569;">
              Welcome to <strong>TAMS Pro</strong>! Click the button below to verify your email address and activate your travel agency workspace.
            </p>
            <p style="margin:24px 0;">
              <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup"
                 style="display:inline-block;background:#0F5E63;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:10px;">
                Confirm TAMS Pro Account
              </a>
            </p>
            <p style="margin:0 0 8px 0;font-size:12px;line-height:1.6;color:#64748b;">
              If the button above does not open automatically, copy and paste this link into your browser:
            </p>
            <p style="margin:0 0 18px 0;font-size:12px;word-break:break-all;color:#0F5E63;">
              {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup
            </p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
            <p style="margin:0;font-size:12px;color:#64748b;">
              If you did not create a TAMS Pro account, you can safely ignore this email. Need help? Contact <a href="mailto:tamspro12@gmail.com" style="color:#0F5E63;">tamspro12@gmail.com</a>.
            </p>
          </td>
        </tr>
      </table>
    </body>
  </html>
  ```

---

## 2. Reset password

- **Dashboard Location:** `Authentication` → `Email Templates` → **Reset password**
- **Subject heading:**
  ```text
  Reset your TAMS Pro password
  ```
- **Message body (HTML):**
  ```html
  <!doctype html>
  <html>
    <body style="margin:0;padding:24px;background-color:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:#0F5E63;padding:24px 28px;color:#ffffff;">
            <div style="font-size:20px;font-weight:700;letter-spacing:0.02em;">TAMS Pro</div>
            <div style="font-size:12px;opacity:0.85;margin-top:4px;">Travel Agency Management System</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <h2 style="margin:0 0 12px 0;font-size:20px;color:#0f172a;">Reset your password</h2>
            <p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#475569;">
              We received a request to reset the password for your <strong>TAMS Pro</strong> account. Click the button below to choose a new password.
            </p>
            <p style="margin:24px 0;">
              <a href="{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery"
                 style="display:inline-block;background:#0F5E63;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:10px;">
                Set New Password
              </a>
            </p>
            <p style="margin:0 0 8px 0;font-size:12px;line-height:1.6;color:#64748b;">
              If the button above does not open automatically, copy and paste this link into your browser:
            </p>
            <p style="margin:0 0 18px 0;font-size:12px;word-break:break-all;color:#0F5E63;">
              {{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery
            </p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
            <p style="margin:0;font-size:12px;color:#64748b;">
              This link can only be used once. If you did not request a password reset, you can safely ignore this email. Questions? Contact <a href="mailto:tamspro12@gmail.com" style="color:#0F5E63;">tamspro12@gmail.com</a>.
            </p>
          </td>
        </tr>
      </table>
    </body>
  </html>
  ```

