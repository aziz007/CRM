import { User } from './models';

export const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Follow-up', 'Appointment', 'Won', 'Lost'] as const;
export const LEAD_SOURCES = ['Website', 'Referral', 'Walk-in', 'Property Portal', 'Social Media', 'Cold Call', 'Other'] as const;
export const PROPERTY_TYPES = ['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Plot', 'Commercial', 'Other'] as const;
export const PURPOSES = ['Buy', 'Rent', 'Sell', 'Invest'] as const;
export const CURRENCIES = ['AED', 'PKR', 'USD'] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  country: 'AE' | 'PK';
  location: string;
  purpose: string;
  propertyType: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency: string;
  source: string;
  status: LeadStatus;
  assignedTo: { id: string; name: string; role: string } | string;
  notes: string;
  lastContactedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadPage {
  items: Lead[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface LeadQuery {
  search?: string;
  status?: string;
  source?: string;
  country?: string;
  page?: number;
  limit?: number;
  sort?: string;
  assignedTo?: string;
}

export interface Activity {
  id: string;
  type: 'created' | 'updated' | 'status_changed' | 'assigned' | 'note';
  summary: string;
  createdAt: string;
  user: { id: string; name: string; role: string } | null;
}

export type AssignableUser = Pick<User, 'id' | 'name' | 'role' | 'country'>;

export function assigneeName(lead: Lead): string {
  return typeof lead.assignedTo === 'string' ? '' : lead.assignedTo?.name ?? '';
}
