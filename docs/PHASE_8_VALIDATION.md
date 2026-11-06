# Phase 8 validation — technician profiles, reviews and availability

Story: a provider publishes a clearly self-reported technician profile and working schedule; a customer sees real reviews and available times, reserves one appointment, and can review only after a server-recorded completed handover. Reports enter a private moderation queue; authorized operators can hide/restore reviews with an audit record.

## Verified behavior

- Backend: 65 isolated HTTP/adapter tests passed, including the previous 44 regression cases and 21 Phase 8 cases. Covers profile identity/validation, Bangladesh dates/hours/exceptions, slot contention across services, rollback, cancellation release, stale profile/schedule edits, verified completion, duplicate/self reviews, public rating integrity, provider responses, report deduplication and audited moderation rollback.
- Frontend: 12 tests passed, lint without warnings and production build passed. The existing large-bundle advisory remains.
- **Real MongoDB transaction integration passed** using the official mongo:8.0 image in a disposable local Docker replica set, bound only to 127.0.0.1:27028. Twelve competing synthetic customers requested the same provider/time: exactly one booking committed, eleven received SLOT_UNAVAILABLE. Failed insert and cancellation writes rolled back both booking/calendar state; schedule closure versus booking could not both commit; a real review/report moderation transaction updated the audit, report state and public aggregate together.
- No Atlas database was used for the integration test. The integration suite does not load dotenv or the real server entry; it uses a hardcoded loopback URI, a random gadgetaid_phase8_qa_* database and fake identities. Test container/data were removed after validation. No production migration, review fabrication or appointment write was performed.
- Browser QA used only loopback 5176/5055 with memory data and fake identities. Provider saved business details, unverified certification/experience claims and Monday/Saturday appointment hours. Customer chose Nov 7, 10:00–11:00 Bangladesh time; successful request displayed a reserved appointment. Cancellation succeeded. A separate demo repair already in progress was advanced by the provider through quality check, ready and actual handover; customer eligibility then appeared, a five-star review was published, the public average became 5 with one review, provider replied, and another demo account submitted a private report without removing the rating.
- Public profile remained accessible signed out, with no response/edit controls. Mobile 390 × 844 layout showed no horizontal page overflow and clearly distinguished self-reported claims from completed-booking review verification.

Read-only local runtime checks also passed after restarting the actual backend: `/health` returned200 ready, `/my-technician` returned401 without a token, and an existing public listing returned200 unconfigured request-mode availability in Asia/Dhaka. These checks did not create or change Atlas records.

## Product and data policy

- One account model remains. Profile editing does not create an admin or verified-technician role. Identity derives from the verified token; claimsVerified is always false and cannot be supplied by clients. Profile names do not silently rewrite existing listing or historical booking snapshots.
- Profile fields: display/business name, photo URL, bio, skills, device categories, service area, self-reported experience and certification claims. Public services and rating totals come from canonical owned listings and eligible published reviews, not client-submitted counts.
- Availability is optional. Unconfigured profiles retain date requests. Configured request mode validates open days; appointment mode reserves fixed one-hour slots starting on whole hours. There is one open/closed window per weekday plus up to 60 date exceptions. Closed exceptions represent holidays. Time zone is always Asia/Dhaka. Configured bookings are limited to 90 days ahead.
- One provider has one calendar across all their services. Pending appointment requests hold the slot; provider rejection/cancellation or eligible customer cancellation releases it atomically. Completed appointments retain their original booking history. Past reservations are pruned from the live calendar on calendar writes. Up to 500 nonexpired reservations are allowed, with an explicit full-calendar error.
- Schedule edits cannot invalidate a nonexpired reservation. Profile/calendar revision comparison rejects stale edits. Appointment date/time/duration and UTC start/end are computed by the server. Availability responses reveal unreserved times, never customer or reservation identities. Booking rows distinguish appointment versus preferred date.
- Existing one-customer/service/date duplication policy remains across all statuses. Cancellation releases capacity for other bookings but does not turn the original booking into an editable/reschedulable record; same-day replacement for the same customer/service needs a separately designed rescheduling policy.
- Only the actual customer of another provider's completed repair can review. Completion requires a trusted workflow and server-recorded provider handover event. Old completed records without that event cannot be retroactively treated as verified; no history is invented. A grandfathered working repair becomes eligible after a real tracked handover. Self reviews are blocked.
- One immutable 1–5 integer rating and 20–2000 character feedback per eligible booking; deterministic IDs enforce uniqueness. Aggregates recheck identity, completion, canonical provider, deterministic review identity and publication state. Public reviews omit customer email/UID/private booking reference. Hidden reviews remain stored and stop contributing to public averages/counts.
- The canonical provider can post one immutable response. Authenticated reports are private and deduplicated per account/review; they never auto-hide a review. No public moderation or admin endpoint is introduced.

## Operator moderation

The report queue and hide/restore operation are server-operator tools, not a new application role. Only personnel already authorized to use the relevant database credentials should run them. Reports may contain private user details; keep output in the trusted operator environment.

From the server directory, set MODERATION_OPERATOR to the accountable operator reference and use:

```powershell
npm run reviews:moderate -- list
```

After inspecting the report/review and approving a decision, explicitly set MODERATION_ALLOW_WRITE=yes for that operation, then:

```powershell
npm run reviews:moderate -- hide <reviewId> <specific reason of at least 10 characters>
npm run reviews:moderate -- restore <reviewId> <specific appeal or restoration reason>
```

Use an authorized DB account; the script does not grant permissions. Each decision appends actor/action/reason/time to immutable moderation history and resolves pending reports in the same transaction. Existing review content/response stays stored. Do not invent an admin role or expose these commands in the browser. Limits: 50 moderation decisions per review before separate operational review is required. This task did not run the operator command against real data.

## Reproducing the local MongoDB test

The integration test requires Docker and a free loopback port 27028. It never reads production environment variables. Run a disposable replica set, then invoke the separate suite:

```powershell
docker run --detach --rm --name gadgetaid-mongo-qa --label gadgetaid.purpose=phase8-qa --publish 127.0.0.1:27028:27017 mongo:8.0 --replSet rs0 --bind_ip_all
docker exec gadgetaid-mongo-qa mongosh --quiet --eval 'rs.initiate()'
# Wait for rs0 to have a writable primary, then from gadget-aid-server:
npm run test:mongo
# After confirming this is the test container:
docker stop gadgetaid-mongo-qa
```

No named volume is attached. The test uses random local database names; stopping the --rm container removes its test data. The official image may remain cached unless removed. Default npm test does not require Docker.

## Runtime and deployment limits

All new bookings now use the MongoDB transaction adapter. Each operation receives the same session; snapshot read concern, majority write concern and bounded commit time are set. Canonical listing writes serialize booking with listing changes; calendar revisions serialize reservations with hours edits. There is no nontransactional reservation fallback. A transaction-capable replica set/Atlas deployment and permissions to create technicians, reviews and reviewReports collections are required before releasing the matched backend/frontend. Actual Atlas multi-process/load tests were not performed; the real transaction evidence is from an isolated local MongoDB server.

No production hosting or schema backfill was deployed. Old appointment-less records retain their original semantics. Current profile/review reconciliation follows the repository's loaded-collection pattern; paginate and index large catalogues/review queues before large-scale rollout. Attachments, variable appointment lengths, overnight/split shifts, customer-wide scheduling conflicts, automatic rescheduling, appeals UI, platform credential verification and Phase 9 admin roles remain outside this phase. Phase 7 email activation still requires the previously documented provider/scheduler configuration.

Transaction implementation was checked against [official MongoDB Node driver transaction guidance](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/).

## Screenshots

- [Technician profile, completed-booking demo review and provider response](screenshots/phase-8-technician-profile.png)
- [Appointment selection](screenshots/phase-8-appointment.png)
- [Mobile self-reported claims and working hours](screenshots/phase-8-profile-mobile.png)
