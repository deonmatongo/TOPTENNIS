import { useState, useRef, useEffect } from "react";

const COLORS = {
  accent: "#F97316",
  accentLight: "#FFF7ED",
  bg: "#F8F9FB",
  sidebar: "#FFFFFF",
  white: "#FFFFFF",
  border: "#EAECF0",
  text: "#111827",
  muted: "#6B7280",
  mutedLight: "#9CA3AF",
  bubble: "#F3F4F6",
  bubbleOwn: "#111827",
  online: "#22C55E",
  unread: "#EF4444",
  hover: "#F9FAFB",
};

const MOCK_CONVERSATIONS = [
  {
    id: 1,
    type: "dm",
    name: "Alex Rivera",
    avatar: "AR",
    color: "#6366F1",
    lastMessage: "GG! That match was intense 🔥",
    time: "2m",
    unread: 3,
    online: true,
    pinned: true,
  },
  {
    id: 2,
    type: "group",
    name: "Friday Squad",
    avatar: "FS",
    color: "#0EA5E9",
    lastMessage: "Jordan: Who's in for tonight?",
    time: "15m",
    unread: 7,
    online: false,
    members: 4,
    pinned: false,
  },
  {
    id: 3,
    type: "dm",
    name: "Sam Chen",
    avatar: "SC",
    color: "#8B5CF6",
    lastMessage: "Can you sub in for me?",
    time: "1h",
    unread: 0,
    online: true,
    pinned: false,
  },
  {
    id: 4,
    type: "dm",
    name: "Morgan Lee",
    avatar: "ML",
    color: "#EC4899",
    lastMessage: "Thanks for the game 👍",
    time: "3h",
    unread: 0,
    online: false,
    pinned: false,
  },
];

const MOCK_FRIENDS = [
  { id: 1, name: "Alex Rivera", email: "alex@example.com", avatar: "AR", color: "#6366F1", online: true, skill: "Advanced" },
  { id: 2, name: "Sam Chen", email: "sam@example.com", avatar: "SC", color: "#8B5CF6", online: true, skill: "Intermediate" },
  { id: 3, name: "Morgan Lee", email: "morgan@example.com", avatar: "ML", color: "#EC4899", online: false, skill: "Beginner" },
];

const MOCK_MESSAGES = [
  { id: 1, from: "Alex Rivera", fromId: 99, avatar: "AR", color: "#6366F1", text: "Hey! Ready for the match tonight?", time: "6:45 PM", mine: false, read: true, reactions: [{ emoji: "👍", count: 1 }] },
  { id: 2, from: "Me", fromId: 1, avatar: "ME", color: "#F97316", text: "Absolutely! What time are we starting?", time: "6:46 PM", mine: true, read: true, reactions: [] },
  { id: 3, from: "Alex Rivera", fromId: 99, avatar: "AR", color: "#6366F1", text: "Let's say 8pm. I'll set up the lobby 🎮", time: "6:47 PM", mine: false, read: true, reactions: [] },
  { id: 4, from: "Me", fromId: 1, avatar: "ME", color: "#F97316", text: "Perfect. I'll invite Jordan too if that's cool?", time: "6:48 PM", mine: true, read: true, reactions: [] },
  { id: 5, from: "Alex Rivera", fromId: 99, avatar: "AR", color: "#6366F1", text: "GG! That match was intense 🔥", time: "6:50 PM", mine: false, read: false, reactions: [{ emoji: "🔥", count: 2 }] },
];

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎮", "👏"];

function Avatar({ initials, color, size = 36, online = false }) {
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: color, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.33, fontWeight: 700, letterSpacing: "-0.5px",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {initials}
      </div>
      {online && (
        <div style={{
          position: "absolute", bottom: 1, right: 1,
          width: size * 0.28, height: size * 0.28,
          borderRadius: "50%", background: COLORS.online,
          border: "2px solid white",
        }} />
      )}
    </div>
  );
}

function Badge({ count, color = COLORS.unread }) {
  if (!count) return null;
  return (
    <div style={{
      background: color, color: "#fff", borderRadius: 999,
      fontSize: 11, fontWeight: 700, minWidth: 20, height: 20,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "0 6px", fontFamily: "'DM Sans', sans-serif",
    }}>{count > 99 ? "99+" : count}</div>
  );
}

export default function NetworkMessages() {
  const [activeTab, setActiveTab] = useState("chat");
  const [selectedConv, setSelectedConv] = useState(MOCK_CONVERSATIONS[0]);
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [hoveredMsg, setHoveredMsg] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [typing, setTyping] = useState(false);
  const [showFindPlayers, setShowFindPlayers] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [notification, setNotification] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Simulate typing indicator
  useEffect(() => {
    if (selectedConv?.id === 1) {
      const t = setTimeout(() => setTyping(true), 2000);
      const t2 = setTimeout(() => setTyping(false), 5000);
      return () => { clearTimeout(t); clearTimeout(t2); };
    }
  }, [selectedConv]);

  const showNotif = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    const newMsg = {
      id: messages.length + 1,
      from: "Me", fromId: 1, avatar: "ME", color: COLORS.accent,
      text: input.trim(), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      mine: true, read: false, reactions: [],
    };
    setMessages([...messages, newMsg]);
    setInput("");
    inputRef.current?.focus();
  };

  const addReaction = (msgId, emoji) => {
    setMessages(messages.map(m => {
      if (m.id !== msgId) return m;
      const existing = m.reactions.find(r => r.emoji === emoji);
      if (existing) {
        return { ...m, reactions: m.reactions.map(r => r.emoji === emoji ? { ...r, count: r.count + 1 } : r) };
      }
      return { ...m, reactions: [...m.reactions, { emoji, count: 1 }] };
    }));
    setShowReactionPicker(null);
  };

  const deleteMessage = (msgId) => {
    setMessages(messages.filter(m => m.id !== msgId));
  };

  const filteredConvs = MOCK_CONVERSATIONS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredFriends = MOCK_FRIENDS.filter(f =>
    f.name.toLowerCase().includes(friendSearch.toLowerCase()) ||
    f.email.toLowerCase().includes(friendSearch.toLowerCase())
  );

  const tabs = [
    { id: "chat", label: "Chat", count: MOCK_CONVERSATIONS.reduce((a, c) => a + c.unread, 0) },
    { id: "friends", label: "Friends", count: MOCK_FRIENDS.length },
    { id: "requests", label: "Requests", count: 2 },
  ];

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      display: "flex", flexDirection: "column",
      height: "100vh", background: COLORS.bg,
      position: "relative",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Toast notification */}
      {notification && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 1000,
          background: COLORS.text, color: "#fff", borderRadius: 12,
          padding: "12px 20px", fontSize: 14, fontWeight: 500,
          boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
          animation: "slideIn 0.3s ease",
        }}>{notification}</div>
      )}

      {/* Header */}
      <div style={{
        padding: "16px 24px", background: COLORS.white,
        borderBottom: `1px solid ${COLORS.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: COLORS.accentLight, display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 20 }}>🎮</span>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>Network & Messages</div>
            <div style={{ fontSize: 13, color: COLORS.muted }}>
              <span style={{ color: COLORS.online, fontWeight: 600 }}>●</span>
              {" "}{MOCK_FRIENDS.filter(f => f.online).length} online · {MOCK_FRIENDS.length} friends · {MOCK_CONVERSATIONS.reduce((a, c) => a + c.unread, 0)} unread
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowNewGroup(true)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 10,
            border: `1.5px solid ${COLORS.border}`, background: COLORS.white,
            color: COLORS.text, fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}>
            <span>👥</span> New Group
          </button>
          <button onClick={() => setShowFindPlayers(!showFindPlayers)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 10,
            background: showFindPlayers ? COLORS.text : COLORS.accent,
            color: "#fff", fontSize: 14, fontWeight: 600,
            border: "none", cursor: "pointer",
          }}>
            <span>+</span> Find Players
          </button>
        </div>
      </div>

      {/* Find Players bar */}
      {showFindPlayers && (
        <div style={{
          padding: "12px 24px", background: "#fff",
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex", gap: 12, alignItems: "center",
        }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 10,
            background: COLORS.bg, borderRadius: 10, padding: "10px 14px",
            border: `1.5px solid ${COLORS.border}`,
          }}>
            <span style={{ color: COLORS.muted }}>🔍</span>
            <input
              value={playerSearch}
              onChange={e => setPlayerSearch(e.target.value)}
              placeholder="Search players by name or skill level..."
              style={{
                border: "none", background: "transparent", outline: "none",
                fontSize: 14, color: COLORS.text, flex: 1,
              }}
              autoFocus
            />
          </div>
          {playerSearch && (
            <div style={{
              position: "absolute", top: 120, left: 24, right: 24, zIndex: 50,
              background: "#fff", border: `1.5px solid ${COLORS.border}`,
              borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.1)",
              overflow: "hidden",
            }}>
              {MOCK_FRIENDS.map(f => (
                <div key={f.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px", cursor: "pointer",
                  borderBottom: `1px solid ${COLORS.border}`,
                  transition: "background 0.1s",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = COLORS.hover}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <Avatar initials={f.avatar} color={f.color} size={40} online={f.online} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>{f.skill} · {f.email}</div>
                  </div>
                  <button onClick={() => showNotif(`Friend request sent to ${f.name}!`)} style={{
                    padding: "6px 14px", borderRadius: 8,
                    background: COLORS.accent, color: "#fff",
                    border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}>Add Friend</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left Sidebar */}
        <div style={{
          width: 320, background: COLORS.white,
          borderRight: `1px solid ${COLORS.border}`,
          display: "flex", flexDirection: "column", flexShrink: 0,
        }}>
          {/* Tabs */}
          <div style={{ padding: "12px 16px 0", borderBottom: `1px solid ${COLORS.border}` }}>
            <div style={{ display: "flex", gap: 4 }}>
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 6, padding: "8px 10px",
                  borderRadius: "8px 8px 0 0", border: "none",
                  background: activeTab === tab.id ? COLORS.bg : "transparent",
                  color: activeTab === tab.id ? COLORS.text : COLORS.muted,
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  fontSize: 13, cursor: "pointer",
                  borderBottom: activeTab === tab.id ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {tab.label}
                  {tab.count > 0 && (
                    <span style={{
                      background: activeTab === tab.id ? COLORS.accent : COLORS.border,
                      color: activeTab === tab.id ? "#fff" : COLORS.muted,
                      borderRadius: 999, fontSize: 11, fontWeight: 700,
                      padding: "1px 7px",
                    }}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div style={{ padding: "12px 16px" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: COLORS.bg, borderRadius: 10,
              padding: "9px 13px", border: `1.5px solid ${COLORS.border}`,
            }}>
              <span style={{ color: COLORS.muted, fontSize: 15 }}>🔍</span>
              <input
                value={activeTab === "friends" ? friendSearch : search}
                onChange={e => activeTab === "friends" ? setFriendSearch(e.target.value) : setSearch(e.target.value)}
                placeholder={`Search ${activeTab}...`}
                style={{
                  border: "none", background: "transparent", outline: "none",
                  fontSize: 13, color: COLORS.text, flex: 1,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
            </div>
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {activeTab === "chat" && (
              <div>
                {filteredConvs.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
                    <div style={{ fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>No conversations yet</div>
                    <div style={{ fontSize: 13, color: COLORS.muted }}>Find players above to start chatting</div>
                  </div>
                ) : filteredConvs.map(conv => (
                  <div key={conv.id}
                    onClick={() => setSelectedConv(conv)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 16px", cursor: "pointer",
                      background: selectedConv?.id === conv.id ? COLORS.accentLight : "transparent",
                      borderLeft: selectedConv?.id === conv.id ? `3px solid ${COLORS.accent}` : "3px solid transparent",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { if (selectedConv?.id !== conv.id) e.currentTarget.style.background = COLORS.hover; }}
                    onMouseLeave={e => { if (selectedConv?.id !== conv.id) e.currentTarget.style.background = "transparent"; }}
                  >
                    <Avatar initials={conv.avatar} color={conv.color} size={44} online={conv.online} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: conv.unread ? 700 : 600, fontSize: 14, color: COLORS.text }}>{conv.name}</div>
                        <div style={{ fontSize: 11, color: COLORS.muted }}>{conv.time}</div>
                      </div>
                      <div style={{
                        fontSize: 12, color: conv.unread ? COLORS.text : COLORS.muted,
                        fontWeight: conv.unread ? 600 : 400,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        marginTop: 2,
                      }}>{conv.lastMessage}</div>
                    </div>
                    {conv.unread > 0 && <Badge count={conv.unread} />}
                  </div>
                ))}
              </div>
            )}

            {activeTab === "friends" && (
              <div>
                <div style={{ padding: "8px 16px 4px", fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1 }}>
                  Online — {filteredFriends.filter(f => f.online).length}
                </div>
                {filteredFriends.map(friend => (
                  <div key={friend.id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 16px", cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = COLORS.hover}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <Avatar initials={friend.avatar} color={friend.color} size={40} online={friend.online} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text }}>{friend.name}</div>
                      <div style={{ fontSize: 12, color: COLORS.muted }}>{friend.skill} · {friend.online ? "Online" : "Offline"}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => { setSelectedConv(MOCK_CONVERSATIONS.find(c => c.name === friend.name) || MOCK_CONVERSATIONS[0]); setActiveTab("chat"); }}
                        style={{
                          padding: "5px 12px", borderRadius: 8,
                          background: COLORS.accent, color: "#fff",
                          border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        }}>Chat</button>
                      <button
                        onClick={() => showNotif(`${friend.name} unfriended`)}
                        style={{
                          padding: "5px 10px", borderRadius: 8,
                          background: COLORS.bg, color: COLORS.muted,
                          border: `1px solid ${COLORS.border}`, fontSize: 12, cursor: "pointer",
                        }}>···</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "requests" && (
              <div style={{ padding: "12px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                  Incoming — 2
                </div>
                {[{ name: "Jordan Kim", avatar: "JK", color: "#14B8A6", skill: "Advanced" },
                  { name: "Riley Park", avatar: "RP", color: "#F59E0B", skill: "Intermediate" }].map((req, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", borderRadius: 12,
                    border: `1.5px solid ${COLORS.border}`, marginBottom: 8,
                    background: COLORS.white,
                  }}>
                    <Avatar initials={req.avatar} color={req.color} size={40} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{req.name}</div>
                      <div style={{ fontSize: 12, color: COLORS.muted }}>{req.skill}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => showNotif(`Accepted ${req.name}'s request!`)} style={{
                        padding: "6px 12px", borderRadius: 8,
                        background: COLORS.accent, color: "#fff",
                        border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}>Accept</button>
                      <button onClick={() => showNotif(`Declined`)} style={{
                        padding: "6px 10px", borderRadius: 8,
                        background: COLORS.bg, color: COLORS.muted,
                        border: `1px solid ${COLORS.border}`, fontSize: 12, cursor: "pointer",
                      }}>✕</button>
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, margin: "16px 0 8px" }}>
                  Sent — 1
                </div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 12,
                  border: `1.5px solid ${COLORS.border}`,
                  background: COLORS.white,
                }}>
                  <Avatar initials="TW" color="#64748B" size={40} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Taylor Wong</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>Beginner</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: COLORS.muted,
                      background: COLORS.bg, padding: "3px 10px", borderRadius: 6,
                      border: `1px solid ${COLORS.border}`,
                    }}>Pending</span>
                    <button onClick={() => showNotif("Request revoked")} style={{
                      background: "none", border: "none", color: COLORS.muted,
                      fontSize: 16, cursor: "pointer",
                    }}>✕</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        {selectedConv ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Thread header */}
            <div style={{
              padding: "14px 20px", background: COLORS.white,
              borderBottom: `1px solid ${COLORS.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <Avatar initials={selectedConv.avatar} color={selectedConv.color} size={40} online={selectedConv.online} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{selectedConv.name}</div>
                  <div style={{ fontSize: 12, color: selectedConv.online ? COLORS.online : COLORS.muted, fontWeight: 500 }}>
                    {typing ? (
                      <span style={{ color: COLORS.accent }}>typing...</span>
                    ) : selectedConv.online ? "Online" : "Last seen 3h ago"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { icon: "🔍", label: "Search" },
                  { icon: "📌", label: "Pin" },
                  { icon: "🔔", label: "Mute" },
                  { icon: "⚙️", label: "Settings" },
                ].map(btn => (
                  <button key={btn.label} title={btn.label} onClick={() => showNotif(`${btn.label} clicked`)} style={{
                    width: 36, height: 36, borderRadius: 9,
                    background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                    fontSize: 15, cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center",
                  }}>{btn.icon}</button>
                ))}
              </div>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: "auto", padding: "20px",
              display: "flex", flexDirection: "column", gap: 2,
              background: COLORS.bg,
            }}>
              {/* Date divider */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                margin: "8px 0 16px",
              }}>
                <div style={{ flex: 1, height: 1, background: COLORS.border }} />
                <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600, whiteSpace: "nowrap" }}>Today</span>
                <div style={{ flex: 1, height: 1, background: COLORS.border }} />
              </div>

              {messages.map((msg, idx) => {
                const showAvatar = !msg.mine && (idx === 0 || messages[idx - 1].mine || messages[idx - 1].fromId !== msg.fromId);
                return (
                  <div key={msg.id}
                    style={{
                      display: "flex", flexDirection: msg.mine ? "row-reverse" : "row",
                      alignItems: "flex-end", gap: 8,
                      marginBottom: msg.reactions.length ? 12 : 4,
                      position: "relative",
                    }}
                    onMouseEnter={() => setHoveredMsg(msg.id)}
                    onMouseLeave={() => { setHoveredMsg(null); setShowReactionPicker(null); }}
                  >
                    {!msg.mine && (
                      <div style={{ width: 32, flexShrink: 0 }}>
                        {showAvatar && <Avatar initials={msg.avatar} color={msg.color} size={32} />}
                      </div>
                    )}
                    <div style={{ maxWidth: "65%", display: "flex", flexDirection: "column", alignItems: msg.mine ? "flex-end" : "flex-start" }}>
                      {!msg.mine && showAvatar && (
                        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, marginBottom: 3, paddingLeft: 4 }}>
                          {msg.from}
                        </div>
                      )}
                      <div style={{ position: "relative", display: "inline-block" }}>
                        <div style={{
                          padding: "10px 14px",
                          background: msg.mine ? COLORS.bubbleOwn : COLORS.white,
                          color: msg.mine ? "#fff" : COLORS.text,
                          borderRadius: msg.mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                          fontSize: 14, lineHeight: 1.5,
                          boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
                          border: msg.mine ? "none" : `1px solid ${COLORS.border}`,
                        }}>
                          {msg.text}
                        </div>
                        {/* Hover actions */}
                        {hoveredMsg === msg.id && (
                          <div style={{
                            position: "absolute", top: -36,
                            [msg.mine ? "left" : "right"]: 0,
                            display: "flex", gap: 4,
                            background: "#fff", borderRadius: 10,
                            border: `1px solid ${COLORS.border}`,
                            padding: "4px 6px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                            zIndex: 10,
                          }}>
                            <button onClick={() => setShowReactionPicker(msg.id)} style={{
                              background: "none", border: "none", fontSize: 16,
                              cursor: "pointer", padding: "2px 4px", borderRadius: 6,
                            }} title="React">😊</button>
                            <button onClick={() => setInput(`Replying to: "${msg.text.slice(0, 30)}..." — `)} style={{
                              background: "none", border: "none", fontSize: 16,
                              cursor: "pointer", padding: "2px 4px", borderRadius: 6,
                            }} title="Reply">↩️</button>
                            {msg.mine && (
                              <button onClick={() => deleteMessage(msg.id)} style={{
                                background: "none", border: "none", fontSize: 16,
                                cursor: "pointer", padding: "2px 4px", borderRadius: 6,
                              }} title="Delete">🗑️</button>
                            )}
                          </div>
                        )}
                        {/* Reaction picker */}
                        {showReactionPicker === msg.id && (
                          <div style={{
                            position: "absolute", top: -80,
                            [msg.mine ? "left" : "right"]: 0,
                            background: "#fff", borderRadius: 12,
                            border: `1px solid ${COLORS.border}`,
                            padding: "8px 10px",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                            display: "flex", gap: 6, zIndex: 20,
                          }}>
                            {EMOJIS.map(e => (
                              <button key={e} onClick={() => addReaction(msg.id, e)} style={{
                                background: "none", border: "none",
                                fontSize: 20, cursor: "pointer", padding: 2,
                                transition: "transform 0.1s",
                              }}
                                onMouseEnter={el => el.currentTarget.style.transform = "scale(1.3)"}
                                onMouseLeave={el => el.currentTarget.style.transform = "scale(1)"}
                              >{e}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Reactions */}
                      {msg.reactions.length > 0 && (
                        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                          {msg.reactions.map(r => (
                            <div key={r.emoji} onClick={() => addReaction(msg.id, r.emoji)} style={{
                              background: "#fff", border: `1.5px solid ${COLORS.border}`,
                              borderRadius: 999, padding: "2px 8px",
                              fontSize: 13, cursor: "pointer",
                              display: "flex", alignItems: "center", gap: 4,
                            }}>
                              {r.emoji} <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted }}>{r.count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Timestamp + read receipt */}
                      <div style={{ fontSize: 11, color: COLORS.mutedLight, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                        {msg.time}
                        {msg.mine && (
                          <span style={{ color: msg.read ? COLORS.accent : COLORS.mutedLight }}>
                            {msg.read ? "✓✓" : "✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {typing && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                  <Avatar initials={selectedConv.avatar} color={selectedConv.color} size={28} />
                  <div style={{
                    background: COLORS.white, borderRadius: "18px 18px 18px 4px",
                    padding: "10px 16px", border: `1px solid ${COLORS.border}`,
                    display: "flex", gap: 4, alignItems: "center",
                  }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: COLORS.muted,
                        animation: `bounce 1.2s ${i * 0.2}s infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div style={{
              padding: "14px 20px", background: COLORS.white,
              borderTop: `1px solid ${COLORS.border}`,
            }}>
              {/* Emoji picker */}
              {showEmoji && (
                <div style={{
                  marginBottom: 10, padding: "10px 12px",
                  background: COLORS.bg, borderRadius: 12,
                  border: `1.5px solid ${COLORS.border}`,
                  display: "flex", flexWrap: "wrap", gap: 8,
                }}>
                  {["😀","😂","🔥","🎮","👍","❤️","😮","🏆","💪","🎯","⚡","🤝","🙌","👊","😎"].map(e => (
                    <button key={e} onClick={() => setInput(prev => prev + e)} style={{
                      background: "none", border: "none", fontSize: 22, cursor: "pointer",
                    }}>{e}</button>
                  ))}
                </div>
              )}
              <div style={{
                display: "flex", alignItems: "flex-end", gap: 10,
                background: COLORS.bg, borderRadius: 14,
                border: `1.5px solid ${COLORS.border}`,
                padding: "8px 12px",
              }}>
                <button onClick={() => setShowEmoji(!showEmoji)} title="Emoji" style={{
                  background: "none", border: "none", fontSize: 20,
                  cursor: "pointer", padding: "4px", borderRadius: 8,
                  color: showEmoji ? COLORS.accent : COLORS.muted,
                }}>😊</button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                  }}
                  placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                  rows={1}
                  style={{
                    flex: 1, border: "none", background: "transparent",
                    outline: "none", resize: "none", fontSize: 14,
                    color: COLORS.text, fontFamily: "'DM Sans', sans-serif",
                    lineHeight: 1.5, maxHeight: 120, overflowY: "auto",
                  }}
                />
                <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                  <button title="Attach file" onClick={() => showNotif("File sharing coming soon!")} style={{
                    background: "none", border: "none", fontSize: 18,
                    cursor: "pointer", color: COLORS.muted, padding: "4px",
                  }}>📎</button>
                  <button title="Send match invite" onClick={() => showNotif("Match invite sent!")} style={{
                    background: "none", border: "none", fontSize: 18,
                    cursor: "pointer", color: COLORS.muted, padding: "4px",
                  }}>🎮</button>
                  <button onClick={sendMessage} disabled={!input.trim()} style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: input.trim() ? COLORS.accent : COLORS.border,
                    border: "none", cursor: input.trim() ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, transition: "all 0.15s", flexShrink: 0,
                  }}>
                    <span style={{ color: "#fff" }}>↑</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: COLORS.bg, gap: 16,
          }}>
            <div style={{ fontSize: 64 }}>💬</div>
            <div style={{ fontWeight: 700, fontSize: 20, color: COLORS.text }}>Select a conversation</div>
            <div style={{ fontSize: 14, color: COLORS.muted }}>Choose from your conversations or find a player</div>
            <button onClick={() => setShowFindPlayers(true)} style={{
              marginTop: 8, padding: "10px 24px", borderRadius: 12,
              background: COLORS.accent, color: "#fff",
              border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>+ Find Players</button>
          </div>
        )}
      </div>

      {/* New Group Dialog */}
      {showNewGroup && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 100,
        }} onClick={() => setShowNewGroup(false)}>
          <div style={{
            background: "#fff", borderRadius: 20, padding: 28,
            width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Create New Group</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.muted, marginBottom: 6 }}>GROUP NAME</div>
            <input
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="e.g. Friday Night Squad"
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10,
                border: `1.5px solid ${COLORS.border}`, fontSize: 14,
                outline: "none", marginBottom: 16, boxSizing: "border-box",
                fontFamily: "'DM Sans', sans-serif",
              }}
            />
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.muted, marginBottom: 8 }}>ADD FRIENDS</div>
            {MOCK_FRIENDS.map(f => (
              <div key={f.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "8px 0", borderBottom: `1px solid ${COLORS.border}`,
              }}>
                <Avatar initials={f.avatar} color={f.color} size={36} online={f.online} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</div>
                </div>
                <input type="checkbox"
                  checked={selectedGroup.includes(f.id)}
                  onChange={() => setSelectedGroup(prev =>
                    prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id]
                  )}
                  style={{ width: 18, height: 18, accentColor: COLORS.accent, cursor: "pointer" }}
                />
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowNewGroup(false)} style={{
                flex: 1, padding: "10px", borderRadius: 10,
                border: `1.5px solid ${COLORS.border}`, background: "transparent",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>Cancel</button>
              <button onClick={() => { showNotif(`Group "${groupName || "New Group"}" created!`); setShowNewGroup(false); setGroupName(""); setSelectedGroup([]); }} style={{
                flex: 1, padding: "10px", borderRadius: 10,
                background: COLORS.accent, color: "#fff",
                border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>Create Group</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
        @keyframes slideIn {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }
      `}</style>
    </div>
  );
}
