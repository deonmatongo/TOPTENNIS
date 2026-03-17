# Real-Time Notification System

This document describes the comprehensive real-time notification system that delivers instant notifications to users across all application screens, similar to industry-standard applications like WhatsApp, Instagram, and Uber.

## Overview

The real-time notification system provides:

✅ **Instant Delivery** - Notifications appear immediately without requiring page refresh  
✅ **Persistent Connection** - WebSocket-based connection with automatic reconnection  
✅ **Cross-Screen Coverage** - Works on all screens and tabs  
✅ **Industry-Standard UX** - Toast notifications, browser push, audio alerts  
✅ **Deduplication** - Prevents duplicate notifications  
✅ **Background Support** - Works when app is in background  
✅ **Exponential Backoff** - Smart reconnection logic  

## Architecture

### 1. Transport Layer

**Supabase Realtime** provides the WebSocket-based transport layer:
- Persistent WebSocket connections
- Automatic reconnection with exponential backoff
- Connection monitoring and heartbeat
- Channel-based subscriptions

### 2. Connection Management

**RealtimeProvider** (`src/contexts/RealtimeContext.tsx`) handles:
- Connection establishment and monitoring
- Exponential backoff reconnection (1s, 2s, 4s, 8s, 16s, 30s max)
- Connection state tracking (`isConnected`, `isReconnecting`)
- Heartbeat every 30 seconds to keep connection alive
- Comprehensive cleanup on logout/unmount

### 3. Notification Processing

**useRealtimeNotifications** (`src/hooks/useRealtimeNotifications.tsx`) manages:
- Event type definitions and routing
- Deduplication using unique event IDs
- Toast notifications with actions
- Browser push notifications
- Audio notifications with different tones
- Background/foreground handling

### 4. State Management

**useNotifications** (`src/hooks/useNotifications.tsx`) provides:
- Notification store with real-time updates
- Unread count tracking
- Optimistic updates for better UX
- Missed notification sync on reconnection
- Queue for events arriving before initial load

### 5. UI Integration

**NotificationsContext** and **NotificationDropdown** provide:
- Reactive bell icon with unread count
- Dropdown with notification list
- Inline actions (accept/decline, view profile)
- Real-time updates across all components

## Notification Types

### Match Invites
- `match_invite_sent` - New invitation received
- `match_invite_accepted` - Your invitation was accepted
- `match_invite_declined` - Your invitation was declined
- `match_rescheduled` - Time proposal received
- `match_cancelled` - Match was cancelled

### Friend Requests
- `friend_request_sent` - New friend request received
- `friend_request_accepted` - Your request was accepted
- `friend_request_declined` - Your request was declined

### Messages
- `message_received` - New message in conversation
- `group_invite_sent` - Group chat invitation

### Availability
- `availability_updated` - Other user updated their availability

## User Experience

### Toast Notifications
- Appear instantly in top-right corner
- Include description and action buttons
- Auto-dismiss after configurable time
- Different styles per event type

### Browser Push Notifications
- Work when tab is in background
- Click to navigate to relevant screen
- Auto-dismiss after 5 seconds
- Respect notification permissions

### Audio Notifications
- Different tones per event type:
  - Match invites: 800Hz, 0.5s volume
  - Friend requests: 900Hz, 0.4s volume
  - Messages: 700Hz, 0.2s volume
  - Acceptances: 600Hz, 0.3s volume
- Fallback to generated beep if audio file missing

### Visual Indicators
- Bell icon updates with unread count instantly
- Badge shows total unread notifications
- Count updates reactively without refresh

## Technical Implementation

### Connection Flow

1. **App Mount** → RealtimeProvider establishes connection
2. **User Auth** → Notification subscriptions activated
3. **Event Trigger** → Database change detected
4. **Real-time Push** → Event sent via WebSocket
5. **Client Receive** → Event processed and deduplicated
6. **UI Update** → Toast, browser notification, audio, bell count

### Reconnection Logic

```javascript
// Exponential backoff with jitter
const delay = Math.min(1000 * Math.pow(2, attempt), 30000) + Math.random() * 1000;

// Max 10 attempts, then stop trying
if (attempt >= 10) return;

// Reset on successful connection
if (status === 'SUBSCRIBED') reconnectAttempts = 0;
```

### Deduplication

```javascript
// Unique event ID prevents duplicates
const eventId = `${type}-${data.id || data.match_id}-${userId}`;

// Track last 1000 events, cleanup old ones
if (processedEvents.size > 1000) {
  const oldIds = Array.from(processedEvents).slice(0, 500);
  oldIds.forEach(id => processedEvents.delete(id));
}
```

### Missed Notification Sync

On reconnection, system fetches notifications created after the latest known timestamp:

```javascript
const latestTimestamp = notifications[0]?.createdAt?.toISOString();
if (latestTimestamp) {
  const missed = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .gt('created_at', latestTimestamp);
}
```

## Testing

### Manual Testing Steps

1. **Match Invites**
   - User A sends invite to User B
   - User B should see instant toast + browser notification
   - Bell count should update immediately
   - Accept/decline should trigger notifications for User A

2. **Friend Requests**
   - User A sends request to User B
   - User B should see instant notification
   - Acceptance should notify User A

3. **Messages**
   - Send message in different tab/window
   - Should see instant notification if not in conversation

4. **Connection Testing**
   - Disconnect network, wait 10 seconds
   - Reconnect - should automatically recover
   - Notifications sent during disconnect should sync

### Automated Testing

```javascript
// Test event processing
const testEvent = {
  type: 'match_invite_sent',
  data: { receiver_id: currentUserId, sender_name: 'Test User' },
  userId: currentUserId,
  timestamp: Date.now()
};

// Verify deduplication
processNotificationEvent(testEvent);
processNotificationEvent(testEvent); // Should be skipped
```

## Performance Considerations

### Memory Management
- Event ID set limited to 1000 entries
- Automatic cleanup of old events
- Proper channel cleanup on unmount

### Network Efficiency
- Single WebSocket connection for all events
- Heartbeat every 30 seconds (not excessive)
- Exponential backoff prevents hammering

### Battery Life
- Background notifications use browser's optimized push system
- Audio notifications are brief and low-volume
- No unnecessary polling or frequent updates

## Browser Compatibility

### Supported Features
- WebSocket connections (all modern browsers)
- Browser notifications (Chrome, Firefox, Safari, Edge)
- Web Audio API for generated sounds
- Service Worker support for background operation

### Fallbacks
- Generated beep if audio file missing
- Toast notifications if browser notifications denied
- Visual bell count always works

## Security

### Authentication
- All subscriptions filtered by user_id
- Server-side RLS policies enforce access
- No cross-user data leakage

### Data Validation
- Event payloads validated before processing
- Type-safe event definitions
- Safe navigation with null checks

## Monitoring

### Console Logs
- Connection status changes logged
- Event processing logged with emojis
- Errors logged with context

### Performance Metrics
- Connection reconnection attempts tracked
- Event processing time monitored
- Memory usage controlled via cleanup

## Troubleshooting

### Common Issues

**Notifications not appearing**
- Check browser notification permissions
- Verify WebSocket connection in console
- Ensure user is authenticated

**Duplicate notifications**
- Check event ID generation
- Verify deduplication logic
- Check for multiple tab instances

**Connection drops frequently**
- Check network stability
- Verify heartbeat is working
- Monitor reconnection attempts

### Debug Commands

```javascript
// Check connection status
console.log('Connection:', useRealtime().isConnected);

// Check unread count
console.log('Unread:', useNotificationsContext().unreadCount);

// Test notification
useNotificationsContext().addNotification({
  type: 'general',
  title: 'Test',
  message: 'This is a test notification'
});
```

## Future Enhancements

### Planned Features
- Mobile push notifications (FCM/APNs)
- Notification categories and preferences
- Scheduled "do not disturb" hours
- Rich media notifications (images, buttons)
- Notification history and search

### Scalability
- Redis pub/sub for multi-server deployments
- Notification queues for high-volume scenarios
- Analytics on notification engagement
- A/B testing on notification timing

---

This real-time notification system provides industry-standard instant delivery across all user interactions, ensuring users never miss important events regardless of where they are in the application.
