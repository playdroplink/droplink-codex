import { useEffect, useRef, useState } from 'react';
import { Music, Volume2, VolumeX, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BackgroundMusicPlayerProps {
  musicUrl?: string;
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
}

type MusicProvider = 'spotify' | 'youtube' | 'audio';

const getMusicProvider = (url?: string): MusicProvider => {
  if (!url) return 'audio';
  const lowered = url.toLowerCase();
  if (lowered.includes('spotify.com')) return 'spotify';
  if (lowered.includes('youtube.com') || lowered.includes('youtu.be')) return 'youtube';
  return 'audio';
};

const buildYouTubeEmbed = (url?: string) => {
  if (!url) return null;
  try {
    const yt = new URL(url);
    let id = '';
    if (yt.hostname.includes('youtu.be')) {
      id = yt.pathname.replace('/', '');
    } else {
      id = yt.searchParams.get('v') || '';
    }
    return id ? `https://www.youtube.com/embed/${id}?rel=0` : null;
  } catch (error) {
    console.error('Failed to parse YouTube URL', error);
    return null;
  }
};

const buildSpotifyEmbed = (url?: string) => {
  if (!url) return null;
  try {
    const sp = new URL(url);
    // Convert open.spotify.com/track/{id} -> /embed/track/{id}
    if (sp.hostname.includes('spotify.com')) {
      const parts = sp.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        const type = parts[0];
        const id = parts[1];
        return `https://open.spotify.com/embed/${type}/${id}`;
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to parse Spotify URL', error);
    return null;
  }
};

export const BackgroundMusicPlayer = ({
  musicUrl,
  autoPlay = true,
  loop = true,
  className = ''
}: BackgroundMusicPlayerProps) => {
  const provider = getMusicProvider(musicUrl);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastVolumeRef = useRef(0.3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.3); // Default to 30% volume
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState(false);

  // Initialize source for direct audio URLs only.
  useEffect(() => {
    if (provider !== 'audio' || !musicUrl || !audioRef.current) return;

    const audio = audioRef.current;
    audio.src = musicUrl;
    audio.loop = loop;
    audio.load();

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [musicUrl, loop, provider]);

  // Keep mute/volume in sync without resetting the media source.
  useEffect(() => {
    if (provider !== 'audio' || !audioRef.current) return;
    const audio = audioRef.current;
    audio.muted = isMuted;
    audio.volume = volume;
    if (volume > 0) {
      lastVolumeRef.current = volume;
    }
  }, [provider, isMuted, volume]);

  // Attempt autoplay when allowed.
  useEffect(() => {
    if (provider !== 'audio' || !audioRef.current || !autoPlay) return;
    const audio = audioRef.current;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [provider, musicUrl, autoPlay]);

  // Handle play/pause (audio provider only)
  const handlePlayPause = () => {
    if (provider !== 'audio' || !audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }
  };

  // Handle volume change (audio provider only)
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (provider !== 'audio') return;
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  // Handle mute/unmute (audio provider only)
  const handleMuteToggle = () => {
    if (provider !== 'audio' || !audioRef.current) return;
    if (isMuted) {
      const restoredVolume = lastVolumeRef.current > 0 ? lastVolumeRef.current : 0.3;
      setVolume(restoredVolume);
      setIsMuted(false);
    } else {
      setIsMuted(true);
    }
  };

  // Update current time as audio plays
  const handleTimeUpdate = () => {
    if (provider !== 'audio') return;
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  // Set duration when metadata loads
  const handleLoadedMetadata = () => {
    if (provider !== 'audio') return;
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  // Handle error
  const handleError = () => {
    setError(true);
    setIsPlaying(false);
  };

  // Format time to MM:SS
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!musicUrl) return null;

  if (error) {
    return (
      <div className={`flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <Music className="w-4 h-4 text-red-500" />
        <span className="text-xs text-red-600">Background music failed to load</span>
      </div>
    );
  }

  const titleFromUrl = (() => {
    if (!musicUrl) return 'Background Music';
    try {
      const u = new URL(musicUrl);
      const name = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || u.hostname);
      return name || 'Background Music';
    } catch {
      return 'Background Music';
    }
  })();

  if (provider === 'youtube') {
    const embed = buildYouTubeEmbed(musicUrl);
    if (!embed) return null;
    return (
      <div className={`flex flex-col gap-3 p-4 bg-transparent border border-white/20 rounded-xl backdrop-blur-sm ${className}`}>
        <div className="text-center">
          <div className="text-xs font-semibold text-gray-300 uppercase tracking-wide">YouTube Music</div>
          <div className="text-sm font-bold text-white">{titleFromUrl}</div>
        </div>
        <div className="aspect-video w-full overflow-hidden rounded-lg shadow-xl border border-white/10">
          <iframe
            src={embed}
            allow="autoplay; encrypted-media"
            allowFullScreen
            className="w-full h-full"
            title="YouTube background music"
          />
        </div>
      </div>
    );
  }

  if (provider === 'spotify') {
    const embed = buildSpotifyEmbed(musicUrl);
    if (!embed) return null;
    return (
      <div className={`flex flex-col gap-3 p-4 bg-transparent border border-white/20 rounded-xl backdrop-blur-sm ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Spotify</div>
            <div className="text-sm font-bold text-white truncate">{titleFromUrl}</div>
          </div>
        </div>
        <iframe
          src={embed}
          width="100%"
          height="152"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          title="Spotify background music"
          className="rounded-lg shadow-xl border border-white/10"
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 p-4 bg-gradient-to-br from-gray-900 via-gray-800 to-black border border-gray-700 rounded-xl shadow-2xl ${className}`}>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={handleError}
        crossOrigin="anonymous"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg flex-shrink-0">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Now Playing</div>
            <div className="text-sm font-bold text-white truncate">{titleFromUrl}</div>
          </div>
        </div>
        <span className="text-xs font-mono text-gray-400 ml-2">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      <div 
        className="group w-full h-1.5 bg-gray-700 rounded-full overflow-hidden cursor-pointer hover:h-2 transition-all relative"
        onClick={(e) => {
          if (!audioRef.current || duration === 0) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
          audioRef.current.currentTime = percent * duration;
        }}
      >
        <div
          className="h-full bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 transition-all relative"
          style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          size="sm"
          onClick={handlePlayPause}
          className="h-10 w-10 p-0 flex items-center justify-center bg-white hover:bg-gray-100 rounded-full shadow-lg hover:scale-105 transition-all border-0"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 text-gray-900 fill-current" />
          ) : (
            <Play className="w-5 h-5 text-gray-900 fill-current ml-0.5" />
          )}
        </Button>

        <div className="flex items-center gap-2 flex-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleMuteToggle}
            className="h-8 w-8 p-0 flex items-center justify-center hover:bg-gray-700 rounded-full transition-all"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-gray-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-white" />
            )}
          </Button>

          <div className="group flex-1 h-1 bg-gray-700 rounded-full overflow-hidden hover:h-1.5 transition-all relative">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              title="Volume"
            />
            <div 
              className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all pointer-events-none relative"
              style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>

        {isPlaying && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/20 rounded-full">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-green-400">Playing</span>
          </div>
        )}
      </div>
    </div>
  );
};
