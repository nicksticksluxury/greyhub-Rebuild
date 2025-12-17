import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!user.company_id) {
            return Response.json({ error: 'User not linked to company' }, { status: 403 });
        }

        // Fetch OAuth token from Setting entity (company-scoped)
        const settings = await base44.entities.Setting.filter({ 
            company_id: user.company_id,
            key: 'ebay_oauth_token' 
        });
        
        const ebayToken = settings[0]?.value;
        if (!ebayToken) {
            return Response.json({ error: 'eBay OAuth token not configured' }, { status: 500 });
        }

        // Set Notification Preferences via Trading API
        // We need to subscribe to events. 
        // Note: The Delivery URL must be configured in the Developer Portal Application Settings 
        // OR we can try to set it here if the application keyset supports it (usually requires ApplicationDeliveryPreferences).

        const xmlBody = `
<?xml version="1.0" encoding="utf-8"?>
<SetNotificationPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <ApplicationDeliveryPreferences>
    <ApplicationEnable>Enable</ApplicationEnable>
    <DeviceType>Platform</DeviceType>
  </ApplicationDeliveryPreferences>
  <UserDeliveryPreferenceArray>
    <NotificationEnable>
      <EventType>FixedPriceTransaction</EventType>
      <EventEnable>Enable</EventEnable>
    </NotificationEnable>
    <NotificationEnable>
      <EventType>ItemSold</EventType>
      <EventEnable>Enable</EventEnable>
    </NotificationEnable>
    <NotificationEnable>
      <EventType>ItemClosed</EventType>
      <EventEnable>Enable</EventEnable>
    </NotificationEnable>
    <NotificationEnable>
      <EventType>ItemSuspened</EventType>
      <EventEnable>Enable</EventEnable>
    </NotificationEnable>
  </UserDeliveryPreferenceArray>
</SetNotificationPreferencesRequest>
`;

        const response = await fetch('https://api.ebay.com/ws/api.dll', {
            method: 'POST',
            headers: {
                'X-EBAY-API-SITEID': '0',
                'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
                'X-EBAY-API-CALL-NAME': 'SetNotificationPreferences',
                'X-EBAY-API-IAF-TOKEN': ebayToken, // OAuth Token
                'Content-Type': 'text/xml'
            },
            body: xmlBody.trim()
        });

        const responseText = await response.text();

        // Basic check for success
        if (responseText.includes('<Ack>Success</Ack>') || responseText.includes('<Ack>Warning</Ack>')) {
            
            // Get the webhook URL to show the user
            // Base44 function URL pattern
            // We don't have the exact domain available in Deno.env usually, but we can try to construct it or just generic info.
            
            return Response.json({ 
                success: true, 
                message: "Subscriptions enabled. Please ensure your Application Delivery URL in eBay Developer Portal points to your Base44 'ebayWebhook' function."
            });
        } else {
            console.error("eBay SetNotificationPreferences Failed:", responseText);
            return Response.json({ 
                success: false, 
                error: "Failed to set preferences", 
                details: responseText 
            });
        }

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});