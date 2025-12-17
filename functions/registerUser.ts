import { createClient } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const { email, password, full_name, company_id, role } = await req.json();

    const base44 = createClient(
      Deno.env.get("BASE44_APP_ID"),
      null,
      Deno.env.get("BASE44_SERVICE_ROLE_KEY")
    );

    // Register the user using service role
    const user = await base44.auth.register({
      email,
      password,
      user_metadata: {
        full_name,
        company_id,
        role,
      },
    });

    return Response.json({ success: true, user });
  } catch (error) {
    console.error("Registration error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});