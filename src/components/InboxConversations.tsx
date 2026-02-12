import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, RefreshCw, ChevronLeft, Plus, Users } from 'lucide-react';
import { usePi } from '@/contexts/PiContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { uploadImage, STORAGE_BUCKETS } from '@/lib/supabase-storage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Conversation {
  type: 'direct' | 'group';
  id: string; // userId or groupId
  name: string; // username or group name
  avatar?: string;
  subtext?: string; // business name or group desc
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  // Extra for direct
  otherUserId?: string;
  isOnline?: boolean;
}

export default function InboxConversations() {
  const navigate = useNavigate();
  const { piUser, isAuthenticated } = usePi();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{
    id: string;
    username: string;
    business_name?: string | null;
    logo?: string | null;
  }>>([]);
  const searchTimeoutRef = useRef<number | null>(null);
  const [onlineProfileIds, setOnlineProfileIds] = useState<Set<string>>(new Set());
  const ONLINE_WINDOW_MS = 5 * 60 * 1000;
  
  // Create Group State
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupAvatar, setNewGroupAvatar] = useState<File | null>(null);
  const [newGroupAvatarPreview, setNewGroupAvatarPreview] = useState<string | null>(null);
  const [newGroupThemeColor, setNewGroupThemeColor] = useState('#3b82f6');

  const handleGroupAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setNewGroupAvatar(file);
    const reader = new FileReader();
    reader.onloadend = () => setNewGroupAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearGroupAvatar = () => {
    setNewGroupAvatar(null);
    setNewGroupAvatarPreview(null);
  };

  useEffect(() => {
    if (isAuthenticated && piUser?.username) {
      loadProfile();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, piUser]);

  useEffect(() => {
    if (profileId) {
      loadConversations();

      // Subscribe to new messages (Direct)
      const channel = supabase
        .channel('inbox-conversations')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_profile_id=eq.${profileId}`
          },
          () => loadConversations()
        )
        .subscribe();
        
      // Subscribe to new messages (Group) - Ideally we subscribe to all groups, but for now global or reload
      // A better approach for groups is to subscribe to messages where group_id is in user's groups
      // For simplicity, we'll just rely on the manual refresh or global events if feasible, 
      // or we can subscribe to 'messages' globally and filter client side (not efficient but works for small scale)
      const groupChannel = supabase
        .channel('inbox-groups')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
          },
          (payload) => {
             if (payload.new.group_id) {
                 // Check if we are in this group (optimization: check if group_id is in our known groups)
                 // For now just reload
                 loadConversations();
             }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(groupChannel);
      };
    }
  }, [profileId]);

  useEffect(() => {
    const channel = supabase.channel('presence-global', {
      config: {
        presence: {
          key: profileId || `viewer-${Date.now()}`
        }
      }
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const next = new Set<string>();
      Object.keys(state || {}).forEach((key) => {
        if (key) next.add(key);
      });
      setOnlineProfileIds(next);
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId]);

  const isProfileOnline = (profileId?: string | null, lastActiveAt?: string | null) => {
    if (!profileId) return false;
    if (onlineProfileIds.has(profileId)) return true;
    if (!lastActiveAt) return false;
    const lastActiveMs = new Date(lastActiveAt).getTime();
    if (!Number.isFinite(lastActiveMs)) return false;
    return Date.now() - lastActiveMs <= ONLINE_WINDOW_MS;
  };

  useEffect(() => {
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }

    const query = searchQuery.trim().replace(/^@/, '');
    if (!query) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    searchTimeoutRef.current = window.setTimeout(() => {
      runUserSearch(query);
    }, 250);

    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const loadProfile = async () => {
    if (!piUser?.username) return;
    
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', piUser.username)
        .maybeSingle();

      if (error) {
        console.error('[InboxConversations] Error loading profile:', error);
        toast.error("Failed to load user profile");
        setLoading(false);
        return;
      }

      if (profile) {
        setProfileId(profile.id);
      } else {
        console.warn('[InboxConversations] No profile found for username:', piUser.username);
        setLoading(false);
      }
    } catch (err) {
      console.error('[InboxConversations] Unexpected error loading profile:', err);
      setLoading(false);
    }
  };

  const runUserSearch = async (query: string) => {
    if (!query || !isAuthenticated) return;

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, business_name, logo')
        .or(`username.ilike.%${query}%,business_name.ilike.%${query}%`)
        .order('username', { ascending: true })
        .limit(8);

      if (error) throw error;

      const filtered = (data || []).filter((p) => p.username && p.username !== piUser?.username);
      setSearchResults(filtered);
    } catch (error) {
      console.error('[InboxConversations] Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const loadConversations = async () => {
    if (!profileId) {
      console.warn('[InboxConversations] Cannot load conversations: profileId is missing');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch Direct Messages
      const { data: messages, error } = await (supabase
        .from('messages' as any)
        .select('*')
        .or(`sender_profile_id.eq.${profileId},receiver_profile_id.eq.${profileId}`)
        .is('group_id', null) // Only direct messages
        .order('created_at', { ascending: false }) as any);

      if (error) {
        console.error('[InboxConversations] Supabase error fetching messages:', error);
        throw error;
      }

      const directMap = new Map<string, any>();

      // Optimize: Gather all unique user IDs first to fetch profiles in batch
      const otherUserIds = new Set<string>();
      for (const msg of (messages as any[]) || []) {
        const otherUserId = msg.sender_profile_id === profileId
          ? msg.receiver_profile_id
          : msg.sender_profile_id;
        if (otherUserId) otherUserIds.add(otherUserId);
      }

      // Fetch all relevant profiles in one go
      let profilesMap = new Map<string, any>();
      if (otherUserIds.size > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, logo, business_name, last_active_at')
          .in('id', Array.from(otherUserIds));
        
        if (!profilesError && profiles) {
          profiles.forEach(p => profilesMap.set(p.id, p));
        }
      }

      for (const msg of (messages as any[]) || []) {
        const otherUserId = msg.sender_profile_id === profileId
          ? msg.receiver_profile_id
          : msg.sender_profile_id;

        if (!otherUserId) continue;

        if (!directMap.has(otherUserId)) {
          const otherProfile = profilesMap.get(otherUserId);
          
          // Still need to fetch unread count separately or use a different approach
          // For now, let's keep it per-user but handle errors gracefully
          let unreadCount = 0;
          try {
             const { count } = await (supabase
              .from('messages' as any)
              .select('*', { count: 'exact', head: true })
              .eq('sender_profile_id', otherUserId)
              .eq('receiver_profile_id', profileId)
              .eq('is_read', false) as any);
             unreadCount = count || 0;
          } catch (e) {
            console.warn(`[Inbox] Failed to fetch unread count for ${otherUserId}`, e);
          }

          directMap.set(otherUserId, {
            type: 'direct',
            id: otherUserId, // For navigation /chat/:username
            name: otherProfile?.username || 'Anonymous',
            avatar: otherProfile?.logo || '',
            subtext: otherProfile?.business_name || '',
            lastMessage: msg.content || (msg.image_url ? 'Sent an image' : ''),
            lastMessageTime: msg.created_at,
            unreadCount: unreadCount,
            otherUserId: otherUserId,
            isOnline: isProfileOnline(otherUserId, otherProfile?.last_active_at)
          });
        }
      }

      // 2. Fetch Groups
      const { data: groupMembers, error: groupError } = await supabase
        .from('group_members')
        .select('group_id, groups(id, name, avatar_url, description)')
        .eq('profile_id', profileId);

      if (groupError) {
        console.error('[InboxConversations] Supabase error fetching groups:', groupError);
        // Don't throw, just continue with direct messages
      }

      const groupConversations: Conversation[] = [];

      for (const gm of groupMembers || []) {
        const group = gm.groups;
        if (!group) continue;
        
        // Fetch last message for this group
        const { data: lastMsg } = await supabase
          .from('messages' as any)
          .select('*')
          .eq('group_id', group.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        groupConversations.push({
            type: 'group',
            id: group.id,
            name: group.name,
            avatar: group.avatar_url,
            subtext: group.description,
            lastMessage: lastMsg ? (lastMsg.content || 'Sent an image') : 'No messages yet',
            lastMessageTime: lastMsg ? lastMsg.created_at : gm.created_at || new Date().toISOString(),
            unreadCount: 0 
        });
      }

      const allConversations = [...directMap.values(), ...groupConversations];
      // Sort by last message time
      allConversations.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());

      setConversations(allConversations);
    } catch (error) {
      console.error('[InboxConversations] Failed to load conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!profileId) {
      toast.error("Profile not loaded");
      return;
    }
    if (!newGroupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }
    
    setCreatingGroup(true);
    try {
        let avatarUrl: string | null = null;
        if (newGroupAvatar) {
          const uploaded = await uploadImage(
            newGroupAvatar,
            STORAGE_BUCKETS.PROFILE_IMAGES,
            `groups/${profileId}`
          );
          avatarUrl = uploaded?.url || null;
        }

        // 1. Create Group
        const { data: group, error: createError } = await supabase
            .from('groups' as any)
            .insert({
                name: newGroupName.trim(),
                description: newGroupDescription.trim() || null,
                created_by: profileId,
                avatar_url: avatarUrl,
                theme_color: newGroupThemeColor
            })
            .select()
            .single();
            
        if (createError) throw createError;
        
        // 2. Add Creator as Member (Admin)
        const { error: memberError } = await supabase
            .from('group_members')
            .insert({
                group_id: group.id,
                profile_id: profileId,
                role: 'admin'
            });
            
        if (memberError) throw memberError;
        
        toast.success('Group created!');
        setNewGroupName('');
        setNewGroupDescription('');
        setNewGroupThemeColor('#3b82f6');
        clearGroupAvatar();
        setIsCreateGroupOpen(false);
        loadConversations();
        
    } catch (error) {
        console.error('Failed to create group:', error);
        toast.error('Failed to create group');
    } finally {
        setCreatingGroup(false);
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (conv.subtext && conv.subtext.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="w-full max-w-5xl mx-auto min-h-screen bg-background text-foreground pb-24">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md pt-4 pb-2 px-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => navigate('/dashboard')}>
               <ChevronLeft className="h-6 w-6" />
            </Button>
            <div className="cursor-pointer" onClick={() => navigate('/profile')}>
              <h1 className="text-xl font-bold">{piUser?.username || 'Messages'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Plus className="h-6 w-6" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Group</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="group-avatar">Group Profile</Label>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={newGroupAvatarPreview || ''} />
                        <AvatarFallback><Users className="h-5 w-5" /></AvatarFallback>
                      </Avatar>
                      <div className="flex gap-2">
                        <Input
                          id="group-avatar"
                          type="file"
                          accept="image/*"
                          onChange={handleGroupAvatarSelect}
                        />
                        {newGroupAvatarPreview && (
                          <Button type="button" variant="outline" onClick={clearGroupAvatar}>
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Upload a group profile image (optional).</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Group Name</Label>
                    <Input 
                        id="name" 
                        placeholder="Enter group name" 
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="group-theme">Theme Color</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="group-theme"
                        type="color"
                        value={newGroupThemeColor}
                        onChange={(e) => setNewGroupThemeColor(e.target.value)}
                        className="h-10 w-16 p-1"
                      />
                      <span className="text-xs text-muted-foreground">Applies to group chat accents.</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea 
                        id="description" 
                        placeholder="What's this group about?" 
                        value={newGroupDescription}
                        onChange={(e) => setNewGroupDescription(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateGroup} disabled={creatingGroup}>
                    {creatingGroup ? 'Creating...' : 'Create Group'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadConversations}>
               <RefreshCw className={`h-6 w-6 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted/50 border-none rounded-xl h-9"
          />
        </div>

        {searchQuery.trim() && (
          <div className="mb-3 rounded-xl border bg-background shadow-sm">
             {/* Search Results rendering (simplified from original) */}
             {searchResults.length > 0 && (
                 <div className="divide-y">
                    {searchResults.map((profile) => (
                      <button
                        key={profile.id}
                        onClick={() => navigate(`/chat/${profile.username}`)}
                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30"
                      >
                         <Avatar className="h-8 w-8"><AvatarImage src={profile.logo || ''} /><AvatarFallback>?</AvatarFallback></Avatar>
                         <div>
                            <div className="font-medium">{profile.username}</div>
                         </div>
                      </button>
                    ))}
                 </div>
             )}
          </div>
        )}
      </div>

      <div className="pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No messages yet</p>
          </div>
        ) : (
          <div className="space-y-0">
            {filteredConversations.map((conversation) => {
              const isGroup = conversation.type === 'group';
              return (
              <div
                key={conversation.id}
                onClick={() => {
                    if (isGroup) {
                        navigate(`/chat/g/${conversation.id}`);
                    } else {
                        navigate(`/chat/${conversation.name}`);
                    }
                }}
                className="flex items-center gap-3 p-3 hover:bg-muted/30 active:bg-muted/50 cursor-pointer transition-colors"
              >
                <div className="relative">
                    <Avatar className="h-14 w-14">
                    <AvatarImage src={conversation.avatar} />
                    <AvatarFallback>
                        {isGroup ? <Users className="h-6 w-6" /> : (conversation.name[0]?.toUpperCase() || '?')}
                    </AvatarFallback>
                    </Avatar>
                    {!isGroup && (
                        <div
                        className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background ${
                            conversation.isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                        }`}
                        title={conversation.isOnline ? 'Online' : 'Offline'}
                        />
                    )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${conversation.unreadCount > 0 ? 'font-bold text-foreground' : 'font-medium text-foreground'}`}>
                      {conversation.subtext || conversation.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
                    {conversation.unreadCount > 0 ? (
                        <span className="font-bold text-foreground truncate">
                             {conversation.lastMessage}
                        </span>
                    ) : (
                        <span className="truncate">
                             {conversation.lastMessage}
                        </span>
                    )}
                    <span className="text-xs mx-1">•</span>
                    <span className="text-xs whitespace-nowrap">
                        {formatDistanceToNow(new Date(conversation.lastMessageTime), { addSuffix: false }).replace('about ', '').replace(' hours', 'h').replace(' minutes', 'm').replace(' days', 'd')}
                    </span>
                  </div>
                </div>

                {conversation.unreadCount > 0 && (
                  <div className="h-2.5 w-2.5 bg-blue-500 rounded-full flex-shrink-0 ml-2"></div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
