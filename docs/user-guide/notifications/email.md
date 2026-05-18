# Email

Karvio can send email notifications when test events occur – for example, when a run is completed or a test item fails. Email delivery is configured through a system-wide SMTP server.

---

## Configure SMTP

SMTP configuration is a system-wide setting managed by the administrator.

1. Go to **Settings** → **Integrations** → **SMTP**.
2. Fill in the SMTP server details:

| Field | Description |
|-------|-------------|
| **Host** | SMTP server hostname, e.g., `smtp.example.com` |
| **Port** | SMTP port (commonly `587` for TLS or `465` for SSL) |
| **Username** | SMTP account username |
| **Password** | SMTP account password |
| **From Address** | The email address that notifications are sent from |
| **From Name** | Display name for the sender, e.g., `Karvio Notifications` |
| **TLS / SSL** | Enable if your SMTP server requires encryption |

3. Click **Save**.

---

## Test the SMTP Configuration

After saving:

1. Click **Send Test Email**.
2. Enter a recipient address.
3. Click **Send**.

Check the inbox for the test message. If it does not arrive, verify your SMTP credentials and firewall rules.

