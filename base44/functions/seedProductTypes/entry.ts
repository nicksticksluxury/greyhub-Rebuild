import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
    }

    const logs = [];
    const addLog = (message) => {
      logs.push(message);
      console.log(message);
    };

    // Product Types
    const productTypes = [
      { name: 'Watch', code: 'watch', description: 'Luxury timepieces', ai_research_prompt: 'Research this luxury watch with extreme detail. Include movement type, case material, bracelet details, dial features, and current market values.' },
      { name: 'Handbag', code: 'handbag', description: 'Designer handbags', ai_research_prompt: 'Research this designer handbag thoroughly. Include style, material, hardware details, size specifications, and current market value.' },
      { name: 'Jewelry - Necklace', code: 'jewelry_necklace', description: 'Necklaces and chains', ai_research_prompt: 'Research this necklace including metal type, stone details, length, clasp type, and market value.' },
      { name: 'Jewelry - Bracelet', code: 'jewelry_bracelet', description: 'Bracelets and bangles', ai_research_prompt: 'Research this bracelet including metal type, stone details, closure type, size, and market value.' },
      { name: 'Jewelry - Earrings', code: 'jewelry_earrings', description: 'Earrings', ai_research_prompt: 'Research these earrings including metal type, stone details, backing type, and market value.' },
      { name: 'Wallet', code: 'wallet', description: 'Wallets and cardholders', ai_research_prompt: 'Research this wallet including material, closure type, interior features, and market value.' },
      { name: 'Belt', code: 'belt', description: 'Designer belts', ai_research_prompt: 'Research this belt including material, buckle type, width, and market value.' },
      { name: 'Sunglasses', code: 'sunglasses', description: 'Designer sunglasses', ai_research_prompt: 'Research these sunglasses including frame material, lens type, UV protection, and market value.' },
      { name: 'Scarf', code: 'scarf', description: 'Scarves and wraps', ai_research_prompt: 'Research this scarf including material, size, pattern, and market value.' },
      { name: 'Hat', code: 'hat', description: 'Hats and caps', ai_research_prompt: 'Research this hat including material, style, size, and market value.' },
      { name: 'Gloves', code: 'gloves', description: 'Designer gloves', ai_research_prompt: 'Research these gloves including material, lining, closure, size, and market value.' },
      { name: 'Hair Accessories', code: 'hair_accessories', description: 'Hair clips, bands, and accessories', ai_research_prompt: 'Research this hair accessory including material, style, and market value.' }
    ];

    for (const type of productTypes) {
      try {
        await base44.asServiceRole.entities.ProductType.create(type);
        addLog(`Created product type: ${type.name}`);
      } catch (error) {
        addLog(`Error creating ${type.name}: ${error.message}`);
      }
    }

    // Watch Fields
    const watchFields = [
      { field_name: 'movement_type', field_label: 'Movement Type', field_type: 'select', options: ['Automatic', 'Manual', 'Quartz', 'Digital'], order: 1 },
      { field_name: 'case_material', field_label: 'Case Material', field_type: 'select', options: ['Stainless Steel', 'Gold', 'Rose Gold', 'Platinum', 'Titanium', 'Ceramic', 'Bronze', 'Carbon'], order: 2 },
      { field_name: 'case_size', field_label: 'Case Size', field_type: 'text', order: 3 },
      { field_name: 'dial_color', field_label: 'Dial Color', field_type: 'text', order: 4 },
      { field_name: 'bracelet_material', field_label: 'Bracelet Material', field_type: 'select', options: ['Stainless Steel', 'Leather', 'Rubber', 'Gold', 'Rose Gold', 'Titanium', 'Fabric'], order: 5 },
      { field_name: 'tested', field_label: 'Tested', field_type: 'select', options: ['Yes', 'No', 'N/A'], order: 6 }
    ];

    for (const field of watchFields) {
      try {
        await base44.asServiceRole.entities.ProductTypeField.create({
          product_type_code: 'watch',
          ...field
        });
        addLog(`Created watch field: ${field.field_label}`);
      } catch (error) {
        addLog(`Error creating watch field ${field.field_label}: ${error.message}`);
      }
    }

    // Handbag Fields
    const handbagFields = [
      { field_name: 'handbag_style', field_label: 'Handbag Style', field_type: 'select', options: ['Backpacks', 'Bucket Bags', 'Clutches', 'Crossbody Bags', 'Evening Bags', 'Handle Bags', 'Hobos', 'Luggage and Travel', 'Mini Bags', 'Satchels', 'Shoulder Bags', 'Totes', 'Waist Bags'], order: 1 },
      { field_name: 'material', field_label: 'Material', field_type: 'select', options: ['Leather', 'Vegan Leather', 'Faux Leather', 'Canvas', 'Nylon', 'Polyester', 'Suede', 'Denim', 'Patent Leather', 'Raffia/Wicker'], order: 2 },
      { field_name: 'exterior_color', field_label: 'Exterior Color', field_type: 'select', options: ['Black', 'White', 'Brown', 'Beige', 'Red', 'Blue', 'Green', 'Metallic (Gold/Silver)', 'Multi-color', 'Patterned (Floral, Animal Print, etc.)'], order: 3 },
      { field_name: 'interior_color', field_label: 'Interior Color', field_type: 'select', options: ['Same as Exterior', 'Contrasting Color', 'Neutral (Beige, Gray)', 'Patterned Lining'], order: 4 },
      { field_name: 'closure_type', field_label: 'Closure Type', field_type: 'select', options: ['Zipper', 'Magnetic Snap', 'Turn Lock', 'Drawstring', 'Flap', 'Buckle', 'Twist Lock'], order: 5 },
      { field_name: 'size', field_label: 'Size', field_type: 'select', options: ['Mini', 'Small', 'Medium', 'Large', 'Oversized'], order: 6 },
      { field_name: 'hardware_finish', field_label: 'Hardware Finish', field_type: 'select', options: ['Gold', 'Silver', 'Gunmetal', 'Rose Gold', 'Matte Black'], order: 7 },
      { field_name: 'includes_dustbag', field_label: 'Includes Dustbag', field_type: 'select', options: ['Yes', 'No', 'N/A'], order: 8 },
      { field_name: 'features', field_label: 'Features', field_type: 'text', order: 9 }
    ];

    for (const field of handbagFields) {
      try {
        await base44.asServiceRole.entities.ProductTypeField.create({
          product_type_code: 'handbag',
          ...field
        });
        addLog(`Created handbag field: ${field.field_label}`);
      } catch (error) {
        addLog(`Error creating handbag field ${field.field_label}: ${error.message}`);
      }
    }

    return Response.json({ success: true, logs });
  } catch (error) {
    console.error('Seed error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});