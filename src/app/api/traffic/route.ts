import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = (url && key) ? createClient(url, key) : null;

export async function POST(req: Request) {
  try {
    const { path, userAgent, ip } = await req.json();
    
    let city = null;
    let region = null;
    let country = null;

    if (ip && ip !== "unknown" && ip !== "127.0.0.1" && ip !== "::1") {
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`);
        const geoData = await geoRes.json();
        if (geoData.status === "success") {
          city = geoData.city;
          region = geoData.regionName;
          country = geoData.country;
        }
      } catch (e) {
        console.error("Geo lookup failed", e);
      }
    }
    
    const event = {
      path,
      ip_address: ip,
      city,
      region,
      country,
      user_agent: userAgent
    };

    if (supabase) {
      // Force await the insert so Vercel serverless doesn't kill the function before it finishes
      const { error } = await supabase.from("traffic_logs").insert(event);
      if (error) {
         console.error("Traffic log insert failed:", error.message);
      }
    } else {
      console.error("Supabase client not initialized - check env vars");
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Traffic POST error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    if (!supabase) return NextResponse.json({ error: "No DB configured" }, { status: 500 });
    
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 500);
    
    const { data, error } = await supabase
      .from("traffic_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
      
    if (error) {
        if (error.code === "42P01" || error.message.includes("schema cache")) {
            return NextResponse.json({ 
                error: "Table does not exist yet. Run supabase_traffic.sql in your Supabase SQL editor.",
                data: []
            });
        }
        throw error;
    }
    
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
