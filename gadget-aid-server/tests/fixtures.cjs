const {ObjectId} = require("mongodb");
const fixedTime = new Date("2026-11-05T10:00:00Z");
const users = {
  customer:{uid:"qa-customer",email:"customer@example.test",name:"Demo Customer"},
  provider:{uid:"qa-provider",email:"provider@example.test",name:"Demo Repairs"},
  other:{uid:"qa-other",email:"other@example.test",name:"Other Provider"},
  second:{uid:"qa-second",email:"second@example.test",name:"Second Customer"}
};
const ids={service:"111111111111111111111111",otherService:"222222222222222222222222",booking:"333333333333333333333333"};
const clone = value => value instanceof ObjectId ? new ObjectId(value.toHexString()) : value instanceof Date ? new Date(value) : Array.isArray(value) ? value.map(clone) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([k,v])=>[k,clone(v)])) : value;
const equal=(a,b)=>a instanceof ObjectId && b instanceof ObjectId ? a.equals(b) : a instanceof Date && b instanceof Date ? a.getTime()===b.getTime() : a === b;
const matches=(row,query)=>Object.entries(query).every(([key,value])=>{
  if(key==="$or")return value.some(part=>matches(row,part));
  if(key==="$and")return value.every(part=>matches(row,part));
  if(value === null)return row[key] == null;
  if(value && typeof value === "object" && !(value instanceof ObjectId) && !(value instanceof Date)) {
    if("$exists" in value)return Object.hasOwn(row,key) === value.$exists;
    if("$in" in value)return value.$in.some(item=>item === null ? row[key] == null : equal(row[key],item));
    throw new Error(`Unsupported test query operator: ${key}`);
  }
  return equal(row[key],value);
});
class MemoryCollection {
  constructor(rows=[]){this.rows=clone(rows);}
  find(query={}){return {toArray:async()=>clone(this.rows.filter(row=>matches(row,query)))};}
  async findOne(query){return clone(this.rows.find(row=>matches(row,query)) || null);}
  async insertOne(record){
    const row=clone(record);row._id ||= new ObjectId();
    if(this.rows.some(existing=>equal(existing._id,row._id)))throw Object.assign(new Error("duplicate key"),{code:11000});
    this.rows.push(row);return {acknowledged:true,insertedId:row._id};
  }
  async updateOne(query,update){
    const row=this.rows.find(row=>matches(row,query));
    if(!row)return {matchedCount:0,modifiedCount:0};
    const before=JSON.stringify(row);Object.assign(row,clone(update.$set));
    return {acknowledged:true,matchedCount:1,modifiedCount:before===JSON.stringify(row) ? 0 : 1};
  }
}
const serviceFields={name:"Laptop diagnostic repair",price:85,area:"Dhaka",description:"Diagnosis and repair for a laptop that will not start.",image:"http://127.0.0.1:5176/banner.png"};
const createFixture=({seedBooking=false}={})=>{
  const service={_id:new ObjectId(ids.service),...serviceFields,providerUid:users.provider.uid,providerEmail:users.provider.email,providerName:users.provider.name,providerPhoto:null,createdAt:fixedTime,updatedAt:fixedTime};
  const otherService={...service,_id:new ObjectId(ids.otherService),name:"Phone display repair",providerUid:users.other.uid,providerEmail:users.other.email,providerName:users.other.name};
  const booking={_id:new ObjectId(ids.booking),serviceId:ids.service,serviceName:service.name,serviceImage:service.image,providerUid:users.provider.uid,providerEmail:users.provider.email,providerName:users.provider.name,userUid:users.customer.uid,userEmail:users.customer.email,userName:users.customer.name,date:"2026-11-06",instruction:"The laptop does not start. Please check the power connection.",price:85,status:"pending",createdAt:fixedTime};
  const db={notifications:new MemoryCollection(),threads:new MemoryCollection(),services:new MemoryCollection([service,otherService]),bookings:new MemoryCollection(seedBooking ? [booking] : [])};
  return {db,service,otherService,booking};
};
const verifyIdToken=async token=>{if(!users[token])throw new Error("invalid test token");return users[token];};
module.exports={MemoryCollection,createFixture,users,ids,fixedTime,serviceFields,verifyIdToken};
