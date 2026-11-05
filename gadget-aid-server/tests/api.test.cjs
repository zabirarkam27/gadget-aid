const test = require("node:test");
const assert = require("node:assert/strict");
const {once} = require("node:events");
const {ObjectId} = require("mongodb");
const {createApp} = require("../app");
const {validateService,todayInDhaka} = require("../domain");
const {createFixture,users,ids,fixedTime,serviceFields,verifyIdToken} = require("./fixtures.cjs");

const setup=async(t,options={})=>{
  const fixture=createFixture(options);
  const app=createApp({getCollections:async()=>fixture.db,verifyIdToken,clock:()=>new Date(fixedTime),...options.app});
  const server=app.listen(0,"127.0.0.1");await once(server,"listening");
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=async(method,path,body,token="customer")=>{
    const response=await fetch(base+path,{method,headers:{...(token ? {Authorization:`Bearer ${token}`} : {}),...(body === undefined ? {} : {"Content-Type":"application/json"})},body:body === undefined ? undefined : JSON.stringify(body)});
    const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
    return {status:response.status,data};
  };
  return {...fixture,request,base};
};
const bookingInput={serviceId:ids.service,date:"2026-11-06",instruction:"Screen does not turn on."};

test("private endpoints reject missing, invalid and incomplete identity tokens",async t=>{
  const {request}=await setup(t);
  for(const [method,path,body] of [["GET","/bookings"],["GET","/all-bookings"],["GET","/my-services"],["POST","/bookings",bookingInput],["POST","/services",serviceFields],["PUT",`/services/${ids.service}`,serviceFields],["DELETE",`/services/${ids.service}`],["PATCH",`/all-bookings/${ids.booking}`,{status:"working"}]])assert.equal((await request(method,path,body,null)).status,401);
  assert.equal((await request("GET","/bookings",undefined,"invalid")).status,401);
  const second=await setup(t,{app:{verifyIdToken:async()=>({email:"without-uid@example.test"})}});
  assert.equal((await second.request("GET","/bookings")).status,401);
});

test("booking derives price, provider, customer and initial status from canonical records",async t=>{
  const {request,db}=await setup(t);
  const result=await request("POST","/bookings",bookingInput);
  assert.equal(result.status,201);assert.equal(result.data.bookingId,result.data.insertedId);
  const record=db.bookings.rows[0];assert.equal(record.price,85);assert.equal(record.providerUid,users.provider.uid);assert.equal(record.userUid,users.customer.uid);assert.equal(record.userEmail,users.customer.email);assert.equal(record.status,"pending");assert.equal(record.serviceName,serviceFields.name);assert.equal(record.createdAt.toISOString(),fixedTime.toISOString());
});

test("tampered authoritative fields and arbitrary fields are rejected",async t=>{
  const {request,db}=await setup(t);
  for(const extra of [{price:1},{providerEmail:users.other.email},{providerName:"Fake Provider"},{serviceName:"Fake service"},{serviceImage:"https://example.test/fake.jpg"},{status:"completed"},{_id:ids.booking},{userUid:"victim"},{unexpected:1}])assert.equal((await request("POST","/bookings",{...bookingInput,...extra})).status,400);
  assert.equal((await request("POST","/bookings",{...bookingInput,userEmail:users.second.email})).status,403);
  assert.equal(db.bookings.rows.length,0);
});

test("matching legacy booking payload remains compatible without trusting its customer name",async t=>{
  const {request,db,service}=await setup(t);
  const result=await request("POST","/bookings",{...bookingInput,serviceName:service.name,serviceImage:service.image,providerEmail:service.providerEmail,providerName:service.providerName,price:"85",status:"pending",userName:"Forged name",userEmail:users.customer.email});
  assert.equal(result.status,201);assert.equal(db.bookings.rows[0].userName,users.customer.name);
});

test("booking rejects malformed IDs, nonexistent services, impossible/past dates and oversized instructions",async t=>{
  const {request}=await setup(t);
  for(const change of [{serviceId:{"$ne":null}},{serviceId:"bad"},{date:"2026-02-30"},{date:"2026-11-04"},{date:""},{date:"2026-11-06T00:00:00Z"},{instruction:"x".repeat(2001)},{instruction:{query:true}}])assert.equal((await request("POST","/bookings",{...bookingInput,...change})).status,400);
  assert.equal((await request("POST","/bookings",{...bookingInput,serviceId:"000000000000000000000000"})).status,404);
});

test("same customer/service/date returns a stable duplicate booking reference",async t=>{
  const {request,db}=await setup(t);
  const first=await request("POST","/bookings",bookingInput),second=await request("POST","/bookings",bookingInput);
  assert.equal(first.status,201);assert.equal(second.status,409);assert.equal(second.data.code,"DUPLICATE_BOOKING");assert.equal(second.data.bookingId,first.data.bookingId);assert.equal(db.bookings.rows.length,1);
  assert.equal((await request("POST","/bookings",bookingInput,"second")).status,201);
  assert.equal((await request("POST","/bookings",{...bookingInput,date:"2026-11-07"})).status,201);
});

test("concurrent duplicate requests cannot insert multiple bookings",async t=>{
  const {request,db}=await setup(t);
  const responses=await Promise.all(Array.from({length:10},()=>request("POST","/bookings",bookingInput)));
  assert.equal(responses.filter(response=>response.status===201).length,1);assert.equal(responses.filter(response=>response.status===409).length,9);assert.equal(db.bookings.rows.length,1);
});

test("legacy booking IDs and serviceStatus are preserved while duplicates are blocked",async t=>{
  const {request,db,booking}=await setup(t);
  const legacy={...booking};delete legacy.userUid;delete legacy.status;legacy.serviceStatus="working";db.bookings.rows.push(legacy);
  const result=await request("POST","/bookings",bookingInput);assert.equal(result.status,409);assert.equal(result.data.bookingId,ids.booking);
  const list=await request("GET","/bookings");assert.equal(list.data[0].status,"working");
});

test("service writes validate fields and derive owner/profile/timestamps",async t=>{
  const {request,db}=await setup(t);
  const result=await request("POST","/services",{...serviceFields,price:0,providerName:"Forged",providerPhoto:"https://example.test/fake.png",createdAt:"1900-01-01"},"provider");
  assert.equal(result.status,201);const row=db.services.rows.at(-1);assert.equal(row.price,0);assert.equal(row.providerUid,users.provider.uid);assert.equal(row.providerName,users.provider.name);assert.equal(row.providerPhoto,null);assert.equal(row.createdAt.toISOString(),fixedTime.toISOString());
  assert.equal((await request("POST","/services",{...serviceFields,providerEmail:users.other.email},"provider")).status,403);
  for(const value of [{...serviceFields,price:-1},{...serviceFields,price:""},{...serviceFields,price:true},{...serviceFields,price:1.001},{...serviceFields,price:"1e999"},{...serviceFields,name:" "},{...serviceFields,description:"tiny"},{...serviceFields,image:"javascript:alert(1)"},{...serviceFields,providerUid:"arbitrary"}])assert.equal((await request("POST","/services",value,"provider")).status,400);
});

test("nonowners cannot update/delete a service and ownership fields cannot be edited",async t=>{
  const {request}=await setup(t);
  assert.equal((await request("PUT",`/services/${ids.service}`,serviceFields,"other")).status,403);
  assert.equal((await request("DELETE",`/services/${ids.service}`,undefined,"other")).status,403);
  assert.equal((await request("PUT",`/services/${ids.service}`,{...serviceFields,providerEmail:users.other.email},"provider")).status,400);
  const result=await request("PUT",`/services/${ids.service}`,serviceFields,"provider");assert.equal(result.status,200);assert.equal(result.data.matchedCount,1);assert.equal(result.data.modifiedCount,0);
});

test("private lists ignore query-string identities and remain customer/provider scoped",async t=>{
  const {request}=await setup(t,{seedBooking:true});
  assert.equal((await request("GET",`/bookings?email=${users.customer.email}`,undefined,"second")).data.length,0);
  assert.equal((await request("GET","/my-services",undefined,"provider")).data.length,1);
  assert.equal((await request("GET","/all-bookings",undefined,"provider")).data.length,1);
  assert.equal((await request("GET","/all-bookings",undefined,"other")).data.length,0);
});

test("a forged legacy providerEmail cannot grant queue or update access",async t=>{
  const {request,db}=await setup(t,{seedBooking:true});db.bookings.rows[0].providerEmail=users.other.email;
  assert.equal((await request("GET","/all-bookings",undefined,"other")).data.length,0);
  assert.equal((await request("PATCH",`/all-bookings/${ids.booking}`,{status:"working"},"other")).status,403);
  assert.equal((await request("PATCH",`/all-bookings/${ids.booking}`,{status:"working"},"provider")).status,200);
  assert.equal(db.bookings.rows[0].status,"working");
});

test("status updates reject arbitrary values and extra fields",async t=>{
  const {request}=await setup(t,{seedBooking:true});
  for(const value of [{status:"approved"},{status:{"$ne":null}},{status:"working",price:0}])assert.equal((await request("PATCH",`/all-bookings/${ids.booking}`,value,"provider")).status,400);
  assert.equal((await request("PATCH",`/all-bookings/${ids.booking}`,{status:"working"},"customer")).status,403);
});

test("removing a listing hides it and blocks new bookings while preserving authorized repair history",async t=>{
  const {request,db}=await setup(t,{seedBooking:true});
  assert.equal((await request("DELETE",`/services/${ids.service}`,undefined,"provider")).data.deletedCount,1);
  assert.equal(db.services.rows.length,2);assert.ok(db.services.rows[0].deletedAt instanceof Date);
  assert.equal((await request("GET",`/services/${ids.service}`)).status,404);
  assert.equal((await request("POST","/bookings",{...bookingInput,date:"2026-11-07"})).status,404);
  assert.equal((await request("GET","/my-services",undefined,"provider")).data.length,0);
  assert.equal((await request("GET","/bookings")).data.length,1);
  assert.equal((await request("GET","/all-bookings",undefined,"provider")).data.length,1);
  assert.equal((await request("PATCH",`/all-bookings/${ids.booking}`,{status:"completed"},"provider")).status,200);
});

test("orphan legacy bookings are withheld from providers when ownership cannot be verified",async t=>{
  const {request,db}=await setup(t,{seedBooking:true});db.bookings.rows[0].serviceId="999999999999999999999999";
  assert.equal((await request("GET","/all-bookings",undefined,"provider")).data.length,0);
  assert.equal((await request("PATCH",`/all-bookings/${ids.booking}`,{status:"working"},"provider")).status,403);
  assert.equal((await request("GET","/bookings")).data.length,1);
});

test("UID ownership prevents an email collision from exposing a modern record",async t=>{
  const {db}=createFixture({seedBooking:true});
  const {request}=await setup(t,{app:{getCollections:async()=>db,verifyIdToken:async()=>({...users.customer,uid:"different-uid"})}});
  assert.equal((await request("GET","/bookings")).data.length,0);
});

test("legacy provider images are normalized on reads without mutating stored records",async t=>{
  const {request,db}=await setup(t);db.services.rows[0].providerImage="https://example.test/legacy.png";
  const result=await request("GET",`/services/${ids.service}`);assert.equal(result.data.providerPhoto,"https://example.test/legacy.png");assert.equal(result.data.providerImage,undefined);assert.equal(db.services.rows[0].providerPhoto,null);
});

test("unready database gives safe 503 while liveness still works",async t=>{
  const {request}=await setup(t,{app:{getCollections:async()=>{throw new Error("private database details");}}});
  assert.equal((await request("GET","/")).status,200);
  for(const path of ["/services","/health"]){const result=await request("GET",path);assert.equal(result.status,503);assert.ok(!JSON.stringify(result.data).includes("private"));}
});

test("malformed/oversized JSON and unexpected errors never expose request or server internals",async t=>{
  const {base,request,db}=await setup(t);
  const malformed=await fetch(base+"/bookings",{method:"POST",headers:{"Content-Type":"application/json"},body:'{"broken":'});assert.equal(malformed.status,400);assert.equal((await malformed.json()).code,"INVALID_JSON");
  const large=await fetch(base+"/bookings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({instruction:"x".repeat(70000)})});assert.equal(large.status,413);
  db.services.find=()=>{throw new Error("private database diagnostics");};
  const result=await request("GET","/services");assert.equal(result.status,500);assert.ok(!JSON.stringify(result.data).includes("private"));
});

test("frontend and backend service validation agree on relevant boundary values",async()=>{
  const {serviceErrors}=await import("../../gadget-aid-client/src/utils/serviceValidation.js");
  for(const input of [serviceFields,{...serviceFields,price:0},{...serviceFields,price:"19.99"},{...serviceFields,price:" "},{...serviceFields,price:true},{...serviceFields,price:-1},{...serviceFields,price:1.001},{...serviceFields,name:"x"},{...serviceFields,area:" "},{...serviceFields,description:"short"},{...serviceFields,image:"file:///secret"}]){
    let valid=true;try{validateService(input);}catch{valid=false;}assert.equal(Object.keys(serviceErrors(input)).length===0,valid);
  }
  assert.equal(todayInDhaka(new Date("2026-11-05T19:00:00Z")),"2026-11-06");
});

test("malformed legacy display fields are normalized without exposing arbitrary objects",async t=>{
  const {request,db}=await setup(t,{seedBooking:true});
  Object.assign(db.bookings.rows[0],{serviceName:{toString:"invalid"},providerName:{},userName:[],date:{},status:{}});
  const result=await request("GET","/bookings");assert.equal(result.status,200);assert.equal(result.data[0].serviceName,"Repair service");assert.equal(result.data[0].providerName,"Service provider");assert.equal(result.data[0].date,"");assert.equal(result.data[0].status,"unknown");
});

test("legacy injected UID fields cannot override the verified email owner",async t=>{
  const {request,db}=await setup(t,{seedBooking:true});
  db.services.rows[0].providerUid=users.other.uid;
  db.bookings.rows[0].userUid=users.second.uid;
  assert.equal((await request("GET","/my-services",undefined,"other")).data.length,1);
  assert.equal((await request("GET","/all-bookings",undefined,"other")).data.length,0);
  assert.equal((await request("GET","/bookings",undefined,"second")).data.length,0);
  assert.equal((await request("PUT",`/services/${ids.service}`,serviceFields,"other")).status,403);
});
