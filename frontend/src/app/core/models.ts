export type Role = 'admin' | 'agent';
export type Country = 'AE' | 'PK';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  country: Country;
  isActive: boolean;
  phone?: string;
  lastLoginAt?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
