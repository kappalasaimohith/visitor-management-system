import "dotenv/config";
console.log('SUPABASE_API_URL             :', Boolean(process.env.SUPABASE_API_URL));
console.log('SUPABASE_API_SERVICE_ROLE_KEY:', Boolean(process.env.SUPABASE_API_SERVICE_ROLE_KEY));
console.log("SUPABASE_ANON_KEY            :", Boolean(process.env.SUPABASE_ANON_KEY));
console.log("GEMINI_API_KEY present       :", Boolean(process.env.GEMINI_API_KEY));
console.log("GEMINI_MODEL                 :",Boolean(process.env.GEMINI_MODEL));
console.log("PORT                         :",Boolean(process.env.PORT));