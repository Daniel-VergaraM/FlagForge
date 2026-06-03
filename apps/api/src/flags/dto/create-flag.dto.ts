import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class FlagRuleDto {
  @IsString()
  @IsNotEmpty()
  attribute: string;

  @IsIn(['eq', 'neq', 'gt', 'lt', 'in', 'contains'])
  operator: string;

  @IsNotEmpty()
  value: unknown;
}

export class FlagVariantDto {
  @IsNotEmpty()
  value: unknown;

  @IsInt()
  @Min(0)
  @Max(100)
  weight: number;
}

export class CreateFlagDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsIn(['BOOLEAN', 'MULTIVARIATE'])
  type: 'BOOLEAN' | 'MULTIVARIATE';

  @IsBoolean()
  @IsOptional()
  enabled?: boolean = false;

  @IsString()
  @IsNotEmpty()
  environmentId: string;

  @IsOptional()
  tags?: string[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FlagRuleDto)
  rules?: FlagRuleDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FlagVariantDto)
  variants?: FlagVariantDto[];

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  rolloutPercentage?: number = 100;
}
