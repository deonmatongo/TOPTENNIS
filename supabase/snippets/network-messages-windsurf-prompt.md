# Windsurf Prompt — Network & Messages (Full Build)

---

## CONTEXT

You are building a **Network & Messages** feature for a gaming/sports web application. This is a full-featured real-time social messaging system inspired by Slack's UX patterns, adapted for a player-to-player context. The stack uses **React**, **Supabase** (real-time subscriptions, auth, database), and **Tailwind CSS**.

The component is called `FriendsMessagesTab` and is accessible from two routes: `Dashboard → Messages` and `Dashboard → Social`.

---

## DESIGN PHILOSOPHY

Take heavy inspiration from **Slack's** approach to channels and DMs:
- Sidebar lists conversations grouped by type (DMs, then Groups/Channels)
- Clicking a conversation opens it in the main panel
- Groups behave like Slack channels — they have a name, member list, admin roles, and persistent history
- Friend requests, when accepted, **automatically create a DM conversation** and redirect the user to the Chat tab with that conversation open and focused
- The experience should feel native, fast, and real-time — no page reloads

---

## DATABASE SCHEMA (Supabase)

Create or ensure these tables exist:

```sql
-- Conversations (DMs and Groups)
create table conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('dm', 'group')),
  name text,                        -- null for DMs, required for groups
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Conversation members (DMs + Groups)
create table conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  user_id uuid references auth.users(id),
  role text default 'member' check (role in ('member', 'admin')),
  joined_at timestamptz default now(),
  last_read_at timestamptz default now(),
  unique(conversation_id, user_id)
);

-- Messages
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender_id uuid references auth.users(id),
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,           -- soft delete
  reply_to_id uuid references messages(id)
);

-- Message reactions
create table message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references messages(id) on delete cascade,
  user_id uuid references auth.users(id),
  emoji text not null,
  created_at timestamptz default now(),
  unique(message_id, user_id, emoji)
);

-- Friends / friend requests
create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references auth.users(id),
  addressee_id uuid references auth.users(id),
  status text default 'pending' check (status in ('pending', 'accepted', 'declined', 'blocked')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(requester_id, addressee_id)
);

-- User profiles (extend if already exists)
create table profiles (
  id uuid primary key references auth.users(id),
  username text unique,
  display_name text,
  avatar_url text,
  skill_level text check (skill_level in ('Beginner', 'Intermediate', 'Advanced', 'Pro')),
  is_online boolean default false,
  last_seen timestamptz default now()
);
```

Enable **Row Level Security** on all tables. Enable **Realtime** on `messages`, `message_reactions`, `friendships`, and `conversation_members`.

---

## COMPONENT ARCHITECTURE

```
FriendsMessagesTab/
├── index.jsx                     # Root layout: sidebar + main panel
├── hooks/
│   ├── useConversations.js       # Fetch + subscribe to conversation list
│   ├── useMessages.js            # Fetch + subscribe to messages in a thread
│   ├── useFriends.js             # Friends list, requests, send/accept/decline
│   ├── useTypingIndicator.js     # Broadcast + receive typing state
│   └── useOnlinePresence.js      # Track + show online status
├── sidebar/
│   ├── Sidebar.jsx               # Container with tabs
│   ├── ChatTab.jsx               # DM + group list (Slack-style)
│   ├── FriendsTab.jsx            # Friends list with chat/unfriend/block actions
│   └── RequestsTab.jsx           # Incoming + sent requests
├── thread/
│   ├── ThreadPanel.jsx           # Main right panel (empty state or active thread)
│   ├── MessageList.jsx           # Scrollable message history
│   ├── MessageBubble.jsx         # Individual message with reactions/hover actions
│   ├── TypingIndicator.jsx       # Animated "... is typing"
│   └── MessageInput.jsx          # Composer: text, emoji, attach, send
├── modals/
│   ├── NewGroupModal.jsx         # Slack-style channel/group creation
│   ├── GroupInfoSheet.jsx        # Slide-in: members, rename, add/remove
│   ├── FindPlayersBar.jsx        # Expandable player search in header
│   └── ProfileModal.jsx          # View a player's profile
└── shared/
    ├── Avatar.jsx                # Avatar with online dot
    └── Badge.jsx                 # Unread count badge
```

---

## FEATURE SPECIFICATIONS

### 1. LEFT SIDEBAR — LAYOUT (Slack-inspired)

Structure the sidebar like Slack:

```
[Header: "Network & Messages" + online count]
[Search bar — filters across DMs and groups]

DIRECT MESSAGES
  ● Alex Rivera          (unread badge)
  ● Sam Chen
  ○ Morgan Lee

GROUPS
  # Friday Squad         (unread badge)
  # Ranked Lobby

[+ Find Players]  [+ New Group]  ← at bottom of sidebar
```

- "●" = online, "○" = offline (colored dot, not text)
- Groups use a `#` prefix like Slack channels
- Conversations sorted by `updated_at` descending (most recent activity first)
- Pinned conversations shown at top of their section with a 📌 icon
- Clicking any row opens the thread in the right panel and marks messages as read
- **Unread count badge** on conversations with unread messages
- **Bold** conversation name when there are unread messages

#### Tabs (above the list)
Keep 3 tabs: **Chat | Friends | Requests**
- Chat tab = Slack-style sidebar described above
- Friends tab = accepted friends list
- Requests tab = incoming + sent

---

### 2. FRIEND REQUEST → AUTO-OPEN DM (Critical Flow)

When a user **accepts a friend request**:

1. Update `friendships.status` to `'accepted'`
2. Check if a DM `conversation` already exists between the two users:
   ```js
   // Query: find a conversation of type 'dm' where both user IDs are members
   const existing = await supabase.rpc('find_dm_conversation', {
     user_a: currentUserId,
     user_b: newFriendId
   });
   ```
3. If no DM exists, **create one**:
   ```js
   const { data: conv } = await supabase
     .from('conversations')
     .insert({ type: 'dm', created_by: currentUserId })
     .select().single();

   await supabase.from('conversation_members').insert([
     { conversation_id: conv.id, user_id: currentUserId, role: 'admin' },
     { conversation_id: conv.id, user_id: newFriendId, role: 'member' }
   ]);
   ```
4. **Switch the active tab to "Chat"**
5. **Set the selected conversation** to this DM
6. Show a **toast**: `"You're now friends with [Name]! Say hello 👋"`
7. The right panel opens the (empty) DM thread ready to type

---

### 3. GROUP CREATION (Slack-style)

Open `NewGroupModal` when user clicks **+ New Group**.

Modal layout:
```
[Group Icon placeholder — click to upload]
Group Name: [________________]
Description (optional): [________________]

Add Members:
[Search friends...]
  ☑ Alex Rivera  (Advanced)
  ☐ Sam Chen     (Intermediate)
  ☑ Morgan Lee   (Beginner)

[Cancel]  [Create Group →]
```

On submit:
1. Insert into `conversations`: `{ type: 'group', name: groupName, created_by: currentUserId }`
2. Insert into `conversation_members`: creator as `'admin'`, all selected as `'member'`
3. Send a system message into the conversation: `"[Creator] created the group. Welcome everyone! 🎮"`
4. Switch to Chat tab, open the new group thread, focus the message input
5. Toast: `"# Friday Squad created!"`

**Group Info Sheet** (slides in from right, like Slack's channel details):
- Group name with pencil icon to rename (admin only)
- Member list with Admin badge — click name to view profile
- Remove member button (admin only, with confirmation)
- "Add Members" section (admin only): shows friends not already in group, with + button
- "Leave Group" button (non-admins)
- "Delete Group" button (admin only, with confirmation)

---

### 4. CHAT TAB — CONVERSATION LIST

Each DM row:
```
[Avatar + online dot]  [Name]           [timestamp]
                       [Last message preview]  [unread badge]
```

Each Group row:
```
[# icon]  [Group Name]          [timestamp]
          [Sender: message preview]  [unread badge]
```

Right-click or hover → context menu:
- Pin / Unpin conversation
- Mute notifications
- Mark as read
- (DM only) View Profile
- (DM only) Block user
- (Group only) Leave group

---

### 5. FRIENDS TAB

```
Search: [________________]

ONLINE — 2
[Avatar ●]  Alex Rivera    Advanced     [Chat]  [···]
[Avatar ●]  Sam Chen       Intermediate [Chat]  [···]

OFFLINE — 1
[Avatar ○]  Morgan Lee     Beginner     [Chat]  [···]
```

The `[···]` dropdown contains:
- View Profile
- Unfriend (with confirm dialog)
- Block (with confirm dialog)
- Send Match Invite

`[Chat]` button: opens or creates DM, switches to Chat tab with that DM selected.

---

### 6. REQUESTS TAB

**INCOMING section:**
- Each card: Avatar, Name, Skill Level, mutual friends count, **Accept** / **Decline** buttons
- Accept → triggers the full "Friend Request → Auto-open DM" flow (Section 2)
- Decline → updates status to `'declined'`, removes from list with animation

**SENT section:**
- Each card: Avatar, Name, Skill Level, `Pending` badge, **Revoke** (✕) button
- Revoke → deletes the friendship row

Both sections update in real-time via Supabase subscription on `friendships`.

---

### 7. THREAD PANEL — RIGHT SIDE

#### Header
```
[Avatar/GroupIcon + online indicator]  [Name or #group-name]
[Status: "Online" / "Last seen 2h ago" / "typing..."]
                    [🔍 Search] [📌 Pin] [🔔 Mute] [⚙️ Settings]
```

Clicking the header on a DM → opens ProfileModal
Clicking the header on a Group → opens GroupInfoSheet

#### Message List

Messages grouped by date with dividers:
```
────────────── Today ──────────────
```

Each message bubble:
- **Their messages**: Avatar + Name above (only on first in a cluster, like Slack), bubble left-aligned
- **Your messages**: bubble right-aligned, no avatar
- Hover → action bar appears **above** the bubble: [😊 React] [↩ Reply] [🗑 Delete]
- Clicking 😊 → opens inline emoji reaction picker (8 common emojis)
- Reactions render below the bubble with count, click to add/remove your reaction
- **Read receipts**: single ✓ sent, double ✓✓ read (shown only on your last message)
- **Reply preview**: quoted message shown above reply bubble (collapsed, click to jump)
- System messages (e.g. "Alex created the group") centered, muted, no bubble

#### Typing Indicator
```
[Avatar]  [● ● ●]  ← animated bounce
```
Powered by Supabase Realtime broadcast (not stored in DB). Broadcast on every keystroke, clear after 2s of inactivity.

```js
// Broadcast typing
await supabase.channel(`typing:${conversationId}`)
  .send({ type: 'broadcast', event: 'typing', payload: { userId, displayName } });
```

#### Message Input (Composer)

```
[😊] [Type a message...                              ] [📎] [🎮] [↑]
```

- `Enter` = send, `Shift+Enter` = new line (exactly like Slack)
- Emoji picker: toggleable panel above input, 3 rows × 8 columns of common emojis
- 📎 = file/image attach (show file preview before sending; store in Supabase Storage)
- 🎮 = send match invite (creates a special message card with Accept/Decline buttons inline)
- Send button (↑) disabled and greyed when input is empty, orange when has content
- Character count warning at 500 chars, hard limit at 1000

#### Empty State (no conversation selected)
```
        💬
  Select a conversation
  Choose from your conversations or find a player

        [+ Find Players]
```

---

### 8. FIND PLAYERS (Header Bar)

Clicking **+ Find Players** in the header expands a search bar below the header:

```
[🔍  Search players by name, username, or skill level...          ]
```

Results appear in a dropdown:
```
[Avatar ●]  Alex Rivera   Advanced   [Add Friend] or [Message] if already friend
[Avatar ○]  Jordan Kim    Pro        [Add Friend]
```

- Real-time search with 300ms debounce
- Clicking result name → opens ProfileModal
- **Add Friend** → inserts into `friendships` as `pending`, button changes to `Pending ✓`
- **Message** (if already friends) → opens or creates DM, switches to Chat tab

---

### 9. REAL-TIME SUBSCRIPTIONS

Set up the following Supabase channels in a `useEffect`:

```js
// 1. New messages in active conversation
supabase.channel(`messages:${conversationId}`)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages',
      filter: `conversation_id=eq.${conversationId}` }, handleNewMessage)
  .subscribe();

// 2. Message reactions
supabase.channel(`reactions:${conversationId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' },
      handleReactionChange)
  .subscribe();

// 3. Friend request updates
supabase.channel(`friendships:${userId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships',
      filter: `addressee_id=eq.${userId}` }, handleFriendshipChange)
  .subscribe();

// 4. Typing indicators (broadcast, not DB)
supabase.channel(`typing:${conversationId}`)
  .on('broadcast', { event: 'typing' }, handleTyping)
  .subscribe();

// 5. Online presence
supabase.channel('online-users')
  .on('presence', { event: 'sync' }, handlePresenceSync)
  .track({ user_id: userId, online_at: new Date().toISOString() })
  .subscribe();
```

Always clean up all channels on component unmount.

---

### 10. NOTIFICATIONS & TOASTS

Use a toast system (e.g. `react-hot-toast` or a custom hook) for:

| Event | Toast |
|-------|-------|
| Friend request accepted | `"You're now friends with [Name]! Say hello 👋"` |
| Friend request received | `"[Name] sent you a friend request"` with Accept/Decline buttons in toast |
| New message (when tab not active) | `"[Name]: [message preview]"` |
| Group created | `"# [Name] created!"` |
| Member added to group | `"[Name] was added to #[Group]"` |
| User removed from group | `"You were removed from #[Group]"` |
| Friend request sent | `"Friend request sent to [Name]"` |
| Request revoked | `"Request to [Name] revoked"` |

---

### 11. PERFORMANCE & UX DETAILS

- **Optimistic UI**: Add messages to local state immediately on send, reconcile with DB response
- **Scroll behavior**: Auto-scroll to bottom on new messages ONLY IF user is already at bottom (within 100px). If scrolled up, show a "↓ New messages" pill button that jumps to bottom on click
- **Unread tracking**: Update `conversation_members.last_read_at` when conversation is opened or user scrolls to bottom
- **Message virtualization**: Use `react-window` or similar for conversations with >100 messages
- **Image previews**: Inline image rendering for image attachments, click to open lightbox
- **Link previews**: Detect URLs in messages and render an Open Graph preview card below the message

---

### 12. ACCESSIBILITY

- All interactive elements must have `aria-label`
- Emoji picker must be keyboard navigable (arrow keys, Enter to select, Escape to close)
- Conversation list is keyboard navigable with Up/Down arrow keys
- Focus is moved to message input when a conversation is opened
- Screen reader announcements for new messages (`aria-live="polite"`)

---

### 13. STYLING GUIDELINES

- Font: DM Sans (import from Google Fonts)
- Primary accent: `#F97316` (orange)
- Background: `#F8F9FB`
- Sidebar background: `#FFFFFF`
- Border: `#EAECF0`
- Online indicator: `#22C55E`
- Unread badge: `#EF4444`
- Message bubble (own): `#111827` with white text
- Message bubble (theirs): `#FFFFFF` with dark text and a border
- Border radius on bubbles: `18px 18px [4px or 18px] [18px or 4px]` depending on direction
- Hover states on sidebar rows: `#F9FAFB`
- Active/selected conversation: `#FFF7ED` with `3px solid #F97316` left border
- Use Tailwind CSS utility classes throughout; avoid inline styles except for dynamic values

---

### 14. FILE STRUCTURE TO CREATE

```
src/
  components/
    FriendsMessagesTab/
      index.jsx
      hooks/
        useConversations.js
        useMessages.js
        useFriends.js
        useTypingIndicator.js
        useOnlinePresence.js
      sidebar/
        Sidebar.jsx
        ChatTab.jsx
        FriendsTab.jsx
        RequestsTab.jsx
      thread/
        ThreadPanel.jsx
        MessageList.jsx
        MessageBubble.jsx
        TypingIndicator.jsx
        MessageInput.jsx
      modals/
        NewGroupModal.jsx
        GroupInfoSheet.jsx
        FindPlayersBar.jsx
        ProfileModal.jsx
      shared/
        Avatar.jsx
        Badge.jsx
  lib/
    supabase.js           # Supabase client singleton
```

---

### 15. SUPABASE HELPER FUNCTIONS (SQL)

Create these as Supabase RPC functions:

```sql
-- Find existing DM between two users
create or replace function find_dm_conversation(user_a uuid, user_b uuid)
returns uuid as $$
  select c.id from conversations c
  join conversation_members m1 on m1.conversation_id = c.id and m1.user_id = user_a
  join conversation_members m2 on m2.conversation_id = c.id and m2.user_id = user_b
  where c.type = 'dm'
  limit 1;
$$ language sql security definer;

-- Get unread count per conversation for current user
create or replace function get_unread_counts(p_user_id uuid)
returns table(conversation_id uuid, unread_count bigint) as $$
  select m.conversation_id, count(*) as unread_count
  from messages m
  join conversation_members cm on cm.conversation_id = m.conversation_id
    and cm.user_id = p_user_id
  where m.created_at > cm.last_read_at
    and m.sender_id != p_user_id
    and m.deleted_at is null
  group by m.conversation_id;
$$ language sql security definer;
```

---

## IMPLEMENTATION ORDER

Build in this sequence to avoid blocking dependencies:

1. **Supabase schema + RPC functions** — database foundation
2. **`supabase.js`** — client singleton
3. **`Avatar.jsx` + `Badge.jsx`** — shared primitives
4. **`useFriends.js`** — friends/requests data layer
5. **`FriendsTab.jsx` + `RequestsTab.jsx`** — static UI with data
6. **Friend request accept → auto-create DM flow** — critical UX path
7. **`useConversations.js`** — conversations list with real-time
8. **`ChatTab.jsx`** — Slack-style sidebar conversation list
9. **`useMessages.js`** — messages with real-time
10. **`MessageBubble.jsx`** — reactions, hover actions, reply
11. **`TypingIndicator.jsx` + `useTypingIndicator.js`**
12. **`MessageInput.jsx`** — composer with emoji picker
13. **`ThreadPanel.jsx`** — assemble full thread
14. **`NewGroupModal.jsx`** — group creation flow
15. **`GroupInfoSheet.jsx`** — group management
16. **`FindPlayersBar.jsx`** — player search
17. **`useOnlinePresence.js`** — presence tracking
18. **`ProfileModal.jsx`** — view profiles
19. **Polish**: scroll behavior, unread tracking, toasts, accessibility

---

## NOTES FOR WINDSURF

- Treat each section above as an independent subtask — complete and test one before moving to the next
- For every Supabase query, always handle loading, error, and empty states
- All real-time subscriptions must be cleaned up in `useEffect` return functions
- Use `useCallback` and `useMemo` to prevent unnecessary re-renders in the message list
- The `find_dm_conversation` RPC must be called before creating a new DM to prevent duplicates
- Test the friend request → DM flow end-to-end before moving on — it is the most critical UX path
