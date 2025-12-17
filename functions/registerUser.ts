import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    console.log("Registration request:", { email: body.email, company_id: body.company_id, role: body.role });
    
    const { email, password, full_name, company_id, role } = body;

    // Use Base44's auth API directly with service role
    const appId = Deno.env.get("BASE44_APP_ID");
    const serviceKey = Deno.env.get("BASE44_SERVICE_ROLE_KEY");
    
    console.log("Making registration API call...");
    const authResponse = await fetch(`https://api.base44.com/v1/apps/${appId}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({
        email,
        password,
        user_metadata: {
          full_name,
          company_id,
          role,
        }
      })
    });

    const result = await authResponse.json();
    console.log("Registration API response:", { status: authResponse.status, result });
    
    if (!authResponse.ok) {
      throw new Error(result.error || 'Registration failed');
    }

    return Response.json({ success: true, user: result });
  } catch (error) {
    console.error("Registration error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});