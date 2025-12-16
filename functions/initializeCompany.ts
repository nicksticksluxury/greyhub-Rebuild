import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user already has a company
    if (user.company_id) {
      const companies = await base44.asServiceRole.entities.Company.filter({ id: user.company_id });
      if (companies.length > 0) {
        return Response.json({ 
          success: true, 
          company: companies[0],
          message: 'Company already exists' 
        });
      }
    }

    const { companyName } = await req.json();

    if (!companyName) {
      return Response.json({ error: 'Company name is required' }, { status: 400 });
    }

    // Create new company
    const company = await base44.asServiceRole.entities.Company.create({
      name: companyName,
      subscription_status: 'trial',
      subscription_plan: 'standard',
      subscription_price: 50,
    });

    // Update user with company_id
    await base44.asServiceRole.entities.User.update(user.id, {
      company_id: company.id,
    });

    return Response.json({ 
      success: true, 
      company,
      message: 'Company created successfully' 
    });

  } catch (error) {
    console.error('Error initializing company:', error);
    return Response.json({ 
      error: error.message || 'Failed to initialize company' 
    }, { status: 500 });
  }
});