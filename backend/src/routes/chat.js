
import express from 'express';
import callGemini from '../ai/gemini.js';
import supabaseAdmin from '../supabaseClient.js';
import notify from '../notify.js';

const VISITOR_FUNCTIONS = ['approve_visitor', 'deny_visitor', 'checkin_visitor', 'checkout_visitor'];
const router = express.Router();

// helper: append event (reuse same format as visitors.js)
async function appendEvent(type, actorUserId, subjectId, payload) {
  await supabaseAdmin.from('events').insert([{ type, actor_user_id: actorUserId, subject_id: subjectId, payload, created_at: new Date().toISOString() }]);
}

// Simple chat endpoint: receives user message, calls Gemini with available function list,
// if Gemini returns a "function call" / structured output we execute it.
router.post('/', async (req, res) => {
  console.log('[POST] /api/chat', { user: req.profile?.id, body: req.body });
  const { profile } = req;
  const { message } = req.body;
  if (!message) return res.status(400).json({error: 'missing message'});
  if (!profile) return res.status(401).json({ error: 'Not authenticated' });

  // Provide the model with clear function templates via system prompt.
  // We'll demonstrate using a structured schema that the model can return as JSON.
  const prompt = `You are a concise security copilot. Reply briefly.
Available actions:
- approve_visitor(visitorName)  // e.g. "approve Ramesh"
- deny_visitor(visitorName, reason?)  // e.g. "deny John - not scheduled"
- checkin_visitor(visitorName)  // e.g. "check in Mr Verma"
- checkout_visitor(visitorName)  // e.g. "check out Mr Verma"
- create_guest_pass(visitorName, purpose, startTime, endTime)  // e.g. "create guest pass for John - gym - Friday 6pm to 8pm"
- broadcast_message(title, message, isUrgent?)  // e.g. "broadcast: Water maintenance tomorrow 9am" (admin only)

User: "${message}"
Return JSON: { action, visitorName?, reason?, purpose?, startTime?, endTime?, title?, message?, isUrgent? } or { text } for chat.
`;

  try {
    // Simple prompt-only call, parse response as JSON
    const response = await callGemini(prompt + '\nRespond with valid JSON only.');

    console.log('Gemini response:', JSON.stringify(response, null, 2));
    
    if (!response) {
      return res.json({ reply: 'AI service temporarily unavailable' });
    }

    // Parse Gemini v1beta generateContent shape
    const firstCandidate = response?.candidates?.[0];
    const firstPart = firstCandidate?.content?.parts?.[0];
    let structured = null;
    
    if (firstPart && typeof firstPart.text === 'string') {
      console.log('Gemini text response:', firstPart.text);
      try { 
        structured = JSON.parse(firstPart.text); 
        console.log('Parsed structured:', structured);
      } catch (e) { 
        console.log('JSON parse error:', e.message);
        // Try to extract JSON from the response if it's wrapped in markdown
        const jsonMatch = firstPart.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            structured = JSON.parse(jsonMatch[0]);
            console.log('Extracted JSON:', structured);
          } catch (e2) {
            console.log('Extracted JSON parse error:', e2.message);
          }
        }
      }
    }

    if (!structured || !structured.action) {
      // Fallback: try to parse the message directly for simple commands
      const lc = message.toLowerCase();
      const visitorContextMatch = message.match(/Current visitors:\n([\s\S]*?)(?:\n\n|$)/);
      
      if (visitorContextMatch) {
        const visitorList = visitorContextMatch[1];
        const nameMatch = lc.match(/approve\s+(\w+)|deny\s+(\w+)|check\s+in\s+(\w+)|checkin\s+(\w+)|check\s+out\s+(\w+)|checkout\s+(\w+)/);
        if (nameMatch) {
          const name = nameMatch[1] || nameMatch[2] || nameMatch[3] || nameMatch[4] || nameMatch[5] || nameMatch[6];
          const visitorLine = visitorList.split('\n').find(line => 
            line.toLowerCase().includes(name.toLowerCase())
          );
          if (visitorLine) {
            const idMatch = visitorLine.match(/ID:\s*([0-9a-fA-F-]{36})/);
            if (idMatch) {
              const visitorId = idMatch[1];
              console.log('Fallback parser found visitor:', { name, visitorId });
              
              // Create structured object for fallback
              if (lc.includes('approve')) {
                structured = { action: 'approve_visitor', visitorName: name };
              } else if (lc.includes('deny')) {
                structured = { action: 'deny_visitor', visitorName: name };
              } else if (lc.includes('check in') || lc.includes('checkin')) {
                structured = { action: 'checkin_visitor', visitorName: name };
              } else if (lc.includes('check out') || lc.includes('checkout')) {
                structured = { action: 'checkout_visitor', visitorName: name };
              }
            }
          }
        }
        
        // Check for broadcast messages
        if (lc.includes('broadcast') && lc.includes(':')) {
          const broadcastMatch = lc.match(/broadcast\s*:\s*(.+)/);
          if (broadcastMatch) {
            const content = broadcastMatch[1].trim();
            const isUrgent = lc.includes('urgent') || lc.includes('emergency');
            structured = { 
              action: 'broadcast_message', 
              title: content.split(' ')[0] + '...', 
              message: content,
              isUrgent 
            };
          }
        }
      }
      
      if (!structured || !structured.action) {
        const text = structured?.text || firstPart?.text || 'I can help with visitor actions.';
        console.log('No action found, returning text:', text);
        return res.json({ reply: text });
      }
    }

    // If action is broadcast or guest-pass, handle separately
    if (structured.action === 'broadcast_message') {
      // only admins allowed
      if (profile.role !== 'admin') return res.json({ reply: 'Only admins can broadcast' });
      const title = structured.title || 'Broadcast';
      const messageText = structured.message || structured.title || '';
      const isUrgent = structured.isUrgent || structured.is_urgent || false;
      const expiresAt = structured.expires_at || structured.expiresAt || null;
      try {
        // persist into broadcasts table
        const { data: b, error: bErr } = await supabaseAdmin
          .from('broadcasts')
          .insert([{
            title,
            message: messageText,
            created_by: profile.id,
            is_urgent: !!isUrgent,
            expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          }])
          .select('*')
          .maybeSingle();

        if (bErr) {
          console.error('broadcast insert error', bErr);
          return res.status(500).json({ error: 'Failed to save broadcast' });
        }

        // Send push notification to all users (topic name kept as existing implementation)
        try {
          const notificationTitle = isUrgent ? `🚨 URGENT: ${title}` : `📢 ${title}`;
          await notify.sendFcmToTopic('all_users', notificationTitle, messageText, { broadcastId: b.id, type: 'broadcast' });
        } catch (err) {
          console.error('broadcast notification error', err);
        }

        await appendEvent('broadcast', profile.id, b.id, { title, message: messageText, is_urgent: !!isUrgent });
        return res.json({ result: 'broadcast_sent', broadcast: b });
      } catch (err) {
        console.error('broadcast error', err);
        return res.status(500).json({ error: 'Broadcast failed' });
      }
    }

    // Find visitor by name (any status) to allow clearer errors
    const { data: visitors } = await supabaseAdmin
      .from('visitors')
      .select('*')
      .ilike('name', `%${structured.visitorName}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    const v = visitors?.[0];
    if (!v) return res.json({ reply: `No visitor found named ${structured.visitorName}` });

    // debug info
    console.log('chat structured:', { action: structured.action, visitorName: structured.visitorName });
    console.log('caller profile:', { id: profile?.id, role: profile?.role, household_id: profile?.household_id });
    console.log('visitor record:', { id: v.id, name: v.name, status: v.status, host_household_id: v.host_household_id });

    // Log minimal debug when action not applied
    console.log('chat structured:', { action: structured.action, visitorName: structured.visitorName, user: profile?.id, role: profile?.role });


    // Approve
    if (structured.action === 'approve_visitor') {
      const isAdmin = (profile.role === 'admin') || (Array.isArray(profile.roles) && profile.roles.includes('admin'));
      const isHostResident = profile.household_id === v.host_household_id;
      console.log('performing approve check', { isAdmin, isHostResident, visitorStatus: v.status });
      if (!isAdmin && !isHostResident) {
        console.log('approve blocked: not admin or host');
        return res.json({ reply: 'Not allowed to approve' });
      }
      if (v.status !== 'pending') {
        console.log('approve blocked: invalid status', v.status);
        return res.json({ reply: `Cannot approve: visitor status is ${v.status}` });
      }

      const { data: updated, error: upErr } = await supabaseAdmin.from('visitors').update({ status: 'approved', approved_by: profile.id, approved_at: new Date().toISOString() }).eq('id', v.id).select('*').maybeSingle();
      if (upErr) {
        console.error('approve update error', upErr);
        return res.status(500).json({ error: upErr.message });
      }

      await appendEvent('approval', profile.id, v.id, { prevStatus: v.status, newStatus: 'approved' });
      try {
        const title = 'Visitor approved';
        const body = `${updated.name || 'Visitor'} was approved`;
        await notify.sendFcmToTopic(`household_${v.host_household_id}`, title, body, { visitorId: v.id });
        await notify.sendFcmToTopic('guards', title, body, { visitorId: v.id });
      } catch (err) { console.error('notify error', err); }

      return res.json({ result: 'approved', visitor: updated });
    }

    // Deny
    if (structured.action === 'deny_visitor') {
      const isAdmin = (profile.role === 'admin') || (Array.isArray(profile.roles) && profile.roles.includes('admin'));
      const isHostResident = profile.household_id === v.host_household_id;
      console.log('performing deny check', { isAdmin, isHostResident, visitorStatus: v.status });
      if (!isAdmin && !isHostResident) {
        console.log('deny blocked: not admin or host');
        return res.json({ reply: 'Not allowed to deny' });
      }
      if (v.status !== 'pending') {
        console.log('deny blocked: invalid status', v.status);
        return res.json({ reply: `Cannot deny: visitor status is ${v.status}` });
      }

      const { data: updated, error: upErr } = await supabaseAdmin.from('visitors').update({ status: 'denied' }).eq('id', v.id).select('*').maybeSingle();
      if (upErr) {
        console.error('deny update error', upErr);
        return res.status(500).json({ error: upErr.message });
      }

      await appendEvent('deny', profile.id, v.id, { reason: structured.reason || null });
      try {
        const title = 'Visitor denied';
        const body = `${updated.name || 'Visitor'} was denied`;
        await notify.sendFcmToTopic(`household_${v.host_household_id}`, title, body, { visitorId: v.id });
        await notify.sendFcmToTopic('guards', title, body, { visitorId: v.id });
      } catch (err) { console.error('notify error', err); }

      return res.json({ result: 'denied', visitor: updated });
    }

    // Check-in
    if (structured.action === 'checkin_visitor') {
      console.log('performing checkin check', { role: profile.role, visitorStatus: v.status });
      if (!((profile.role === 'guard') || (Array.isArray(profile.roles) && profile.roles.includes('guard')))) {
        console.log('checkin blocked: not guard');
        return res.json({ reply: 'Only guards can check-in' });
      }
      if (v.status !== 'approved') {
        console.log('checkin blocked: invalid status', v.status);
        return res.json({ reply: `Cannot check-in: visitor status is ${v.status}` });
      }

      const { data: updated, error: upErr } = await supabaseAdmin.from('visitors').update({ status: 'checked_in' }).eq('id', v.id).select('*').maybeSingle();
      if (upErr) {
        console.error('checkin update error', upErr);
        return res.status(500).json({ error: upErr.message });
      }

      await appendEvent('checkin', profile.id, v.id, {});
      try {
        const title = 'Visitor checked in';
        const body = `${updated.name || 'Visitor'} has checked in`;
        await notify.sendFcmToTopic(`household_${v.host_household_id}`, title, body, { visitorId: v.id });
        await notify.sendFcmToTopic('guards', title, body, { visitorId: v.id });
      } catch (err) { console.error('notify error', err); }

      return res.json({ result: 'checked_in', visitor: updated });
    }

    // Check-out
    if (structured.action === 'checkout_visitor') {
      console.log('performing checkout check', { role: profile.role, visitorStatus: v.status });
      if (!((profile.role === 'guard') || (Array.isArray(profile.roles) && profile.roles.includes('guard')))) {
        console.log('checkout blocked: not guard');
        return res.json({ reply: 'Only guards can check-out' });
      }
      if (v.status !== 'checked_in') {
        console.log('checkout blocked: invalid status', v.status);
        return res.json({ reply: `Cannot check-out: visitor status is ${v.status}` });
      }

      const { data: updated, error: upErr } = await supabaseAdmin.from('visitors').update({ status: 'checked_out' }).eq('id', v.id).select('*').maybeSingle();
      if (upErr) {
        console.error('checkout update error', upErr);
        return res.status(500).json({ error: upErr.message });
      }

      await appendEvent('checkout', profile.id, v.id, {});
      try {
        const title = 'Visitor checked out';
        const body = `${updated.name || 'Visitor'} has checked out`;
        await notify.sendFcmToTopic(`household_${v.host_household_id}`, title, body, { visitorId: v.id });
        await notify.sendFcmToTopic('guards', title, body, { visitorId: v.id });
      } catch (err) { console.error('notify error', err); }

      return res.json({ result: 'checked_out', visitor: updated });
    }

    // Create guest pass (multi-step tool)
    if (structured.action === 'create_guest_pass') {
      console.log('performing guest pass creation', { visitorName: structured.visitorName, purpose: structured.purpose });
      
      // Find visitor by name
      const { data: visitors } = await supabaseAdmin
        .from('visitors')
        .select('*')
        .ilike('name', `%${structured.visitorName}%`)
        .order('created_at', { ascending: false })
        .limit(1);

      const v = visitors?.[0];
      if (!v) return res.json({ reply: `No visitor found named ${structured.visitorName}` });

      // Check permissions (residents can create for their household, admins for any)
      const isAdmin = (profile.role === 'admin') || (Array.isArray(profile.roles) && profile.roles.includes('admin'));
      const isHostResident = profile.household_id === v.host_household_id;
      
      if (!isAdmin && !isHostResident) {
        return res.json({ reply: 'Not allowed to create guest pass for this visitor' });
      }

      // Create a special visitor record for the guest pass
      const { data: guestPass, error: gpErr } = await supabaseAdmin
        .from('visitors')
        .insert([{
          name: `${v.name} (Guest Pass)`,
          phone: v.phone,
          purpose: `Guest Pass: ${structured.purpose || 'General access'}`,
          host_household_id: v.host_household_id,
          status: 'approved', // Pre-approved guest pass
          approved_by: profile.id,
          approved_at: new Date().toISOString(),
          scheduled_from: structured.startTime ? new Date(structured.startTime).toISOString() : null,
          scheduled_to: structured.endTime ? new Date(structured.endTime).toISOString() : null
        }])
        .select('*')
        .single();

      if (gpErr) {
        console.error('guest pass creation error', gpErr);
        return res.status(500).json({ error: gpErr.message });
      }

      await appendEvent('guest_pass_created', profile.id, guestPass.id, { 
        originalVisitorId: v.id,
        purpose: structured.purpose,
        timeSlot: `${structured.startTime} to ${structured.endTime}`
      });

      try {
        const title = 'Guest Pass Created';
        const body = `Guest pass created for ${v.name} - ${structured.purpose || 'General access'}`;
        await notify.sendFcmToTopic(`household_${v.host_household_id}`, title, body, { guestPassId: guestPass.id });
        await notify.sendFcmToTopic('guards', title, body, { guestPassId: guestPass.id });
      } catch (err) { console.error('notify error', err); }

      return res.json({ 
        result: 'guest_pass_created', 
        guestPass,
        message: `Guest pass created for ${v.name} - ${structured.purpose || 'General access'}`
      });
    }

    // Broadcast message (admin only)
    if (structured.action === 'broadcast_message') {
      console.log('performing broadcast', { title: structured.title, isUrgent: structured.isUrgent });
      
      const isAdmin = (profile.role === 'admin') || (Array.isArray(profile.roles) && profile.roles.includes('admin'));
      if (!isAdmin) {
        return res.json({ reply: 'Only admins can send broadcasts' });
      }

      try {
        const { data: broadcast, error: bcErr } = await supabaseAdmin
          .from('broadcasts')
          .insert([{
            title: structured.title || 'Announcement',
            message: structured.message || 'No message provided',
            created_by: profile.id,
            is_urgent: structured.isUrgent || false
          }])
          .select('*')
          .single();

        if (bcErr) {
          console.error('broadcast creation error', bcErr);
          // If broadcasts table doesn't exist, return a helpful message
          if (bcErr.code === '42P01') {
            return res.json({ reply: 'Broadcast system not available - broadcasts table not found' });
          }
          return res.status(500).json({ error: bcErr.message });
        }

        try {
          const notificationTitle = structured.isUrgent ? `🚨 URGENT: ${structured.title}` : `📢 ${structured.title}`;
          await notify.sendFcmToTopic('all_users', notificationTitle, structured.message, { 
            broadcastId: broadcast.id,
            type: 'broadcast'
          });
        } catch (err) { console.error('broadcast notification error', err); }

        return res.json({ 
          result: 'broadcast_sent', 
          broadcast,
          message: `Broadcast sent: ${structured.title}`
        });
      } catch (err) {
        console.error('broadcast error', err);
        return res.json({ reply: 'Broadcast system not available' });
      }
    }

  } catch (err) {
    console.error('chat error', err.response?.data || err.message || err);
    
    // If Gemini fails, try simple fallback parsing
    try {
      const lc = message.toLowerCase();
      if (lc.includes('approve') || lc.includes('deny') || lc.includes('check in') || lc.includes('check out')) {
        return res.json({ reply: 'AI service temporarily unavailable. Please use the buttons in My Visitors or Gate pages for now.' });
      }
    } catch (fallbackErr) {
      console.error('fallback error', fallbackErr);
    }
    
    return res.status(500).json({ error: 'AI invocation failed' });
  }
});


export default router;