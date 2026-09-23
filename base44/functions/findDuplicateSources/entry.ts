import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // Use user-scoped queries if user has company_id
        const entityBase = user.company_id ? base44.entities : base44.asServiceRole.entities;
        
        // Fetch all sources
        const sources = await entityBase.WatchSource.list(null, 1000); // Assuming < 1000 for now, need pagination if more

        const normalized = {};
        
        for (const source of sources) {
            if (!source.name) continue;
            const key = source.name.trim().toLowerCase();
            if (!normalized[key]) {
                normalized[key] = [];
            }
            normalized[key].push(source);
        }

        const duplicates = [];
        for (const [key, group] of Object.entries(normalized)) {
            if (group.length > 1) {
                duplicates.push({
                    name: key,
                    sources: group
                });
            }
        }

        return Response.json({ duplicates });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});