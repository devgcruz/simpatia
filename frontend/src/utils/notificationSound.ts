/**
 * Utilitário para reproduzir som de notificação
 */

let audioContext: AudioContext | null = null;
let notificationSoundBuffer: AudioBuffer | null = null;

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
 * Gera um som de notificação agradável usando Web Audio API
 * Cria um som suave tipo "ding" ou "ping"
 */
function generateNotificationSound(): AudioBuffer {
  const ctx = getAudioContext();
  const sampleRate = ctx.sampleRate;
  const duration = 0.3; // 300ms
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);

  // Criar um tom suave (frequência fundamental + harmônicos)
  const frequency = 800; // Hz - tom agradável
  const frequency2 = 1000; // Hz - segundo harmônico
  
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    // Envelope ADSR (Attack, Decay, Sustain, Release) para suavizar
    let envelope = 1;
    if (t < 0.05) {
      // Attack
      envelope = t / 0.05;
    } else if (t < 0.1) {
      // Decay
      envelope = 1 - (t - 0.05) / 0.05 * 0.3;
    } else if (t < 0.2) {
      // Sustain
      envelope = 0.7;
    } else {
      // Release
      envelope = 0.7 * (1 - (t - 0.2) / 0.1);
    }
    
    // Combinar dois tons com envelope
    data[i] = 
      Math.sin(2 * Math.PI * frequency * t) * 0.3 * envelope +
      Math.sin(2 * Math.PI * frequency2 * t) * 0.2 * envelope;
  }

  return buffer;
}

/**
 * Reproduz o som de notificação
 */
export function playNotificationSound(): void {
  try {
    const ctx = getAudioContext();
    
    // Se o contexto estiver suspenso (por políticas do navegador), retomar
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Gerar ou usar buffer em cache
    if (!notificationSoundBuffer) {
      notificationSoundBuffer = generateNotificationSound();
    }

    // Criar source e reproduzir
    const source = ctx.createBufferSource();
    source.buffer = notificationSoundBuffer;
    source.connect(ctx.destination);
    source.start(0);

    console.log('[Notification Sound] Som reproduzido');
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

