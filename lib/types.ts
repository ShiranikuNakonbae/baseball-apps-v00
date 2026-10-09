export type Role = "admin" | "coach" | "parent";
export type Division = "tball" | "minor" | "major" | "youth";
export type EventType = "practice" | "game" | "meeting" | "event";
export type RsvpStatus = "attending" | "not_attending" | "tentative";
export type AttendanceStatus = "present" | "excused" | "unexcused" | "late";
export type Side = "right" | "left" | "switch";

export const DIVISIONS: Division[] = ["tball", "minor", "major", "youth"];
export const ROLES: Role[] = ["admin", "coach", "parent"];
export const EVENT_TYPES: EventType[] = ["practice", "game", "meeting", "event"];
export const RSVP_STATUSES: RsvpStatus[] = ["attending", "not_attending", "tentative"];
export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "present",
  "late",
  "excused",
  "unexcused",
];
export const SIDES: Side[] = ["right", "left", "switch"];
export const POSITIONS = [
  "P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF",
  "IF", "OF", "UTIL",
];

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone_number: string | null;
  role: Role;
};

export type Team = {
  id: string;
  name: string;
  division: Division;
  season: string;
};

export type Athlete = {
  id: string;
  team_id: string | null;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  primary_position: string | null;
  secondary_position: string | null;
  bats: Side;
  throws: Side;
  date_of_birth: string | null;
  team?: Pick<Team, "name" | "division" | "season"> | null;
};

export type ClubEvent = {
  id: string;
  team_id: string;
  title: string;
  type: EventType;
  start_time: string;
  end_time: string;
  location_name: string;
  location_url: string | null;
  notes: string | null;
  team?: Pick<Team, "name" | "division"> | null;
};

export type Rsvp = {
  event_id: string;
  athlete_id: string;
  status: RsvpStatus;
};

export type AttendanceRow = {
  event_id: string;
  athlete_id: string;
  status: AttendanceStatus;
};

export type BattingLine = {
  event_id: string;
  athlete_id: string;
  pa: number;
  ab: number;
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  r: number;
  rbi: number;
  bb: number;
  k: number;
  hbp: number;
  sf: number;
  pitch_count: number;
  innings_pitched: number;
  earned_runs: number;
};

export type SeasonStats = {
  athlete_id: string;
  games_played: number;
  total_pa: number;
  total_ab: number;
  total_hits: number;
  total_singles: number;
  total_doubles: number;
  total_triples: number;
  total_hr: number;
  total_runs: number;
  total_rbi: number;
  total_bb: number;
  total_k: number;
  total_hbp: number;
  total_sf: number;
  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  avg_pitch_count: number;
  innings_pitched: number;
  total_earned_runs: number;
  era: number | null;
};

export type AttendanceStats = {
  athlete_id: string;
  practices_scheduled: number;
  practices_attended: number;
  games_scheduled: number;
  games_attended: number;
  status_present: number;
  status_late: number;
  status_excused: number;
  status_unexcused: number;
  practice_rate: number | null;
  game_rate: number | null;
  overall_rate: number | null;
};
