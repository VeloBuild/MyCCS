---
title: Use SKIP LOCKED for Non-Blocking Queue Processing
impact: MEDIUM-HIGH
impactDescription: 10x throughput for worker queues
tags: skip-locked, queue, workers, concurrency
---

## Use SKIP LOCKED for Non-Blocking Queue Processing

When multiple workers process a queue, SKIP LOCKED allows workers to process different rows without waiting.

**Incorrect (workers block each other):**

```sql
-- Worker 1 and Worker 2 both try to get next job
begin;
select * from jobs where status = 'pending' order by created_at limit 1 for update;
-- Worker 2 waits for Worker 1's lock to release!
```

**Correct (SKIP LOCKED for parallel processing):**

```sql
-- Each worker skips locked rows and gets the next available
begin;
select * from jobs
where status = 'pending'
order by created_at
limit 1
for update skip locked;

-- Worker 1 gets job 1, Worker 2 gets job 2 (no waiting)

update jobs set status = 'processing' where id = $1;
commit;
```

Atomic claim step (pair with a lease/recovery job for abandoned `processing` rows):

```sql
-- Atomic claim-and-update with a visibility lease
update jobs
set status = 'processing',
    worker_id = $1,
    started_at = now(),
    lease_expires_at = now() + interval '5 minutes'
where id = (
  select id from jobs
  where status = 'pending'
     or (status = 'processing' and lease_expires_at < now())
  order by created_at
  limit 1
  for update skip locked
)
returning *;
```

Reference: [SELECT FOR UPDATE SKIP LOCKED](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)
