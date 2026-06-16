import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// one preferred combo + how many times a week it appears, plus the customer's
// in-combo customization (chosen options + paid add-ons) which affects price.
export class ComboPlanDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(21)
  perWeek?: number;

  // headcount this combo is served to (boxes/week = perWeek × people)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  people?: number;

  // { [choice label]: chosen option name }
  @IsOptional()
  @IsObject()
  choices?: Record<string, string>;

  // selected paid add-on names
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  addOns?: string[];

  // customized unit price (base + chosen options + add-ons), before carrier discount
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  unitPrice?: number;
}

// One delivery in an active subscription — the combo handed out on a given day.
export class DeliveryDto {
  @IsString()
  @MaxLength(40)
  date: string; // yyyy-mm-dd

  @IsOptional()
  @IsString()
  @MaxLength(120)
  combo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  people?: number;

  @IsOptional()
  @IsBoolean()
  delivered?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  deliveredAt?: string;
}

// A customer's subscription enquiry ("get the same box delivered regularly").
// This is a lead/quote request — the team follows up to finalise pricing.
export class CreateSubscriptionDto {
  // --- contact (the most important info) ---
  @IsString()
  @MaxLength(120)
  contactName: string;

  @IsString()
  @MaxLength(20)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  organisation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6)
  pincode?: string;

  // --- plan shape ---
  @IsOptional()
  @IsString()
  @IsIn(['Breakfast', 'Lunch/Dinner', 'Snacks'])
  mealSlot?: string;

  @IsOptional()
  @IsInt()
  @IsIn([3, 5, 8])
  boxType?: number; // items per box

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  totalMeals?: number; // total meals across the whole plan

  // how long the plan runs (value + unit)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  durationValue?: number;

  @IsOptional()
  @IsString()
  @IsIn(['days', 'weeks', 'months'])
  durationUnit?: string;

  @IsOptional()
  @IsString()
  @IsIn(['daily', 'weekdays', 'weekly', 'custom'])
  frequency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  startDate?: string; // ISO yyyy-mm-dd

  @IsOptional()
  @IsString()
  @MaxLength(40)
  endDate?: string; // ISO yyyy-mm-dd; blank = ongoing

  @IsOptional()
  @IsBoolean()
  ongoing?: boolean; // no end date — runs until cancelled

  // sustainable option: reusable carriers instead of disposable plates/cutlery
  @IsOptional()
  @IsBoolean()
  reusableCarrier?: boolean;

  // customized (co-branded) packaging surcharge
  @IsOptional()
  @IsBoolean()
  coBranded?: boolean;

  // combos the customer likes — preferences only, used to plan a rotational menu
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredCombos?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  // client-computed, informational only — server recomputes authoritatively
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  discountPct?: number;

  // idempotency: a stable key per submit attempt dedupes retries/double-taps
  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;
}

export class ListSubscriptionsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

const STATUSES = ['new', 'contacted', 'quoted', 'confirmed', 'closed', 'cancelled'];

// Admins can edit the whole enquiry from the detail page. All fields optional.
export class UpdateSubscriptionDto {
  @IsOptional() @IsString() @MaxLength(120) contactName?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(160) organisation?: string;
  @IsOptional() @IsString() @MaxLength(6) pincode?: string;

  @IsOptional() @IsString() @IsIn(['Breakfast', 'Lunch/Dinner', 'Snacks']) mealSlot?: string;
  @IsOptional() @IsInt() @IsIn([3, 5, 8]) boxType?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100000) totalMeals?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) durationValue?: number;
  @IsOptional() @IsString() @IsIn(['days', 'weeks', 'months']) durationUnit?: string;
  @IsOptional() @IsString() @IsIn(['daily', 'weekdays', 'weekly', 'custom']) frequency?: string;
  @IsOptional() @IsString() @IsIn(['weekly', 'monthly']) paymentType?: string;
  @IsOptional() @IsString() @MaxLength(40) startDate?: string;
  @IsOptional() @IsString() @MaxLength(40) endDate?: string;
  @IsOptional() @IsBoolean() ongoing?: boolean;
  @IsOptional() @IsBoolean() reusableCarrier?: boolean;
  @IsOptional() @IsBoolean() coBranded?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) preferredCombos?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) nextWeekCombos?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ComboPlanDto) comboPlan?: ComboPlanDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DeliveryDto) deliveries?: DeliveryDto[];
  @IsOptional() @IsObject() payouts?: Record<string, any>;
  @IsOptional() @IsObject() weekPayments?: Record<string, any>;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) discountPct?: number;

  @IsOptional() @IsString() @IsIn(STATUSES) status?: string;
  @IsOptional() @IsString() @MaxLength(2000) adminNotes?: string;
}
