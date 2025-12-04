import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type NotificationSoundType = 'default' | 'soft' | 'chime' | 'bell' | 'pop' | 'ding' | 'appointment1' | 'appointment2' | 'appointment3';

interface Settings {
  notifications: {
    soundEnabled: boolean;
    browserNotificationsEnabled: boolean;
    soundType: NotificationSoundType; // Som para chat
    appointmentSoundType: NotificationSoundType; // Som para agendamentos
  };
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => void;
  toggleSound: () => void;
  toggleBrowserNotifications: () => void;
  setSoundType: (soundType: NotificationSoundType) => void;
  setAppointmentSoundType: (soundType: NotificationSoundType) => void;
}

const defaultSettings: Settings = {
  notifications: {
    soundEnabled: true, // Ativado por padrão
    browserNotificationsEnabled: true,
    soundType: 'default' as NotificationSoundType, // Som padrão para chat
    appointmentSoundType: 'appointment1' as NotificationSoundType, // Som padrão para agendamentos
  },
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const STORAGE_KEY = 'simpatia_settings';

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    // Carregar do localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge com defaults para garantir que novas propriedades sejam incluídas
        return {
          ...defaultSettings,
          ...parsed,
          notifications: {
            ...defaultSettings.notifications,
            ...(parsed.notifications || {}),
          },
        };
      }
    } catch (error) {
      console.error('[Settings] Erro ao carregar configurações:', error);
    }
    return defaultSettings;
  });

  // Salvar no localStorage sempre que as configurações mudarem
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('[Settings] Erro ao salvar configurações:', error);
    }
  }, [settings]);

  const updateSettings = (updates: Partial<Settings>) => {
    setSettings((prev) => ({
      ...prev,
      ...updates,
      notifications: {
        ...prev.notifications,
        ...(updates.notifications || {}),
      },
    }));
  };

  const toggleSound = () => {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        soundEnabled: !prev.notifications.soundEnabled,
      },
    }));
  };

  const toggleBrowserNotifications = () => {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        browserNotificationsEnabled: !prev.notifications.browserNotificationsEnabled,
      },
    }));
  };

  const setSoundType = (soundType: NotificationSoundType) => {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        soundType,
      },
    }));
  };

  const setAppointmentSoundType = (soundType: NotificationSoundType) => {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        appointmentSoundType: soundType,
      },
    }));
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        toggleSound,
        toggleBrowserNotifications,
        setSoundType,
        setAppointmentSoundType,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings deve ser usado dentro de SettingsProvider');
  }
  return context;
};

