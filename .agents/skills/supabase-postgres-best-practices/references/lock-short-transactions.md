---
title: Keep Transactions Short to Reduce Lock Contention
impact: MEDIUM-HIGH
impactDescription: 3-5x throughput improvement, fewer deadlocks
tags: transactions, locking, contention, performance
---

## Keep Transactions Short to Reduce Lock Contention

Long-running transactions hold locks that block other queries. Keep transactions as short as possible.

**Incorrect (long transaction with external calls):**

```sql
begin;
select * from orders where id = 1 for update;  -- Lock acquired

-- Application makes HTTP call to payment API (2-5 seconds)
-- Other queries on this row are blocked!

update orders set status = 'paid' where id = 1;
commit;  -- Lock held for entire duration
```

**Correct (minimal transaction scope):**

```sql
-- Step 1: Durably claim the pending order in a short transaction so concurrent
-- callers cannot double-charge
begin;
update orders
set status = 'charging', idempotency_key = coalesce(idempotency_key, gen_random_uuid())
where id = $1 and status = 'pending'
returning id, idempotency_key;
commit;  -- Lock released before external HTTP call

-- Step 2: Call external payment API outside any DB transaction using the
-- persisted idempotency_key:
-- response = await paymentAPI.charge({ orderId, idempotencyKey })

-- Step 3: Record payment outcome in a second short transaction
begin;
update orders
set status = 'paid', payment_id = $1
where id = $2 and status = 'charging'
returning *;
commit;  -- Lock held for milliseconds

-- Note: Run a background reconciliation/recovery job for orders stuck in
-- 'charging' (e.g., if the app crashes after charging but before Step 3 commits)
-- by querying paymentAPI with the persisted idempotency_key.
```

Use `statement_timeout` to prevent runaway transactions:

```sql
-- Session-wide timeout: abort queries running longer than 30 seconds
set statement_timeout = '30s';

-- Transaction-local timeout (must be set inside an active transaction)
begin;
set local statement_timeout = '5s';
-- ... queries ...
commit;
```

Reference: [Transaction Management](https://www.postgresql.org/docs/current/tutorial-transactions.html)
