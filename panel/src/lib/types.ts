export interface Account {
  id: number;
  username: string;
  email: string | null;
  language: "en" | "ro";
  premium_points: number;
  admin_level: number;
  helper_level: number;
  created_at: string;
}

export interface CharacterSummary {
  id: number;
  player_id: number;
  account_id: number;
  firstname: string;
  lastname: string;
  slot: number;
  cash: number;
  bank: number;
  job: string;
  job_grade: number;
  level: number;
  xp: number;
  respect_points: number;
  paydays_received: number;
  phone_number: string | null;
  home_property_id: number | null;
  avatar: string | null;
  gender: number;
  nationality: string;
  is_dead: boolean;
  created_at: string;
  last_played: string | null;
}

export interface PublicPlayerProfile {
  id: number;
  name: string;
  username: string;
  level: number;
  respect_points: number;
  paydays_received: number;
  job: string;
  job_grade: number;
  job_label: string;
  faction_id: string | null;
  faction_label: string | null;
  faction_rank: string | null;
  clan_tag: string | null;
  clan_name: string | null;
  clan_color: string | null;
  clan_style: string | null;
  avatar: string | null;
  registered_at: string;
  last_seen: string;
  vehicles_count: number;
  properties_count: number;
  married_to: {
    character_id: number;
    name: string;
    married_at: string;
  } | null;
  recent_sanctions: PublicSanction[];
  job_skills: JobSkill[];
  licenses: CharacterLicense[];
  mission_reputation: MissionReputation[];
}

export interface PublicSanction {
  id: number;
  action: "warn" | "kick" | "tempban" | "ban" | "unban" | "jail" | "unjail";
  admin_name: string;
  reason: string;
  duration_min: number | null;
  created_at: string;
}

export interface JobSkill {
  job_id: string;
  job_label: string;
  level: number;
  xp: number;
  completed_tasks: number;
  total_earned: number;
}

export interface CharacterLicense {
  type: "driver" | "weapon" | "boat" | "pilot" | "hunting";
  issued_at: string;
  issued_at_payday: number;
  expires_at_payday: number | null;
  is_expired: boolean;
  remaining_paydays: number | null;
}

export interface MissionReputation {
  contact: string;
  reputation: number;
  missions_completed: number;
  last_mission_timestamp: number;
}

export interface Vehicle {
  id: number;
  character_id: number;
  plate: string;
  model: string;
  fuel: number;
  engine: number;
  body: number;
  stored: boolean;
  garage: string;
  insurance_points: number;
  insurance_level: number;
  destroyed: boolean;
  insurance_cost: number;
  created_at: string;
  impounded: boolean;
  impound_reason?: string;
  impound_fee?: number;
}

export interface Property {
  id: number;
  label: string;
  price: number;
  interior: string;
  minimum_level: number;
  description: string | null;
  owner_character_id: number | null;
  locked: boolean;
  for_sale: boolean;
  rent_enabled: boolean;
  rent_price: number;
  max_renters: number;
  renter_count?: number;
  owner_name?: string;
}

export interface Faction {
  id: string;
  label: string;
  type: "legal" | "illegal";
  factionType: string;
  description: string;
  society: string;
  duty: boolean;
  leader_name: string | null;
  leader_character_id: number | null;
  member_count: number;
  active_warnings_count: number;
  motd: string;
}

export interface Turf {
  id: number;
  name: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  owner_clan_id: number | null;
  owner_clan_name?: string;
  owner_clan_tag?: string;
  owner_clan_color?: string;
  payout: number;
  respect_payout: number;
  polygon?: Array<{ x: number; y: number }>;
}

export interface Poll {
  id: number;
  title_en: string;
  title_ro: string;
  description_en: string | null;
  description_ro: string | null;
  status: "upcoming" | "active" | "closed" | "archived";
  starts_at: string;
  ends_at: string;
  minimum_level: number;
  minimum_hours: number;
  created_by: number;
  results_visibility: "public" | "after_vote" | "after_close" | "staff_only";
  options: PollOption[];
  total_votes: number;
  user_voted_option_id?: number | null;
  is_eligible?: boolean;
  ineligibility_reason?: string;
}

export interface PollOption {
  id: number;
  poll_id: number;
  label_en: string;
  label_ro: string;
  sort_order: number;
  votes_count: number;
  percentage?: number;
}

export interface SupportTicket {
  id: number;
  account_id: number;
  character_id: number | null;
  department: "general" | "account" | "bug" | "billing" | "faction" | "staff";
  subject: string;
  status: "open" | "in_progress" | "waiting_player" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  assigned_admin_account_id: number | null;
  assigned_admin_name?: string | null;
  author_name?: string;
  created_at: string;
  updated_at: string;
  messages_count?: number;
}

export interface TicketMessage {
  id: number;
  ticket_id: number;
  sender_account_id: number;
  sender_character_id: number | null;
  sender_name: string;
  is_staff: boolean;
  message: string;
  created_at: string;
}

export interface Complaint {
  id: number;
  accuser_account_id: number;
  accuser_name: string;
  accused_character_id: number;
  accused_name: string;
  category: string;
  title: string;
  evidence_text: string;
  status: "pending" | "under_review" | "action_taken" | "dismissed";
  verdict: string | null;
  handled_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  accountId: number;
  username: string;
  email: string | null;
  language: "en" | "ro";
  adminLevel: number;
  helperLevel: number;
  isAuthor?: boolean;
  selectedCharacterId: number | null;
  selectedCharacterName: string | null;
}

/** Only these fields may cross a Server Component → Client Component boundary. */
export type ViewerSessionDTO = Pick<UserSession,
  | "accountId"
  | "username"
  | "language"
  | "adminLevel"
  | "helperLevel"
  | "isAuthor"
  | "selectedCharacterId"
  | "selectedCharacterName"
>;
