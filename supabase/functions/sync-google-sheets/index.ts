import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  type: "income" | "expense";
  amount: number;
  installments?: number;
  currentInstallment?: number;
  creditCard?: string;
}

// Sanitize string to prevent Google Sheets formula injection
function sanitize(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

function validateTransactions(data: unknown): Transaction[] {
  if (!Array.isArray(data)) {
    throw new Error("Invalid payload: transactions array required");
  }
  if (data.length === 0) {
    throw new Error("No transactions provided");
  }
  if (data.length > 1000) {
    throw new Error("Too many transactions (max 1000)");
  }

  const validTypes = ["income", "expense"];

  for (let i = 0; i < data.length; i++) {
    const t = data[i];
    if (!t || typeof t !== "object") {
      throw new Error(`Transaction ${i}: invalid object`);
    }
    if (typeof t.id !== "string" || t.id.length > 100) {
      throw new Error(`Transaction ${i}: invalid id`);
    }
    if (typeof t.date !== "string" || t.date.length > 30) {
      throw new Error(`Transaction ${i}: invalid date`);
    }
    if (typeof t.description !== "string" || t.description.length > 200) {
      throw new Error(`Transaction ${i}: invalid description`);
    }
    if (typeof t.category !== "string" || t.category.length > 100) {
      throw new Error(`Transaction ${i}: invalid category`);
    }
    if (!validTypes.includes(t.type)) {
      throw new Error(`Transaction ${i}: invalid type`);
    }
    if (typeof t.amount !== "number" || !isFinite(t.amount) || t.amount < 0) {
      throw new Error(`Transaction ${i}: invalid amount`);
    }
  }

  return data as Transaction[];
}

// Google Auth: get access token from service account JSON
async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  let cleanJson = serviceAccountJson.trim();
  if (cleanJson.startsWith('"') && cleanJson.endsWith('"')) {
    cleanJson = cleanJson.slice(1, -1);
  }
  
  cleanJson = cleanJson.replace(/\r?\n/g, '\\n').replace(/\t/g, '\\t');
  
  console.log("JSON starts with:", cleanJson.substring(0, 20));
  const sa = JSON.parse(cleanJson);
  const now = Math.floor(Date.now() / 1000);

  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );

  const textEncoder = new TextEncoder();
  const inputData = textEncoder.encode(`${header}.${payload}`);

  const pemContents = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, inputData);
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${header}.${payload}.${signatureBase64}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) {
    console.error("Google Auth failed:", JSON.stringify(tokenData));
    throw new Error("Google authentication failed.");
  }
  return tokenData.access_token;
}

async function syncToGoogleSheets(
  accessToken: string,
  spreadsheetId: string,
  transactions: Transaction[]
) {
  const SHEETS_API = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  console.log("Using spreadsheet ID:", spreadsheetId);

  const clearRes = await fetch(`${SHEETS_API}/values/Sheet1:clear`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  if (!clearRes.ok) {
    const clearErr = await clearRes.json();
    console.error("Clear failed:", JSON.stringify(clearErr));
    if (clearErr.error?.code === 400) {
      console.log("Trying Página1 (Portuguese default sheet name)...");
      await fetch(`${SHEETS_API}/values/Página1:clear`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
    }
  }

  const headerRow = [
    "ID",
    "Data",
    "Descrição",
    "Categoria",
    "Tipo",
    "Valor",
    "Parcelas",
    "Parcela Atual",
    "Cartão",
  ];

  const dataRows = transactions.map((t) => [
    sanitize(t.id),
    sanitize(t.date),
    sanitize(t.description),
    sanitize(t.category),
    t.type === "income" ? "Receita" : "Despesa",
    t.amount,
    t.installments ?? "",
    t.currentInstallment ?? "",
    sanitize(t.creditCard ?? ""),
  ]);

  const values = [headerRow, ...dataRows];

  const updateResponse = await fetch(
    `${SHEETS_API}/values/A1?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({ range: "A1", majorDimension: "ROWS", values }),
    }
  );

  const updateData = await updateResponse.json();
  if (!updateResponse.ok) {
    console.error("Sheets API error:", JSON.stringify(updateData));
    throw new Error("Google Sheets update failed.");
  }

  return updateData;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- JWT Authentication ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reject anon-key requests — only authenticated users allowed
    if (claimsData.claims.role !== "authenticated") {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Secrets ---
    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountJson) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON secret not configured");
    }

    const spreadsheetId = Deno.env.get("GOOGLE_SPREADSHEET_ID")?.trim();
    if (!spreadsheetId) {
      throw new Error("GOOGLE_SPREADSHEET_ID secret not configured");
    }

    // --- Input Validation ---
    const body = await req.json();
    const transactions = validateTransactions(body.transactions);

    const accessToken = await getGoogleAccessToken(serviceAccountJson);
    const result = await syncToGoogleSheets(accessToken, spreadsheetId, transactions);

    return new Response(
      JSON.stringify({ success: true, updatedCells: result.updatedCells }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Sync failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});