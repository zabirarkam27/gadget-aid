# Platform operations

## Roles

Public visitors browse services and technician information. Signed-in customers manage their own records. Approved Technicians manage their own listings, schedules and repairs. Admins handle platform operations and Technician approval. Only Super Admins can grant or revoke Admin access; Super Admin access itself is controlled by a trusted server operator.

Roles are database grants bound to a verified Firebase UID/email. Registration, editable profiles, public demo buttons and client-provided fields cannot grant live privileges. Private requests check revocation. Admins cannot impersonate customers, approve their quotations, fabricate handovers or bypass passport/receipt ownership.

Sensitive operations require recent sign-in, an exact target/revision, a reason, confirmation and atomic audit persistence. Audit failure prevents the operation. Real operator passwords, service credentials and bootstrap flags never belong in the client or repository.

## Super Admin bootstrap and recovery

Verify the intended Firebase project/database and exact enabled, email-verified target UID before running the CLI. It uses normal server credentials and `gadgetAidDB`. From `gadget-aid-server`:

```powershell
$env:SUPER_ADMIN_OPERATOR = '<accountable operator>'
$env:SUPER_ADMIN_CONFIRM_UID = '<exact reviewed Firebase UID>'
$env:SUPER_ADMIN_ALLOW_WRITE = 'yes'
npm run admin:bootstrap -- grant '<exact reviewed Firebase UID>' 'Specific reviewed bootstrap reason'
# Use revoke instead of grant for an authorized recovery/revocation.
Remove-Item Env:SUPER_ADMIN_OPERATOR, Env:SUPER_ADMIN_CONFIRM_UID, Env:SUPER_ADMIN_ALLOW_WRITE
```

The CLI checks the Firebase identity and commits grant/audit together. It does not create an account or choose its password. There is no first-user promotion or browser Super Admin assignment.

After bootstrap, a recently signed-in Super Admin manages Admin access in `/admin`. Technician access starts with an application through `/account-access` and explicit review. Legacy provider records are not automatically approved grants; preserve authorized booking history during onboarding or revocation.

## Local transaction verification

Tests use a disposable replica set at `127.0.0.1:27028`, not Atlas. With Docker available:

```bash
docker run --name gadgetaid-test-mongo -p 127.0.0.1:27028:27017 -d mongo:7.0 --replSet rs0 --bind_ip_all
```

Wait for startup, then initialize:

```bash
docker exec gadgetaid-test-mongo mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
```

Wait until `db.hello().isWritablePrimary` is true. Run `npm run test:mongo` from `gadget-aid-server`; tests create and clean random test databases with synthetic identities. Remove only this test container when finished:

```bash
docker rm -f gadgetaid-test-mongo
```

The public `/demo` is a browser-only sample workspace. Developer QA at ports 5176/5055 has its own memory API and fake identities. Neither grants production access.
