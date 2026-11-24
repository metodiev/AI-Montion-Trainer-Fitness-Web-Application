import { useEffect, useRef, useState } from 'react';
import { Camera, Info, Lock, RefreshCw, ShieldCheck, Trash2, Volume2 } from 'lucide-react';
import { useAppData } from '@/store/AppDataProvider';
import { CameraManager } from '@/services/CameraManager';
import { getAudioFeedback } from '@/services/AudioFeedback';
import { Card, SectionHeader, Toggle } from '@/components/ui/primitives';

export function SettingsPage() {
  const { data, updateSettings, resetProgress, storageAvailable } = useAppData();
  const { settings } = data;
  const [devices, setDevices] = useState<{ deviceId: string; label: string }[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const managerRef = useRef(new CameraManager());
  const [confirmReset, setConfirmReset] = useState(false);

  const refreshDevices = async () => {
    setCameraError(null);
    const list = await managerRef.current.listDevices();
    setDevices(list.map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Camera ${index + 1}`,
    })));
  };

  useEffect(() => {
    void refreshDevices();
  }, []);

  const testSound = () => {
    const audio = getAudioFeedback();
    audio.configure({ volume: settings.volume, sound: true, voice: false });
    void audio.unlock().then(() => audio.play('start'));
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="app-label mb-1">Settings</p>
        <h1 className="app-title">Your setup</h1>
        <p className="app-muted mt-2 max-w-2xl">
          Tune audio, camera and privacy. Everything here is stored locally in your browser.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <SectionHeader eyebrow="Feedback" title="Sound & coaching" />
          <div className="flex flex-col divide-y divide-white/6">
            <Toggle
              checked={settings.sound}
              onChange={(sound) => updateSettings({ sound })}
              label="Sound effects"
              description="Rep chimes, warnings and level-up fanfares."
            />
            <Toggle
              checked={settings.voice}
              onChange={(voice) => updateSettings({ voice })}
              label="Voice coaching"
              description="Spoken cues and rep counts using your browser's local voice."
            />
            <div className="py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-white">Volume</span>
                <span className="font-mono text-[11px] text-slate-400">{Math.round(settings.volume * 100)}%</span>
              </div>
              <div className="flex items-center gap-3">
                <Volume2 size={15} className="text-slate-500" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.volume}
                  onChange={(event) => {
                    const volume = Number(event.target.value);
                    updateSettings({ volume });
                    getAudioFeedback().configure({ volume });
                  }}
                  className="h-1.5 w-full appearance-none rounded-full bg-white/12 accent-lime-400"
                  aria-label="Volume"
                />
                <button type="button" onClick={testSound} className="app-button-secondary px-3 py-1.5 text-[11px]">
                  Test
                </button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <SectionHeader eyebrow="Camera" title="View & tracking" />
          <div className="flex flex-col divide-y divide-white/6">
            <Toggle
              checked={settings.mirror}
              onChange={(mirror) => updateSettings({ mirror })}
              label="Mirror camera"
              description="Match your movements like a mirror. Recommended."
            />
            <Toggle
              checked={settings.showSkeleton}
              onChange={(showSkeleton) => updateSettings({ showSkeleton })}
              label="Show skeleton overlay"
              description="Draw tracked joints and bones over the video."
            />
            <Toggle
              checked={settings.showMetrics}
              onChange={(showMetrics) => updateSettings({ showMetrics })}
              label="Show live tracking metrics"
              description="Developer-style angles and thresholds during workouts."
            />
            <div className="py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium text-white">
                  <Camera size={15} className="text-slate-400" /> Camera device
                </span>
                <button
                  type="button"
                  onClick={() => void refreshDevices()}
                  className="flex items-center gap-1 text-[11px] font-semibold text-lime-300 hover:text-lime-200"
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>
              <select
                value={settings.cameraDeviceId ?? ''}
                onChange={(event) => updateSettings({ cameraDeviceId: event.target.value || null })}
                className="app-input"
              >
                <option value="">Default camera</option>
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                {cameraError ??
                  (devices.some((device) => device.label.startsWith('Camera '))
                    ? 'Camera names are hidden until you allow camera access in a workout.'
                    : 'Choose which camera the trainer uses.')}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <SectionHeader eyebrow="Profile" title="Goals" />
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-white">Daily XP goal</span>
                <span className="font-mono text-[11px] text-lime-300">{settings.dailyGoalXp} XP</span>
              </div>
              <input
                type="range"
                min={40}
                max={400}
                step={10}
                value={settings.dailyGoalXp}
                onChange={(event) => updateSettings({ dailyGoalXp: Number(event.target.value) })}
                className="h-1.5 w-full appearance-none rounded-full bg-white/12 accent-lime-400"
                aria-label="Daily XP goal"
              />
              <p className="mt-2 text-[11px] text-slate-500">
                A typical 10-minute session earns 120–220 XP.
              </p>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-white">Weight (for calorie estimates)</span>
                <span className="font-mono text-[11px] text-slate-300">{settings.weightKg} kg</span>
              </div>
              <input
                type="range"
                min={35}
                max={160}
                step={1}
                value={settings.weightKg}
                onChange={(event) => updateSettings({ weightKg: Number(event.target.value) })}
                className="h-1.5 w-full appearance-none rounded-full bg-white/12 accent-lime-400"
                aria-label="Weight"
              />
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-[11px] leading-relaxed text-slate-500">
              Storage: {storageAvailable ? 'local browser storage is active.' : 'unavailable — progress will not persist on this device.'}
            </div>
          </div>
        </Card>

        <Card className="flex flex-col p-6">
          <SectionHeader eyebrow="Privacy" title="Where your data lives" />
          <div className="space-y-3 text-sm leading-relaxed text-slate-400">
            <p className="flex gap-3">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-300" />
              Pose estimation runs entirely on this device with MediaPipe. Video frames are never
              recorded or uploaded.
            </p>
            <p className="flex gap-3">
              <Lock size={18} className="mt-0.5 shrink-0 text-sky-300" />
              Progress, achievements and settings live in this browser&apos;s local storage. No
              account, no server, no analytics.
            </p>
            <p className="flex gap-3">
              <Info size={18} className="mt-0.5 shrink-0 text-violet-300" />
              The only network requests are the local app bundle plus the pose model/runtime on first
              load. You can turn the camera off at any time.
            </p>
          </div>

          <div className="mt-auto pt-6">
            {confirmReset ? (
              <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4">
                <p className="text-sm font-medium text-rose-100">Delete all progress?</p>
                <p className="mt-1 text-[11px] text-rose-200/70">
                  This removes XP, levels, achievements, records and workout history. Settings are kept.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetProgress();
                      setConfirmReset(false);
                    }}
                    className="app-button-danger px-3 py-1.5 text-[11px]"
                  >
                    Yes, delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="app-button-ghost px-3 py-1.5 text-[11px]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="app-button-danger px-4 py-2 text-xs"
              >
                <Trash2 size={14} /> Reset progress
              </button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
