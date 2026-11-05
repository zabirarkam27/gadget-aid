require("dotenv").config();
// Run from a trusted server/scheduler. Never put CRON_SECRET in a browser URL.
const run=async()=>{
 const secret=process.env.CRON_SECRET || "";
 if(secret.length<32)throw new Error("Configure a CRON_SECRET of at least 32 characters first.");
 const endpoint=new URL(process.env.EMAIL_JOB_URL || "http://localhost:5000/internal/jobs/email");
 if(!["http:","https:"].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash)throw new Error("EMAIL_JOB_URL must be a plain http(s) job endpoint.");
 if(endpoint.protocol!=="https:" && !["localhost","127.0.0.1","[::1]"].includes(endpoint.hostname))throw new Error("Use HTTPS for remote delivery jobs.");
 const response=await fetch(endpoint,{headers:{Authorization:`Bearer ${secret}`},redirect:"error",signal:AbortSignal.timeout(90000)});
 if(!response.ok)throw new Error(`Email job did not complete (HTTP ${response.status}). Check server configuration and delivery state.`);
 const result=await response.json();console.log(JSON.stringify({accepted:result.accepted,retry:result.retry,failed:result.failed,skipped:result.skipped}));
};
run().catch(error=>{console.error(error.message);process.exitCode=1;});
