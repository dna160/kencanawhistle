# Whistleblow — Operations Runbook

## Overview

This runbook documents break-glass procedures, incident response, and operational
procedures for the Whistleblow platform. It is intended for the system administrator
and designated incident response personnel.

---

## 1. Break-Glass Database Access

**Policy:** The PostgreSQL database runs on Railway's private network with no public
proxy enabled. No routine direct database access is permitted — all report contents
are readable only through the authenticated application UI.

### When break-glass access is required

- Forensic investigation of a suspected security breach
- Data recovery after application-layer data corruption
- Migration failure that leaves the DB in an inconsistent state
- Incident response requiring audit log review outside the app

### Procedure

1. **Obtain temporary credentials** via Railway dashboard:
   - Navigate to the PostgreSQL service → Connect → Temporary credentials
   - Set the minimum required access level (read-only unless write is essential)
   - Set a short expiry (1–4 hours)

2. **Log the access before connecting:**
   - Record in the audit log via the API or directly:
     ```sql
     INSERT INTO audit_logs (action, metadata_json, created_at)
     VALUES ('break_glass.db_access',
             '{"actor": "<your-name>", "reason": "<reason>", "access_level": "read-only"}',
             NOW());
     ```

3. **Connect** via the Railway CLI or psql:
   ```bash
   railway connect postgresql
   # or
   psql "$RAILWAY_TEMP_DATABASE_URL"
   ```

4. **Log the disconnection** in the audit log when finished.

5. **Revoke temporary credentials** immediately after use via Railway dashboard.

6. **Report the access** to the Board of Commissioners within 24 hours.

---

## 2. Security Incident Response

### Suspected anonymity breach

1. Immediately take the reporter submission form offline (`MAINTENANCE_MODE=true`)
2. Preserve all access logs (Railway deployment logs, audit_logs table)
3. Notify the Board of Commissioners within 24 hours
4. Engage Indonesian legal counsel (UU PDP breach notification obligations may apply)
5. Conduct forensic review with a non-conflicted external party
6. Issue a full incident report before re-enabling submissions

### Suspected database compromise

1. Revoke all Railway database credentials immediately
2. Rotate `ENCRYPTION_KEY` and `AUTH_SECRET` (requires all reviewers to re-authenticate)
3. Review `audit_logs` for unauthorized access
4. Assess whether field-level encryption protected report contents (check `ENCRYPTION_KEY` was set)
5. Notify UU PDP regulator within 72 hours if personal data was compromised

### Account compromise (reviewer)

1. Disable the account via `/admin` panel or directly:
   ```sql
   UPDATE reviewers SET is_active = false, disabled_at = NOW()
   WHERE email = 'compromised@example.com';
   ```
2. Revoke all active sessions:
   ```sql
   DELETE FROM sessions WHERE reviewer_id = '<id>';
   ```
3. Log the action as `user.disabled` in audit_logs
4. Audit that reviewer's recent case access in audit_logs

---

## 3. Data Retention Purge

The retention purge worker runs automatically. To trigger manually:

```bash
railway run node -e "require('./src/workers/retention-purge').runRetentionPurge().then(console.log)"
```

Review what will be purged before running in production:
```sql
SELECT reference_code, status, closed_at,
       NOW() - closed_at AS age
FROM reports
WHERE status IN ('closed', 'action_taken')
  AND closed_at < NOW() - INTERVAL '<RETENTION_DAYS> days';
```

---

## 4. TOTP Recovery

If a reviewer loses access to their TOTP device:

1. Admin disables the account
2. Creates a new invite
3. Reviewer re-enrolls with a new TOTP device
4. Old sessions are invalidated automatically on account disable

---

## 5. Environment Variable Rotation

| Variable | Rotation impact |
|---|---|
| `AUTH_SECRET` | All sessions invalidated; all reviewers must re-login |
| `ENCRYPTION_KEY` | Existing encrypted data unreadable until re-encrypted; do NOT rotate without a re-encryption migration |
| `DATABASE_URL` | Service restart required |
| SMTP credentials | Restart required |

**Never rotate `ENCRYPTION_KEY` without first running a re-encryption migration.**
Contact the development team before rotating.

---

## 6. UU PDP Data Subject Rights Handling

For **anonymous reporters**: no identity is held; no subject-rights actions apply.

For **named reporters** (who consented):
- The `consented_identity_enc` field in `reports` holds their identity (encrypted)
- To fulfil an access request: decrypt and provide to them via a secure channel
- To fulfil an erasure request: set `consented_identity_enc = NULL` (does not delete the report body)
- Log all data-subject-rights actions in audit_logs

For **subjects of reports** (the accused):
- Content refers to them but is held for legitimate investigative purpose
- Seek legal advice on balancing erasure requests against investigative necessity

---

## 7. Contact

| Role | Contact |
|---|---|
| System administrator | *(set at deployment)* |
| External escalation party | *(configured in `EXTERNAL_ESCALATION_EMAIL`)* |
| Indonesian legal counsel | *(set at deployment)* |
