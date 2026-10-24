import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
let journey: string;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
    insert into auth.users values('${a}'),('${b}');`);
  // Embedded PostgreSQL has gen_random_uuid built in; Supabase provides pgcrypto.
  const sql = await readFile(
    new URL(
      "../supabase/migrations/202610100001_foundation.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(sql.replace("create extension if not exists pgcrypto;", ""));
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610110002_knowledge.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
async function asUser(id: string) {
  await db.exec(
    `reset role; set request.jwt.claim.sub='${id}'; set role authenticated;`,
  );
}
const event = {
  event_type: "meal",
  title: "Dosa",
  timezone: "Asia/Kolkata",
  metadata_json: {},
  confidence: 1,
};
describe("actual migration in embedded PostgreSQL", () => {
  it("creates all eleven tables with RLS", async () => {
    const r = await db.query<{ count: number }>(
      "select count(*)::int as count from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname='public' and c.relkind='r' and c.relrowsecurity",
    );
    expect(r.rows[0].count).toBe(11);
  });
  it("creates a journey and enforces one active journey", async () => {
    await asUser(a);
    const first = await db.query<{ value: { id: string } }>(
      "select start_journey('First','Munnar',now(),null) as value",
    );
    journey = first.rows[0].value.id;
    await db.query("select start_journey('Second','Kerala',now(),null)");
    const r = await db.query<{ status: string }>("select status from journeys");
    expect(r.rows.filter((x) => x.status === "active")).toHaveLength(1);
    await db.query("select set_journey_status($1,'active')", [journey]);
  });
  it("denies sensitive saves without consent", async () => {
    await expect(
      db.query("select create_manual_event($1,$2,$3)", [
        crypto.randomUUID(),
        journey,
        event,
      ]),
    ).rejects.toThrow("Unauthorized");
  });
  it("stores signup answers without leaking health data before consent", async () => {
    await asUser(a);
    const created = await db.query<{ value: { storage_saved: boolean } }>(
      "select save_signup_profile($1) as value",
      [
        {
          display_name: "Alex",
          date_of_birth: "1996-04-02",
          sex: "female",
          allergies: ["peanuts"],
          dietary_preference: "vegetarian",
          interests: ["trekking"],
          emergency_contact: {
            name: "Sam",
            phone: "+919876543210",
            relationship: "Sister",
          },
          adult: true,
          storage_consent: false,
          ai_consent: true,
        },
      ],
    );
    expect(created.rows[0].value.storage_saved).toBe(false);
    const profile = await db.query<{ interests: string[] }>(
      "select interests from profiles where id=$1",
      [a],
    );
    expect(profile.rows[0].interests).toEqual(["trekking"]);
    // Declining private storage must leave allergies and the contact unstored.
    expect((await db.query("select * from health_profiles")).rows).toHaveLength(
      0,
    );
    expect(
      (await db.query("select * from emergency_contacts")).rows,
    ).toHaveLength(0);
  });
  it("refuses a self-serve signup below 18", async () => {
    await asUser(a);
    await expect(
      db.query("select save_signup_profile($1)", [
        {
          display_name: "Too young",
          date_of_birth: new Date().toISOString().slice(0, 10),
        },
      ]),
    ).rejects.toThrow("Adults only");
  });
  it("derives the age bucket and stores allergies once consent is granted", async () => {
    await asUser(a);
    const result = await db.query<{ value: { storage_saved: boolean } }>(
      "select save_signup_profile($1) as value",
      [
        {
          display_name: "Alex",
          date_of_birth: "1996-04-02",
          sex: "female",
          allergies: ["peanuts"],
          dietary_preference: "vegetarian",
          interests: ["trekking", "street food"],
          emergency_contact: {
            name: "Sam",
            phone: "+919876543210",
            relationship: "Sister",
          },
          adult: true,
          storage_consent: true,
          ai_consent: true,
        },
      ],
    );
    expect(result.rows[0].value.storage_saved).toBe(true);
    const health = await db.query<{ allergies: string[]; age_range: string }>(
      "select allergies, age_range from health_profiles where user_id=$1",
      [a],
    );
    expect(health.rows[0].allergies).toEqual(["peanuts"]);
    expect(health.rows[0].age_range).toBe("30–44");
    expect(
      (await db.query("select * from emergency_contacts")).rows,
    ).toHaveLength(1);
  });
  it("keeps repeated manual saves idempotent", async () => {
    await db.query("select set_consent('sensitive_storage',true)");
    const key = crypto.randomUUID();
    const first = await db.query<{ value: { id: string } }>(
      "select create_manual_event($1,$2,$3) as value",
      [key, journey, event],
    );
    const second = await db.query<{ value: { id: string } }>(
      "select create_manual_event($1,$2,$3) as value",
      [key, journey, event],
    );
    expect(second.rows[0].value.id).toBe(first.rows[0].value.id);
    const rows = await db.query("select * from journey_events");
    expect(rows.rows).toHaveLength(1);
  });
  it("persists a complete turn once and acknowledges only committed events", async () => {
    const key = crypto.randomUUID();
    const result = {
      reply: "Remembered.",
      events: [],
      actions: [],
      medical_context: {
        contains_health_guidance: false,
        urgency: "none",
        source_ids: [],
      },
    };
    const one = await db.query<{ value: any }>(
      "select persist_chat_turn($1,null,$2,$3,$4,$5) as value",
      [key, journey, "I ate dosa.", result, [event]],
    );
    const two = await db.query<{ value: any }>(
      "select persist_chat_turn($1,null,$2,$3,$4,$5) as value",
      [key, journey, "I ate dosa.", result, [event]],
    );
    expect(one.rows[0].value).toEqual(two.rows[0].value);
    expect(one.rows[0].value.events[0].status).toBe("saved");
    expect((await db.query("select * from messages")).rows).toHaveLength(2);
  });
  it("rolls back messages when an extracted event is invalid", async () => {
    const bad = { ...event, event_type: "diagnosis" };
    await expect(
      db.query("select persist_chat_turn($1,null,$2,$3,$4,$5)", [
        crypto.randomUUID(),
        journey,
        "Bad turn",
        { reply: "Hi", events: [] },
        [bad],
      ]),
    ).rejects.toThrow();
    expect((await db.query("select * from messages")).rows).toHaveLength(2);
  });
  it("edits owned events", async () => {
    await db.query(
      "update journey_events set title='Corrected breakfast' where journey_id=$1",
      [journey],
    );
    expect(
      (
        await db.query<{ title: string }>("select title from journey_events")
      ).rows.every((x) => x.title === "Corrected breakfast"),
    ).toBe(true);
  });
  it("isolates another user across reads, edits and foreign-journey RPCs", async () => {
    await asUser(b);
    for (const table of [
      "journeys",
      "journey_events",
      "messages",
      "conversations",
      "consent_records",
      "request_records",
    ])
      expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
    expect(
      (
        await db.query(
          "update journeys set title='Intrusion' where id=$1 returning id",
          [journey],
        )
      ).rows,
    ).toHaveLength(0);
    await db.query("select set_consent('sensitive_storage',true)");
    await expect(
      db.query("select create_manual_event($1,$2,$3)", [
        crypto.randomUUID(),
        journey,
        event,
      ]),
    ).rejects.toThrow("Unauthorized");
  });
  it("cannot bypass ownership through a direct event insert", async () => {
    await expect(
      db.query(
        "insert into journey_events(user_id,journey_id,event_type,title) values($1,$2,'meal','Foreign')",
        [b, journey],
      ),
    ).rejects.toThrow();
  });
  it("revocation blocks new saves but allows deleting owned data", async () => {
    await asUser(a);
    await db.query("select set_consent('sensitive_storage',false)");
    await expect(
      db.query(
        "update journey_events set title='Blocked' where journey_id=$1",
        [journey],
      ),
    ).rejects.toThrow("row-level security");
    await db.query("delete from journey_events where journey_id=$1", [journey]);
    expect((await db.query("select * from journey_events")).rows).toHaveLength(
      0,
    );
  });
  it("shares rate counters and enforces a configured lower quota", async () => {
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select consume_usage('ai',1) as allowed",
        )
      ).rows[0].allowed,
    ).toBe(true);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select consume_usage('ai',1) as allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
  });
  it("denies anonymous access to private tables and privileged functions", async () => {
    await db.exec("reset role; set request.jwt.claim.sub=''; set role anon;");
    await expect(db.query("select * from journeys")).rejects.toThrow(
      "permission denied",
    );
    await expect(
      db.query("select set_consent('external_ai',true)"),
    ).rejects.toThrow("permission denied");
    expect(
      (await db.query("select * from medical_knowledge")).rows,
    ).toHaveLength(7);
  });
  it("account deletion cascades private records", async () => {
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [a]);
    for (const table of [
      "journeys",
      "messages",
      "conversations",
      "request_records",
      "usage_counters",
    ])
      expect(
        (await db.query(`select * from ${table} where user_id=$1`, [a])).rows,
      ).toHaveLength(0);
  });
});
