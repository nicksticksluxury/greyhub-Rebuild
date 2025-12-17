import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    console.log("Registration request:", { email: body.email, company_id: body.company_id, role: body.role });
    
    const { email, password, full_name, company_id, role } = body;

    const appId = Deno.env.get("BASE44_APP_ID");
    
    console.log("Making registration API call to Base44...");
    const authResponse = await fetch(`https://api.base44.com/v1/apps/${appId}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Role-Key': 'true'
      },
      body: JSON.stringify({
        email,
        password,
        full_name,
        company_id,
        role
      })
    });

    const result = await authResponse.json();
    console.log("Registration API response:", { status: authResponse.status, success: authResponse.ok });
    
    if (!authResponse.ok) {
      throw new Error(result.error || result.message || 'Registration failed');
    }

    return Response.json({ success: true, user: result });
  } catch (error) {
    console.error("Registration error:", {
      message: error.message,
      stack: error.stack
    });
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});