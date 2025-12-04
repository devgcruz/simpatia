/**
 * Utilitário para reproduzir som de notificação
 */

import { NotificationSoundType } from '../context/SettingsContext';

let audioContext: AudioContext | null = null;
const soundBuffers: Map<NotificationSoundType, AudioBuffer> = new Map();

/**
 * Inicializa o contexto de áudio (lazy loading)
 */
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Gera diferentes tipos de som de notificação usando Web Audio API
 */
function generateNotificationSound(soundType: NotificationSoundType): AudioBuffer {
  const ctx = getAudioContext();
  const sampleRate = ctx.sampleRate;
  
  let frequency1: number;
  let frequency2: number;
  let frequency3: number | null = null;
  let duration: number;
  let envelopeType: 'smooth' | 'sharp' | 'gentle';

  switch (soundType) {
    case 'soft':
      frequency1 = 600;
      frequency2 = 800;
      duration = 0.25;
      envelopeType = 'gentle';
      break;
    case 'chime':
      frequency1 = 523; // C5
      frequency2 = 659; // E5
      frequency3 = 784; // G5
      duration = 0.35;
      envelopeType = 'smooth';
      break;
    case 'bell':
      frequency1 = 880; // A5
      frequency2 = 1108; // C#6
      duration = 0.4;
      envelopeType = 'smooth';
      break;
    case 'pop':
      frequency1 = 400;
      frequency2 = 600;
      duration = 0.15;
      envelopeType = 'sharp';
      break;
    case 'ding':
      frequency1 = 1000;
      frequency2 = 1200;
      duration = 0.2;
      envelopeType = 'sharp';
      break;
    case 'appointment1':
      // Som de agendamento 1: Tom ascendente e alegre
      frequency1 = 440; // A4
      frequency2 = 554; // C#5
      frequency3 = 659; // E5
      duration = 0.4;
      envelopeType = 'smooth';
      break;
    case 'appointment2':
      // Som de agendamento 2: Tom mais grave e profissional
      frequency1 = 330; // E4
      frequency2 = 440; // A4
      frequency3 = 554; // C#5
      duration = 0.35;
      envelopeType = 'smooth';
      break;
    case 'appointment3':
      // Som de agendamento 3: Tom médio e claro
      frequency1 = 523; // C5
      frequency2 = 659; // E5
      duration = 0.3;
      envelopeType = 'smooth';
      break;
    case 'default':
    default:
      frequency1 = 800;
      frequency2 = 1000;
      duration = 0.3;
      envelopeType = 'smooth';
      break;
  }

  const totalSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let envelope = 1;

    // Aplicar envelope baseado no tipo
    if (envelopeType === 'gentle') {
      // Envelope suave e longo
      if (t < 0.08) {
        envelope = t / 0.08;
      } else if (t < 0.15) {
        envelope = 1 - (t - 0.08) / 0.07 * 0.2;
      } else {
        envelope = 0.8 * (1 - (t - 0.15) / (duration - 0.15));
      }
    } else if (envelopeType === 'sharp') {
      // Envelope rápido e agudo
      if (t < 0.02) {
        envelope = t / 0.02;
      } else if (t < 0.05) {
        envelope = 1 - (t - 0.02) / 0.03 * 0.4;
      } else {
        envelope = 0.6 * (1 - (t - 0.05) / (duration - 0.05));
      }
    } else {
      // Envelope suave (smooth)
      if (t < 0.05) {
        envelope = t / 0.05;
      } else if (t < 0.1) {
        envelope = 1 - (t - 0.05) / 0.05 * 0.3;
      } else if (t < 0.2) {
        envelope = 0.7;
      } else {
        envelope = 0.7 * (1 - (t - 0.2) / (duration - 0.2));
      }
    }

    // Gerar o som
    let sample = Math.sin(2 * Math.PI * frequency1 * t) * 0.3 * envelope;
    sample += Math.sin(2 * Math.PI * frequency2 * t) * 0.2 * envelope;
    
    if (frequency3) {
      sample += Math.sin(2 * Math.PI * frequency3 * t) * 0.15 * envelope;
    }

    data[i] = sample;
  }

  return buffer;
}

/**
 * Reproduz o som de notificação
 */
export function playNotificationSound(soundType: NotificationSoundType = 'default'): void {
  try {
    const ctx = getAudioContext();
    
    // Se o contexto estiver suspenso (por políticas do navegador), retomar
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Gerar ou usar buffer em cache
    if (!soundBuffers.has(soundType)) {
      soundBuffers.set(soundType, generateNotificationSound(soundType));
    }

    const buffer = soundBuffers.get(soundType)!;

    // Criar source e reproduzir
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);

    console.log('[Notification Sound] Som reproduzido:', soundType);
  } catch (error) {
    console.warn('[Notification Sound] Erro ao reproduzir som:', error);
    // Fallback: tentar usar HTML5 Audio se disponível
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi77+efTRAMUKfj8LZjHAY4kdfyzHksBSR3x/DdkEAKFF606euoVRQKRp/g8r5sIQUrgc7y2Yk2CBlou+/nn00QDFCn4/C2YxwGOJHX8sx5LAUkd8fw3ZBAC');
      audio.volume = 0.3;
      audio.play().catch((e) => {
        console.warn('[Notification Sound] Erro no fallback de áudio:', e);
      });
    } catch (fallbackError) {
      console.warn('[Notification Sound] Fallback também falhou:', fallbackError);
    }
  }
}

/**
 * Para o som de notificação (se estiver tocando)
 */
export function stopNotificationSound(): void {
  // Para Web Audio API, não há necessidade de parar explicitamente
  // pois o som termina automaticamente quando o buffer acaba
  // Mas podemos limpar o contexto se necessário
  if (audioContext && audioContext.state !== 'closed') {
    // Não fechar o contexto, apenas limpar referências se necessário
  }
}

