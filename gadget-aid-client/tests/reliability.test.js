import test from "node:test";
import assert from "node:assert/strict";
import { createAuthFetch } from "../src/utils/authenticatedRequest.js";
import { bookingToday, bookingDateError } from "../src/utils/bookingValidation.js";
import { bookingStatus, statusCounts } from "../src/utils/workspace.js";
import { readJson } from "../src/utils/readJson.js";

test("private requests attach a token and refresh only once after 401", async()=>{
  const refreshes=[],headers=[];
  const user={uid:"test",getIdToken:async refresh=>{refreshes.push(refresh);return refresh ? "fresh" : "old";}};
  const request=createAuthFetch({getUser:()=>user,fetchImpl:async(url,options)=>{headers.push(options.headers.get("Authorization"));return new Response("{}",{status:headers.length===1 ? 401 : 200});}});
  assert.equal((await request("/bookings",{method:"POST",body:"{}"})).status,200);
  assert.deepEqual(refreshes,[false,true]);assert.deepEqual(headers,["Bearer old","Bearer fresh"]);
});

test("unauthenticated and changed sessions never send private requests",async()=>{
  let sent=0;
  const absent=createAuthFetch({getUser:()=>null,fetchImpl:async()=>{sent++;}});
  await assert.rejects(absent("/bookings"),error=>error.status===401);
  let current={uid:"first",getIdToken:async()=>{current={uid:"second"};return "old-token";}};
  const changed=createAuthFetch({getUser:()=>current,fetchImpl:async()=>{sent++;}});
  await assert.rejects(changed("/bookings"),error=>error.status===401);assert.equal(sent,0);
});

test("failed network mutations and 500 responses are not silently resubmitted",async()=>{
  const user={uid:"test",getIdToken:async()=>"token"};let sent=0;
  const failed=createAuthFetch({getUser:()=>user,fetchImpl:async()=>{sent++;throw new TypeError("internal socket diagnostics");}});
  await assert.rejects(failed("/bookings",{method:"POST"}),error=>error.code==="NETWORK_ERROR" && !error.message.includes("diagnostics"));assert.equal(sent,1);
  sent=0;const serverError=createAuthFetch({getUser:()=>user,fetchImpl:async()=>{sent++;return new Response("{}",{status:500});}});
  assert.equal((await serverError("/bookings",{method:"POST"})).status,500);assert.equal(sent,1);
});

test("aborted requests do not fetch or refresh credentials",async()=>{
  const controller=new AbortController();controller.abort();let touched=false;
  const request=createAuthFetch({getUser:()=>({uid:"test",getIdToken:async()=>{touched=true;}}),fetchImpl:async()=>{touched=true;}});
  await assert.rejects(request("/bookings",{signal:controller.signal}),error=>error.name==="AbortError");assert.equal(touched,false);
});

test("booking dates use Bangladesh time and reject impossible/past dates",()=>{
  const now=new Date("2026-11-05T19:00:00Z");assert.equal(bookingToday(now),"2026-11-06");
  assert.equal(bookingDateError("2026-11-06",now),"");assert.notEqual(bookingDateError("2026-11-05",now),"");assert.notEqual(bookingDateError("2026-02-30",now),"");assert.notEqual(bookingDateError("not-a-date",now),"");
});

test("legacy statuses count correctly without treating unknown values as pending",()=>{
  const bookings=[{serviceStatus:"working"},{status:"pending"},{status:"completed"},{status:"unexpected"}];
  assert.equal(bookingStatus(bookings[0]),"repairing");assert.deepEqual(statusCounts(bookings).map(item=>item.value),[1,1,1]);
});

test("duplicate booking feedback survives the API boundary without raw server details",async()=>{
  await assert.rejects(readJson(new Response(JSON.stringify({code:"DUPLICATE_BOOKING",message:"private internals"}),{status:409})),error=>error.code==="DUPLICATE_BOOKING" && error.message.includes("My bookings") && !error.message.includes("internals"));
});
