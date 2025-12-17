import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    console.log("Registration request:", { email: body.email, company_id: body.company_id, role: body.role });
    
    const { email, password, full_name, company_id, role } = body;

    console.log("Attempting to register user...");
    
    // Use the SDK's auth.register method with service role
    const result = await base44.asServiceRole.auth.register({
      email,
      password,
      user_metadata: {
        full_name,
        company_id,
        role
      }
    });

    console.log("Registration successful:", { user_id: result.id });

    return Response.json({ success: true, user: result });
  } catch (error) {
    console.error("Registration error:", {
      message: error.message,
      stack: error.stack
    });
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});