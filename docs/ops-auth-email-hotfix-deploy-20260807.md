# Auth email hotfix production deploy

- Deploys the Cloudflare-safe AWS SES verification sender.
- Applies to Pagero web signup and CallTag signup because both use `/api/auth/email-verification`.
- Requires a live 2xx response with `verification.delivery.status = sent` before closing.
