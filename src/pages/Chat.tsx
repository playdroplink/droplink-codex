import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePi } from '@/contexts/PiContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Image as ImageIcon, X, ArrowLeft, Mic, Video, Moon, Sun, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { uploadMessageImage, uploadMessageMedia } from '@/lib/supabase-storage';

interface Message {
  id: string;
  sender_profile_id: string | null;
  receiver_profile_id: string;
  content: string;
  image_url?: string;
  media_url?: string;
  media_type?: string;
  duration_ms?: number;
  is_read: boolean;
  created_at: string;
  sender_username?: string;
  sender_logo?: string;
}

export default function ChatPage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { piUser } = usePi();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [otherProfile, setOtherProfile] = useState<any>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const gifInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | null>(null);
  const [showMediaActions, setShowMediaActions] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<number | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (piUser?.username && username) {
      loadProfiles();
    }
  }, [piUser, username]);

  useEffect(() => {
    const saved = localStorage.getItem('inbox_theme_mode');
    setIsDarkMode(saved === 'dark');
  }, []);

  useEffect(() => {
    localStorage.setItem('inbox_theme_mode', isDarkMode ? 'dark' : 'light');
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    if (myProfileId && otherProfile?.id) {
      loadMessages();
      markMessagesAsRead();

      // Subscribe to new messages (both sender and receiver)
      const channel = supabase
        .channel(`chat-${myProfileId}-${otherProfile.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            const msg: any = payload.new;
            if (!msg) return;
            const isInThread =
              (msg.sender_profile_id === myProfileId && msg.receiver_profile_id === otherProfile.id) ||
              (msg.sender_profile_id === otherProfile.id && msg.receiver_profile_id === myProfileId);
            if (isInThread) {
              loadMessages();
            }
          }
        )
        .subscribe();

      // Typing indicator channel
      const typingChannel = supabase
        .channel(`typing-${myProfileId}-${otherProfile.id}`)
        .on('broadcast', { event: 'typing' }, (payload) => {
          if (payload?.payload?.senderId === otherProfile.id) {
            setShowTyping(payload.payload.isTyping === true);
          }
        })
        .subscribe();
      typingChannelRef.current = typingChannel;

      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(typingChannel);
        typingChannelRef.current = null;
      };
    }
  }, [myProfileId, otherProfile]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadProfiles = async () => {
    try {
      // Get my profile
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', piUser!.username)
        .single();

      if (myProfile) {
        setMyProfileId(myProfile.id);
      }

      // Get other user's profile
      const { data: otherUserProfile } = await supabase
        .from('profiles')
        .select('id, username, business_name, logo')
        .eq('username', username)
        .single();

      if (otherUserProfile) {
        setOtherProfile(otherUserProfile);
      } else {
        toast.error('User not found');
        navigate('/inbox');
      }
    } catch (error) {
      console.error('Failed to load profiles:', error);
      toast.error('Failed to load profiles');
    }
  };

  const loadMessages = async () => {
    if (!myProfileId || !otherProfile?.id) return;

    setLoading(true);
    try {
      // Fetch all messages between the two users
      const { data, error } = await supabase
        .from('messages' as any)
        .select('*')
        .or(`and(sender_profile_id.eq.${myProfileId},receiver_profile_id.eq.${otherProfile.id}),and(sender_profile_id.eq.${otherProfile.id},receiver_profile_id.eq.${myProfileId})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Add sender info
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

  const markMessagesAsRead = async () => {
    if (!myProfileId || !otherProfile?.id) return;

    try {
      await supabase
        .from('messages' as any)
        .update({ is_read: true })
        .eq('receiver_profile_id', myProfileId)
        .eq('sender_profile_id', otherProfile.id)
        .eq('is_read', false);
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearMedia = () => {
    setSelectedMedia(null);
    setMediaPreview(null);
    setMediaType(null);
    if (mediaInputRef.current) {
      mediaInputRef.current.value = '';
    }
  };

  const selectGif = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'image/gif') {
      toast.error('Please choose a GIF file');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('GIF must be less than 8MB');
      return;
    }
    setSelectedMedia(file);
    setMediaType('image');
    setMediaPreview(URL.createObjectURL(file));
    setShowMediaActions(false);
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');

    if (isImage && file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }
    if (isVideo && file.size > 20 * 1024 * 1024) {
      toast.error('Video must be less than 20MB');
      return;
    }
    if (isAudio && file.size > 10 * 1024 * 1024) {
      toast.error('Audio must be less than 10MB');
      return;
    }
    if (!isImage && !isVideo && !isAudio) {
      toast.error('Unsupported file type');
      return;
    }

    setSelectedMedia(file);
    setMediaType(isImage ? 'image' : isVideo ? 'video' : 'audio');
    const previewUrl = URL.createObjectURL(file);
    setMediaPreview(previewUrl);
    setShowMediaActions(false);
  };

  const startRecording = async () => {
    if (!window.isSecureContext) {
      toast.error('Voice recording needs HTTPS. You can upload an audio file instead.');
      audioInputRef.current?.click();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Voice recording not supported on this device. Choose an audio file.');
      audioInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = [
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/webm'
      ].find((mime) => MediaRecorder.isTypeSupported?.(mime));
      const recorder = preferredMimeType ? new MediaRecorder(stream, { mimeType: preferredMimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blobType = preferredMimeType || 'audio/webm';
        const extension = blobType.includes('mp4') ? 'm4a' : 'webm';
        const blob = new Blob(audioChunksRef.current, { type: blobType });
        const file = new File([blob], `voice-${Date.now()}.${extension}`, { type: blobType });
        setSelectedMedia(file);
        setMediaType('audio');
        setMediaPreview(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (error) {
      console.error('Voice record error:', error);
      toast.error('Unable to start recording. Choose an audio file instead.');
      audioInputRef.current?.click();
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const sendTypingStatus = async (typing: boolean) => {
    if (!myProfileId || !otherProfile?.id) return;
    setIsTyping(typing);
    const channel = typingChannelRef.current;
    if (!channel) return;
    await channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { senderId: myProfileId, isTyping: typing },
    });
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedImage && !selectedMedia) || !myProfileId || !otherProfile?.id) return;

    setSending(true);
    try {
      let imageUrl = null;
      let mediaUrl: string | null = null;
      let mediaTypeToSave: string | null = null;

      // Upload image if selected
      if (selectedImage) {
        setUploadingImage(true);
        try {
          imageUrl = await uploadMessageImage(selectedImage);
        } catch (error) {
          console.error('Failed to upload image:', error);
          toast.error('Failed to upload image');
          setUploadingImage(false);
          setSending(false);
          return;
        }
        setUploadingImage(false);
      }

      if (selectedMedia) {
        setUploadingImage(true);
        try {
          const uploaded = await uploadMessageMedia(selectedMedia, `chat/${myProfileId}`);
          mediaUrl = uploaded?.url || null;
          mediaTypeToSave = mediaType;
        } catch (error) {
          console.error('Failed to upload media:', error);
          toast.error('Failed to upload media');
          setUploadingImage(false);
          setSending(false);
          return;
        }
        setUploadingImage(false);
      }

      // Send message
      const { error } = await supabase
        .from('messages' as any)
        .insert({
          sender_profile_id: myProfileId,
          receiver_profile_id: otherProfile.id,
          content: newMessage.trim(),
          image_url: imageUrl || (mediaTypeToSave === 'image' ? mediaUrl : null),
          media_url: mediaUrl,
          media_type: mediaTypeToSave,
          is_read: false
        });

      if (error) throw error;

      setNewMessage('');
      clearImage();
      clearMedia();
      setShowMediaActions(false);
      setIsTyping(false);
      await loadMessages();
      toast.success('Message sent!');
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center px-4 py-3 bg-background/80 backdrop-blur-md border-b border-border/40">
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 mr-2"
          onClick={() => navigate('/inbox')}
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        
        <div
          className="flex items-center gap-3 flex-1 cursor-pointer"
          onClick={() => {
            if (otherProfile?.username) {
              navigate(`/@${otherProfile.username}`);
            }
          }}
          title="View public bio"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={otherProfile?.logo} />
            <AvatarFallback>
              {otherProfile?.username?.[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-none">
              {otherProfile?.business_name || otherProfile?.username}
            </span>
            <span className="text-xs text-muted-foreground">
              @{otherProfile?.username}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <Button
             variant="ghost"
             size="icon"
             className="h-8 w-8"
             onClick={() => setIsDarkMode((prev) => !prev)}
             title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
           >
             {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
           </Button>
           {/* Call/Video icons placeholder */}
           <Button variant="ghost" size="icon" className="h-8 w-8">
             <svg aria-label="Audio Call" className="x1lliihq x1n2onr6 x5n08af" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><path d="M18.227 22.138a1.26 1.26 0 0 1-.9-.37l-2.074-2.073a1.99 1.99 0 0 1-.585-1.413 2 2 0 0 1 .586-1.414l.823-.823a.355.355 0 0 0-.022-.522l-4.522-4.521a.355.355 0 0 0-.522.022l-.823.823a1.99 1.99 0 0 1-1.414.586 2 2 0 0 1-1.414-.586L5.297 9.773a1.26 1.26 0 0 1-.366-.893c0-.332.13-.65.366-.894L7.54 5.743a2.98 2.98 0 0 1 2.277-.992 15.65 15.65 0 0 1 7.234 3.033 15.66 15.66 0 0 1 3.033 7.233 2.98 2.98 0 0 1-.992 2.278l-2.247 2.246a1.26 1.26 0 0 1-.893.366l.006.23Zm-11.53-9.528 4.52 4.52a2.35 2.35 0 0 0 3.328 0l2.073 2.073c.473.472.473 1.238 0 1.71l-2.247 2.246a.98.98 0 0 1-.75.328 13.67 13.67 0 0 1-6.315-2.647 13.66 13.66 0 0 1-2.646-6.315.98.98 0 0 1 .328-.75l2.246-2.247a1.21 1.21 0 0 1 1.71 0l-2.247-2.914Z"></path></svg>
           </Button>
           <Button variant="ghost" size="icon" className="h-8 w-8">
             <svg aria-label="Video Call" className="x1lliihq x1n2onr6 x5n08af" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><path d="M18.775 6.225 7.225 17.775a.75.75 0 0 1-1.06 0L4.12 15.73a.75.75 0 0 1 0-1.06l11.55-11.55a.75.75 0 0 1 1.06 0l2.045 2.045a.75.75 0 0 1 0 1.06ZM22.5 12c0 5.799-4.701 10.5-10.5 10.5S1.5 17.799 1.5 12 6.201 1.5 12 1.5 22.5 6.201 22.5 12Z"></path></svg>
           </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={otherProfile?.logo} />
              <AvatarFallback className="text-4xl">
                {otherProfile?.username?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-xl">{otherProfile?.business_name || otherProfile?.username}</h3>
              <p className="text-muted-foreground">@{otherProfile?.username}</p>
              <p className="text-sm text-muted-foreground mt-2">You're friends on Droplink</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (otherProfile?.username) {
                  navigate(`/@${otherProfile.username}`);
                }
              }}
            >
              View Profile
            </Button>
          </div>
        ) : (
          messages.map((message, index) => {
            const isMyMessage = message.sender_profile_id === myProfileId;
            const showAvatar = !isMyMessage && (index === messages.length - 1 || messages[index + 1]?.sender_profile_id === myProfileId);
            const isLastMyMessage =
              isMyMessage &&
              messages
                .filter((m) => m.sender_profile_id === myProfileId)
                .at(-1)?.id === message.id;
            
            return (
              <div
                key={message.id}
                className={`flex w-full ${isMyMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-end max-w-[70%] gap-2 ${isMyMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                   {!isMyMessage && (
                     <div className="w-7 flex-shrink-0">
                       {showAvatar && (
                         <Avatar className="h-7 w-7">
                           <AvatarImage src={message.sender_logo} />
                           <AvatarFallback className="text-[10px]">
                             {message.sender_username?.[0]?.toUpperCase() || '?'}
                           </AvatarFallback>
                         </Avatar>
                       )}
                     </div>
                   )}

                   <div className="flex flex-col">
                    <div
                      className={`px-4 py-2 relative group ${
                        isMyMessage
                          ? 'bg-blue-500 text-white rounded-2xl rounded-br-sm'
                          : 'bg-zinc-200 dark:bg-zinc-800 text-foreground rounded-2xl rounded-bl-sm'
                      }`}
                    >
                      {message.content && (
                        <p className="text-[15px] whitespace-pre-wrap break-words leading-relaxed">
                          {message.content}
                        </p>
                      )}
                      {(message.image_url || (message.media_type === 'image' && message.media_url)) && (
                        <div className={`${message.content ? 'mt-2' : ''}`}>
                          <img
                            src={message.image_url || message.media_url || ''}
                            alt="Shared image"
                            className="rounded-lg max-h-64 w-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                            onClick={() => window.open(message.image_url || message.media_url || '', '_blank')}
                          />
                        </div>
                      )}
                      {message.media_type === 'video' && message.media_url && (
                        <div className={`${message.content ? 'mt-2' : ''}`}>
                          <video
                            src={message.media_url}
                            controls
                            className="rounded-lg max-h-64 w-full"
                          />
                        </div>
                      )}
                      {message.media_type === 'audio' && message.media_url && (
                        <div className={`${message.content ? 'mt-2' : ''}`}>
                          <audio src={message.media_url} controls className="w-full" />
                        </div>
                      )}
                    </div>
                    {isLastMyMessage && (
                      <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 text-right">
                        {message.is_read ? 'Seen' : 'Delivered'}
                      </div>
                    )}
                   </div>
                  
                  {/* Time tooltip on hover could go here, or simple timestamp */}
                  {/* <span className="text-[10px] text-muted-foreground self-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: false })}
                  </span> */}
                </div>
              </div>
            );
          })
        )}
        {showTyping && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
            </div>
            {otherProfile?.username || 'User'} is typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-background">
        {showMediaActions && (
          <div className="mb-3 rounded-2xl border border-border bg-card p-2 shadow-lg">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted"
            >
              Send Image
            </button>
            <button
              type="button"
              onClick={() => mediaInputRef.current?.click()}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted"
            >
              Photo Library / Files
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted"
            >
              Take Photo or Video
            </button>
            <button
              type="button"
              onClick={() => gifInputRef.current?.click()}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted"
            >
              Send GIF
            </button>
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted"
            >
              Send Audio File
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 rounded-full px-1 py-1 pr-2 border border-border/50">
           <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-blue-500 bg-blue-500/10 hover:bg-blue-500/20"
              onClick={() => setShowMediaActions((prev) => !prev)}
              disabled={sending || uploadingImage}
            >
              <Plus className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-indigo-500 bg-indigo-500/10 hover:bg-indigo-500/20"
              onClick={() => cameraInputRef.current?.click()}
              disabled={sending || uploadingImage}
              title="Take photo or video"
            >
              <ImageIcon className="w-4 h-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`h-9 w-9 rounded-full ${recording ? 'text-red-600 bg-red-500/20' : 'text-emerald-500 bg-emerald-500/10'} hover:bg-emerald-500/20`}
              onClick={() => (recording ? stopRecording() : startRecording())}
              disabled={sending || uploadingImage}
            >
              <Mic className="w-4 h-4" />
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            <input
              ref={mediaInputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              className="hidden"
              onChange={handleMediaSelect}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              className="hidden"
              onChange={handleMediaSelect}
            />
            <input
              ref={gifInputRef}
              type="file"
              accept="image/gif"
              className="hidden"
              onChange={selectGif}
            />
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleMediaSelect}
            />

            {imagePreview && (
            <div className="relative inline-block h-8 w-8 ml-1">
              <img
                src={imagePreview}
                alt="Preview"
                className="h-8 w-8 rounded object-cover border"
              />
              <button
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                onClick={clearImage}
              >
                <X className="h-2 w-2" />
              </button>
            </div>
            )}

            {mediaPreview && (
              <div className="relative inline-block h-8 w-8 ml-1">
                {mediaType === 'video' ? (
                  <div className="h-8 w-8 rounded border bg-slate-100 flex items-center justify-center">
                    <Video className="w-4 h-4 text-slate-500" />
                  </div>
                ) : mediaType === 'audio' ? (
                  <div className="h-8 w-8 rounded border bg-slate-100 flex items-center justify-center">
                    <Mic className="w-4 h-4 text-slate-500" />
                  </div>
                ) : (
                  <img
                    src={mediaPreview}
                    alt="Preview"
                    className="h-8 w-8 rounded object-cover border"
                  />
                )}
                <button
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                  onClick={clearMedia}
                >
                  <X className="h-2 w-2" />
                </button>
              </div>
            )}

            <Input
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                if (typingTimeoutRef.current) {
                  window.clearTimeout(typingTimeoutRef.current);
                }
                sendTypingStatus(true);
                typingTimeoutRef.current = window.setTimeout(() => {
                  sendTypingStatus(false);
                }, 1200);
              }}
              onKeyPress={handleKeyPress}
              placeholder="Message..."
              disabled={sending || uploadingImage}
              className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 h-9 px-2"
            />
            
            {newMessage.trim() || selectedImage || selectedMedia ? (
                <Button
                  onClick={sendMessage}
                  disabled={sending || uploadingImage}
                  variant="ghost"
                  className="h-auto px-3 font-semibold text-blue-500 hover:text-blue-600 hover:bg-transparent"
                >
                  Send
                </Button>
            ) : (
                <div className="flex items-center gap-1 mr-1">
                   <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => (recording ? stopRecording() : startRecording())}
                      title={recording ? 'Stop recording' : 'Record voice'}
                   >
                      <Mic className="h-5 w-5" />
                   </Button>
                   <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => mediaInputRef.current?.click()}
                      title="Attach image/video/audio"
                   >
                      <ImageIcon className="h-6 w-6" />
                   </Button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
