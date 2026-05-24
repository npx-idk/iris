import { axiosInstance } from './axios';

export const api = {
  get: <T>(path: string) =>
    axiosInstance.get<T>(path).then((r) => r.data),
  post: <T>(path: string, body?: unknown) =>
    axiosInstance.post<T>(path, body).then((r) => r.data),
  put: <T>(path: string, body?: unknown) =>
    axiosInstance.put<T>(path, body).then((r) => r.data),
  patch: <T>(path: string, body?: unknown) =>
    axiosInstance.patch<T>(path, body).then((r) => r.data),
  delete: <T = void>(path: string) =>
    axiosInstance.delete<T>(path).then((r) => r.data),
};
