import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        // Use service role to check settings and create alerts even if triggered by unauthenticated context (though usually called from frontend)
        // Actually, better to use service role for reliable settings access
        const client = base44.asServiceRole;

        const settings = await client.entities.Setting.list();
        const expirySetting = settings.find(s => s.key === 'ebay_token_expiry');
        
        let alertsCreated = 0;

        // Check eBay Token Expiry
        if (expirySetting && expirySetting.value) {
            const expiryDate = new Date(expirySetting.value);
            const now = new Date();
            const hoursUntilExpiry = (expiryDate - now) / (1000 * 60 * 60);

            if (hoursUntilExpiry < 24) {
                // Check if an alert already exists for this to avoid spamming
                // We'll filter by recent alerts with the same title
                const recentAlerts = await client.entities.Alert.filter({ 
                    title: "eBay Token Expiring", 
                    read: false 
                });

                if (recentAlerts.length === 0) {
                    const isExpired = hoursUntilExpiry <= 0;
                    await client.entities.Alert.create({
                        type: "error",
                        title: isExpired ? "eBay Token Expired" : "eBay Token Expiring",
                        message: isExpired 
                            ? "Your eBay connection has expired. Sales sync and listing will fail. Please reconnect in Settings." 
                            : `Your eBay connection expires in ${Math.round(hoursUntilExpiry)} hours. Please reconnect in Settings.`,
                        link: "Settings",
                        read: false,
                        metadata: { source: "system_check" }
                    });
                    alertsCreated++;
                }
            }
        } else {
             // If no expiry setting but we have a token setting, maybe we should warn? 
             // Or if no token at all?
             const tokenSetting = settings.find(s => s.key === 'ebay_user_access_token');
             if (!tokenSetting) {
                 // Maybe warn that eBay is not connected?
                 // Only if we haven't warned recently
                 const recentAlerts = await client.entities.Alert.filter({ 
                    title: "eBay Not Connected", 
                    read: false 
                });
                if (recentAlerts.length === 0) {
                    // This might be annoying for new users, maybe skip
                }
             }
        }

        return Response.json({ success: true, alertsCreated });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});