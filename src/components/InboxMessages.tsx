import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, AlertCircle, Trash2, Check, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { usePi } from '@/contexts/PiContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Message {
  id: string;
  sender_profile_id: string | null;
  receiver_profile_id: string;
  content: string;
  image_url?: string;
  is_read: boolean;
  created_at: string;
  sender_username?: string;
  sender_logo?: string;
}

interface InboxMessagesProps {
  receiverUsername: string;
}

export default function InboxMessages({ receiverUsername }: InboxMessagesProps) {
  const { isAuthenticated, piUser } = usePi();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && piUser?.username) {
      loadProfile();
    }
  }, [isAuthenticated, piUser]);

  useEffect(() => {
    if (profileId) {
      loadMessages();
      // Subscribe to new messages
      const channel = supabase
        .channel(`inbox-messages-${profileId}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_profile_id=eq.${profileId}`
          },
          (payload) => {
            console.log('New message:', payload);
            loadMessages();
            toast.info('New message received!');
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profileId]);

  const loadProfile = async () => {
    if (!piUser?.username) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', piUser.username)
      .maybeSingle();
    
    if (profile) {
      setProfileId(profile.id);
    }
  };

  const loadMessages = async () => {
    if (!profileId) return;
    
    setLoading(true);
    try {
      // Fetch messages using type assertion
      const { data, error } = await (supabase
        .from('messages' as any)
        .select('*')
        .eq('receiver_profile_id', profileId)
        .order('created_at', { ascending: false }) as any);

      if (error) throw error;

      // Fetch sender profiles for each message
      const messagesWithSenders = await Promise.all(
        (data || []).map(async (msg: any) => {
          if (msg.sender_profile_id) {
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('username, logo')
              .eq('id', msg.sender_profile_id)
              .maybeSingle();
            
            return {
              ...msg,
              sender_username: senderProfile?.username || 'Anonymous',
              sender_logo: senderProfile?.logo
            };
          }
          return { ...msg, sender_username: 'Anonymous' };
        })
      );

      setMessages(messagesWithSenders);
    } catch (error) {
      console.error('Failed to load messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      const { error } = await (supabase
        .from('messages' as any)
        .update({ is_read: true })
        .eq('id', messageId) as any);

      if (error) throw error;

      setMessages(prev => 
        prev.map(m => m.id === messageId ? { ...m, is_read: true } : m)
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm('Delete this message?')) return;
    
    try {
      const { error } = await (supabase
        .from('messages' as any)
        .delete()
        .eq('id', messageId) as any);

      if (error) throw error;

      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast.success('Message deleted');
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.error('Failed to delete message');
    }
  };

  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Inbox Messages
          </CardTitle>
          <CardDescription>
            View and manage messages from your followers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please sign in with Pi Network to view your messages.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const unreadCount = messages.filter(m => !m.is_read).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Inbox Messages
              {unreadCount > 0 && (
                <Badge variant="destructive">{unreadCount} new</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Messages for @{receiverUsername || piUser?.username}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadMessages}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No messages yet</p>
            <p className="text-sm">Messages from your followers will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`p-4 rounded-lg border ${
                  message.is_read ? 'bg-muted/30' : 'bg-primary/5 border-primary/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Avatar
                    className="h-10 w-10 cursor-pointer"
                    onClick={() => {
                      if (message.sender_username) {
                        navigate(`/@${message.sender_username}`);
                      }
                    }}
                  >
                    <AvatarImage src={message.sender_logo} />
                    <AvatarFallback>
                      {message.sender_username?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="font-medium cursor-pointer"
                        onClick={() => {
                          if (message.sender_username) {
                            navigate(`/@${message.sender_username}`);
                          }
                        }}
                      >
                        @{message.sender_username || 'Anonymous'}
                      </span>
                      {!message.is_read && (
                        <Badge variant="secondary" className="text-xs">New</Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                    {message.image_url && (
                      <div className="mt-2">
                        <img 
                          src={message.image_url} 
                          alt="Message attachment"
                          className="max-h-48 rounded-lg border"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      {!message.is_read && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => markAsRead(message.id)}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Mark as read
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMessage(message.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
