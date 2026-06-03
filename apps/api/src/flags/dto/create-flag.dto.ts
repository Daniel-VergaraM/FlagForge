import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

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
  rules?: Record<string, unknown>;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  rolloutPercentage?: number = 100;
}
