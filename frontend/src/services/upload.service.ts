import { api } from './api';

export interface UploadLogoResponse {
  message: string;
  url: string;
  filename: string;
}

export const uploadLogo = async (file: File): Promise<UploadLogoResponse> => {
  const formData = new FormData();
  formData.append('logo', file);

  const response = await api.post<UploadLogoResponse>('/upload/logo', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};


